import { readFileSync } from 'node:fs';
import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, type ClienteApi, type ImagemDto, type ProjetoDto, type VarianteDto } from '../infra/dto';
import { criarStoreEditor } from './store';

// Ajuste do M2 à spec v0.4 (T14, §13): limites de posição (M2-11), snap nos campos (M2-12), cascata (A-04),
// setas agrupadas (A-08), status depois de desfazer (A-26), ciclo de vida do histórico (A-27), zundo (M2-13),
// biblioteca recarregada depois de salvar (M2-05), recorte (A-11), placeholders (M2-06) e posição ao vivo (A-07).

const hex = (n: number) => n.toString(16).padStart(24, '0');
const ID_PROJETO = hex(301);
const ID_VARIANTE = hex(201);
const SALVA_EM = '2026-10-25T17:35:00.000Z';
const SALVA_DEPOIS = '2026-10-25T18:10:00.000Z';

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

function fotoDe(n: number, sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: hex(500 + n),
    imagemId: RETRATO._id,
    imagemAnteriorId: null,
    tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
    xCm: 50,
    yCm: 50,
    recorte: { offsetX: 0, offsetY: 0 },
    borda: { larguraCm: 0, cor: '#FFFFFF' },
    ...sobrescrita,
  } as VarianteDto['fotos'][number];
}

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

function projeto(): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome: 'Sala',
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 3,
    ultimaVarianteId: ID_VARIANTE,
    parede: PAREDE_LINEAR,
    schemaVersion: 1,
  };
}

async function aberto(opcoes: { variante?: Partial<VarianteDto>; snap?: boolean } = {}) {
  const base = variante(opcoes.variante);
  if (opcoes.snap === false) base.grid = { ...base.grid, snap: false };
  const inicial = { projeto: projeto(), variantes: [base] };
  const api = {
    listarProjetos: vi.fn(async () => []),
    criarProjeto: vi.fn(async () => inicial),
    obterProjeto: vi.fn(async () => inicial),
    renomearProjeto: vi.fn(),
    excluirProjeto: vi.fn(),
    enviarParede: vi.fn(async () => ({ projeto: projeto(), variantesAlteradas: [] })),
    aplicarCalibracao: vi.fn(async () => ({ projeto: projeto(), variantesAlteradas: [] })),
    aplicarPerspectiva: vi.fn(),
    listarImagens: vi.fn(async () => [RETRATO, PAISAGEM]),
    enviarImagem: vi.fn(),
    obterConfig: vi.fn(async () => ({ uploadMaxMb: 12 })),
    salvarVariante: vi.fn(async () => ({ revisao: 2, salvaEm: SALVA_DEPOIS })),
  } as unknown as ClienteApi;
  let n = 900;
  const store = criarStoreEditor(api, { gerarId: () => hex(n++) });
  await store.getState().abrirProjeto(ID_PROJETO);
  await store.getState().carregarBiblioteca();
  const estado = () => store.getState();
  // A parte desfazível da variante vive isolada em `conteudo` (M2-13, §4.7).
  const fotos = () => estado().conteudo!.fotos;
  return { api, store, estado, fotos };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('limite de posição nos movimentos do usuário (M2-11)', () => {
  it('arrastar para longe da parede mantém 1 cm do retângulo externo dentro dela', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), -9999, 9999);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([-9, 224]); // externo 10 × 15; parede 300 × 225
    store.getState().moverFoto(hex(501), 9999, -9999);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([299, -14]);
  });

  it('os campos X/Y respeitam o mesmo limite', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().alterarPosicao(hex(501), 5000, 5000);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([299, 224]);
  });

  it('as setas respeitam o limite', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: 299, yCm: 100 })] } });
    store.getState().moverPorSeta(hex(501), 'direita', true);
    expect(fotos()[0]!.xCm).toBe(299);
  });

  it('duplicar perto da borda não passa do limite', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: 299, yCm: 224 })] } });
    store.getState().duplicarFoto(hex(501));
    expect([fotos()[1]!.xCm, fotos()[1]!.yCm]).toEqual([299, 224]);
  });

  it('adicionar por arraste fora da parede também é limitado', async () => {
    const { store, fotos } = await aberto();
    store.getState().adicionarFoto(RETRATO._id, { x: 9999, y: -9999 });
    expect(fotos()[0]!.xCm).toBeLessThanOrEqual(299);
    expect(fotos()[0]!.yCm).toBeGreaterThanOrEqual(-14);
  });

  it('abrir o projeto nunca corrige uma foto que já está fora (RN-10)', async () => {
    const { fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: -500, yCm: 900 })] } });
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([-500, 900]);
  });

  it('refazer a escala mantém as posições em cm, mesmo fora da parede (RN-10)', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: -500, yCm: 900 })] } });
    await store.getState().aplicarCalibracao({ p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, comprimentoCm: 10 });
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([-500, 900]);
  });
});

describe('snap nos campos X/Y (M2-12)', () => {
  it('com snap ligado, o valor digitado vai para a linha mais próxima', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().alterarPosicao(hex(501), 12.3, 41);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([10, 40]);
  });

  it('com snap desligado, vale o valor digitado a 0,1 cm', async () => {
    const { store, fotos } = await aberto({ snap: false, variante: { fotos: [fotoDe(1)] } });
    store.getState().alterarPosicao(hex(501), 12.34, -4);
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([12.3, -4]);
  });

  it('um valor digitado vira 1 passo de desfazer', async () => {
    const { store, estado, fotos } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().alterarPosicao(hex(501), 100, 100);
    store.getState().desfazer();
    expect([fotos()[0]!.xCm, fotos()[0]!.yCm]).toEqual([50, 50]);
    expect(estado().podeDesfazer()).toBe(false);
  });
});

describe('cascata ao adicionar (A-04)', () => {
  it('a mesma imagem de novo vai +1 passo do grid em X e Y, e de novo, até 10 tentativas', async () => {
    const { store, fotos } = await aberto();
    for (let i = 0; i < 13; i += 1) store.getState().adicionarFoto(RETRATO._id);
    const [primeira] = fotos();
    expect([fotos()[1]!.xCm - primeira!.xCm, fotos()[1]!.yCm - primeira!.yCm]).toEqual([5, 5]);
    // A 12ª e a 13ª pararam em +50 (10 tentativas) sobre a anterior.
    expect(fotos()[11]!.xCm - primeira!.xCm).toBe(50);
    expect(fotos()[12]!.xCm - primeira!.xCm).toBe(50);
  });

  it('sem snap, +5 cm', async () => {
    const { store, fotos } = await aberto({ snap: false });
    store.getState().adicionarFoto(RETRATO._id);
    store.getState().adicionarFoto(RETRATO._id);
    expect(fotos()[1]!.xCm - fotos()[0]!.xCm).toBe(5);
  });
});

describe('setas seguidas formam 1 passo de desfazer (A-08)', () => {
  it('três setas com menos de 1 s entre elas, na mesma foto, desfazem de uma vez', async () => {
    vi.useFakeTimers();
    const { store, estado, fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: 50 })] } });
    for (let i = 0; i < 3; i += 1) {
      store.getState().moverPorSeta(hex(501), 'direita', false);
      vi.advanceTimersByTime(900);
    }
    expect(fotos()[0]!.xCm).toBe(65);
    store.getState().desfazer();
    expect(fotos()[0]!.xCm).toBe(50);
    expect(estado().podeDesfazer()).toBe(false);
  });

  it('com 1 s ou mais de pausa, começa outro passo', async () => {
    vi.useFakeTimers();
    const { store, fotos } = await aberto({ variante: { fotos: [fotoDe(1, { xCm: 50 })] } });
    store.getState().moverPorSeta(hex(501), 'direita', false);
    vi.advanceTimersByTime(1000);
    store.getState().moverPorSeta(hex(501), 'direita', false);
    store.getState().desfazer();
    expect(fotos()[0]!.xCm).toBe(55);
    store.getState().desfazer();
    expect(fotos()[0]!.xCm).toBe(50);
  });

  it('outra foto, ou outra ação no meio, quebra o grupo', async () => {
    vi.useFakeTimers();
    const { store, fotos } = await aberto({
      variante: { fotos: [fotoDe(1, { xCm: 50 }), fotoDe(2, { xCm: 100 })] },
    });
    store.getState().moverPorSeta(hex(501), 'direita', false);
    store.getState().moverPorSeta(hex(502), 'direita', false);
    store.getState().desfazer();
    expect(fotos()[1]!.xCm).toBe(100);
    expect(fotos()[0]!.xCm).toBe(55);
    store.getState().moverPorSeta(hex(501), 'direita', false);
    store.getState().trocarOrientacao(hex(501), 'paisagem');
    store.getState().moverPorSeta(hex(501), 'direita', false);
    store.getState().desfazer();
    expect(fotos()[0]!.tamanho.larguraCm).toBe(15);
  });
});

describe('status depois de desfazer (A-26)', () => {
  it('voltar ao conteúdo do último salvamento volta o status a "Salvo" com a hora dele', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    await store.getState().salvarVariante();
    store.getState().moverFoto(hex(501), 120, 120);
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');

    store.getState().desfazer();
    expect(estado().documento.sujo).toBe(false);
    expect(estado().documento.salvamento).toEqual({ tipo: 'salvo', em: new Date(SALVA_DEPOIS) });

    store.getState().refazer();
    expect(estado().documento.sujo).toBe(true);
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');
  });

  it('desfazer um passo anterior ao salvamento deixa "Alterações não salvas"', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    await store.getState().salvarVariante();
    store.getState().desfazer();
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');
    expect(estado().documento.sujo).toBe(true);
  });

  it('o grid alterado mantém "Alterações não salvas" mesmo com as fotos iguais ao salvo', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    store.getState().alterarGrid({ passoCm: 10 });
    store.getState().desfazer();
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');
  });

  it('sem nenhum salvamento na sessão, voltar ao estado aberto volta a "Salvo"', async () => {
    const { store, estado } = await aberto();
    store.getState().adicionarFoto(RETRATO._id);
    store.getState().desfazer();
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().documento.sujo).toBe(false);
  });
});

describe('ciclo de vida do histórico (A-27)', () => {
  it('descarta o histórico ao recarregar depois de um 409', async () => {
    const { api, store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    (api.salvarVariante as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ErroApi(409, { erro: 'Esta variante foi salva em outra aba.', salvaEm: SALVA_DEPOIS }),
    );
    await store
      .getState()
      .salvarVariante()
      .catch(() => undefined);
    expect(estado().documento.conflito).not.toBeNull();
    await store.getState().recarregar();
    expect(estado().podeDesfazer()).toBe(false);
    expect(estado().podeRefazer()).toBe(false);
  });

  it('descarta o histórico ao trocar a parede', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    expect(estado().podeDesfazer()).toBe(true);
    await store.getState().enviarParede(new File(['x'], 'parede.jpg', { type: 'image/jpeg' }), 'leve');
    expect(estado().podeDesfazer()).toBe(false);
  });

  it('refazer a escala mantém o histórico (os valores em cm não mudam — RN-10)', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    await store.getState().aplicarCalibracao({ p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, comprimentoCm: 10 });
    expect(estado().podeDesfazer()).toBe(true);
  });

  it('salvar não altera o histórico (SV-10)', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    await store.getState().salvarVariante();
    expect(estado().podeDesfazer()).toBe(true);
  });

  it('desfazer mantém a seleção quando a foto continua existindo', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().selecionarFoto(hex(501));
    store.getState().moverFoto(hex(501), 80, 80);
    store.getState().desfazer();
    expect(estado().ui.selecaoId).toBe(hex(501));
  });
});

describe('zundo isola a parte desfazível da variante (M2-13, ADR-03, §4.7)', () => {
  it('`conteudo` tem só fotos, área útil e borda padrão; a variante do documento não os repete', async () => {
    const { estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    expect(Object.keys(estado().conteudo!).sort()).toEqual(['areaUtil', 'bordaPadrao', 'fotos']);
    expect(estado().documento.variante).not.toHaveProperty('fotos');
    expect(estado().documento.variante).toHaveProperty('grid');
  });

  it('seleção, modo, biblioteca, grid e arraste ao vivo não criam passo de desfazer', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().selecionarFoto(hex(501));
    store.getState().selecionarImagemDaBiblioteca(RETRATO._id);
    store.getState().definirModo('area-util');
    store.getState().definirModo('editor');
    store.getState().alterarGrid({ passoCm: 10 });
    store.getState().definirArrasto({ id: hex(501), xCm: 90, yCm: 90 });
    await store.getState().carregarBiblioteca();
    expect(estado().podeDesfazer()).toBe(false);
  });

  it('desfazer só restaura o conteúdo: projeto, revisão e grid ficam como estão', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    const projetoAntes = estado().documento.projeto;
    store.getState().moverFoto(hex(501), 80, 80);
    store.getState().alterarGrid({ passoCm: 10 });
    store.getState().desfazer();
    expect(estado().documento.projeto).toBe(projetoAntes);
    expect(estado().documento.revisaoBase).toBe(1);
    expect(estado().documento.variante!.grid.passoCm).toBe(10);
  });

  it('o limite é de 100 passos por variante', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    for (let i = 1; i <= 105; i += 1) store.getState().moverFoto(hex(501), 50 + i, 50);
    let passos = 0;
    while (estado().podeDesfazer()) {
      store.getState().desfazer();
      passos += 1;
    }
    expect(passos).toBe(100);
  });

  it('o zundo está instalado com versão exata no apps/web (M2-13, T16)', () => {
    const pacote = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pacote.dependencies.zundo).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('biblioteca depois do salvamento (M2-05)', () => {
  it('a biblioteca é carregada de novo depois de cada salvamento', async () => {
    const { api, store } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    expect(api.listarImagens).toHaveBeenCalledTimes(1);
    store.getState().moverFoto(hex(501), 80, 80);
    await store.getState().salvarVariante();
    expect(api.listarImagens).toHaveBeenCalledTimes(2);
  });

  it('as fotos salvas (para os filtros) só mudam no salvamento', async () => {
    const { store, estado } = await aberto();
    expect(estado().documento.salvo!.conteudo.fotos).toHaveLength(0);
    store.getState().adicionarFoto(RETRATO._id);
    expect(estado().documento.salvo!.conteudo.fotos).toHaveLength(0);
    await store.getState().salvarVariante();
    expect(estado().documento.salvo!.conteudo.fotos).toHaveLength(1);
  });
});

describe('recorte bloqueia salvar, desfazer e refazer (A-11)', () => {
  it('Salvar não faz nada durante o modo de recorte', async () => {
    const { api, store, estado } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().moverFoto(hex(501), 80, 80);
    store.getState().abrirRecorte(hex(501));
    await store.getState().salvarVariante();
    expect(api.salvarVariante).not.toHaveBeenCalled();
    store.getState().desfazer();
    expect(estado().conteudo!.fotos[0]!.xCm).toBe(80);
  });
});

describe('ordem: uma posição por clique (M2-08, A-24)', () => {
  it('trazerParaFrente e enviarParaTras andam uma posição, cada clique é 1 passo', async () => {
    const { store, estado, fotos } = await aberto({
      variante: { fotos: [fotoDe(1), fotoDe(2), fotoDe(3)] },
    });
    store.getState().trazerParaFrente(hex(501));
    expect(fotos().map((f) => f._id)).toEqual([hex(502), hex(501), hex(503)]);
    store.getState().enviarParaTras(hex(503));
    expect(fotos().map((f) => f._id)).toEqual([hex(502), hex(503), hex(501)]);
    store.getState().desfazer();
    expect(fotos().map((f) => f._id)).toEqual([hex(502), hex(501), hex(503)]);
    store.getState().trazerParaFrente(hex(503));
    expect(estado().podeDesfazer()).toBe(true);
  });

  it('no topo ou no fundo, o clique não cria passo', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [fotoDe(1), fotoDe(2)] } });
    store.getState().trazerParaFrente(hex(502));
    store.getState().enviarParaTras(hex(501));
    expect(estado().podeDesfazer()).toBe(false);
  });
});

describe('placeholders (M2-06)', () => {
  const placeholder = () => fotoDe(1, { imagemId: null });

  it('selecionar, mover, mudar tamanho, orientação e borda, duplicar e remover funcionam', async () => {
    const { store, fotos } = await aberto({ variante: { fotos: [placeholder()] } });
    store.getState().selecionarFoto(hex(501));
    store.getState().moverFoto(hex(501), 80, 80);
    store.getState().trocarTamanho(hex(501), { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 });
    store.getState().trocarOrientacao(hex(501), 'paisagem');
    store.getState().alterarBordaDaFoto(hex(501), { larguraCm: 2 });
    store.getState().duplicarFoto(hex(501));
    expect(fotos()).toHaveLength(2);
    expect(fotos()[1]!.imagemId).toBeNull();
    store.getState().removerFoto(hex(501));
    expect(fotos()).toHaveLength(1);
  });

  it('"Ajustar recorte" não abre para placeholder: não há imagem para enquadrar', async () => {
    const { store, estado } = await aberto({ variante: { fotos: [placeholder()] } });
    store.getState().abrirRecorte(hex(501));
    expect(estado().ui.modo).toBe('editor');
    expect(estado().ui.recorte).toBeNull();
  });
});

describe('posição ao vivo no arraste (A-07)', () => {
  it('definirArrasto publica a posição sem tocar nas fotos nem no histórico; moverFoto encerra', async () => {
    const { store, estado, fotos } = await aberto({ variante: { fotos: [fotoDe(1)] } });
    store.getState().definirArrasto({ id: hex(501), xCm: 77.5, yCm: 12 });
    expect(estado().ui.arrasto).toEqual({ id: hex(501), xCm: 77.5, yCm: 12 });
    expect(fotos()[0]!.xCm).toBe(50);
    expect(estado().podeDesfazer()).toBe(false);
    store.getState().moverFoto(hex(501), 80, 15);
    expect(estado().ui.arrasto).toBeNull();
  });
});

describe('limite de upload do servidor (A-28)', () => {
  it('carregarConfig guarda o uploadMaxMb de GET /api/config', async () => {
    const { store, estado } = await aberto();
    expect(estado().config.uploadMaxMb).toBe(50); // padrão até carregar
    await store.getState().carregarConfig();
    expect(estado().config.uploadMaxMb).toBe(12);
  });

  it('falha ao ler a configuração mantém o padrão, sem derrubar o editor', async () => {
    const { api, store, estado } = await aberto();
    (api.obterConfig as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fora do ar'));
    await store.getState().carregarConfig();
    expect(estado().config.uploadMaxMb).toBe(50);
  });
});
