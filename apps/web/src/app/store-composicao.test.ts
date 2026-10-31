import { BORDA_PADRAO, GRID_PADRAO, tamanhoSugerido } from '@deco-wall/domain';
import { describe, expect, it, vi } from 'vitest';
import type { ClienteApi, ImagemDto, ProjetoDto, VarianteDto } from '../infra/dto';
import { criarStoreEditor } from './store';

// Store do editor no M2 (docs/specs/M2-biblioteca-e-composicao.md §3, §6): biblioteca, fotos na parede,
// seleção, recorte e desfazer/refazer. O cliente HTTP entra por injeção; os ids são determinísticos.

const hex = (n: number) => n.toString(16).padStart(24, '0');
const ID_PROJETO = hex(301);
const ID_VARIANTE = hex(201);
const SALVA_EM = '2026-10-25T17:35:00.000Z';

// Parede linear de 1200 × 900 px a 4 px/cm → parede inteira 300 × 225 cm.
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

const imagem = (n: number, orientacaoNatural: 'retrato' | 'paisagem'): ImagemDto => ({
  _id: hex(n),
  nomeOriginal: `foto-${n}.jpg`,
  perfil: 'leve',
  larguraPx: orientacaoNatural === 'paisagem' ? 800 : 600,
  alturaPx: orientacaoNatural === 'paisagem' ? 600 : 800,
  orientacaoNatural,
  bytes: 1,
  arquivos: { render: `imagens/${hex(n)}.webp`, thumb: `imagens/${hex(n)}.thumb.webp` },
  mime: 'image/webp',
  criadaEm: SALVA_EM,
  projetos: [ID_PROJETO],
  excluidaEm: null,
  purgaEm: null,
  schemaVersion: 1,
});
const RETRATO = imagem(1, 'retrato');
const PAISAGEM = imagem(2, 'paisagem');

function variante(sobrescrita: Partial<VarianteDto> = {}): VarianteDto {
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
    ...sobrescrita,
  };
}

function projeto(parede: ProjetoDto['parede'] = PAREDE_LINEAR): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome: 'Sala',
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 3,
    ultimaVarianteId: ID_VARIANTE,
    parede,
    schemaVersion: 1,
  };
}

async function aberto(opcoes: { parede?: ProjetoDto['parede']; variante?: Partial<VarianteDto> } = {}) {
  const inicial = { projeto: projeto(opcoes.parede), variantes: [variante(opcoes.variante)] };
  const api = {
    listarProjetos: vi.fn(async () => []),
    criarProjeto: vi.fn(async () => inicial),
    obterProjeto: vi.fn(async () => inicial),
    renomearProjeto: vi.fn(),
    excluirProjeto: vi.fn(),
    enviarParede: vi.fn(),
    aplicarCalibracao: vi.fn(),
    aplicarPerspectiva: vi.fn(),
    listarImagens: vi.fn(async () => [RETRATO, PAISAGEM]),
    enviarImagem: vi.fn(),
    salvarVariante: vi.fn(async () => ({ revisao: 2, salvaEm: SALVA_EM })),
  } as unknown as ClienteApi;
  let n = 900;
  const store = criarStoreEditor(api, { gerarId: () => hex(n++) });
  await store.getState().abrirProjeto(ID_PROJETO);
  await store.getState().carregarBiblioteca();
  const estado = () => store.getState();
  const fotos = () => estado().conteudo!.fotos;
  return { api, store, estado, fotos };
}

describe('biblioteca', () => {
  it('carregarBiblioteca traz as imagens da API', async () => {
    const { estado } = await aberto();
    expect(estado().biblioteca.imagens.map((i) => i._id)).toEqual([hex(1), hex(2)]);
    expect(estado().biblioteca.erro).toBeNull();
  });

  it('falha ao carregar vira mensagem, sem derrubar o editor', async () => {
    const { api, estado } = await aberto();
    (api.listarImagens as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Servidor local indisponível.'),
    );
    await estado().carregarBiblioteca();
    expect(estado().biblioteca.erro).toBe('Servidor local indisponível.');
  });

  it('adotarImagem põe a nova no começo e não duplica', async () => {
    const { estado } = await aberto();
    const nova = imagem(3, 'retrato');
    estado().adotarImagem(nova);
    estado().adotarImagem(nova);
    expect(estado().biblioteca.imagens.map((i) => i._id)).toEqual([hex(3), hex(1), hex(2)]);
  });

  it('seleciona e desseleciona uma imagem da biblioteca', async () => {
    const { estado } = await aberto();
    estado().selecionarImagemDaBiblioteca(hex(2));
    expect(estado().ui.bibliotecaSelecaoId).toBe(hex(2));
    estado().selecionarImagemDaBiblioteca(null);
    expect(estado().ui.bibliotecaSelecaoId).toBeNull();
  });
});

describe('adicionarFoto (RF-30, RN-03, RN-04, RN-13, A-04)', () => {
  it('10×15 na orientação natural, centralizada na área útil e encaixada no grid', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(2)); // paisagem → 15 × 10
    expect(id).toBe(hex(900));
    expect(fotos()).toHaveLength(1);
    expect(fotos()[0]).toEqual({
      _id: hex(900),
      imagemId: hex(2),
      imagemAnteriorId: null,
      tamanho: { sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 },
      xCm: 145,
      yCm: 110,
      recorte: { offsetX: 0, offsetY: 0 },
      borda: { larguraCm: 0, cor: '#FFFFFF' },
    });
  });

  it('seleciona a foto nova e marca "Alterações não salvas"', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1));
    expect(estado().ui.selecaoId).toBe(id);
    expect(estado().documento.sujo).toBe(true);
    expect(estado().documento.salvamento).toEqual({ tipo: 'alteracoes' });
  });

  it('usa a borda padrão da variante nas fotos novas (RN-03)', async () => {
    const { estado, fotos } = await aberto();
    estado().alterarBordaPadrao({ larguraCm: 2, cor: '#C8A27A' });
    estado().adicionarFoto(hex(1));
    expect(fotos()[0]!.borda).toEqual({ larguraCm: 2, cor: '#C8A27A' });
  });

  it('ao soltar da biblioteca, o centro da foto vai ao ponto de soltura, encaixado no grid', async () => {
    const { estado, fotos } = await aberto();
    estado().adicionarFoto(hex(2), { x: 100, y: 100 });
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([95, 95]);
  });

  it('a mesma imagem pode entrar várias vezes (RN-13), em cascata', async () => {
    const { estado, fotos } = await aberto();
    estado().adicionarFoto(hex(1));
    estado().adicionarFoto(hex(1));
    expect(fotos()).toHaveLength(2);
    expect(fotos()[1]!.xCm).not.toBe(fotos()[0]!.xCm);
  });

  it('sem escala definida nada é adicionado (RF-13, RN-08)', async () => {
    const { estado, fotos } = await aberto({
      parede: { ...PAREDE_LINEAR, escala: { metodo: null } },
      variante: { areaUtil: null },
    });
    expect(estado().adicionarFoto(hex(1))).toBeNull();
    expect(fotos()).toHaveLength(0);
    expect(estado().documento.sujo).toBe(false);
  });

  it('imagem que não está na biblioteca não é adicionada', async () => {
    const { estado, fotos } = await aberto();
    expect(estado().adicionarFoto(hex(77))).toBeNull();
    expect(fotos()).toHaveLength(0);
  });

  it('adicionarFotoSelecionada usa a imagem escolhida na biblioteca', async () => {
    const { estado, fotos } = await aberto();
    expect(estado().adicionarFotoSelecionada()).toBeNull();
    estado().selecionarImagemDaBiblioteca(hex(1));
    estado().adicionarFotoSelecionada();
    expect(fotos()[0]!.imagemId).toBe(hex(1));
  });
});

describe('seleção e movimento (RF-34, RN-16)', () => {
  it('selecionarFoto ignora ids que não existem', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().selecionarFoto(null);
    expect(estado().ui.selecaoId).toBeNull();
    estado().selecionarFoto(hex(55));
    expect(estado().ui.selecaoId).toBeNull();
    estado().selecionarFoto(id);
    expect(estado().ui.selecaoId).toBe(id);
  });

  it('moverFoto grava a posição a 0,1 cm sem snap e encaixa no grid com snap (M2-12)', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 40.04, 25.06);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([40, 25]);
    estado().alterarGrid({ snap: false });
    estado().moverFoto(id, 40.04, 25.06);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([40, 25.1]);
  });

  it('moverPorSeta segue o snap: próxima linha do grid; sem snap, 1 cm', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 12, 20);
    estado().moverPorSeta(id, 'direita', false);
    expect(fotos()[0]!.xCm).toBe(15);
    estado().moverPorSeta(id, 'baixo', true);
    expect(fotos()[0]!.yCm).toBe(45);

    estado().alterarGrid({ snap: false });
    estado().moverPorSeta(id, 'esquerda', false);
    expect(fotos()[0]!.xCm).toBe(14);
  });
});

describe('tamanho, orientação e borda (RF-31, RF-32, RF-41, RN-05, M2-09, M2-10)', () => {
  it('trocarTamanho e trocarOrientacao mantêm o canto superior esquerdo e recentralizam o recorte', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 40, 30);
    estado().trocarTamanho(id, tamanhoSugerido('20x30'));
    expect(fotos()[0]).toMatchObject({
      xCm: 40,
      yCm: 30,
      tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
    });
    estado().trocarOrientacao(id, 'paisagem');
    expect(fotos()[0]).toMatchObject({ xCm: 40, yCm: 30, tamanho: { larguraCm: 30, alturaCm: 20 } });
  });

  it('alterarBordaDaFoto muda largura e cor sem mover a foto; largura limitada a 0–20 cm', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 40, 30);
    estado().alterarBordaDaFoto(id, { larguraCm: 2 });
    estado().alterarBordaDaFoto(id, { cor: '#5C3A21' });
    expect(fotos()[0]).toMatchObject({ xCm: 40, yCm: 30, borda: { larguraCm: 2, cor: '#5C3A21' } });
    estado().alterarBordaDaFoto(id, { larguraCm: 99 });
    expect(fotos()[0]!.borda.larguraCm).toBe(20);
    estado().alterarBordaDaFoto(id, { larguraCm: -3 });
    expect(fotos()[0]!.borda.larguraCm).toBe(0);
  });

  it('alterar a borda padrão não mexe nas fotos que já estão na parede (RN-03)', async () => {
    const { estado, fotos } = await aberto();
    estado().adicionarFoto(hex(1));
    estado().alterarBordaPadrao({ larguraCm: 3 });
    expect(fotos()[0]!.borda.larguraCm).toBe(0);
    expect(estado().conteudo!.bordaPadrao.larguraCm).toBe(3);
  });
});

describe('duplicar, remover e ordem (RF-35, A-24, A-25)', () => {
  it('duplicarFoto copia 5 cm adiante, no topo, e seleciona a cópia', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().alterarGrid({ snap: false });
    estado().moverFoto(id, 40, 30);
    estado().duplicarFoto(id);
    expect(fotos()).toHaveLength(2);
    expect(fotos()[1]).toMatchObject({ imagemId: hex(1), xCm: 45, yCm: 35 });
    expect(fotos()[1]!._id).not.toBe(id);
    expect(estado().ui.selecaoId).toBe(fotos()[1]!._id);
  });

  it('removerFoto tira a foto da variante e limpa a seleção', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().removerFoto(id);
    expect(fotos()).toHaveLength(0);
    expect(estado().ui.selecaoId).toBeNull();
  });

  it('trazerParaFrente e enviarParaTras mudam a ordem (z-index)', async () => {
    const { estado, fotos } = await aberto();
    const a = estado().adicionarFoto(hex(1))!;
    const b = estado().adicionarFoto(hex(2))!;
    estado().trazerParaFrente(a);
    expect(fotos().map((f) => f._id)).toEqual([b, a]);
    estado().enviarParaTras(a);
    expect(fotos().map((f) => f._id)).toEqual([a, b]);
  });
});

describe('desfazer e refazer (RF-70, RN-18, M2-02, M2-03)', () => {
  it('cada ação é um passo: adicionar, mover e trocar tamanho desfazem na ordem inversa', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 40, 30);
    estado().trocarTamanho(id, tamanhoSugerido('20x30'));

    estado().desfazer();
    expect(fotos()[0]!.tamanho.sugeridoId).toBe('10x15');
    estado().desfazer();
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).not.toEqual([40, 30]);
    estado().desfazer();
    expect(fotos()).toHaveLength(0);
    expect(estado().podeDesfazer()).toBe(false);

    estado().refazer();
    estado().refazer();
    estado().refazer();
    expect(fotos()[0]).toMatchObject({ xCm: 40, yCm: 30, tamanho: { sugeridoId: '20x30' } });
    expect(estado().podeRefazer()).toBe(false);
  });

  it('uma ação nova descarta o que dava para refazer', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().moverFoto(id, 40, 30);
    estado().desfazer();
    expect(estado().podeRefazer()).toBe(true);
    estado().moverFoto(id, 60, 60);
    expect(estado().podeRefazer()).toBe(false);
  });

  it('mover para o mesmo lugar não cria passo', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    const { xCm, yCm } = estado().conteudo!.fotos[0]!;
    estado().desfazer(); // adicionar
    estado().refazer();
    estado().moverFoto(id, xCm, yCm);
    estado().desfazer();
    expect(estado().conteudo!.fotos).toHaveLength(0); // o único passo era o de adicionar
  });

  it('desfazer também marca "Alterações não salvas" e não mexe em projeto, revisão nem status', async () => {
    const { estado, api } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    await estado().salvarVariante();
    expect(estado().documento.sujo).toBe(false);
    const antes = {
      projeto: estado().documento.projeto,
      revisaoBase: estado().documento.revisaoBase,
    };
    estado().moverFoto(id, 90, 90);
    await estado().salvarVariante();
    expect(api.salvarVariante).toHaveBeenCalledTimes(2);

    estado().desfazer();
    expect(estado().documento.sujo).toBe(true);
    expect(estado().documento.salvamento).toEqual({ tipo: 'alteracoes' });
    expect(estado().documento.projeto).toEqual(antes.projeto);
    expect(estado().documento.revisaoBase).toBe(2);
  });

  it('salvar não limpa o histórico (SV-10)', async () => {
    const { estado } = await aberto();
    estado().adicionarFoto(hex(1));
    await estado().salvarVariante();
    expect(estado().podeDesfazer()).toBe(true);
  });

  it('o grid fica fora do histórico (M2-03): desfazer não volta o passo do grid', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().alterarGrid({ passoCm: 10 });
    estado().moverFoto(id, 70, 70);
    estado().desfazer();
    expect(estado().documento.variante!.grid.passoCm).toBe(10);
    estado().desfazer();
    expect(fotos()).toHaveLength(0);
    expect(estado().documento.variante!.grid.passoCm).toBe(10);
  });

  it('a área útil e a borda padrão entram no histórico (M2-03)', async () => {
    const { estado } = await aberto();
    estado().definirAreaUtil({ xCm: 10, yCm: 10, larguraCm: 100, alturaCm: 100 });
    estado().alterarBordaPadrao({ larguraCm: 2 });
    estado().desfazer();
    expect(estado().conteudo!.bordaPadrao.larguraCm).toBe(0);
    estado().desfazer();
    expect(estado().conteudo!.areaUtil).toEqual(AREA_TOTAL);
  });

  it('desfazer remove da seleção a foto que deixou de existir', async () => {
    const { estado } = await aberto();
    estado().adicionarFoto(hex(1));
    estado().desfazer();
    expect(estado().ui.selecaoId).toBeNull();
  });

  it('recarregar o projeto zera o histórico', async () => {
    const { estado } = await aberto();
    estado().adicionarFoto(hex(1));
    await estado().recarregar();
    expect(estado().podeDesfazer()).toBe(false);
    expect(estado().podeRefazer()).toBe(false);
  });

  it('só desfaz no editor: nos modos Perspectiva, Calibração, Área útil e Recorte, não', async () => {
    const { estado, fotos } = await aberto();
    estado().adicionarFoto(hex(1));
    estado().definirModo('area-util');
    estado().desfazer();
    expect(fotos()).toHaveLength(1);
  });

  it('o histórico guarda no máximo 100 passos', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().alterarGrid({ snap: false });
    for (let i = 1; i <= 110; i += 1) estado().moverFoto(id, i, i);
    let passos = 0;
    while (estado().podeDesfazer()) {
      estado().desfazer();
      passos += 1;
    }
    expect(passos).toBe(100);
  });
});

describe('modo de recorte (RN-14, RN-28, DESIGN §7.0)', () => {
  it('abrirRecorte entra no modo com um rascunho do tamanho e do recorte da foto', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id);
    expect(estado().ui.modo).toBe('recorte');
    expect(estado().ui.recorte).toEqual({
      fotoId: id,
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      offset: { offsetX: 0, offsetY: 0 },
      personalizado: false,
    });
  });

  it('"Personalizado…" abre o modo com os campos de largura e altura visíveis (RN-28)', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id, { personalizado: true });
    expect(estado().ui.recorte!.personalizado).toBe(true);
    estado().atualizarRecorte({ personalizado: false });
    expect(estado().ui.recorte!.personalizado).toBe(false);
  });

  it('o rascunho não mexe na foto; Concluir grava tamanho e recorte em um único passo', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id);
    estado().atualizarRecorte({ tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 } });
    estado().atualizarRecorte({ offset: { offsetX: 0.4, offsetY: 0 } });
    expect(fotos()[0]!.tamanho.sugeridoId).toBe('10x15');

    estado().concluirRecorte();
    expect(estado().ui.modo).toBe('editor');
    expect(estado().ui.recorte).toBeNull();
    expect(fotos()[0]).toMatchObject({
      tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 },
      recorte: { offsetX: 0.4, offsetY: 0 },
    });

    estado().desfazer(); // um passo só
    expect(fotos()[0]).toMatchObject({
      tamanho: { sugeridoId: '10x15' },
      recorte: { offsetX: 0, offsetY: 0 },
    });
  });

  it('mudar o tamanho no rascunho recentraliza o recorte (RN-28)', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id);
    estado().atualizarRecorte({ offset: { offsetX: 0.4, offsetY: -0.2 } });
    estado().atualizarRecorte({ tamanho: tamanhoSugerido('20x30') });
    expect(estado().ui.recorte!.offset).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('cancelarRecorte descarta o rascunho e não cria passo', async () => {
    const { estado, fotos } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id);
    estado().atualizarRecorte({ offset: { offsetX: 0.4, offsetY: 0 } });
    estado().cancelarRecorte();
    expect(estado().ui.modo).toBe('editor');
    expect(fotos()[0]!.recorte).toEqual({ offsetX: 0, offsetY: 0 });
    estado().desfazer();
    expect(fotos()).toHaveLength(0); // o passo desfeito foi o de adicionar
  });

  it('concluir sem mudar nada não cria passo', async () => {
    const { estado } = await aberto();
    const id = estado().adicionarFoto(hex(1))!;
    estado().abrirRecorte(id);
    estado().concluirRecorte();
    estado().desfazer();
    expect(estado().conteudo!.fotos).toHaveLength(0);
  });
});

describe('salvamento com fotos', () => {
  it('o hard save envia as fotos da variante', async () => {
    const { estado, api } = await aberto();
    estado().adicionarFoto(hex(1));
    await estado().salvarVariante();
    const corpo = (api.salvarVariante as ReturnType<typeof vi.fn>).mock.calls[0]![2];
    expect(corpo.fotos).toHaveLength(1);
    expect(corpo.fotos[0]).toMatchObject({ imagemId: hex(1) });
  });
});
