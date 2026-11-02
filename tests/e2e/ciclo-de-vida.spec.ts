/// <reference lib="dom" />
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  centroDaFoto,
  criarProjetoComEscalaLinear,
  enviarImagem,
  esperarPalco,
  fotoDaApi,
  idsDasFotos,
  lerProjeto,
  nomeUnico,
  salvarVarianteApi,
  type ProjetoE2E,
} from './ajudantes';

// Ciclo de vida das imagens (spec M4 §7, E2E 1 a 5; RF-28, RF-29, RF-30a, RN-24, M4-03 a M4-08, A-03, A-11).
// A parede do cenário é frontal.jpg com 4 px/cm. O banco de teste é compartilhado: cada teste cria as próprias
// imagens (as mais recentes vêm primeiro na biblioteca, daí o `.first()`).

const GRID = { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 };

const biblioteca = (page: Page) => page.getByRole('complementary', { name: 'Biblioteca' });

interface FotoApi {
  _id: string;
  imagemId: string | null;
  imagemAnteriorId: string | null;
  xCm: number;
  yCm: number;
  tamanho: { sugeridoId: string | null; larguraCm: number; alturaCm: number };
}
interface VarianteApi {
  _id: string;
  nome: string;
  revisao: number;
  fotos: FotoApi[];
}

async function variantes(request: APIRequestContext, p: ProjetoE2E): Promise<VarianteApi[]> {
  return (await lerProjeto(request, p.id)).variantes as unknown as VarianteApi[];
}

async function criarVariante(request: APIRequestContext, p: ProjetoE2E, nome: string, fotos: unknown[]) {
  const base = (await variantes(request, p))[0]!;
  const res = await request.post(`/api/projetos/${p.id}/variantes`, {
    data: {
      sessaoId: 'e2e-api',
      nome,
      grid: GRID,
      bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
      areaUtil: (base as unknown as { areaUtil: unknown }).areaUtil,
      origem: { tipo: 'copia', fotos },
    },
  });
  return ((await res.json()) as { variante: VarianteApi }).variante;
}

// Projeto com duas imagens: a Base usa a "retrato" 2× e a "paisagem" 1×; a "Alternativa" usa a "retrato" 1×.
async function cenario(request: APIRequestContext, prefixo: string) {
  const p = await criarProjetoComEscalaLinear(request, nomeUnico(prefixo));
  const retrato = await enviarImagem(request, p.id, 'retrato.jpg');
  const paisagem = await enviarImagem(request, p.id, 'paisagem.jpg');
  const salvo = await salvarVarianteApi(request, p, [
    fotoDaApi(1, retrato._id, { xCm: 50, yCm: 50 }),
    fotoDaApi(2, retrato._id, { xCm: 100, yCm: 50 }),
    fotoDaApi(3, paisagem._id, { xCm: 150, yCm: 50 }),
  ]);
  expect(salvo.status()).toBe(200);
  const alternativa = await criarVariante(request, p, 'Alternativa', [fotoDaApi(4, retrato._id)]);
  // Criar uma variante a torna a "última aberta": o editor deve abrir na Base.
  await request.patch(`/api/projetos/${p.id}`, { data: { ultimaVarianteId: p.varianteId } });
  return { p, retrato, paisagem, alternativa };
}

async function abrirMenuDaImagem(page: Page, nome: string) {
  const menu = biblioteca(page)
    .getByRole('button', { name: `Mais ações de ${nome}` })
    .first();
  await menu.click();
  await page.getByRole('menuitem', { name: 'Remover ou excluir…' }).click();
}

test.describe('remover deste projeto (RF-29, M4-04)', () => {
  test('as fotos somem das variantes, a imagem continua na biblioteca e a pilha de desfazer zera', async ({
    page,
    request,
  }) => {
    const { p, retrato, alternativa } = await cenario(request, 'Remover');
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    expect(await idsDasFotos(page)).toHaveLength(3);

    await abrirMenuDaImagem(page, 'retrato.jpg');
    const dialogo = page.getByRole('dialog', { name: 'retrato.jpg' });
    await expect(dialogo.getByRole('radio', { name: /Remover deste projeto/ })).toBeChecked();
    await expect(dialogo.getByText('Usada em 3 lugares')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Remover do projeto' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText('“retrato.jpg” removida do projeto: 3 fotos em 2 variantes.')).toBeVisible();

    const depois = await variantes(request, p);
    expect(depois.flatMap((v) => v.fotos.map((f) => f.imagemId)).filter((id) => id === retrato._id)).toEqual(
      [],
    );
    expect(depois.find((v) => v._id === alternativa._id)?.fotos).toHaveLength(0);
    expect(await idsDasFotos(page)).toHaveLength(1);

    // A imagem segue na biblioteca (filtro "Todas") e saiu do filtro "Projeto".
    await expect(
      biblioteca(page).getByRole('button', { name: 'retrato.jpg, Retrato' }).first(),
    ).toBeVisible();
    await biblioteca(page).getByRole('radio', { name: 'Projeto' }).click();
    await expect(biblioteca(page).getByRole('button', { name: 'retrato.jpg, Retrato' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Desfazer' })).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('excluir da biblioteca e restaurar (RF-28, RF-29, RF-30a, RN-24)', () => {
  test('placeholders em duas variantes e em outro projeto; Excluídas com 30 dias; restaurar não repõe; Usar preenche', async ({
    page,
    request,
  }) => {
    const { p, retrato, alternativa } = await cenario(request, 'Excluir');
    // Outro projeto que também usa a imagem.
    const outro = await criarProjetoComEscalaLinear(request, nomeUnico('Excluir outro'));
    await salvarVarianteApi(request, outro, [fotoDaApi(9, retrato._id, { xCm: 20, yCm: 20 })]);

    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await abrirMenuDaImagem(page, 'retrato.jpg');
    const dialogo = page.getByRole('dialog', { name: 'retrato.jpg' });
    await dialogo.getByRole('radio', { name: /Excluir da biblioteca/ }).click();
    await dialogo.getByRole('button', { name: 'Excluir imagem' }).click();
    await expect(dialogo).toBeHidden();
    await expect(
      page.getByText(/“retrato.jpg” excluída\. \d+ fotos viraram espaço sem foto em \d+ variantes\./),
    ).toBeVisible();

    // No servidor: placeholders nas duas variantes do projeto e no outro projeto, com a imagem guardada.
    const daBase = (await variantes(request, p))[0]!.fotos;
    expect(daBase.map((f) => [f.imagemId === null, f.imagemAnteriorId === retrato._id])).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ]);
    const daAlternativa = (await variantes(request, p)).find((v) => v._id === alternativa._id)!;
    expect(daAlternativa.fotos[0]).toMatchObject({ imagemId: null, imagemAnteriorId: retrato._id });
    const doOutro = (await variantes(request, outro))[0]!;
    expect(doOutro.fotos[0]).toMatchObject({ imagemId: null, imagemAnteriorId: retrato._id });

    // O selo "N sem foto" sobe no seletor de variantes.
    await expect(page.getByRole('button', { name: /^Variante: / })).toContainText('2 sem foto');

    // Em "Excluídas", com 30 dias restantes.
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await page.getByRole('menuitem', { name: 'Excluídas' }).click();
    const linha = biblioteca(page).getByRole('listitem').filter({ hasText: 'retrato.jpg' }).first();
    await expect(linha).toContainText('30 dias restantes');
    await expect(biblioteca(page).getByText('Restaurar não devolve a foto às composições.')).toBeVisible();

    // Restaurar: volta à biblioteca; os placeholders continuam vazios.
    await linha.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByText('“retrato.jpg” restaurada.')).toBeVisible();
    await biblioteca(page).getByRole('button', { name: 'Excluídas ×' }).click();
    await expect(
      biblioteca(page).getByRole('button', { name: 'retrato.jpg, Retrato' }).first(),
    ).toBeVisible();
    const aposRestaurar = (await variantes(request, p))[0]!.fotos;
    expect(aposRestaurar[0]!.imagemId).toBeNull();

    // O painel do placeholder recomenda a foto anterior; "Usar" preenche mantendo formato e posição.
    await page.reload();
    await esperarPalco(page);
    const ids = await idsDasFotos(page);
    const centro = await centroDaFoto(page, ids[0]!);
    await page.mouse.click(centro.x, centro.y);
    await expect(page.getByText('Foto anterior, restaurada')).toBeVisible();
    await page.getByRole('button', { name: 'Usar' }).click();
    await expect(page.getByText('Foto anterior, restaurada')).toBeHidden();
    await page.keyboard.press('Control+s');
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();
    const preenchida = (await variantes(request, p))[0]!.fotos[0]!;
    expect(preenchida).toMatchObject({
      _id: daBase[0]!._id,
      imagemId: retrato._id,
      xCm: daBase[0]!.xCm,
      yCm: daBase[0]!.yCm,
      tamanho: daBase[0]!.tamanho,
    });
  });

  test('o diálogo de uma imagem fora do projeto aberto deixa "Remover" inativo', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Fora do projeto'));
    const outro = await criarProjetoComEscalaLinear(request, nomeUnico('Dono da imagem'));
    await enviarImagem(request, outro.id, 'quadrada.jpg');
    await page.goto(`/projetos/${p.id}`);
    await abrirMenuDaImagem(page, 'quadrada.jpg');
    const dialogo = page.getByRole('dialog', { name: 'quadrada.jpg' });
    await expect(dialogo.getByText('Esta imagem não está neste projeto.')).toBeVisible();
    await expect(dialogo.getByRole('radio', { name: /Remover deste projeto/ })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Excluir imagem' })).toBeVisible();
  });
});

test.describe('com alterações não salvas (A-03, A-12)', () => {
  test('remover pede Salvar, Descartar ou Cancelar antes de abrir o diálogo da imagem', async ({
    page,
    request,
  }) => {
    const { p } = await cenario(request, 'Decisão');
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await page.getByRole('switch', { name: 'Mostrar grid' }).click();

    await abrirMenuDaImagem(page, 'retrato.jpg');
    const decisao = page.getByRole('dialog', { name: /^Salvar as alterações de/ });
    await expect(decisao).toBeVisible();
    await decisao.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await abrirMenuDaImagem(page, 'retrato.jpg');
    await page
      .getByRole('dialog', { name: /^Salvar as alterações de/ })
      .getByRole('button', { name: 'Salvar e continuar' })
      .click();
    await expect(page.getByRole('dialog', { name: 'retrato.jpg' })).toBeVisible();
    const salva = (await lerProjeto(request, p.id)).variantes[0]!;
    expect(salva.grid.visivel).toBe(false);
  });
});

test.describe('duas abas (M4-05, M4-06, A-11)', () => {
  test('excluir em uma aba e salvar a variante antiga na outra: conflito se foi afetada', async ({
    page,
    request,
    context,
  }) => {
    const { p, retrato } = await cenario(request, 'Conflito');
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await page.getByRole('switch', { name: 'Mostrar grid' }).click();

    const outra = await context.newPage();
    await outra.goto(`/projetos/${p.id}`);
    await esperarPalco(outra);
    await abrirMenuDaImagem(outra, 'retrato.jpg');
    const dialogo = outra.getByRole('dialog', { name: 'retrato.jpg' });
    await dialogo.getByRole('radio', { name: /Excluir da biblioteca/ }).click();
    await dialogo.getByRole('button', { name: 'Excluir imagem' }).click();
    await expect(dialogo).toBeHidden();
    expect((await variantes(request, p))[0]!.fotos[0]!.imagemAnteriorId).toBe(retrato._id);

    await page.keyboard.press('Control+s');
    await expect(page.getByRole('dialog', { name: 'Esta variante foi salva em outra aba' })).toBeVisible();
  });

  test('a variante não afetada converte ao salvar e avisa (A-11)', async ({ page, request }) => {
    const { p, paisagem } = await cenario(request, 'Conversão');
    // A Alternativa não usa a "paisagem"; na aba, o usuário a adiciona e só então ela é excluída por fora.
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await page.getByRole('button', { name: /^Variante: / }).click();
    await page.getByRole('button', { name: /^Alternativa/ }).click();
    await biblioteca(page).getByRole('button', { name: 'paisagem.jpg, Paisagem' }).first().click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();

    // Excluída em "outra aba" (pela API): a Base é afetada; a Alternativa, salva, não.
    const excluir = await request.delete(`/api/imagens/${paisagem._id}`);
    expect(excluir.status()).toBe(200);

    await page.keyboard.press('Control+s');
    await expect(
      page.getByText('1 foto virou espaço sem foto porque a imagem foi excluída em outra aba.'),
    ).toBeVisible();
    const alternativa = (await variantes(request, p)).find((v) => v.nome === 'Alternativa')!;
    expect(alternativa.fotos.at(-1)).toMatchObject({ imagemId: null, imagemAnteriorId: paisagem._id });
  });
});

test.describe('API (aceite do ciclo de vida)', () => {
  test('restaurar uma imagem purgada ou vencida responde 404/410', async ({ request }) => {
    const inexistente = await request.post(`/api/imagens/${'0'.repeat(24)}/restaurar`);
    expect(inexistente.status()).toBe(404);
  });
});
