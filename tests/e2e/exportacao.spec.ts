/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  centroDaFoto,
  criarProjeto,
  criarProjetoComEscalaLinear,
  criarProjetoComPerspectiva,
  enviarImagem,
  esperarPalco,
  fotoDaApi,
  idsDasFotos,
  nomeUnico,
  salvarVarianteApi,
  type ProjetoE2E,
} from './ajudantes';

// Exportação PNG/JPG (spec M4 §7, E2E 6, 7, 7b, 8 e 12; RF-80, RN-12, RN-19, PRD aceite 8, A-13 a A-20, A-28).
// A parede do cenário é frontal.jpg com 4 px/cm: 1200 × 900 px = 300 × 225 cm, 1 cm = 4 px.

const PX_POR_CM = 4;
const px = (cm: number) => Math.round(cm * PX_POR_CM);

interface Pixels {
  data: Buffer;
  largura: number;
  altura: number;
  formato: string | undefined;
}

async function decodificar(buffer: Buffer): Promise<Pixels> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await sharp(buffer).metadata();
  return { data, largura: info.width, altura: info.height, formato: meta.format };
}

const pixel = (img: Pixels, x: number, y: number): [number, number, number, number] => {
  const i = (y * img.largura + x) * 4;
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
};
const distancia = (a: number[], b: number[]) =>
  Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);

// Média de (R − (G+B)/2) numa região: o "quanto de vermelho" que a hachura acrescenta.
function vermelhidao(img: Pixels, x0: number, y0: number, x1: number, y1: number): number {
  let soma = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const [r, g, b] = pixel(img, x, y);
      soma += r - (g + b) / 2;
      n += 1;
    }
  }
  return soma / n;
}

async function paredeOriginal(request: APIRequestContext, p: ProjetoE2E): Promise<Pixels> {
  const res = await request.get(`/api/projetos/${p.id}/parede/arquivo?tipo=original&v=${p.revisao}`);
  return decodificar(Buffer.from(await res.body()));
}

interface Baixado {
  nome: string;
  img: Pixels;
}

async function exportar(
  page: Page,
  opcoes: { formato?: 'png' | 'jpg'; grid?: boolean } = {},
): Promise<Baixado> {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Exportar imagem' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByAltText('Prévia da exportação')).toBeVisible({ timeout: 20_000 });
  if (opcoes.formato === 'jpg') await dialogo.getByRole('radio', { name: 'JPG' }).click();
  if (opcoes.grid) await dialogo.getByRole('switch', { name: 'Incluir grid' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialogo.getByRole('button', { name: /^(Baixar|Aceitar e baixar)/ }).click(),
  ]);
  const caminho = await download.path();
  await expect(dialogo).toBeHidden();
  return { nome: download.suggestedFilename(), img: await decodificar(await readFile(caminho)) };
}

// Base com uma foto de borda magenta de 2 cm, um placeholder e uma foto que passa da parede.
async function cenarioPNG(request: APIRequestContext) {
  const nome = nomeUnico('Export');
  const p = await criarProjetoComEscalaLinear(request, nome);
  const imagem = await enviarImagem(request, p.id, 'retrato.jpg');
  const salvo = await salvarVarianteApi(request, p, [
    fotoDaApi(1, imagem._id, { xCm: 50, yCm: 50, borda: { larguraCm: 2, cor: '#FF00FF' } }),
    fotoDaApi(2, null, { xCm: 150, yCm: 50 }),
    fotoDaApi(3, imagem._id, { xCm: 295, yCm: 215 }),
  ]);
  expect(salvo.status()).toBe(200);
  return { p, nome, imagem, parede: await paredeOriginal(request, p) };
}

test.describe('exportar PNG (RF-80, RN-12, RN-19, PRD aceite 8)', () => {
  test('nome do arquivo, resolução da parede, foto com borda, placeholder hachurado e recorte nos limites', async ({
    page,
    request,
  }) => {
    const { p, nome, parede } = await cenarioPNG(request);
    expect(parede.largura).toBe(1200);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);

    const { nome: arquivo, img } = await exportar(page);

    // <projeto>-<variante>-AAAAMMDD-HHmm.png, com o projeto em slug.
    const slug = nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    expect(arquivo).toMatch(new RegExp(`^${slug}-base-\\d{8}-\\d{4}\\.png$`));
    expect(img.formato).toBe('png');
    // O que passa da parede é recortado: a saída é exatamente a parede inteira.
    expect([img.largura, img.altura]).toEqual([1200, 900]);

    // Borda magenta por fora e imagem por dentro (centro do retângulo impresso).
    const borda = pixel(img, px(51), px(60));
    expect(borda[0]).toBeGreaterThan(220);
    expect(borda[1]).toBeLessThan(40);
    expect(borda[2]).toBeGreaterThan(220);
    const dentro = pixel(img, px(57), px(59.5));
    expect(distancia(dentro, pixel(parede, px(57), px(59.5)))).toBeGreaterThan(20);

    // Placeholder: hachura vermelha no lugar.
    const antes = vermelhidao(parede, px(150), px(50), px(160), px(65));
    const depois = vermelhidao(img, px(150), px(50), px(160), px(65));
    expect(depois - antes).toBeGreaterThan(15);

    // Fora das fotos, a parede intocada: sem contorno de seleção, sem alças, sem alertas.
    for (const [x, y] of [
      [px(48), px(60)],
      [px(57), px(47)],
      [px(66), px(60)],
      [px(57), px(72)],
    ] as const) {
      expect(distancia(pixel(img, x, y), pixel(parede, x, y))).toBeLessThanOrEqual(12);
    }
  });

  test('sem contorno de seleção nem de alerta, mesmo com a foto selecionada e sobreposta/fora da parede', async ({
    page,
    request,
  }) => {
    const { p, parede } = await cenarioPNG(request);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    // Seleciona a foto da borda magenta (o editor desenha o contorno de seleção ao redor).
    const ids = await idsDasFotos(page);
    const centro = await centroDaFoto(page, ids[0]!);
    await page.mouse.click(centro.x, centro.y);
    await expect(page.getByRole('button', { name: 'Remover', exact: true })).toBeVisible();

    const { img } = await exportar(page);
    for (const [x, y] of [
      [px(49.5), px(60)],
      [px(66.5), px(60)],
      [px(57), px(48.5)],
    ] as const) {
      expect(distancia(pixel(img, x, y), pixel(parede, x, y))).toBeLessThanOrEqual(12);
    }
  });

  test('"Incluir grid" desenha as linhas; sem ele, a parede fica como é', async ({ page, request }) => {
    const { p, parede } = await cenarioPNG(request);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const sem = await exportar(page);
    const com = await exportar(page, { grid: true });

    // Passo de 5 cm = 20 px: a coluna 40 px (10 cm) é uma linha do grid; a 46 px, não (y = 102 cm cai entre
    // duas linhas horizontais).
    const linha = [px(10), px(102)] as const;
    const vazio = [px(11.5), px(102)] as const;
    expect(distancia(pixel(sem.img, ...linha), pixel(parede, ...linha))).toBeLessThanOrEqual(12);
    expect(distancia(pixel(com.img, ...linha), pixel(parede, ...linha))).toBeGreaterThan(3);
    expect(distancia(pixel(com.img, ...vazio), pixel(parede, ...vazio))).toBeLessThanOrEqual(12);
    // O grid fica abaixo das fotos: o centro da foto não leva linha por cima.
    const dentro = [px(57), px(60)] as const;
    expect(distancia(pixel(com.img, ...dentro), pixel(sem.img, ...dentro))).toBeLessThanOrEqual(6);
  });

  test('exporta o que está na tela, inclusive alterações não salvas (A-13)', async ({ page, request }) => {
    const { p } = await cenarioPNG(request);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const base = await exportar(page);
    // Adiciona mais uma foto sem salvar (no centro da área útil, com snap).
    await page
      .getByRole('complementary', { name: 'Biblioteca' })
      .getByRole('button', { name: 'retrato.jpg, Retrato' })
      .first()
      .click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText('Alterações não salvas').first()).toBeVisible();

    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await expect(
      page.getByText('Exporta o que está na tela, inclusive alterações não salvas.'),
    ).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Exportar imagem' })
      .getByRole('button', { name: 'Cancelar' })
      .click();

    const tela = await exportar(page);
    // A foto nova caiu perto do centro da parede (150 × 112,5 cm): o pixel muda em relação à exportação anterior.
    let diferentes = 0;
    for (let y = px(100); y < px(125); y += 4) {
      for (let x = px(140); x < px(160); x += 4) {
        if (distancia(pixel(tela.img, x, y), pixel(base.img, x, y)) > 20) diferentes += 1;
      }
    }
    expect(diferentes).toBeGreaterThan(20);
    // Nada foi gravado: a variante salva continua com 3 fotos.
    const salvas = (
      (await (await request.get(`/api/projetos/${p.id}`)).json()) as {
        variantes: { fotos: unknown[] }[];
      }
    ).variantes[0]!.fotos;
    expect(salvas).toHaveLength(3);
  });
});

test.describe('exportar JPG e a transparência (A-14)', () => {
  test('JPG tem o fundo branco onde o PNG é transparente', async ({ page, request }) => {
    const p = await criarProjetoComPerspectiva(request, nomeUnico('Export persp'), 100);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);

    const png = await exportar(page);
    expect(png.img.formato).toBe('png');
    expect(pixel(png.img, 10, 10)[3]).toBe(0);
    expect(pixel(png.img, 400, 400)[3]).toBe(255);

    const jpg = await exportar(page, { formato: 'jpg' });
    expect(jpg.nome.endsWith('.jpg')).toBe(true);
    expect(jpg.img.formato).toBe('jpeg');
    const canto = pixel(jpg.img, 10, 10);
    expect(Math.min(canto[0], canto[1], canto[2])).toBeGreaterThanOrEqual(245);
    expect(pixel(jpg.img, 400, 400)[3]).toBe(255);
  });
});

test.describe('nenhuma requisição fora de localhost (RNF-01)', () => {
  test('a exportação só fala com a própria origem', async ({ page, request, baseURL }) => {
    const { p } = await cenarioPNG(request);
    const externas: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith(baseURL!) && !url.startsWith('blob:') && !url.startsWith('data:'))
        externas.push(url);
    });
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await exportar(page);
    await exportar(page, { formato: 'jpg', grid: true });
    expect(externas).toEqual([]);
  });
});

// ---- Perfil Alto: acima de 16 MP o padrão é JPG e o PNG só depois do aceite (M4-18, A-28) ----

async function paredeAlto(request: APIRequestContext, ruidosa = false): Promise<ProjetoE2E> {
  const p = await criarProjeto(request, nomeUnico('Export Alto'));
  const largura = 6144;
  const altura = 4608;
  const jpgRuidoso = ruidosa
    ? await sharp({
        create: {
          width: largura,
          height: altura,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
          noise: { type: 'gaussian', mean: 128, sigma: 40 },
        },
      })
        .blur(0.8)
        .jpeg({ quality: 60 })
        .toBuffer()
    : null;
  const bruto = Buffer.alloc(largura * altura * 3);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * 3;
      bruto[i] = (x * 255) / largura;
      bruto[i + 1] = (y * 255) / altura;
      bruto[i + 2] = ((x + y) & 255) >> 1;
    }
  }
  const jpg =
    jpgRuidoso ??
    (await sharp(bruto, { raw: { width: largura, height: altura, channels: 3 } })
      .jpeg({ quality: 70 })
      .toBuffer());
  const parede = await request.put(`/api/projetos/${p.id}/parede`, {
    multipart: {
      perfil: 'alto',
      revisaoBase: String(p.revisao),
      arquivo: { name: 'parede-alto.jpg', mimeType: 'image/jpeg', buffer: jpg },
    },
    timeout: 120_000,
  });
  const revisao = ((await parede.json()) as { projeto: { revisao: number } }).projeto.revisao;
  await request.put(`/api/projetos/${p.id}/parede/escala`, {
    data: {
      revisaoBase: revisao,
      metodo: 'linear',
      linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
    },
  });
  return p;
}

test.describe('imagem grande: perfil Alto (M4-18, A-28, A-20)', () => {
  test('abre em JPG; PNG avisa e só gera depois do aceite', async ({ page, request }) => {
    test.setTimeout(240_000);
    const p = await paredeAlto(request);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);

    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Exportar imagem' });
    await expect(dialogo.getByRole('radio', { name: 'JPG' })).toBeChecked();
    await expect(dialogo.getByText('6144 × 4608 px')).toBeVisible();

    // Escolher PNG mostra o aviso e troca o botão; nada é gerado antes do clique.
    await dialogo.getByRole('radio', { name: 'PNG' }).click();
    await expect(dialogo.getByText(/Gerar PNG pode demorar bastante/)).toBeVisible();
    const geradas = () => page.evaluate(() => performance.getEntriesByName('deco:exportacao').length);
    expect(await geradas()).toBe(0);

    // JPG primeiro: meta de 8 s no Alto (A-20).
    await dialogo.getByRole('radio', { name: 'JPG' }).click();
    const [jpg] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      dialogo.getByRole('button', { name: 'Baixar JPG' }).click(),
    ]);
    expect((await sharp(await readFile(await jpg.path())).metadata()).width).toBe(6144);
    const tempoJpg = await page.evaluate(
      () => performance.getEntriesByName('deco:exportacao').at(-1)?.duration ?? null,
    );
    console.log(`Exportação JPG, perfil Alto (6144×4608): ${Math.round(tempoJpg ?? -1)} ms`);
    expect(tempoJpg).not.toBeNull();
    expect(tempoJpg!).toBeLessThanOrEqual(8000);

    // Agora o PNG, com o aceite.
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialogo2 = page.getByRole('dialog', { name: 'Exportar imagem' });
    await dialogo2.getByRole('radio', { name: 'PNG' }).click();
    const [png] = await Promise.all([
      page.waitForEvent('download', { timeout: 180_000 }),
      dialogo2.getByRole('button', { name: 'Aceitar e baixar PNG' }).click(),
    ]);
    const meta = await sharp(await readFile(await png.path())).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([6144, 4608, 'png']);
    const tempoPng = await page.evaluate(
      () => performance.getEntriesByName('deco:exportacao').at(-1)?.duration ?? null,
    );
    console.log(`Exportação PNG, perfil Alto (6144×4608): ${Math.round(tempoPng ?? -1)} ms`);
  });
});

test.describe('imagem grande com textura: pior caso do codificador (A-20, A-28)', () => {
  test('mede o JPG e o PNG do perfil Alto com ruído (registrado no MEMORY.md)', async ({ page, request }) => {
    test.setTimeout(300_000);
    const p = await paredeAlto(request, true);
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const tempos: Record<string, number> = {};
    for (const formato of ['jpg', 'png'] as const) {
      await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      const dialogo = page.getByRole('dialog', { name: 'Exportar imagem' });
      await dialogo.getByRole('radio', { name: formato.toUpperCase() }).click();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 240_000 }),
        dialogo.getByRole('button', { name: /^(Baixar|Aceitar e baixar)/ }).click(),
      ]);
      const meta = await sharp(await readFile(await download.path())).metadata();
      expect(meta.width).toBe(6144);
      tempos[formato] = await page.evaluate(
        () => performance.getEntriesByName('deco:exportacao').at(-1)?.duration ?? -1,
      );
    }
    console.log(
      `Exportação com ruído, perfil Alto (6144×4608): JPG ${Math.round(tempos.jpg!)} ms · PNG ${Math.round(tempos.png!)} ms`,
    );
    expect(tempos.jpg!).toBeLessThanOrEqual(8000);
  });
});
