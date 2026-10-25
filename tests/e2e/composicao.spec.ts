/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import {
  caminhoImagem,
  centroDaFoto,
  criarProjetoComEscalaLinear,
  enviarImagem,
  esperarPalco,
  idsDasFotos,
  lerCampo,
  lerProjeto,
  nomeUnico,
  pxPorCmNaTela,
  retanguloDaFoto,
} from './ajudantes';

// Composição na parede (spec M2 §3.3 a §3.7, §7; PRD aceite 1, 2, 2a, 3, 4, 7 e 12; RF-30 a RF-35, RF-41,
// RF-53, RF-60, RF-62, RF-70, RN-05, RN-11, RN-12, RN-14, RN-16, RN-28, RN-34).
// A parede do cenário é frontal.jpg com 4 px/cm: parede inteira = área útil = 300 × 225 cm.

async function cenario(request: import('@playwright/test').APIRequestContext, imagens = ['retrato.jpg']) {
  const projeto = await criarProjetoComEscalaLinear(request, nomeUnico('Composição'));
  for (const nome of imagens) await enviarImagem(request, projeto.id, nome);
  return projeto;
}

async function abrir(page: Page, projetoId: string) {
  await page.goto(`/projetos/${projetoId}`);
  await esperarPalco(page);
}

const biblioteca = (page: Page) => page.getByRole('complementary', { name: 'Biblioteca' });

async function adicionar(page: Page, nome: string, orientacao: 'Retrato' | 'Paisagem' = 'Retrato') {
  // A biblioteca é global e o banco de teste acumula imagens com o mesmo nome: a mais recente vem primeiro.
  await biblioteca(page)
    .getByRole('button', { name: `${nome}, ${orientacao}` })
    .first()
    .click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
}

async function escolherTamanho(page: Page, rotulo: string) {
  await page.getByRole('combobox', { name: 'Tamanho' }).click();
  await page.getByRole('option', { name: rotulo }).click();
}

async function aplicar(page: Page, campo: string, valor: string) {
  const entrada = page.getByLabel(campo, { exact: true });
  await entrada.fill(valor);
  await entrada.press('Enter');
}

const externo = (page: Page, texto: string) => page.getByText(texto, { exact: true });

test.describe('adicionar fotos (RF-30, RN-03, RN-04, RN-13)', () => {
  test('botão Adicionar: 10×15 centralizada na área útil, encaixada no grid, selecionada', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await expect(page.getByRole('button', { name: 'Adicionar', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await adicionar(page, 'retrato.jpg');
    await expect(page.getByText('Nenhuma foto selecionada')).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Tamanho' })).toContainText('10 × 15');
    await expect(externo(page, '10,0 × 15,0 cm')).toBeVisible();
    // centro: x = (300 − 10) / 2 = 145; y = (225 − 15) / 2 = 105 — já múltiplos de 5
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([145, 105]);
    await expect(page.getByText('Salvo', { exact: true })).toBeHidden();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
  });

  test('a mesma imagem pode ser adicionada de novo, em cascata (RN-13)', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    expect((await idsDasFotos(page)).length).toBe(2);
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([150, 110]);
  });

  test('arrastar a miniatura para a parede: o centro da foto vai ao ponto, encaixado no grid', async ({
    page,
    request,
  }) => {
    const p = await cenario(request, ['paisagem.jpg']);
    await abrir(page, p.id);
    await biblioteca(page)
      .getByRole('button', { name: 'paisagem.jpg, Paisagem' })
      .first()
      .dragTo(page.getByTestId('palco'), {
        sourcePosition: { x: 20, y: 20 },
        targetPosition: { x: 400, y: 300 },
      });

    const [id] = await idsDasFotos(page);
    expect(id).toBeTruthy();
    const x = await lerCampo(page, 'X');
    const y = await lerCampo(page, 'Y');
    expect(x % 5).toBe(0);
    expect(y % 5).toBe(0);
    // Paisagem 15 × 10: o centro (x + 7,5; y + 5) fica a até um passo (5 cm) do ponto de soltura.
    const esc = await pxPorCmNaTela(page);
    const centro = await centroDaFoto(page, id!);
    const alvo = await page.getByTestId('palco').boundingBox();
    expect(Math.abs(centro.x - (alvo!.x + 400))).toBeLessThanOrEqual(5 * esc);
    expect(Math.abs(centro.y - (alvo!.y + 300))).toBeLessThanOrEqual(5 * esc);
  });
});

test.describe('medidas (PRD aceite 1, 2, 2a, 3)', () => {
  test('20×30 retrato mede 20 × 30 cm na escala (±1 px) — aceite 1', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '20 × 30 cm');

    const [id] = await idsDasFotos(page);
    const r = await retanguloDaFoto(page, id!);
    const esc = await pxPorCmNaTela(page);
    expect(Math.abs(r!.largura - 20 * esc)).toBeLessThanOrEqual(1);
    expect(Math.abs(r!.altura - 30 * esc)).toBeLessThanOrEqual(1);
  });

  test('10×15 com borda de 2 cm tem tamanho externo 14 × 19 cm — aceite 2', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    const [x0, y0] = [await lerCampo(page, 'X'), await lerCampo(page, 'Y')];
    await aplicar(page, 'Largura da borda', '2');
    await expect(externo(page, '14,0 × 19,0 cm')).toBeVisible();

    // Canto superior esquerdo externo fixo (M2-05) e medida na tela.
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([x0, y0]);
    const [id] = await idsDasFotos(page);
    const r = await retanguloDaFoto(page, id!);
    const esc = await pxPorCmNaTela(page);
    expect(Math.abs(r!.largura - 14 * esc)).toBeLessThanOrEqual(1);
    expect(Math.abs(r!.altura - 19 * esc)).toBeLessThanOrEqual(1);
  });

  test('borda: cor pronta e valor fora da faixa mostra a faixa válida sem aplicar', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await page.getByRole('button', { name: 'Cor da borda' }).click();
    await page.getByRole('button', { name: 'Madeira escura' }).click();
    await expect(page.getByRole('button', { name: 'Cor da borda' })).toContainText('Madeira escura');

    await aplicar(page, 'Largura da borda', '25');
    await expect(page.getByText('Entre 0,0 e 20,0 cm.')).toBeVisible();
    await expect(externo(page, '10,0 × 15,0 cm')).toBeVisible();
  });

  test('tamanho personalizado: 21,0 × 29,7 aceito; 4,9 e 150,1 rejeitados — aceite 2a', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');

    await escolherTamanho(page, 'Personalizado…');
    await expect(page.getByRole('heading', { name: 'Ajustar recorte' })).toBeVisible();
    await aplicar(page, 'Largura', '21');
    await aplicar(page, 'Altura', '29,7');
    await expect(externo(page, '21,0 × 29,7 cm')).toBeVisible();

    await aplicar(page, 'Largura', '4,9');
    await expect(page.getByText('Entre 5,0 e 150,0 cm em cada lado.').first()).toBeVisible();
    await expect(externo(page, '21,0 × 29,7 cm')).toBeVisible();
    await aplicar(page, 'Altura', '150,1');
    await expect(page.getByText('Entre 5,0 e 150,0 cm em cada lado.').first()).toBeVisible();
    await expect(externo(page, '21,0 × 29,7 cm')).toBeVisible();

    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByRole('combobox', { name: 'Tamanho' })).toContainText('21,0 × 29,7');
  });

  test('alternar a orientação inverte largura e altura e mantém o canto — aceite 3, RN-05', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '20 × 30 cm');
    const [x0, y0] = [await lerCampo(page, 'X'), await lerCampo(page, 'Y')];

    await page.getByRole('radio', { name: 'Paisagem' }).click();
    await expect(externo(page, '30,0 × 20,0 cm')).toBeVisible();
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([x0, y0]);

    await page.getByRole('radio', { name: 'Retrato' }).click();
    await expect(externo(page, '20,0 × 30,0 cm')).toBeVisible();
  });

  test('tamanho quadrado não tem orientação', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '13 × 13 cm');
    await expect(page.getByRole('radio', { name: 'Retrato' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Paisagem' })).toBeDisabled();
  });
});

test.describe('mover (RF-34, RF-53, RN-16; PRD aceite 4)', () => {
  test('arrastar com snap: X e Y ficam múltiplos de 5 cm — aceite 4', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    const [id] = await idsDasFotos(page);
    const centro = await centroDaFoto(page, id!);
    const esc = await pxPorCmNaTela(page);

    // Arrasta uns 37 cm e 21 cm (fora do grid) a partir do centro da foto.
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down();
    await page.mouse.move(centro.x + 37 * esc, centro.y + 21 * esc, { steps: 12 });
    await page.mouse.up();

    const x = await lerCampo(page, 'X');
    const y = await lerCampo(page, 'Y');
    expect(x % 5).toBe(0);
    expect(y % 5).toBe(0);
    expect(x).toBeGreaterThan(145 + 25);
    expect(y).toBeGreaterThan(105 + 10);
  });

  test('sem snap, a posição é livre a 0,1 cm', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await page.getByRole('button', { name: 'Snap ao grid' }).click();
    await adicionar(page, 'retrato.jpg');
    const [id] = await idsDasFotos(page);
    const centro = await centroDaFoto(page, id!);
    const esc = await pxPorCmNaTela(page);
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down();
    await page.mouse.move(centro.x + 13.3 * esc, centro.y + 7.7 * esc, { steps: 10 });
    await page.mouse.up();
    const x = await lerCampo(page, 'X');
    expect(x).toBeGreaterThan(145);
    expect(Math.round(x * 10) / 10).toBe(x);
  });

  test('setas: próxima linha do grid; Shift = 5 linhas (RN-16)', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    // O foco sai dos campos para o teclado valer para a foto.
    await page.locator('footer').click();
    await page.keyboard.press('ArrowRight');
    expect(await lerCampo(page, 'X')).toBe(150);
    await page.keyboard.press('Shift+ArrowDown');
    expect(await lerCampo(page, 'Y')).toBe(130);
    await page.keyboard.press('ArrowLeft');
    expect(await lerCampo(page, 'X')).toBe(145);
  });

  test('X e Y digitados valem como digitados, a 0,1 cm, sem encaixar no grid', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await aplicar(page, 'X', '12,3');
    await aplicar(page, 'Y', '-4');
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([12.3, -4]);
  });
});

test.describe('alertas e medidas da composição (RN-11, RN-12, RN-34, RF-62)', () => {
  test('sobreposição, fora da área útil e fora da parede, com o resumo da composição', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click(); // cascata +5/+5: sobrepõe
    await expect(page.getByText('Esta foto sobrepõe outra na parede.')).toBeVisible();

    // Fora da parede (a foto selecionada é a segunda).
    await aplicar(page, 'X', '295');
    await expect(page.getByText('Esta foto passa dos limites da parede.')).toBeVisible();

    // Sem seleção: o painel Composição resume (2 fotos, bounding box, 1 fora dos limites).
    await page.locator('footer').click(); // tira o foco do campo: Esc em campo é do campo
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { level: 2, name: 'Composição' })).toBeVisible();
    await expect(page.getByText('Fora dos limites')).toBeVisible();
    await expect(page.getByText('Sobreposições')).toBeHidden(); // a segunda saiu de cima da primeira
    // Bounding box: de x = 145 até 295 + 10 = 305 (160 cm) e de y = 105 até 110 + 15 = 125 (20 cm).
    await expect(page.getByText('160,0 × 20,0 cm')).toBeVisible();
  });

  test('foto na área útil menor que a parede: "passa dos limites da área útil" (RN-34)', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await page.request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}`, {
      data: {
        sessaoId: 'e2e',
        revisaoBase: (await lerProjeto(request, p.id)).variantes[0]!.revisao,
        grid: { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 },
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: { xCm: 50, yCm: 50, larguraCm: 100, alturaCm: 100 },
        fotos: [],
      },
    });
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await aplicar(page, 'X', '20'); // dentro da parede (300 × 225), fora da área útil (50–150)
    await expect(page.getByText('Esta foto passa dos limites da área útil.')).toBeVisible();
  });
});

test.describe('duplicar, remover e ordem (RF-35)', () => {
  test('duplicar copia 5 cm adiante, no topo, e seleciona a cópia; remover tira da variante', async ({
    page,
    request,
  }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await page.getByRole('button', { name: 'Duplicar', exact: true }).first().click();
    const ids = await idsDasFotos(page);
    expect(ids.length).toBe(2);
    expect([await lerCampo(page, 'X'), await lerCampo(page, 'Y')]).toEqual([150, 110]);

    await page.getByRole('button', { name: 'Remover' }).click();
    expect((await idsDasFotos(page)).length).toBe(1);
    await expect(page.getByText('Nenhuma foto selecionada')).toBeVisible();
  });

  test('trazer para frente / enviar para trás mudam a ordem (z-index)', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    const [primeira, segunda] = await idsDasFotos(page);
    // A segunda (selecionada) está por cima; enviar para trás inverte a ordem.
    await page.getByRole('button', { name: 'Enviar para trás' }).click();
    expect(await idsDasFotos(page)).toEqual([segunda, primeira]);
    await page.getByRole('button', { name: 'Trazer para frente' }).click();
    expect(await idsDasFotos(page)).toEqual([primeira, segunda]);
  });
});

test.describe('modo de recorte (RN-14, RN-28)', () => {
  test('duplo clique abre o modo; arrastar a imagem e Concluir grava o recorte; Esc cancela', async ({
    page,
    request,
  }) => {
    const p = await cenario(request, ['paisagem.jpg']);
    await abrir(page, p.id);
    await adicionar(page, 'paisagem.jpg', 'Paisagem'); // 10×15 na orientação natural: 15 × 10 sobre 4:3
    await page.getByRole('radio', { name: 'Retrato' }).click(); // 10 × 15 retrato sobre imagem 4:3: sobra horizontal
    const [id] = await idsDasFotos(page);

    const centro = await centroDaFoto(page, id!);
    await page.mouse.dblclick(centro.x, centro.y);
    await expect(page.getByText('O restante da parede fica bloqueado até concluir')).toBeVisible();

    // Esc cancela e restaura.
    await page.keyboard.press('Escape');
    await expect(page.getByText('O restante da parede fica bloqueado até concluir')).toBeHidden();

    await page.getByRole('button', { name: 'Ajustar recorte' }).click();
    const esc = await pxPorCmNaTela(page);
    const quadro = await retanguloDaFoto(page, id!);
    const cx = quadro!.x + quadro!.largura / 2;
    const cy = quadro!.y + quadro!.altura / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 3 * esc, cy, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('O restante da parede fica bloqueado até concluir')).toBeHidden();

    await page.keyboard.press('Control+s');
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();
    const foto = (await lerProjeto(request, p.id)).variantes[0]!.fotos[0] as {
      recorte: { offsetX: number; offsetY: number };
    };
    // Arrastou a imagem 3 cm para a direita: mostra mais da esquerda (offset negativo).
    expect(foto.recorte.offsetX).toBeLessThan(0);
    expect(foto.recorte.offsetY).toBe(0);
  });
});

test.describe('desfazer e refazer (RF-70, RN-18; PRD aceite 12)', () => {
  test('botões e Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y percorrem os passos', async ({ page, request }) => {
    const p = await cenario(request);
    await abrir(page, p.id);
    const desfazer = page.getByRole('button', { name: 'Desfazer' });
    const refazer = page.getByRole('button', { name: 'Refazer' });
    await expect(desfazer).toHaveAttribute('aria-disabled', 'true');

    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '20 × 30 cm');
    await expect(desfazer).not.toHaveAttribute('aria-disabled', 'true');
    await expect(refazer).toHaveAttribute('aria-disabled', 'true');

    await desfazer.click();
    await expect(page.getByRole('combobox', { name: 'Tamanho' })).toContainText('10 × 15');
    await expect(refazer).not.toHaveAttribute('aria-disabled', 'true');

    await page.locator('footer').click();
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByRole('combobox', { name: 'Tamanho' })).toContainText('20 × 30');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z'); // desfaz também o "adicionar"
    await expect(page.getByText('Nenhuma foto selecionada')).toBeVisible();
    expect((await idsDasFotos(page)).length).toBe(0);
    await page.keyboard.press('Control+y');
    expect((await idsDasFotos(page)).length).toBe(1);
  });
});

test.describe('salvar e reabrir (PRD aceite 7)', () => {
  test('fotos, posições, tamanhos, bordas e recortes voltam depois de recarregar', async ({
    page,
    request,
  }) => {
    const p = await cenario(request, ['retrato.jpg', 'paisagem.jpg']);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '20 × 30 cm');
    await aplicar(page, 'Largura da borda', '1,5');
    await aplicar(page, 'X', '40');
    await aplicar(page, 'Y', '25');
    await adicionar(page, 'paisagem.jpg', 'Paisagem');

    await page.keyboard.press('Control+s');
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();
    const salvo = (await lerProjeto(request, p.id)).variantes[0]!.fotos as Record<string, unknown>[];
    expect(salvo).toHaveLength(2);
    expect(salvo[0]).toMatchObject({
      xCm: 40,
      yCm: 25,
      tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
      borda: { larguraCm: 1.5 },
    });

    await page.reload();
    await esperarPalco(page);
    expect((await idsDasFotos(page)).length).toBe(2);
    const [primeira] = await idsDasFotos(page);
    const r = await retanguloDaFoto(page, primeira!);
    const esc = await pxPorCmNaTela(page);
    expect(Math.abs(r!.largura - 23 * esc)).toBeLessThanOrEqual(1); // 20 + 2 × 1,5
    expect(Math.abs(r!.altura - 33 * esc)).toBeLessThanOrEqual(1);
  });

  test('o servidor recusa fotos sem escala ou com imagem inexistente (422)', async ({ request }) => {
    const sem = await (
      await request.post('/api/projetos', { data: { nome: nomeUnico('Sem escala') } })
    ).json();
    const base = {
      sessaoId: 'e2e',
      grid: { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 },
      bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
      areaUtil: null,
    };
    const foto = {
      _id: '0'.repeat(23) + '1',
      imagemId: '0'.repeat(23) + '2',
      imagemAnteriorId: null,
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      xCm: 0,
      yCm: 0,
      recorte: { offsetX: 0, offsetY: 0 },
      borda: { larguraCm: 0, cor: '#FFFFFF' },
    };
    const res = await request.put(`/api/projetos/${sem.projeto._id}/variantes/${sem.variantes[0]._id}`, {
      data: { ...base, revisaoBase: 1, fotos: [foto] },
    });
    expect(res.status()).toBe(422);
  });
});

test.describe('rede (RNF-01)', () => {
  test('nenhuma requisição fora de localhost nos fluxos da biblioteca e da composição', async ({
    page,
    request,
  }) => {
    const externas: string[] = [];
    page.on('request', (r) => {
      const { hostname, protocol } = new URL(r.url());
      if (protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(hostname))
        externas.push(r.url());
    });
    const p = await cenario(request, ['retrato.jpg', 'paisagem.jpg']);
    await abrir(page, p.id);
    await adicionar(page, 'retrato.jpg');
    await escolherTamanho(page, '30 × 40 cm');
    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    await page
      .getByRole('dialog')
      .getByTestId('entrada-arquivos')
      .setInputFiles([caminhoImagem('quadrada.jpg')]);
    await page.getByRole('button', { name: 'Enviar 1 foto' }).click();
    await expect(page.getByText('1 de 1 enviadas')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Concluir' }).click();
    await page.keyboard.press('Control+s');
    expect(externas).toEqual([]);
  });
});
