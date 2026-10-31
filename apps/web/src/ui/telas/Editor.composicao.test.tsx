import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteApi, ImagemDto, ProjetoDto, VarianteDto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Editor } from './Editor';

// O Konva não roda no jsdom (ADR-10): o palco é trocado por um marcador (como em Editor.test.tsx).
// A última cena recebida fica em `globalThis.__cena`, para os testes chamarem os callbacks do canvas.
vi.mock('../canvas/Palco', () => ({
  Palco: ({ cena }: { cena: unknown }) => {
    (globalThis as unknown as { __cena: unknown }).__cena = cena;
    return <div data-testid="palco" />;
  },
}));
const cenaAtual = () =>
  (globalThis as unknown as { __cena: { onArrastarFoto?: (a: unknown) => void } }).__cena;

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

function variante(fotos: VarianteDto['fotos'] = []): VarianteDto {
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
    fotos,
    schemaVersion: 1,
  };
}

const SEM_ESCALA: NonNullable<ProjetoDto['parede']> = { ...PAREDE_LINEAR, escala: { metodo: null } };

const fotoSalva = (n: number, imagemId: string | null, sobrescrita: Record<string, unknown> = {}) =>
  ({
    _id: hex(500 + n),
    imagemId,
    imagemAnteriorId: null,
    tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
    xCm: 50,
    yCm: 50,
    recorte: { offsetX: 0, offsetY: 0 },
    borda: { larguraCm: 0, cor: '#FFFFFF' },
    ...sobrescrita,
  }) as VarianteDto['fotos'][number];

async function montar(
  opcoes: {
    imagens?: ImagemDto[];
    api?: Partial<ClienteApi>;
    parede?: ProjetoDto['parede'];
    fotos?: VarianteDto['fotos'];
  } = {},
) {
  const inicial = {
    projeto: projeto(opcoes.parede ?? PAREDE_LINEAR),
    variantes: [variante(opcoes.fotos)],
  };
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
    obterConfig: vi.fn(async () => ({ uploadMaxMb: 50 })),
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

  it('o contador mostra quantas fotos o filtro ativo exibe (A-01)', async () => {
    await montar();
    const lista = screen.getByRole('complementary', { name: 'Biblioteca' });
    expect(within(lista).getByText('2 fotos')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(within(lista).getByText('1 foto')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(within(lista).getByText('0 fotos')).toBeTruthy();
  });

  it('estados vazios por filtro (§3.1)', async () => {
    await montar({ imagens: [] });
    expect(screen.getByText('Nenhuma foto na biblioteca. Carregue fotos para começar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(screen.getByText('Nenhuma foto neste projeto ainda.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(screen.getByText('Nenhuma foto salva nesta variante ainda.')).toBeTruthy();
  });

  it('miniatura de 92 px, com tooltip de nome e orientação natural (A-02)', async () => {
    await montar();
    const botao = miniatura('retrato.jpg');
    expect(botao.querySelector('span[class*="h-[92px]"]')).not.toBeNull();
    expect(botao.getAttribute('title')).toBe('retrato.jpg · Retrato natural');
    expect(miniatura('paisagem.jpg').getAttribute('title')).toBe('paisagem.jpg · Paisagem natural');
  });

  it('filtros mostram só o estado salvo (M2-05): "Projeto" pelas associações; "Variante" pelas fotos salvas', async () => {
    // paisagem.jpg é de outro projeto; a variante salva já usa a paisagem.jpg.
    await montar({ fotos: [fotoSalva(1, hex(2))] });
    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(miniatura('paisagem.jpg')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^retrato\.jpg/ })).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(miniatura('retrato.jpg')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^paisagem\.jpg/ })).toBeNull(); // usada, mas ainda não associada
  });

  it('foto adicionada e não salva não entra em "Variante" nem em "Projeto" até o Salvar', async () => {
    await montar();
    adicionarFoto('paisagem.jpg');
    fireEvent.click(screen.getByRole('radio', { name: 'Variante' }));
    expect(screen.getByText('Nenhuma foto salva nesta variante ainda.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(screen.queryByRole('button', { name: /^paisagem\.jpg/ })).toBeNull();
  });

  it('depois de salvar, a biblioteca é recarregada e os filtros refletem o salvo', async () => {
    const associada = { ...PAISAGEM, projetos: [ID_PROJETO, hex(302)] };
    const listarImagens = vi
      .fn()
      .mockResolvedValueOnce([RETRATO, PAISAGEM])
      .mockResolvedValue([RETRATO, associada]);
    await montar({ api: { listarImagens } });
    adicionarFoto('paisagem.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(listarImagens).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('radio', { name: 'Variante' }));
    expect(await screen.findByRole('button', { name: /^paisagem\.jpg/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(await screen.findByRole('button', { name: /^paisagem\.jpg/ })).toBeTruthy();
  });

  it('sem escala: lista e "Carregar fotos" funcionam, as miniaturas não arrastam e o texto muda (A-05, A-20, §3.1)', async () => {
    await montar({ parede: SEM_ESCALA });
    const carregar = screen.getByRole('button', { name: 'Carregar fotos' });
    expect(carregar.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(carregar);
    expect(await screen.findByRole('dialog', { name: 'Carregar fotos' })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Defina a escala da parede para colocar fotos nela.')).toBeTruthy();
    expect(screen.queryByText(/As fotos ficam disponíveis/)).toBeNull();
    expect(miniatura('retrato.jpg').getAttribute('draggable')).toBe('false');
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

  it('duplo clique na miniatura não faz nada: só "Adicionar" ou arrastar põe a foto na parede (A-03)', async () => {
    await montar();
    fireEvent.doubleClick(miniatura('paisagem.jpg'));
    expect(screen.getByText('Nenhuma foto selecionada')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Composição' })).toBeTruthy();
    expect(screen.queryByText('Tamanho externo')).toBeNull();
  });

  it('o clique seleciona uma miniatura por vez, independente da seleção na parede (A-03)', async () => {
    await montar();
    fireEvent.click(miniatura('retrato.jpg'));
    fireEvent.click(miniatura('paisagem.jpg'));
    expect(miniatura('paisagem.jpg').getAttribute('aria-pressed')).toBe('true');
    expect(miniatura('retrato.jpg').getAttribute('aria-pressed')).toBe('false');
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

describe('ordem na pilha (M2-08)', () => {
  const frente = () => screen.getByRole('button', { name: 'Trazer para frente' });
  const tras = () => screen.getByRole('button', { name: 'Enviar para trás' });

  it('"Trazer para frente" fica inativo no topo; "Enviar para trás", no fundo', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    adicionarFoto('paisagem.jpg'); // a segunda fica no topo, selecionada
    expect(frente().getAttribute('aria-disabled')).toBe('true');
    expect(tras().getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(tras()); // uma posição: agora está no fundo
    expect(tras().getAttribute('aria-disabled')).toBe('true');
    expect(frente().getAttribute('aria-disabled')).toBeNull();
  });

  it('com uma foto só, ela está no topo e no fundo: as duas ações ficam inativas', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    expect(frente().getAttribute('aria-disabled')).toBe('true');
    expect(tras().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('barra de status (M2-01, §3.10, A-07)', () => {
  it('com snap, a dica diz 1 passo do grid e 5 passos', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    expect(screen.getByText('Setas: 1 passo do grid · Shift + setas: 5 passos')).toBeTruthy();
  });

  it('sem snap, a dica diz 1 cm e 5 cm', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Snap ao grid' }));
    expect(screen.getByText('Setas: 1 cm · Shift + setas: 5 cm')).toBeTruthy();
  });

  it('X/Y da foto selecionada e, à direita, o aviso de medidas aproximadas', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    expect(screen.getByText('X 145,0 · Y 105,0 cm')).toBeTruthy();
    expect(screen.getByText('Medidas aproximadas, parede considerada plana')).toBeTruthy();
  });

  it('a posição ao vivo do arraste aparece na barra, sem mexer na foto nem no desfazer', async () => {
    await montar();
    adicionarFoto('retrato.jpg');
    const id = (cenaAtual() as unknown as { fotos: { id: string }[] }).fotos[0]!.id;
    act(() => cenaAtual().onArrastarFoto?.({ id, xCm: 77.5, yCm: 12 }));
    expect(screen.getByText('X 77,5 · Y 12,0 cm')).toBeTruthy();
    expect(campoX().value).toBe('145,0');
    act(() => cenaAtual().onArrastarFoto?.(null));
    expect(screen.getByText('X 145,0 · Y 105,0 cm')).toBeTruthy();
  });
});

describe('Ctrl+S e o modo de recorte (A-11)', () => {
  it('Ctrl+S não salva durante o recorte e volta a salvar depois de concluir', async () => {
    const { api } = await montar();
    adicionarFoto('retrato.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(api.salvarVariante).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(api.salvarVariante).toHaveBeenCalledTimes(1));
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

describe('diálogo Carregar fotos (RF-20, RF-21, RF-25, DV-10, A-17, A-18, A-28)', () => {
  const arquivo = (nome: string, tipo = 'image/jpeg', bytes = 2048) =>
    new File([new Uint8Array(bytes)], nome, { type: tipo });

  function escolher(arquivos: File[]) {
    const entrada = screen.getByTestId('entrada-arquivos') as HTMLInputElement;
    Object.defineProperty(entrada, 'files', { value: arquivos, configurable: true });
    fireEvent.change(entrada);
  }

  // Envio que só termina quando o teste manda: permite ver "Na fila", "Enviando" e "Processando…".
  function envioControlado() {
    const pendentes: {
      nome: string;
      progresso: (f: number) => void;
      concluir: (bytes?: number) => void;
      falhar: (erro: unknown) => void;
    }[] = [];
    const enviar = vi.fn(
      (dados: { arquivo: File; perfil: string }, opcoes?: { onProgresso?: (f: number) => void }) =>
        new Promise<ImagemDto>((resolve, reject) => {
          pendentes.push({
            nome: dados.arquivo.name,
            progresso: (f) => opcoes?.onProgresso?.(f),
            concluir: (bytes = 412 * 1024) =>
              resolve({ ...imagem(50 + pendentes.length, dados.arquivo.name, 'retrato'), bytes }),
            falhar: reject,
          });
        }),
    );
    return { enviar, pendentes };
  }

  async function abrirDialogo(opcoes: Parameters<typeof montar>[0] = {}) {
    const montado = await montar(opcoes);
    fireEvent.click(screen.getByRole('button', { name: 'Carregar fotos' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
    return { ...montado, dialogo };
  }

  it('abre com Leve marcado, nada na fila e sem botão Enviar', async () => {
    const { dialogo } = await abrirDialogo();
    expect(within(dialogo).getByRole('radio', { name: /Leve/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialogo).getByText('1024 px')).toBeTruthy();
    expect(
      within(dialogo).getByText('Convertidas para WebP. Seus arquivos originais não são alterados.'),
    ).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: /^Enviar/ })).toBeNull();
  });

  it('escolher arquivos inicia o envio na hora, com o perfil já escolhido; ignorados contados com o motivo', async () => {
    const enviarImagem = vi.fn(async (dados: { arquivo: File; perfil: string }) => ({
      ...imagem(50 + enviarImagem.mock.calls.length, dados.arquivo.name, 'retrato'),
      perfil: dados.perfil,
    }));
    const { dialogo } = await abrirDialogo({
      api: { enviarImagem: enviarImagem as unknown as ClienteApi['enviarImagem'] },
    });

    fireEvent.click(within(dialogo).getByRole('radio', { name: /Alto/ }));
    act(() =>
      escolher([arquivo('um.jpg'), arquivo('dois.png', 'image/png'), arquivo('tres.heic', 'image/heic')]),
    );

    await waitFor(() => expect(within(dialogo).getByText('2 de 2 enviadas')).toBeTruthy());
    expect(enviarImagem).toHaveBeenCalledTimes(2);
    expect(enviarImagem.mock.calls.every(([dados]) => dados.perfil === 'alto')).toBe(true);
    expect(enviarImagem.mock.calls[0]![0]).toMatchObject({ projetoId: ID_PROJETO });
    expect(within(dialogo).getByText('1 arquivo ignorado por formato')).toBeTruthy();
    // O inválido aparece na lista, com o motivo.
    expect(within(dialogo).getByText('tres.heic')).toBeTruthy();
    expect(within(dialogo).getByText('Formato não suportado')).toBeTruthy();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // As novas entram na biblioteca na hora, sem recarregar.
    expect(screen.getByRole('button', { name: /^um\.jpg/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^dois\.png/ })).toBeTruthy();
  });

  it('a qualidade trava no primeiro envio e só destrava ao fechar o diálogo; arquivos novos entram na mesma fila', async () => {
    const { enviar, pendentes } = envioControlado();
    const { dialogo } = await abrirDialogo({
      api: { enviarImagem: enviar as unknown as ClienteApi['enviarImagem'] },
    });
    fireEvent.click(within(dialogo).getByRole('radio', { name: /Médio/ }));
    act(() => escolher([arquivo('a.jpg')]));
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    expect(within(dialogo).getByRole('radio', { name: /Leve/ }).hasAttribute('disabled')).toBe(true);

    act(() => pendentes[0]!.concluir());
    await waitFor(() => expect(within(dialogo).getByText('1 de 1 enviadas')).toBeTruthy());
    // Lote acabou, mas o diálogo segue aberto: continua travada.
    expect(within(dialogo).getByRole('radio', { name: /Leve/ }).hasAttribute('disabled')).toBe(true);

    act(() => escolher([arquivo('b.jpg')]));
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(2));
    expect(enviar.mock.calls[1]![0].perfil).toBe('medio');
    act(() => pendentes[1]!.concluir());
    await waitFor(() => expect(within(dialogo).getByText('2 de 2 enviadas')).toBeTruthy());
  });

  it('estados por arquivo: Na fila · Enviando nn% · Processando… · Concluída com o tamanho (A-18)', async () => {
    const { enviar, pendentes } = envioControlado();
    const { dialogo } = await abrirDialogo({
      api: { enviarImagem: enviar as unknown as ClienteApi['enviarImagem'] },
    });
    act(() => escolher([arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg'), arquivo('d.jpg')]));
    await waitFor(() => expect(pendentes).toHaveLength(3));
    expect(within(dialogo).getByText('Na fila')).toBeTruthy(); // o 4º espera uma vaga (3 em paralelo)

    act(() => pendentes[0]!.progresso(0.42));
    expect(within(dialogo).getByText('Enviando 42%')).toBeTruthy();

    act(() => pendentes[1]!.progresso(1)); // subiu tudo; o servidor ainda processa
    expect(within(dialogo).getByText('Processando…')).toBeTruthy();

    act(() => pendentes[1]!.concluir(412 * 1024));
    await waitFor(() => expect(within(dialogo).getByText(/^Concluída.*412 KB/)).toBeTruthy());
    await waitFor(() => expect(pendentes).toHaveLength(4)); // a vaga liberada pega o 4º
    expect(within(dialogo).queryByText('Na fila')).toBeNull();
  });

  it('falha de rede ou 5xx: "Falhou" com "Tentar de novo"; 415: "Não foi possível ler a imagem." sem repetir', async () => {
    const { ErroApi } = await import('../../infra/dto');
    const enviarImagem = vi.fn(async (dados: { arquivo: File }) => {
      if (dados.arquivo.name === 'rede.jpg') throw new ErroApi(0, { erro: 'Servidor local indisponível.' });
      if (dados.arquivo.name === 'ilegivel.jpg')
        throw new ErroApi(415, { erro: 'Não foi possível ler a imagem.' });
      return imagem(60, dados.arquivo.name, 'retrato');
    });
    const { dialogo } = await abrirDialogo({
      api: { enviarImagem: enviarImagem as unknown as ClienteApi['enviarImagem'] },
    });
    act(() => escolher([arquivo('rede.jpg'), arquivo('ilegivel.jpg'), arquivo('boa.jpg')]));

    await waitFor(() => expect(within(dialogo).getByText('1 de 3 enviadas')).toBeTruthy());
    expect(within(dialogo).getByText(/^Falhou.*Servidor local indisponível./)).toBeTruthy();
    expect(within(dialogo).getByText('Não foi possível ler a imagem.')).toBeTruthy();
    expect(within(dialogo).getAllByRole('button', { name: 'Tentar de novo' })).toHaveLength(1);
  });

  it('o limite de upload vem do servidor, não fixo em 50 MB (A-28)', async () => {
    const { dialogo, api } = await abrirDialogo({
      api: { obterConfig: vi.fn(async () => ({ uploadMaxMb: 2 })) },
    });
    expect(api.enviarImagem).not.toHaveBeenCalled();
    await waitFor(() => expect(api.obterConfig).toHaveBeenCalled());
    act(() => escolher([arquivo('grande.jpg', 'image/jpeg', 3 * 1024 * 1024)]));
    expect(within(dialogo).getByText('Arquivo maior que 2 MB.')).toBeTruthy();
    expect(api.enviarImagem).not.toHaveBeenCalled();
  });

  it('"Cancelar restantes" fica ativo com envios pendentes; "Concluir" só sem pendentes; fechar pergunta', async () => {
    const { enviar, pendentes } = envioControlado();
    const { dialogo } = await abrirDialogo({
      api: { enviarImagem: enviar as unknown as ClienteApi['enviarImagem'] },
    });
    act(() => escolher([arquivo('a.jpg'), arquivo('b.jpg')]));
    await waitFor(() => expect(pendentes).toHaveLength(2));
    expect(within(dialogo).getByRole('button', { name: 'Cancelar restantes' })).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: 'Concluir' })).toBeNull();

    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(await within(dialogo).findByText('Cancelar os envios restantes?')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar enviando' }));

    act(() => {
      pendentes[0]!.concluir();
      pendentes[1]!.concluir();
    });
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Concluir' })).toBeTruthy());
    expect(within(dialogo).queryByRole('button', { name: 'Cancelar restantes' })).toBeNull();
  });

  describe('arquivos soltos sobre a Biblioteca (A-17, A-18)', () => {
    const soltar = (arquivos: File[]) => {
      const biblioteca = screen.getByRole('complementary', { name: 'Biblioteca' });
      fireEvent.drop(biblioteca, { dataTransfer: { types: ['Files'], files: arquivos, items: [] } });
    };

    it('abre o diálogo com os arquivos "Aguardando" e o botão primário "Enviar"; nada é enviado antes', async () => {
      const { api } = await montar();
      soltar([arquivo('um.jpg'), arquivo('dois.png', 'image/png')]);
      const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
      expect(within(dialogo).getAllByText('Aguardando')).toHaveLength(2);
      expect(api.enviarImagem).not.toHaveBeenCalled();

      // A qualidade ainda pode ser escolhida; "Enviar" começa o lote.
      fireEvent.click(within(dialogo).getByRole('radio', { name: /Médio/ }));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar 2 fotos' }));
      await waitFor(() => expect(api.enviarImagem).toHaveBeenCalledTimes(2));
      expect((api.enviarImagem as ReturnType<typeof vi.fn>).mock.calls[0]![0].perfil).toBe('medio');
      expect(within(dialogo).queryByRole('button', { name: /^Enviar/ })).toBeNull();
    });

    it('com o diálogo já aberto, escolher arquivos volta a iniciar na hora', async () => {
      const { api } = await montar();
      soltar([arquivo('um.jpg')]);
      const dialogo = await screen.findByRole('dialog', { name: 'Carregar fotos' });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar 1 foto' }));
      await waitFor(() => expect(api.enviarImagem).toHaveBeenCalledTimes(1));
      act(() => escolher([arquivo('dois.jpg')]));
      await waitFor(() => expect(api.enviarImagem).toHaveBeenCalledTimes(2));
    });

    it('funciona também sem escala: a biblioteca é global (A-20)', async () => {
      await montar({ parede: SEM_ESCALA });
      soltar([arquivo('um.jpg')]);
      expect(await screen.findByRole('dialog', { name: 'Carregar fotos' })).toBeTruthy();
    });
  });
});
