/// <reference lib="dom" />
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  anotacoesDaCena,
  arrastar,
  criarProjetoComEscalaLinear,
  enviarImagem,
  esperarPalco,
  idsDasFotos,
  lerCampo,
  lerProjeto,
  nomeUnico,
  retanguloDaFoto,
  type ProjetoE2E,
} from './ajudantes';

// Variantes, templates, salvamento e comparação (spec M3 §7; PRD aceite 3, 4, 7, 11 e 12; RF-71, RF-73, RF-91 a
// RF-93, RN-23, RN-29 a RN-32). A parede do cenário é frontal.jpg com 4 px/cm: parede inteira = área útil = 300 × 225 cm.

const GRID = { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 };

interface VarianteApi {
  _id: string;
  nome: string;
  revisao: number;
  ordem: number;
  bordaPadrao: { larguraCm: number; cor: string };
  templateOrigem?: string | null;
  areaUtil: { xCm: number; yCm: number; larguraCm: number; alturaCm: number } | null;
  fotos: {
    _id: string;
    imagemId: string | null;
    tamanho: { sugeridoId: string | null; larguraCm: number; alturaCm: number };
  }[];
}

async function variantes(request: APIRequestContext, p: ProjetoE2E): Promise<VarianteApi[]> {
  const res = await request.get(`/api/projetos/${p.id}`);
  return ((await res.json()) as { variantes: VarianteApi[] }).variantes;
}

async function criarVarianteApi(
  request: APIRequestContext,
  p: ProjetoE2E,
  nome: string,
  origem: Record<string, unknown> = { tipo: 'vazia' },
): Promise<VarianteApi> {
  const base = (await variantes(request, p))[0]!;
  const res = await request.post(`/api/projetos/${p.id}/variantes`, {
    data: {
      sessaoId: 'e2e-api',
      nome,
      grid: GRID,
      bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
      areaUtil: base.areaUtil,
      origem,
    },
  });
  return ((await res.json()) as { variante: VarianteApi }).variante;
}

async function abrir(page: Page, p: ProjetoE2E) {
  await page.goto(`/projetos/${p.id}`);
  await esperarPalco(page);
}

const gatilho = (page: Page) => page.getByRole('button', { name: /^Variante: / });

async function abrirSeletor(page: Page) {
  await gatilho(page).click();
}

async function criarEmBranco(page: Page, nome?: string) {
  await abrirSeletor(page);
  await page.getByRole('button', { name: 'Nova variante em branco…' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Nova variante' });
  if (nome) await dialogo.getByRole('textbox').fill(nome);
  await dialogo.getByRole('button', { name: 'Criar variante' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const biblioteca = (page: Page) => page.getByRole('complementary', { name: 'Biblioteca' });

async function adicionarFoto(page: Page, nome = 'retrato.jpg') {
  await biblioteca(page)
    .getByRole('button', { name: `${nome}, Retrato` })
    .first()
    .click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
}

test.describe('variantes (RF-91, RN-23)', () => {
  test('criar em branco, renomear, alternar e excluir; a última não se exclui', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Variantes'));
    await abrir(page, p);

    await criarEmBranco(page);
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Variante 2');
    expect(await variantes(request, p)).toHaveLength(2);

    await abrirSeletor(page);
    await page.getByRole('button', { name: 'Ações de Variante 2' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    const renomear = page.getByRole('dialog', { name: 'Renomear variante' });
    await renomear.getByRole('textbox').fill('Sala escura');
    await renomear.getByRole('button', { name: 'Renomear' }).click();
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Sala escura');

    await abrirSeletor(page);
    await page.getByRole('dialog').getByRole('button', { name: /^Base/ }).click();
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Base');

    await abrirSeletor(page);
    await page.getByRole('button', { name: 'Ações de Sala escura' }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    const excluir = page.getByRole('dialog', { name: 'Excluir variante' });
    await excluir.getByRole('button', { name: 'Excluir variante' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await variantes(request, p)).toHaveLength(1);

    await abrirSeletor(page);
    await page.getByRole('button', { name: 'Ações de Base' }).click();
    await expect(page.getByRole('menuitem', { name: 'Excluir' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('desfazer é independente por variante, e a pilha de A sobrevive à ida a B (PRD aceite 12)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Desfazer'));
    await enviarImagem(request, p.id, 'retrato.jpg');
    await abrir(page, p);

    await adicionarFoto(page);
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(1);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/^Salvo às/)).toBeVisible();

    await criarEmBranco(page);
    await adicionarFoto(page);
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(1);
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(0);

    await abrirSeletor(page);
    await page.getByRole('dialog').getByRole('button', { name: /^Base/ }).click();
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(1);
    // A pilha de A continua ali: desfazer tira a foto adicionada em A.
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(0);
  });

  test('fechar e reabrir restaura as variantes, as posições e a variante aberta (PRD aceite 7)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Reabrir'));
    await enviarImagem(request, p.id, 'retrato.jpg');
    await abrir(page, p);
    await criarEmBranco(page, 'Segunda');
    await adicionarFoto(page);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/^Salvo às/)).toBeVisible();

    await page.reload();
    await esperarPalco(page);
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Segunda');
    await expect.poll(async () => (await idsDasFotos(page)).length).toBe(1);
  });
});

test.describe('templates (RF-93, RN-29 a RN-32; PRD aceite 3 e 4)', () => {
  async function galeria(page: Page) {
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    return page.getByRole('dialog', { name: /Escolher template/ });
  }

  test('Pirâmide: galeria, posicionamento com snap, confirmação e vagas nos tamanhos do catálogo', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Pirâmide'));
    await abrir(page, p);
    const base = (await variantes(request, p))[0]!;

    const g = await galeria(page);
    await expect(g.getByRole('radio')).toHaveCount(12);
    await g.getByRole('button', { name: 'Posicionar na parede' }).click();
    await expect(page.getByText('Posicionar template · Pirâmide')).toBeVisible();
    await expect(page.getByText('6 vagas · nova variante “Pirâmide”')).toBeVisible();

    // Arrasta o conjunto 20 cm para a direita e 10 para baixo: o canto superior esquerdo encaixa no grid de 5 cm.
    const x0 = await lerCampo(page, 'X');
    const y0 = await lerCampo(page, 'Y');
    const centro = { x: x0 + 151 / 2, y: y0 + 70.6 / 2 };
    await arrastar(page, centro, { x: centro.x + 20, y: centro.y + 10 });
    const x1 = await lerCampo(page, 'X');
    const y1 = await lerCampo(page, 'Y');
    expect(x1 % 5).toBeCloseTo(0, 5);
    expect(y1 % 5).toBeCloseTo(0, 5);
    expect(x1).not.toBe(x0);

    await page.getByRole('button', { name: 'Confirmar posição' }).click();
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Pirâmide');
    await expect(gatilho(page)).toContainText('6 sem foto');

    const todas = await variantes(request, p);
    const piramide = todas.find((v) => v.nome === 'Pirâmide')!;
    expect(piramide.templateOrigem).toBe('piramide');
    expect(piramide.areaUtil).toEqual(base.areaUtil);
    expect(piramide.fotos.map((f) => `${f.tamanho.larguraCm}x${f.tamanho.alturaCm}`)).toEqual([
      '20x30',
      '20x30',
      '20x30',
      '20x30',
      '20x30',
      '30x20',
    ]);
    expect(piramide.fotos.every((f) => f.imagemId === null)).toBe(true);
  });

  test('borda de 2 cm recalcula os tamanhos (Escada: a segunda vaga vira 15 × 21)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Escada'));
    await abrir(page, p);
    const g = await galeria(page);
    await g.getByRole('radio', { name: /^Escada/ }).click();
    const campo = g.getByRole('textbox', { name: 'Borda das fotos' });
    await campo.fill('2');
    await campo.press('Enter');
    await g.getByRole('button', { name: 'Posicionar na parede' }).click();
    await page.getByRole('button', { name: 'Confirmar posição' }).click();
    await expect(gatilho(page)).toHaveAccessibleName('Variante: Escada');

    const escada = (await variantes(request, p)).find((v) => v.nome === 'Escada')!;
    expect(escada.bordaPadrao.larguraCm).toBe(2);
    expect(escada.fotos[1]!.tamanho).toMatchObject({ sugeridoId: '15x21', larguraCm: 15, alturaCm: 21 });
  });

  test('template maior que a área útil: aviso, mas a confirmação segue liberada', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Grande'));
    // Área útil pequena na Base.
    const base = (await variantes(request, p))[0]!;
    await request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}`, {
      data: {
        sessaoId: 'e2e-api',
        revisaoBase: base.revisao,
        grid: GRID,
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: { xCm: 20, yCm: 20, larguraCm: 100, alturaCm: 60 },
        fotos: [],
      },
    });
    await abrir(page, p);
    const g = await galeria(page);
    await expect(g.getByRole('radio', { name: /^Pirâmide/ })).toContainText('Maior que a área útil');
    await g.getByRole('button', { name: 'Posicionar na parede' }).click();
    await expect(page.getByText(/O template é maior que a área útil/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar posição' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Escolher template/ })).toBeVisible();
  });

  test('preencher vaga pelo botão e por arraste; a vaga mantém formato e posição (M3-01)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Vagas'));
    await enviarImagem(request, p.id, 'retrato.jpg');
    await criarVarianteApi(request, p, 'Trio', {
      tipo: 'template',
      templateId: 'trio',
      posicaoCm: { xCm: 100, yCm: 80 },
      borda: { larguraCm: 0, cor: '#FFFFFF' },
    });
    await abrir(page, p);
    await expect(gatilho(page)).toContainText('3 sem foto');
    const ids = await idsDasFotos(page);
    expect(ids).toHaveLength(3);

    // Botão: seleciona a primeira vaga, escolhe a miniatura e preenche.
    const r0 = (await retanguloDaFoto(page, ids[0]!))!;
    await page.mouse.click(r0.x + r0.largura / 2, r0.y + r0.altura / 2);
    await biblioteca(page).getByRole('button', { name: 'retrato.jpg, Retrato' }).first().click();
    await page.getByRole('button', { name: 'Preencher com a foto selecionada' }).click();
    await expect(gatilho(page)).toContainText('2 sem foto');
    expect((await anotacoesDaCena(page)).filter((a) => a.tipo === 'placeholder')).toHaveLength(2);
    const depois = (await retanguloDaFoto(page, ids[0]!))!;
    expect(Math.abs(depois.x - r0.x)).toBeLessThan(1);
    expect(Math.abs(depois.largura - r0.largura)).toBeLessThan(1);

    // Arraste: solta a miniatura sobre a segunda vaga.
    const r1 = (await retanguloDaFoto(page, ids[1]!))!;
    const palco = page.getByTestId('palco');
    const caixa = (await palco.boundingBox())!;
    await biblioteca(page)
      .getByRole('button', { name: 'retrato.jpg, Retrato' })
      .first()
      .dragTo(palco, {
        targetPosition: { x: r1.x + r1.largura / 2 - caixa.x, y: r1.y + r1.altura / 2 - caixa.y },
      });
    await expect(gatilho(page)).toContainText('1 sem foto');
    expect(await idsDasFotos(page)).toHaveLength(3);
  });
});

test.describe('salvamento automático e recuperação (RF-71, SV-01, SV-07)', () => {
  test('o rascunho é gravado a cada AUTOSAVE_MINUTOS e o Salvar o apaga', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Autosave'));
    await page.clock.install();
    await page.goto(`/projetos/${p.id}`);
    await page.clock.resume();
    await esperarPalco(page);

    await page.getByRole('switch', { name: 'Mostrar grid' }).click();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await page.clock.fastForward('05:05');
    await expect(page.getByText(/^Rascunho salvo às/)).toBeVisible();
    const comRascunho = (await (await request.get(`/api/projetos/${p.id}`)).json()) as {
      rascunhos: unknown[];
    };
    expect(comRascunho.rascunhos).toHaveLength(1);

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/^Salvo às/)).toBeVisible();
    const depois = (await (await request.get(`/api/projetos/${p.id}`)).json()) as { rascunhos: unknown[] };
    expect(depois.rascunhos).toHaveLength(0);
  });

  test('recuperar um rascunho mais novo que a versão salva', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Recuperar'));
    const base = (await variantes(request, p))[0]!;
    const res = await request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}/rascunho`, {
      data: {
        sessaoId: 'aba-antiga',
        revisaoBase: base.revisao,
        conteudo: {
          grid: GRID,
          bordaPadrao: { larguraCm: 3, cor: '#FFFFFF' },
          areaUtil: base.areaUtil,
          fotos: [],
        },
      },
    });
    expect(res.status()).toBe(200);

    await page.goto(`/projetos/${p.id}`);
    const dialogo = page.getByRole('dialog', { name: /Recuperar alterações não salvas de/ });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Recuperar' }).click();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
  });
});

test.describe('conflito entre abas (RF-73, RN-26, SV-04 a SV-06)', () => {
  async function duasAbas(page: Page, p: ProjetoE2E) {
    const outra = await page.context().newPage();
    await abrir(page, p);
    await abrir(outra, p);
    return outra;
  }

  test('a segunda aba a salvar vê o diálogo; só a palavra digitada libera "Manter a minha"', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Conflito'));
    const revisaoInicial = (await variantes(request, p))[0]!.revisao;
    const b = await duasAbas(page, p);

    await page.getByRole('switch', { name: 'Mostrar grid' }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/^Salvo às/)).toBeVisible();

    await b.getByRole('switch', { name: 'Mostrar grid' }).click();
    await b.getByRole('button', { name: 'Salvar', exact: true }).click();
    const dialogo = b.getByRole('dialog');
    await expect(dialogo.getByText('Esta variante foi salva em outra aba')).toBeVisible();
    const manter = dialogo.getByRole('button', { name: 'Manter a minha' });
    await expect(manter).toHaveAttribute('aria-disabled', 'true');
    await dialogo.getByRole('textbox', { name: 'Para confirmar, digite a palavra da opção' }).fill('minha');
    await expect(manter).not.toHaveAttribute('aria-disabled', 'true');
    await manter.click();
    await expect(b.getByRole('dialog')).toHaveCount(0);
    await expect(b.getByText(/^Salvo às/)).toBeVisible();
    // A salvou (+1) e a B manteve a dela sobre a revisão do servidor (+1).
    expect((await variantes(request, p))[0]!.revisao).toBe(revisaoInicial + 2);
  });

  test('"Salvar a minha como nova variante" guarda o conteúdo e a original mostra a salva', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Conflito nova'));
    const b = await duasAbas(page, p);

    await page.getByRole('switch', { name: 'Mostrar grid' }).click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText(/^Salvo às/)).toBeVisible();

    await b.getByRole('switch', { name: 'Mostrar grid' }).click();
    await b.getByRole('button', { name: 'Salvar', exact: true }).click();
    const dialogo = b.getByRole('dialog');
    await dialogo.getByRole('textbox', { name: 'Para confirmar, digite a palavra da opção' }).fill('nova');
    await dialogo.getByRole('button', { name: 'Salvar a minha como nova variante' }).click();
    await expect(b.getByRole('dialog')).toHaveCount(0);
    await expect(gatilho(b)).toHaveAccessibleName(/^Variante: Base \(cópia \d{2}:\d{2}\)$/);
    expect(await variantes(request, p)).toHaveLength(2);
  });

  test('conflito achado no rascunho: aviso com "Resolver…" e o autosave fica suspenso', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Conflito rascunho'));
    await page.clock.install();
    await page.goto(`/projetos/${p.id}`);
    await page.clock.resume();
    await esperarPalco(page);
    await page.getByRole('switch', { name: 'Mostrar grid' }).click();

    // Outra aba (aqui, a API) salva a variante antes do tick do rascunho.
    const base = (await variantes(request, p))[0]!;
    await request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}`, {
      data: {
        sessaoId: 'outra-aba',
        revisaoBase: base.revisao,
        grid: GRID,
        bordaPadrao: { larguraCm: 1, cor: '#FFFFFF' },
        areaUtil: base.areaUtil,
        fotos: [],
      },
    });
    await page.clock.fastForward('05:05');
    const aviso = page.getByRole('alert');
    await expect(aviso).toContainText('Esta variante foi salva em outra aba às');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await aviso.getByRole('button', { name: 'Resolver…' }).click();
    await expect(page.getByRole('dialog').getByText('Esta variante foi salva em outra aba')).toBeVisible();
  });
});

test.describe('comparação (RF-92, ADR-12; PRD aceite 11)', () => {
  const viewportsDosPalcos = (page: Page) =>
    page.getByTestId('palco').evaluateAll((el) => el.map((e) => e.getAttribute('data-viewport')));

  test('zoom e pan em um painel se repetem no outro; Parede inteira enquadra os dois', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Comparar'));
    await criarVarianteApi(request, p, 'Variante 2');
    await page.goto(`/projetos/${p.id}/comparar`);
    await expect(page.getByText('Somente visualização')).toBeVisible();
    await expect(page.getByTestId('palco')).toHaveCount(2);

    await expect.poll(async () => (await viewportsDosPalcos(page)).every(Boolean)).toBe(true);
    const inicial = await viewportsDosPalcos(page);
    expect(inicial[0]).toBe(inicial[1]);

    // Roda do mouse no painel esquerdo: o zoom aparece nos dois.
    const caixa = (await page.getByTestId('palco').first().boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => (await viewportsDosPalcos(page))[0]).not.toBe(inicial[0]);
    const aposZoom = await viewportsDosPalcos(page);
    expect(aposZoom[1]).toBe(aposZoom[0]);

    // Pan arrastando o fundo do painel direito: os dois acompanham.
    const direita = (await page.getByTestId('palco').nth(1).boundingBox())!;
    await page.mouse.move(direita.x + 40, direita.y + 40);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(direita.x + 120, direita.y + 90, { steps: 6 });
    await page.mouse.up({ button: 'middle' });
    await expect.poll(async () => (await viewportsDosPalcos(page))[0]).not.toBe(aposZoom[0]);
    const aposPan = await viewportsDosPalcos(page);
    expect(aposPan[1]).toBe(aposPan[0]);

    await page.getByRole('button', { name: 'Parede inteira' }).click();
    await expect.poll(async () => (await viewportsDosPalcos(page))[0]).toBe(inicial[0]);
    const final = await viewportsDosPalcos(page);
    expect(final[1]).toBe(final[0]);
  });

  test('é somente visualização: Voltar ao editor leva ao editor, sem salvar nada', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Comparar leitura'));
    await criarVarianteApi(request, p, 'Variante 2');
    await page.goto(`/projetos/${p.id}/comparar`);
    await expect(page.getByRole('switch', { name: 'Grid' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao editor' }).click();
    await expect(page).toHaveURL(new RegExp(`/projetos/${p.id}$`));
    await esperarPalco(page);
    expect((await lerProjeto(request, p.id)).variantes).toHaveLength(2);
  });

  test('o botão Comparar do editor abre a comparação quando há 2 variantes', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Comparar botão'));
    await abrir(page, p);
    await expect(page.getByRole('button', { name: 'Comparar', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await criarEmBranco(page);
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projetos/${p.id}/comparar$`));
    await expect(page.getByTestId('palco')).toHaveCount(2);
    // A tela anterior não foi recarregada: as duas variantes continuam à escolha.
    await expect(page.getByRole('combobox', { name: 'Variante do painel esquerdo' })).toBeVisible();
  });
});
