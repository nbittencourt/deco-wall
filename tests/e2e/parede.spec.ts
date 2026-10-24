/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { aplicarHomografia, cantosPadrao, segmentoPadrao } from '../../packages/domain/src/index';
import { CAMINHO_FRONTAL, CAMINHO_PERSPECTIVA, FRONTAL, PERSPECTIVA } from '../fixtures/paredes';
import {
  arrastar,
  criarProjeto,
  criarProjetoComEscalaLinear,
  criarProjetoComPerspectiva,
  esperarPalco,
  lerProjeto,
  paraTela,
  nomeUnico,
} from './ajudantes';

// Fluxos de parede e escala do M1 (spec M1 §7 "E2E", aceite 3 a 11).

async function enviarFoto(page: Page, caminho: string) {
  await page.getByLabel('Foto da parede').setInputFiles(caminho);
}

test.describe('perspectiva (fluxo E2E 1, PRD aceite 6)', () => {
  test('upload → quatro cantos → medidas → prévia → aplicar → área útil → salvar → recarregar', async ({
    page,
    request,
  }) => {
    const p = await criarProjeto(request, nomeUnico('Perspectiva'));
    await page.goto(`/projetos/${p.id}`);

    // Upload abre direto o modo Perspectiva (M1-06).
    await enviarFoto(page, CAMINHO_PERSPECTIVA);
    await expect(page.getByText('Correção de perspectiva')).toBeVisible();
    await esperarPalco(page);
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeDisabled();

    // As alças já aparecem prontas a 25% das bordas (A-10): arrastar cada uma até o canto real.
    const prontas = cantosPadrao(PERSPECTIVA.larguraImagemPx, PERSPECTIVA.alturaImagemPx);
    for (let i = 0; i < 4; i++) {
      await arrastar(page, prontas[i]!, PERSPECTIVA.cantosPx[i]!);
    }
    await expect(page.getByText('Cantos 4 de 4')).toBeVisible();
    await expect(page.getByText('Os cantos precisam formar um quadrilátero.')).toHaveCount(0);

    await page.getByLabel('Largura').fill('300');
    await page.getByLabel('Altura').fill('200');
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeEnabled();

    // Prévia sob demanda: Vazio → Pronta → Desatualizada quando um canto muda (DV-06).
    await page.getByRole('button', { name: 'Gerar prévia' }).click();
    await expect(page.getByText(/Gerada às \d{2}:\d{2} · 300,0 × 200,0 cm/)).toBeVisible({ timeout: 15_000 });
    const canto0 = PERSPECTIVA.cantosPx[0]!;
    await arrastar(page, canto0, { x: canto0.x + 12, y: canto0.y + 12 });
    await expect(page.getByText('Os cantos mudaram')).toBeVisible();
    await arrastar(page, { x: canto0.x + 12, y: canto0.y + 12 }, canto0);

    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('Aplicando perspectiva…')).toBeHidden({ timeout: 30_000 });

    // Primeira escala: abre o modo Área útil (M1-08); confirmar mantém a parede inteira.
    await expect(
      page.getByText('Perspectiva aplicada. Agora defina onde as fotos podem ficar.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar área' }).click();
    await expect(page.getByRole('button', { name: 'Confirmar área' })).toBeHidden();

    // Chip de escala e grid visível por padrão (passo 5 cm).
    await expect(page.getByRole('region', { name: 'Escala' })).toContainText(/\d+,\d px\/cm/);
    await expect(page.getByRole('button', { name: 'Grid 5 cm' })).toHaveAttribute('aria-pressed', 'true');

    // PRD aceite 6: o retângulo retificado mede 300 × 200 cm (±1%).
    const salvo = await lerProjeto(request, p.id);
    const escala = salvo.projeto.parede!.escala;
    expect(escala.metodo).toBe('perspectiva');
    const h = escala.homografia!;
    const [tl, tr, br, bl] = PERSPECTIVA.cantosPx.map((c) => aplicarHomografia(h, c));
    expect(Math.abs(tr!.x - tl!.x - 300)).toBeLessThanOrEqual(3);
    expect(Math.abs(br!.y - tr!.y - 200)).toBeLessThanOrEqual(2);
    expect(Math.abs(br!.x - bl!.x - 300)).toBeLessThanOrEqual(3);
    expect(Math.abs(bl!.y - tl!.y - 200)).toBeLessThanOrEqual(2);

    // Salvar persiste grid e área útil; recarregar restaura o mesmo estado (PRD aceite 7, parede).
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();

    const aposSalvar = await lerProjeto(request, p.id);
    const area = aposSalvar.variantes[0]!.areaUtil!;
    expect(area.larguraCm).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const painelArea = page.getByRole('region', { name: 'Área útil desta variante' });
    await expect(painelArea.getByLabel('Largura')).not.toHaveValue('');
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calibrar', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

test.describe('calibração linear (fluxo E2E 2, RF-10, RF-12)', () => {
  test('segmento + comprimento geram a escala esperada (4,0 px/cm)', async ({ page, request }) => {
    const p = await criarProjeto(request, nomeUnico('Linear'));
    await page.goto(`/projetos/${p.id}`);
    await enviarFoto(page, CAMINHO_FRONTAL);
    await expect(page.getByText('Correção de perspectiva')).toBeVisible();

    await page.getByRole('button', { name: 'Pular e usar calibração linear' }).click();
    await expect(page.getByText('Calibração linear')).toBeVisible();
    await esperarPalco(page);

    // Segmento pronto (A-12): horizontal, no centro, com metade da largura. Arrastar as pontas.
    const { p1, p2 } = segmentoPadrao(FRONTAL.larguraImagemPx, FRONTAL.alturaImagemPx);
    await arrastar(page, p1, { x: 100, y: 100 });
    await arrastar(page, p2, { x: 700, y: 100 });
    await expect(page.getByText('600 px')).toBeVisible();

    await page.getByLabel('Comprimento real').fill('150');
    await expect(page.getByText('4,0 px/cm')).toBeVisible();

    await page.getByRole('button', { name: 'Aplicar escala' }).click();
    await expect(page.getByText('Escala aplicada. Agora defina onde as fotos podem ficar.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar área' }).click();

    await expect(page.getByRole('region', { name: 'Escala' })).toContainText('Linear');
    await expect(page.getByRole('region', { name: 'Escala' })).toContainText('4,0 px/cm');

    const salvo = await lerProjeto(request, p.id);
    expect(salvo.projeto.parede!.escala.metodo).toBe('linear');
    expect(Math.abs(salvo.projeto.parede!.escala.homografia![0]! - 0.25)).toBeLessThan(0.25 * 0.005);
    // Primeira escala gravou a área útil = a foto toda (300 × 225 cm).
    expect(salvo.variantes[0]!.areaUtil).toEqual({ xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 });
  });

  test('cancelar a calibração mantém a parede e o aviso de escala pendente', async ({ page, request }) => {
    const p = await criarProjeto(request, nomeUnico('Cancelar'));
    await page.goto(`/projetos/${p.id}`);
    await enviarFoto(page, CAMINHO_FRONTAL);
    await page.getByRole('button', { name: 'Pular e usar calibração linear' }).click();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByText('Defina a escala da parede para posicionar fotos.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Área útil' })).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('regras de método (M1-02, aceite 6)', () => {
  test('com a perspectiva aplicada, "Calibrar" fica inativo com tooltip', async ({ page, request }) => {
    const p = await criarProjetoComPerspectiva(request, nomeUnico('Persp aplicada'));
    await page.goto(`/projetos/${p.id}`);
    const calibrar = page.getByRole('button', { name: 'Calibrar', exact: true });
    await expect(calibrar).toHaveAttribute('aria-disabled', 'true');

    // aria-disabled conta como desabilitado para o Playwright: o clique é forçado de propósito.
    await calibrar.click({ force: true });
    await expect(page.getByText('Calibração linear')).toHaveCount(0);

    await calibrar.focus();
    await expect(
      page.getByRole('tooltip').filter({
        hasText: 'Com a perspectiva aplicada, use Perspectiva para refazer a escala.',
      }),
    ).toBeVisible();
  });

  test('de linear para perspectiva a área útil mantém os valores em cm', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Linear para persp'));
    const antes = (await lerProjeto(request, p.id)).variantes[0]!.areaUtil!;
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('button', { name: 'Perspectiva', exact: true }).click();
    await expect(page.getByText('Correção de perspectiva')).toBeVisible();
    // Foto frontal: cantos prontos servem (o conteúdo não importa para este teste).
    await page.getByLabel('Largura').fill('300');
    await page.getByLabel('Altura').fill('200');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('Aplicando perspectiva…')).toBeHidden({ timeout: 30_000 });

    const depois = await lerProjeto(request, p.id);
    expect(depois.projeto.parede!.escala.metodo).toBe('perspectiva');
    expect(depois.variantes[0]!.areaUtil).toEqual(antes);
    // O quadrilátero cabe na parede inteira nova? Se não, o aviso aparece (RN-35).
    const aviso = page.getByText('A área útil ficou fora da parede. Ajuste em Área útil.');
    if ((await aviso.count()) > 0)
      await expect(page.getByRole('button', { name: 'Ajustar' }).first()).toBeVisible();
  });
});

test.describe('área útil (aceite 7)', () => {
  test('arrastar a alça lateral encurta a largura, Confirmar aplica, Cancelar descarta', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Area util'));
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('button', { name: 'Área útil' }).click();
    await expect(page.getByText('Ajuste onde as fotos podem ficar.')).toBeVisible();
    await esperarPalco(page);

    // A área nasce como a parede inteira (0,0 · 300 × 225): alça do meio do lado direito (em cm).
    // O mouse trabalha em px: a largura fica a menos de 1 cm do alvo.
    const larguraDoCampo = async (rotulo: ReturnType<typeof page.getByLabel>) =>
      Number((await rotulo.inputValue()).replace(',', '.'));
    await arrastar(page, { x: 300, y: 112.5 }, { x: 250, y: 112.5 });
    expect(Math.abs((await larguraDoCampo(page.getByLabel('Largura'))) - 250)).toBeLessThan(1);

    // Cancelar descarta o ajuste e mantém a área anterior (parede inteira).
    await page.getByRole('button', { name: 'Cancelar' }).click();
    const largura = page.getByRole('region', { name: 'Área útil desta variante' }).getByLabel('Largura');
    await expect(largura).toHaveValue('300,0');

    // De novo, agora confirmando.
    await page.getByRole('button', { name: 'Área útil' }).click();
    await arrastar(page, { x: 300, y: 112.5 }, { x: 250, y: 112.5 });
    await page.getByRole('button', { name: 'Confirmar área' }).click();
    expect(Math.abs((await larguraDoCampo(largura)) - 250)).toBeLessThan(1);
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
  });

  test('o pan funciona sobre a área útil (botão do meio e Espaço) e o interior ainda move a área', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Pan'));
    await page.goto(`/projetos/${p.id}`);
    await page.getByRole('button', { name: 'Área útil' }).click();
    await esperarPalco(page);

    // Aproxima até a parede (que é a área útil inteira) encher a tela: não sobra fundo para arrastar.
    const caixa = (await page.getByTestId('palco').boundingBox())!;
    const centro = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
    await page.mouse.move(centro.x, centro.y);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -120);
    await expect.poll(async () => (await paraTela(page, { x: 0, y: 0 })).x).toBeLessThan(caixa.x);

    const antes = await paraTela(page, { x: 0, y: 0 });
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(centro.x + 80, centro.y + 40, { steps: 5 });
    await page.mouse.up({ button: 'middle' });
    const aposMeio = await paraTela(page, { x: 0, y: 0 });
    expect(Math.round(aposMeio.x - antes.x)).toBe(80);
    expect(Math.round(aposMeio.y - antes.y)).toBe(40);

    await page.keyboard.down('Space');
    await page.mouse.move(centro.x, centro.y);
    await page.mouse.down();
    await page.mouse.move(centro.x - 60, centro.y - 30, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    const aposEspaco = await paraTela(page, { x: 0, y: 0 });
    expect(Math.round(aposEspaco.x - aposMeio.x)).toBe(-60);
    expect(Math.round(aposEspaco.y - aposMeio.y)).toBe(-30);

    // Nenhum dos dois gestos mexeu na área.
    await expect(page.getByLabel('X')).toHaveValue('0,0');
    await expect(page.getByLabel('Largura')).toHaveValue('300,0');

    // Sem Espaço, arrastar o interior continua movendo a área (agora com a largura reduzida para ter folga).
    await page.getByLabel('Largura').fill('200');
    await page.getByLabel('Largura').press('Enter');
    await arrastar(page, { x: 100, y: 100 }, { x: 120, y: 100 });
    await expect(page.getByLabel('X')).not.toHaveValue('0,0');
  });

  test('campos do painel aplicam com Enter e recusam valor fora da parede (A-13)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Campos'));
    await page.goto(`/projetos/${p.id}`);
    const area = page.getByRole('region', { name: 'Área útil desta variante' });

    await area.getByLabel('Largura').fill('200,5');
    await area.getByLabel('Largura').press('Enter');
    await expect(area.getByLabel('Largura')).toHaveValue('200,5');

    await area.getByLabel('Largura').fill('999');
    await area.getByLabel('Largura').press('Enter');
    await expect(area.getByText('Faixa válida: 5,0 a 300,0 cm.')).toBeVisible();
  });
});

test.describe('canvas: zoom e Ajustar à tela (aceite 9)', () => {
  test('os botões de zoom mudam a porcentagem e "Ajustar à tela" volta ao enquadramento inicial', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Zoom'));
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const zoom = page.getByTestId('zoom-percentual');
    const inicial = await zoom.textContent();

    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await expect(zoom).not.toHaveText(inicial!);
    await page.getByRole('button', { name: 'Diminuir zoom' }).click();
    await page.getByRole('button', { name: 'Diminuir zoom' }).click();
    await page.getByRole('button', { name: 'Ajustar à tela' }).click();
    await expect(zoom).toHaveText(inicial!);
  });

  test('a roda do mouse dá zoom no ponto do cursor', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Roda'));
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    const zoom = page.getByTestId('zoom-percentual');
    const inicial = await zoom.textContent();
    const caixa = (await page.getByTestId('palco').boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.wheel(0, -300);
    await expect(zoom).not.toHaveText(inicial!);
  });
});

test.describe('salvamento (aceite 10, SV-08)', () => {
  test('Ctrl+S salva, mesmo com o foco num campo', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Ctrl S'));
    await page.goto(`/projetos/${p.id}`);
    const painel = page.getByRole('region', { name: 'Grid' });

    await painel.getByRole('radio', { name: '10' }).click();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    await page.getByRole('region', { name: 'Área útil desta variante' }).getByLabel('X').focus();
    await page.keyboard.press('Control+s');
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();

    const salvo = await lerProjeto(request, p.id);
    expect(salvo.variantes[0]!.grid.passoCm).toBe(10);
  });

  test('o browser avisa ao fechar com alterações não salvas', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Aviso'));
    await page.goto(`/projetos/${p.id}`);
    const tentarSair = () =>
      page.evaluate(() => {
        const evento = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(evento);
        return evento.defaultPrevented;
      });

    expect(await tentarSair()).toBe(false);
    await page.getByRole('switch', { name: 'Mostrar grid' }).click();
    expect(await tentarSair()).toBe(true);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(/Salvo às/)).toBeVisible();
    expect(await tentarSair()).toBe(false);
  });

  test('duas abas: a segunda a salvar recebe o aviso de conflito (409) e recarrega', async ({
    context,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Conflito'));
    const abaA = await context.newPage();
    const abaB = await context.newPage();
    await abaA.goto(`/projetos/${p.id}`);
    await abaB.goto(`/projetos/${p.id}`);
    await expect(abaA.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(abaB.getByRole('heading', { level: 1 })).toBeVisible();

    // A aba B salva primeiro.
    await abaB.getByRole('switch', { name: 'Mostrar grid' }).click();
    await abaB.getByRole('button', { name: 'Salvar' }).click();
    await expect(abaB.getByText(/Salvo às/)).toBeVisible();

    // A aba A ainda acredita na revisão antiga.
    await abaA.getByRole('region', { name: 'Grid' }).getByRole('radio', { name: '10' }).click();
    await abaA.getByRole('button', { name: 'Salvar' }).click();
    const aviso = abaA.getByRole('alert');
    await expect(aviso).toContainText('Esta variante foi salva em outra aba às');
    await expect(abaA.getByText('Conflito', { exact: true })).toBeVisible();

    await aviso.getByRole('button', { name: 'Recarregar' }).click();
    await expect(abaA.getByRole('alert')).toHaveCount(0);
    await expect(abaA.getByRole('switch', { name: 'Mostrar grid' })).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('trocar a parede (fluxo E2E 4, M1-05, RF-07)', () => {
  test('sem fotos: confirma, descarta a escala e abre o envio da nova foto', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Trocar'));
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('button', { name: 'Parede', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Trocar a foto da parede?' });
    await expect(dialogo).toContainText('A escala e a área útil serão descartadas.');
    await dialogo.getByRole('button', { name: 'Trocar parede' }).click();

    await enviarFoto(page, CAMINHO_PERSPECTIVA);
    await expect(page.getByText('Correção de perspectiva')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByText('Defina a escala da parede para posicionar fotos.')).toBeVisible();
    const salvo = await lerProjeto(request, p.id);
    expect(salvo.projeto.parede).toMatchObject({ larguraPx: 1600, alturaPx: 1200, escala: { metodo: null } });
    expect(salvo.variantes[0]!.areaUtil).toBeNull();
  });

  test('com fotos posicionadas o botão fica inativo (UI) e a API recusa com 409', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Com fotos'));
    const atual = (await lerProjeto(request, p.id)).variantes[0]!;
    const salvar = await request.put(`/api/projetos/${p.id}/variantes/${p.varianteId}`, {
      data: {
        sessaoId: 'e2e',
        revisaoBase: atual.revisao,
        grid: { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 },
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: atual.areaUtil,
        fotos: [
          {
            _id: 'a'.repeat(24),
            imagemId: 'b'.repeat(24),
            imagemAnteriorId: null,
            tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
            xCm: 40,
            yCm: 30,
            recorte: { offsetX: 0, offsetY: 0 },
            borda: { larguraCm: 0, cor: '#FFFFFF' },
          },
        ],
      },
    });
    expect(salvar.status()).toBe(200);

    await page.goto(`/projetos/${p.id}`);
    const botao = page.getByRole('button', { name: 'Parede', exact: true });
    await expect(botao).toHaveAttribute('aria-disabled', 'true');
    await botao.click({ force: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const revisao = (await lerProjeto(request, p.id)).projeto.revisao;
    const res = await request.put(`/api/projetos/${p.id}/parede`, {
      multipart: {
        perfil: 'leve',
        revisaoBase: String(revisao),
        arquivo: { name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') },
      },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe('upload da parede (aceite 2)', () => {
  test('HEIC é recusado no browser com mensagem; nada é enviado', async ({ page, request }) => {
    const p = await criarProjeto(request, nomeUnico('Heic'));
    await page.goto(`/projetos/${p.id}`);
    const requisicoes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT') requisicoes.push(r.url());
    });

    await enviarFoto(page, 'tests/fixtures/imagens/documento.heic');
    await expect(page.getByText('Formato não suportado. Use JPG, PNG ou WEBP.')).toBeVisible();
    expect(requisicoes).toEqual([]);
  });

  test('o card da lista mostra a miniatura da foto original (A-17)', async ({ page, request }) => {
    const nome = nomeUnico('Miniatura');
    const p = await criarProjeto(request, nome);
    await page.goto(`/projetos/${p.id}`);
    await enviarFoto(page, CAMINHO_FRONTAL);
    await expect(page.getByText('Correção de perspectiva')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.goto('/');
    const miniatura = page.getByRole('img', { name: `Parede de ${nome}` });
    await expect(miniatura).toBeVisible();
    await expect
      .poll(() => miniatura.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });
});
