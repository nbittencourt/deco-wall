/// <reference lib="dom" />
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { cantosPadrao } from '../../packages/domain/src/index';
import {
  arrastar,
  centroDaFoto,
  criarProjeto,
  criarProjetoComEscalaLinear,
  enviarImagem,
  esperarPalco,
  fotoDaApi,
  idsDasFotos,
  lerProjeto,
  nomeUnico,
  salvarVarianteApi,
} from './ajudantes';

// Desempenho da retificação (spec M1 §4.2, §7, aceites 9 e 12; ARCHITECTURE §8 e ADR-16). O tempo é lido do
// User Timing `deco:retificacao`, medido no app em volta do Worker (warp + codificação WebP), e registrado
// no MEMORY.md. Perfil Leve (o padrão): meta de 3 s. Perfil Alto: a meta de 3 s não é atingida em 28 MP
// (ADR-16); o teste guarda contra regressões com o teto da ADR e imprime o tempo medido.

const META_MS = 3000;
const TETO_ALTO_MS = 4500; // ADR-16

async function fotoSintetica(largura: number, altura: number): Promise<string> {
  const bruto = Buffer.alloc(largura * altura * 3);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * 3;
      bruto[i] = (x * 255) / largura;
      bruto[i + 1] = (y * 255) / altura;
      bruto[i + 2] = ((x + y) & 255) >> 1;
    }
  }
  const pasta = await mkdtemp(join(tmpdir(), 'deco-wall-desempenho-'));
  const arquivo = join(pasta, `parede-${largura}x${altura}.jpg`);
  await writeFile(
    arquivo,
    await sharp(bruto, { raw: { width: largura, height: altura, channels: 3 } })
      .jpeg({ quality: 70 })
      .toBuffer(),
  );
  return arquivo;
}

async function medirRetificacao(
  page: Page,
  request: Parameters<typeof criarProjeto>[0],
  perfil: 'Leve' | 'Alto',
  largura: number,
  altura: number,
): Promise<number> {
  const p = await criarProjeto(request, nomeUnico(`Desempenho ${perfil}`));
  const arquivo = await fotoSintetica(largura, altura);

  page.on('console', (mensagem) => {
    if (mensagem.text().startsWith('[retificacao]')) console.log(mensagem.text());
  });

  await page.goto(`/projetos/${p.id}`);
  await page.getByRole('radiogroup', { name: 'Qualidade' }).getByRole('radio', { name: perfil }).click();
  await page.getByLabel('Foto da parede').setInputFiles(arquivo);
  await expect(page.getByText('Correção de perspectiva')).toBeVisible({ timeout: 60_000 });
  await esperarPalco(page);

  // Cantos a 12% / 88% (as alças já nascem a 25% / 75%). O servidor limita o perfil Leve a 3072 px.
  const reducao = perfil === 'Leve' ? Math.min(1, 3072 / Math.max(largura, altura)) : 1;
  const L = largura * reducao;
  const A = altura * reducao;
  const prontas = cantosPadrao(L, A);
  const alvo = [
    { x: L * 0.12, y: A * 0.12 },
    { x: L * 0.88, y: A * 0.14 },
    { x: L * 0.9, y: A * 0.88 },
    { x: L * 0.1, y: A * 0.86 },
  ];
  for (let i = 0; i < 4; i++) await arrastar(page, prontas[i]!, alvo[i]!);
  await page.getByLabel('Largura').fill('400');
  await page.getByLabel('Altura').fill('300');

  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('Aplicando perspectiva…')).toBeHidden({ timeout: 90_000 });

  const duracaoMs = await page.evaluate(() => {
    const medidas = performance.getEntriesByName('deco:retificacao');
    return medidas.length > 0 ? medidas[medidas.length - 1]!.duration : null;
  });
  expect(duracaoMs, 'o app precisa registrar performance.measure("deco:retificacao")').not.toBeNull();
  test
    .info()
    .annotations.push({ type: `retificacao-${perfil}-ms`, description: String(Math.round(duracaoMs!)) });
  console.log(`Retificação perfil ${perfil} (${largura}×${altura}): ${Math.round(duracaoMs!)} ms`);
  return duracaoMs!;
}

test('retificação no perfil Leve (padrão) leva até 3 s', async ({ page, request }) => {
  test.setTimeout(120_000);
  expect(await medirRetificacao(page, request, 'Leve', 4000, 3000)).toBeLessThanOrEqual(META_MS);
});

test('retificação no perfil Alto (28 MP) fica dentro do teto da ADR-16', async ({ page, request }) => {
  test.setTimeout(120_000);
  const duracao = await medirRetificacao(page, request, 'Alto', 6144, 4608);
  // Meta de 3 s (ARCHITECTURE §8) não atingida em 28 MP: ver ADR-16.
  expect(duracao).toBeLessThanOrEqual(TETO_ALTO_MS);
});

// Arrastar com 40 fotos (RNF-03, ARCHITECTURE §8: 60 fps, mínimo 50). A sonda conta os quadros que o
// navegador desenha durante um arrasto longo (o Playwright envia os movimentos o mais rápido que pode) e
// imprime os números. O teste só guarda contra regressões grosseiras; o valor medido vai para o MEMORY.md.
const TETO_QUADRO_MEDIO_MS = 33; // ≥ 30 fps de média

test.describe('arrastar com 40 fotos (RNF-03)', () => {
  test('taxa de quadros durante o arrasto', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Desempenho 40 fotos'));
    const imagem = await enviarImagem(request, p.id, 'retrato.jpg');
    const atual = (await lerProjeto(request, p.id)).variantes[0]!;
    const fotos = Array.from({ length: 40 }, (_, i) => ({
      _id: (i + 1).toString(16).padStart(24, '0'),
      imagemId: imagem._id,
      imagemAnteriorId: null,
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      xCm: 10 + (i % 8) * 30,
      yCm: 10 + Math.floor(i / 8) * 40,
      recorte: { offsetX: 0, offsetY: 0 },
      borda: { larguraCm: 1, cor: '#FFFFFF' },
    }));
    const salvo = await request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}`, {
      data: {
        sessaoId: 'e2e',
        revisaoBase: atual.revisao,
        grid: { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 },
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: atual.areaUtil,
        fotos,
      },
    });
    expect(salvo.status()).toBe(200);

    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const ids = await idsDasFotos(page);
    expect(ids.length).toBe(40);
    // Deixa as 40 imagens carregarem antes de medir.
    await page.waitForTimeout(1500);

    const centro = await centroDaFoto(page, ids[0]!);
    await page.evaluate(() => {
      const w = window as unknown as { __quadros: number[]; __parar: boolean };
      w.__quadros = [];
      w.__parar = false;
      const laco = (t: number) => {
        w.__quadros.push(t);
        if (!w.__parar) requestAnimationFrame(laco);
      };
      requestAnimationFrame(laco);
    });
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down();
    for (let volta = 0; volta < 3; volta += 1) {
      await page.mouse.move(centro.x + 300, centro.y + 150, { steps: 60 });
      await page.mouse.move(centro.x, centro.y, { steps: 60 });
    }
    await page.mouse.up();
    const quadros = await page.evaluate(() => {
      const w = window as unknown as { __quadros: number[]; __parar: boolean };
      w.__parar = true;
      return w.__quadros;
    });

    const intervalos = quadros.slice(1).map((t, i) => t - quadros[i]!);
    const medio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const ordenados = [...intervalos].sort((a, b) => a - b);
    const p95 = ordenados[Math.floor(ordenados.length * 0.95)]!;
    console.log(
      `[arrasto 40 fotos] ${quadros.length} quadros · média ${medio.toFixed(1)} ms (${(1000 / medio).toFixed(0)} fps) · p95 ${p95.toFixed(1)} ms`,
    );
    expect(medio).toBeLessThanOrEqual(TETO_QUADRO_MEDIO_MS);
  });
});

// Upload em lote de 50 fotos no perfil Leve (spec M2 §7): até 1 s por foto, do clique à última concluída.
// O tempo total entra no MEMORY.md.
const META_UPLOAD_MS_POR_FOTO = 1000;

test.describe('upload de 50 fotos (spec M2 §7)', () => {
  test('perfil Leve, até 1 s por foto', async ({ page, request }) => {
    test.setTimeout(180_000);
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Desempenho upload'));
    // Fotos de câmera: 4000 × 3000 (12 MP), que o servidor reduz a 1024 px (as fixtures do repositório são pequenas).
    const grande = await readFile(await fotoSintetica(4000, 3000));
    const arquivos = Array.from({ length: 50 }, (_, i) => ({
      name: `${String(i).padStart(2, '0')}-camera.jpg`,
      mimeType: 'image/jpeg',
      buffer: grande,
    }));

    await page.goto(`/projetos/${p.id}`);
    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });
    const inicio = Date.now();
    await dialogo.getByTestId('entrada-arquivos').setInputFiles(arquivos);
    await expect(dialogo.getByText('50 de 50 enviadas')).toBeVisible({ timeout: 120_000 });
    const total = Date.now() - inicio;
    console.log(
      `[upload 50 fotos Leve, 12 MP] ${total} ms no total · ${(total / 50).toFixed(0)} ms por foto`,
    );
    expect(total / 50).toBeLessThanOrEqual(META_UPLOAD_MS_POR_FOTO);
  });
});

// Memória com 40 fotos no perfil Leve (ARCHITECTURE §8; spec M2 §7): menos de 300 MB acima do navegador vazio.
// Mede a soma da memória (conjunto de trabalho) dos processos do Chromium no Windows, antes e depois de abrir
// as 40 fotos, que inclui as imagens decodificadas; com o perfil Alto o orçamento não se aplica.
const ORCAMENTO_MEMORIA_MB = 300;

async function memoriaDoNavegadorMb(): Promise<number | null> {
  if (process.platform !== 'win32') return null;
  const comando =
    "(Get-Process | Where-Object { $_.ProcessName -match 'chrome|headless_shell' } | Measure-Object WorkingSet64 -Sum).Sum";
  const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-Command', comando]);
  const bytes = Number(stdout.trim());
  return Number.isFinite(bytes) ? bytes / (1024 * 1024) : null;
}

test.describe('memória com 40 fotos (spec M2 §7)', () => {
  test('perfil Leve, menos de 300 MB acima do navegador vazio', async ({ page, request }) => {
    test.setTimeout(120_000);
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Desempenho memória'));
    const grande = await readFile(await fotoSintetica(4000, 3000));
    const imagens = [];
    for (let i = 0; i < 40; i += 1) {
      const res = await request.post('/api/imagens', {
        multipart: {
          perfil: 'leve',
          projetoId: p.id,
          arquivo: { name: `camera-${i}.jpg`, mimeType: 'image/jpeg', buffer: grande },
        },
      });
      imagens.push((await res.json()) as { _id: string });
    }
    const fotos = imagens.map((imagem, i) =>
      fotoDaApi(i + 1, imagem._id, {
        xCm: 10 + (i % 8) * 30,
        yCm: 10 + Math.floor(i / 8) * 40,
        borda: { larguraCm: 1, cor: '#FFFFFF' },
      }),
    );
    expect((await salvarVarianteApi(request, p, fotos)).status()).toBe(200);

    await page.goto('about:blank');
    const antes = await memoriaDoNavegadorMb();
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    expect((await idsDasFotos(page)).length).toBe(40);
    await page.waitForTimeout(4000); // as 40 imagens carregam e decodificam

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const heapMb = (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / (1024 * 1024);
    const depois = await memoriaDoNavegadorMb();
    const delta = antes !== null && depois !== null ? depois - antes : null;
    console.log(
      `[memória 40 fotos Leve] heap JS ${heapMb.toFixed(0)} MB · navegador ${antes?.toFixed(0)} → ${depois?.toFixed(0)} MB (acréscimo ${delta?.toFixed(0)} MB)`,
    );
    expect(heapMb).toBeLessThan(ORCAMENTO_MEMORIA_MB);
    if (delta !== null) expect(delta).toBeLessThan(ORCAMENTO_MEMORIA_MB);
  });
});
