import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteApi, ImagemDto, ProjetoDto, VarianteDto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Editor } from './Editor';

// O Konva não roda no jsdom (ADR-10): o palco é trocado por um marcador (como em Editor.test.tsx).
vi.mock('../canvas/Palco', () => ({ Palco: () => <div data-testid="palco" /> }));

// Editor no M2: biblioteca, upload, adicionar, selecionar, mover por teclado, duplicar, remover, ordem,
// desfazer e modo de recorte (spec M2 §3.1 a §3.7).

const hex = (n: number) => n.toString(16).padStart(24, '0');
const ID_PROJETO = hex(301);
const ID_VARIANTE = hex(201);
const SALVA_EM = '2026-10-25T17:35:00.000Z';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const PAREDE_LINEAR: NonNullable<ProjetoDto['parede']> = {
  perfil: 'leve',
  arquivo: `paredes/${ID_PROJETO}.webp`,
  thumb: `paredes/${ID_PROJETO}.thumb.webp`,
  larguraPx: 1200,
  alturaPx: 900,
  escala: {
    metodo: 'linear',
    linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
    homografia: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 1],
  },
};
const AREA_TOTAL = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };

const imagem = (n: number, nome: string, orientacaoNatural: 'retrato' | 'paisagem'): ImagemDto => ({
  _id: hex(n),
  nomeOriginal: nome,
  perfil: 'leve',
  larguraPx: orientacaoNatural === 'paisagem' ? 800 : 600,
  alturaPx: orientacaoNatural === 'paisagem' ? 600 : 800,
  orientacaoNatural,
  bytes: 1,
  arquivos: { render: `imagens/${hex(n)}.webp`, thumb: `imagens/${hex(n)}.thumb.webp` },
  mime: 'image/webp',
  criadaEm: SALVA_EM,
  projetos: n === 1 ? [ID_PROJETO] : [hex(302)],
  excluidaEm: null,
  purgaEm: null,
  schemaVersion: 1,
});
const RETRATO = imagem(1, 'retrato.jpg', 'retrato');
const PAISAGEM = imagem(2, 'paisagem.jpg', 'paisagem');

function projeto(parede: ProjetoDto['parede']): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome: 'Sala',
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 2,
    ultimaVarianteId: ID_VARIANTE,
    parede,
    schemaVersion: 1,
  };
}

function variante(): VarianteDto {
  return {
    _id: ID_VARIANTE,
    projetoId: ID_PROJETO,
    nome: 'Base',
    ordem: 0,
    criadaEm: SALVA_EM,
    revisao: 1,
    salvaEm: SALVA_EM,
    salvaPorSessao: 'sistema',
    grid: { ...GRID_PADRAO },
    bordaPadrao: { ...BORDA_PADRAO },
    areaUtil: AREA_TOTAL,
    fotos: [],
    schemaVersion: 1,
  };
}

async function montar(opcoes: { imagens?: ImagemDto[]; api?: Partial<ClienteApi> } = {}) {
  const inicial = { projeto: projeto(PAREDE_LINEAR), variantes: [variante()] };
  const cliente = {
    listarProjetos: vi.fn(),
    criarProjeto: vi.fn(),
    obterProjeto: vi.fn(async () => inicial),
    renomearProjeto: vi.fn(),
    excluirProjeto: vi.fn(),
    enviarParede: vi.fn(),
    aplicarCalibracao: vi.fn(),
    aplicarPerspectiva: vi.fn(),
    listarImagens: vi.fn(async () => opcoes.imagens ?? [RETRATO, PAISAGEM]),
    enviarImagem: vi.fn(),
    salvarVariante: vi.fn(async () => ({ revisao: 2, salvaEm: SALVA_EM })),
    ...opcoes.api,
  } as unknown as ClienteApi;
  render(
    <TooltipProvider>
      <Editor projetoId={ID_PROJETO} api={cliente} navegar={vi.fn()} />
    </TooltipProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  if ((opcoes.imagens ?? [RETRATO, PAISAGEM]).length > 0)
    await screen.findByRole('button', { name: /^retrato\.jpg/ });
  return { api: cliente };
}

const miniatura = (nome: string) => screen.getByRole('button', { name: new RegExp(`^${nome}, `) });
const adicionar = () => screen.getByRole('button', { name: 'Adicionar' });
const campoX = () => screen.getByLabelText('X', { selector: 'input' }) as HTMLInputElement;

// Seleciona a miniatura e usa "Adicionar": a foto nova fica selecionada.
function adicionarFoto(nome: string) {
  fireEvent.click(miniatura(nome));
  fireEvent.click(adicionar());
}

describe('biblioteca (RF-22, RF-27, RF-28)', () => {
  it('lista as miniaturas com nome e orientação natural e o contador', async () => {
    await montar();
    const lista = screen.getByRole('complementary', { name: 'Biblioteca' });
    expect(within(lista).getByText('2 fotos')).toBeTruthy();
    expect(miniatura('retrato.jpg').textContent).toContain('Retrato');
    expect(miniatura('paisagem.jpg').textContent).toContain('Paisagem');
  });

  it('biblioteca vazia: avisa; filtro sem resultado: avisa', async () => {
    await montar({ imagens: [] });
    expect(screen.getByText('Nenhuma foto na biblioteca ainda.')).toBeTruthy();
  });

  it('filtros: "Projeto" tem só as do projeto; "Variante", só as usadas (B-08)', async () => {
    await montar();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(screen.queryByRole('button', { name: /^paisagem\.jpg/ })).toBeNull();
    expect(miniatura('retrato.jpg')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(screen.getByText('Nenhuma foto neste filtro.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Todas' }));
    fireEvent.doubleClick(miniatura('paisagem.jpg')); // usa a imagem de outro projeto nesta variante
    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(miniatura('paisagem.jpg')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(miniatura('paisagem.jpg')).toBeTruthy();
  });

  it('"Excluídas" fica no menu ⋯, visível e inativa (M4)', async () => {
    await montar();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Mais filtros' }), {
      button: 0,
      ctrlKey: false,
    });
    const item = await screen.findByRole('menuitem', { name: 'Excluídas' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });

  it('a busca por nome segue inativa (RF-33c)', async () => {
    await montar();
    expect(screen.getByLabelText('Buscar por nome').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('adicionar, selecionar e remover (RF-30, RF-35)', () => {
  it('"Adicionar" só vale com uma foto escolhida na biblioteca (M2-04)', async () => {
    await montar();
    expect(adicionar().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(miniatura('retrato.jpg'));
    expect(miniatura('retrato.jpg').getAttribute('aria-pressed')).toBe('true');
    expect(adicionar().getAttribute('aria-disabled')).toBeNull();
  });

  it('adiciona a foto, abre o painel dela e marca "Alterações não salvas"', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    expect(screen.getByText('Tamanho externo')).toBeTruthy();
    expect(screen.getByText('10,0 × 15,0 cm')).toBeTruthy();
    expect(campoX().value).toBe('145,0');
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
    expect(screen.queryByText('Nenhuma foto selecionada')).toBeNull();
  });

  it('duplo clique na miniatura também adiciona', async () => {
    await montar();
    fireEvent.doubleClick(miniatura('paisagem.jpg'));
    expect(screen.getByText('15,0 × 10,0 cm')).toBeTruthy(); // 10×15 na orientação natural: paisagem
  });

  it('Esc desseleciona e o painel volta a ser o da composição, com o resumo', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Composição' })).toBeTruthy();
    expect(screen.getByText('10,0 × 15,0 cm')).toBeTruthy(); // área total = bounding box
  });

  it('Duplicar copia a foto e seleciona a cópia; Remover tira da variante', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicar' })[0]!); // a da toolbar
    expect(campoX().value).toBe('150,0'); // um passo do grid adiante
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
  });

  it('a foto escolhida no canvas habilita Duplicar e as ações de ordem', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Duplicar' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Trazer para frente' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    adicionarFoto('retrato.jpg');
    expect(
      screen.getByRole('button', { name: 'Trazer para frente' }).getAttribute('aria-disabled'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Enviar para trás' }).getAttribute('aria-disabled')).toBeNull();
  });
});

describe('teclado (RN-16, RF-70)', () => {
  it('setas movem a foto selecionada pelo grid; Shift avança 5 linhas', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(campoX().value).toBe('150,0');
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    expect(campoX().value).toBe('175,0');
  });

  it('as setas dentro de um campo são do campo', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.keyDown(campoX(), { key: 'ArrowRight' });
    expect(campoX().value).toBe('145,0');
  });

  it('Ctrl+Z desfaz e Ctrl+Shift+Z / Ctrl+Y refazem; os botões do header acompanham as pilhas', async () => {
    await montar();
    const desfazer = () => screen.getByRole('button', { name: 'Desfazer' });
    const refazer = () => screen.getByRole('button', { name: 'Refazer' });
    expect(desfazer().getAttribute('aria-disabled')).toBe('true');

    adicionarFoto('retrato.jpg');
    expect(desfazer().getAttribute('aria-disabled')).toBeNull();

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
    expect(refazer().getAttribute('aria-disabled')).toBeNull();

    // Refazer devolve a foto (a seleção não volta: o painel segue sendo o da composição, com 1 foto).
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(screen.getByText('10,0 × 15,0 cm')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(screen.queryByText('10,0 × 15,0 cm')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true });
    expect(screen.getByText('10,0 × 15,0 cm')).toBeTruthy();

    fireEvent.click(desfazer());
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
  });

  it('Ctrl+Z dentro de um campo é do campo (não desfaz a composição)', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.keyDown(campoX(), { key: 'z', ctrlKey: true });
    expect(campoX().value).toBe('145,0');
  });

  it('salvar envia as fotos e mantém o histórico', async () => {
    const { api } = await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.salvarVariante).toHaveBeenCalledWith(
        ID_PROJETO,
        ID_VARIANTE,
        expect.objectContaining({
          fotos: [expect.objectContaining({ imagemId: hex(1), xCm: 145, yCm: 105 })],
        }),
      ),
    );
    expect(await screen.findByText('Salvo às 14:35')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desfazer' }).getAttribute('aria-disabled')).toBeNull();
  });
});

describe('modo de recorte (RN-14)', () => {
  it('Ajustar recorte abre o modo; Cancelar volta sem alterar; Concluir sem mudança não cria passo', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    expect(screen.getByText('Ajustar recorte · retrato.jpg')).toBeTruthy();
    expect(screen.getByText('O restante da parede fica bloqueado até concluir')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Ajustar recorte · retrato.jpg')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByText('Ajustar recorte · retrato.jpg')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); // desfaz o "adicionar", não o recorte
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
  });

  it('Esc cancela e Enter conclui', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Ajustar recorte · retrato.jpg')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByText('Ajustar recorte · retrato.jpg')).toBeNull();
  });
});

describe('diálogo Carregar fotos (RF-20, RF-21, RF-25, DV-10, M2-07)', () => {
  const arquivo = (nome: string, tipo = 'image/jpeg') =>
    new File([new Uint8Array(2048)], nome, { type: tipo });

  function escolher(arquivos: File[]) {
    const entrada = screen.getByTestId('entrada-arquivos') as HTMLInputElement;
    Object.defineProperty(entrada, 'files', { value: arquivos, configurable: true });
    fireEvent.change(entrada);
  }

  it('abre com Leve marcado e nada na fila', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar fotos' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
    expect(within(dialogo).getByRole('radio', { name: /Leve/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialogo).getByText('1024 px')).toBeTruthy();
    expect(
      within(dialogo).getByText('Convertidas para WebP. Seus arquivos originais não são alterados.'),
    ).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: /^Enviar/ })).toBeNull();
  });

  it('a fila só envia em "Enviar N fotos", com o perfil escolhido; ignorados são contados', async () => {
    const enviarImagem = vi.fn(async (dados: { arquivo: File; perfil: string }) => ({
      ...imagem(50 + enviarImagem.mock.calls.length, dados.arquivo.name, 'retrato'),
      perfil: dados.perfil,
    }));
    await montar({ api: { enviarImagem: enviarImagem as unknown as ClienteApi['enviarImagem'] } });
    fireEvent.click(screen.getByRole('button', { name: 'Carregar fotos' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });

    fireEvent.click(within(dialogo).getByRole('radio', { name: /Alto/ }));
    act(() =>
      escolher([arquivo('um.jpg'), arquivo('dois.png', 'image/png'), arquivo('tres.heic', 'image/heic')]),
    );

    expect(within(dialogo).getByText('1 arquivo ignorado por formato')).toBeTruthy();
    expect(within(dialogo).getAllByText('Aguardando')).toHaveLength(2);
    expect(enviarImagem).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar 2 fotos' }));
    await waitFor(() => expect(within(dialogo).getByText('2 de 2 enviadas')).toBeTruthy());
    expect(enviarImagem).toHaveBeenCalledTimes(2);
    expect(enviarImagem.mock.calls.every(([dados]) => dados.perfil === 'alto')).toBe(true);
    expect(enviarImagem.mock.calls[0]![0]).toMatchObject({ projetoId: ID_PROJETO });

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // As novas entram na biblioteca na hora, sem recarregar.
    expect(screen.getByRole('button', { name: /^um\.jpg/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^dois\.png/ })).toBeTruthy();
  });

  it('falha de um arquivo mostra o motivo e "Tentar de novo", sem parar o lote', async () => {
    let chamadas = 0;
    const enviarImagem = vi.fn(async (dados: { arquivo: File }) => {
      chamadas += 1;
      if (dados.arquivo.name === 'ruim.jpg') {
        const { ErroApi } = await import('../../infra/dto');
        throw new ErroApi(415, { erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' });
      }
      return imagem(60 + chamadas, dados.arquivo.name, 'retrato');
    });
    await montar({ api: { enviarImagem: enviarImagem as unknown as ClienteApi['enviarImagem'] } });
    fireEvent.click(screen.getByRole('button', { name: 'Carregar fotos' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
    act(() => escolher([arquivo('ruim.jpg'), arquivo('boa.jpg')]));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar 2 fotos' }));

    await waitFor(() => expect(within(dialogo).getByText('1 de 2 enviadas')).toBeTruthy());
    expect(within(dialogo).getByText('Falhou: Formato não suportado. Use JPG, PNG ou WEBP.')).toBeTruthy();
    expect(within(dialogo).getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });

  it('Cancelar antes de enviar fecha sem enviar nada', async () => {
    const { api } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar fotos' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
    act(() => escolher([arquivo('um.jpg')]));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.enviarImagem).not.toHaveBeenCalled();
  });
});
