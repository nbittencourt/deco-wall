// Exemplos válidos do modelo de dados (docs/specs/M0-setup.md §4), no formato de domínio:
// ids são strings hex de 24 caracteres e datas são Date. Os builders aceitam sobrescritas
// rasas para montar casos inválidos nos testes.

export const id = (n: number): string => n.toString(16).padStart(24, '0');

export const AGORA = new Date('2026-10-12T14:35:00-03:00');

export function tamanho(sobrescrita: Record<string, unknown> = {}) {
  return { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30, ...sobrescrita };
}

export function grid(sobrescrita: Record<string, unknown> = {}) {
  return {
    visivel: true,
    snap: true,
    passoCm: 5,
    principalACada: 5,
    cor: '#7A7A7A',
    opacidade: 0.5,
    ...sobrescrita,
  };
}

export function borda(sobrescrita: Record<string, unknown> = {}) {
  return { larguraCm: 0, cor: '#FFFFFF', ...sobrescrita };
}

export function areaUtil(sobrescrita: Record<string, unknown> = {}) {
  return { xCm: 0, yCm: 0, larguraCm: 180, alturaCm: 110, ...sobrescrita };
}

export function foto(sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: id(101),
    imagemId: id(1),
    imagemAnteriorId: null,
    tamanho: tamanho(),
    xCm: 40,
    yCm: 30,
    recorte: { offsetX: 0, offsetY: 0 },
    borda: borda(),
    ...sobrescrita,
  };
}

export function escalaPerspectiva() {
  return {
    metodo: 'perspectiva',
    perspectiva: {
      cantosPx: [
        { x: 100, y: 100 },
        { x: 2900, y: 120 },
        { x: 2950, y: 1900 },
        { x: 80, y: 1880 },
      ],
      larguraCm: 300,
      alturaCm: 200,
    },
    homografia: [0.1, 0, 0, 0, 0.1, 0, 0, 0, 1],
  };
}

export function parede(sobrescrita: Record<string, unknown> = {}) {
  return {
    perfil: 'leve',
    arquivo: `paredes/${id(301)}.webp`,
    thumb: `paredes/${id(301)}.thumb.webp`,
    larguraPx: 3072,
    alturaPx: 2048,
    escala: escalaPerspectiva(),
    retificada: {
      arquivo: `paredes/${id(301)}.retificada.webp`,
      larguraPx: 3072,
      alturaPx: 2048,
      pxPorCm: 10.24,
      origemCm: { x: 0, y: 0 },
    },
    ...sobrescrita,
  };
}

export function projeto(sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: id(301),
    nome: 'Sala de estar',
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    revisao: 1,
    ultimaVarianteId: id(201),
    parede: parede(),
    schemaVersion: 1,
    ...sobrescrita,
  };
}

export function variante(sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: id(201),
    projetoId: id(301),
    nome: 'Base',
    ordem: 0,
    criadaEm: AGORA,
    revisao: 1,
    salvaEm: AGORA,
    salvaPorSessao: 'sessao-a',
    grid: grid(),
    bordaPadrao: borda(),
    areaUtil: areaUtil(),
    templateOrigem: null,
    fotos: [foto()],
    schemaVersion: 1,
    ...sobrescrita,
  };
}

export function imagem(sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: id(1),
    nomeOriginal: 'praia.jpg',
    perfil: 'leve',
    larguraPx: 1024,
    alturaPx: 768,
    orientacaoNatural: 'paisagem',
    bytes: 120_000,
    arquivos: { render: `imagens/${id(1)}.webp`, thumb: `imagens/${id(1)}.thumb.webp` },
    mime: 'image/webp',
    criadaEm: AGORA,
    projetos: [id(301)],
    excluidaEm: null,
    purgaEm: null,
    schemaVersion: 1,
    ...sobrescrita,
  };
}

export function rascunho(sobrescrita: Record<string, unknown> = {}) {
  return {
    _id: id(401),
    varianteId: id(201),
    projetoId: id(301),
    sessaoId: 'sessao-a',
    revisaoBase: 1,
    conteudo: {
      grid: grid(),
      bordaPadrao: borda(),
      areaUtil: areaUtil(),
      fotos: [foto()],
    },
    salvoEm: AGORA,
    ...sobrescrita,
  };
}
