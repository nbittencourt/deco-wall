import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import {
  aplicarBorda,
  aplicarTamanho,
  criarFoto,
  duplicarFoto,
  enviarParaTras,
  posicaoDoDrop,
  posicaoInicial,
  resumoDaComposicao,
  trazerParaFrente,
} from './composicao';
import { tamanhoSugerido } from './tamanho';

// Composição: criar, posicionar, duplicar e ordenar fotos (RN-03, RN-04, RN-05, RN-13, B-06, M2-04, M2-05).

const GRID_ON = { snap: true, passoCm: 5 };
const GRID_OFF = { snap: false, passoCm: 5 };
const AREA = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };

const foto = (sobrescrita: Record<string, unknown> = {}) => fotoFixture(sobrescrita) as FotoNaParede;

describe('criarFoto (RN-03, RN-04, RN-13)', () => {
  const bordaPadrao = { larguraCm: 2, cor: '#112233' };

  it('10×15, na orientação natural da imagem, com a borda padrão e o recorte centralizado', () => {
    const retrato = criarFoto({
      id: id(500),
      imagem: { _id: id(7), orientacaoNatural: 'retrato' },
      bordaPadrao,
      posicao: { x: 5, y: 6 },
    });
    expect(retrato).toEqual({
      _id: id(500),
      imagemId: id(7),
      imagemAnteriorId: null,
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      xCm: 5,
      yCm: 6,
      recorte: { offsetX: 0, offsetY: 0 },
      borda: { larguraCm: 2, cor: '#112233' },
    });

    const paisagem = criarFoto({
      id: id(501),
      imagem: { _id: id(7), orientacaoNatural: 'paisagem' },
      bordaPadrao,
      posicao: { x: 0, y: 0 },
    });
    expect(paisagem.tamanho).toEqual({ sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 });
  });

  it('a borda é uma cópia: mudar a borda padrão depois não altera a foto', () => {
    const origem = { larguraCm: 1, cor: '#FFFFFF' };
    const nova = criarFoto({
      id: id(500),
      imagem: { _id: id(7), orientacaoNatural: 'retrato' },
      bordaPadrao: origem,
      posicao: { x: 0, y: 0 },
    });
    expect(nova.borda).not.toBe(origem);
  });
});

describe('posicaoInicial (M2-04)', () => {
  const externo = { larguraCm: 14, alturaCm: 19 };

  it('centraliza na área útil e encaixa no grid quando o snap está ligado', () => {
    // centro: x = (300 − 14) / 2 = 143 → 145; y = (200 − 19) / 2 = 90,5 → 90
    expect(posicaoInicial({ area: AREA, fotos: [], externo, grid: GRID_ON })).toEqual({ x: 145, y: 90 });
  });

  it('sem snap, fica no centro exato', () => {
    expect(posicaoInicial({ area: AREA, fotos: [], externo, grid: GRID_OFF })).toEqual({ x: 143, y: 90.5 });
  });

  it('em cascata de 5 cm enquanto houver foto no mesmo lugar', () => {
    const ocupadas = [foto({ _id: id(1), xCm: 143, yCm: 90.5 }), foto({ _id: id(2), xCm: 148, yCm: 95.5 })];
    expect(posicaoInicial({ area: AREA, fotos: ocupadas, externo, grid: GRID_OFF })).toEqual({
      x: 153,
      y: 100.5,
    });
  });

  it('sem área útil, usa a origem', () => {
    expect(posicaoInicial({ area: null, fotos: [], externo, grid: GRID_OFF })).toEqual({ x: 0, y: 0 });
  });
});

describe('posicaoDoDrop (M2-04)', () => {
  const externo = { larguraCm: 14, alturaCm: 19 };

  it('o centro da foto vai para o ponto de soltura', () => {
    expect(posicaoDoDrop({ ponto: { x: 100, y: 100 }, externo, grid: GRID_OFF })).toEqual({ x: 93, y: 90.5 });
  });

  it('com snap, o canto superior esquerdo é encaixado', () => {
    expect(posicaoDoDrop({ ponto: { x: 100, y: 100 }, externo, grid: GRID_ON })).toEqual({ x: 95, y: 90 });
  });
});

describe('duplicarFoto (B-06, RN-13)', () => {
  it('copia imagem, tamanho, borda e recorte com novo id, 5 cm abaixo e à direita', () => {
    const original = foto({
      xCm: 40,
      yCm: 30,
      recorte: { offsetX: 0.4, offsetY: 0 },
      borda: { larguraCm: 1, cor: '#000000' },
    });
    const copia = duplicarFoto(original, id(900), GRID_OFF);
    expect(copia).toEqual({ ...original, _id: id(900), xCm: 45, yCm: 35 });
    expect(copia.borda).not.toBe(original.borda);
    expect(copia.recorte).not.toBe(original.recorte);
  });

  it('com snap ligado, desloca um passo do grid', () => {
    const copia = duplicarFoto(foto({ xCm: 40, yCm: 30 }), id(900), { snap: true, passoCm: 10 });
    expect([copia.xCm, copia.yCm]).toEqual([50, 40]);
  });
});

describe('ordem das fotos', () => {
  const a = foto({ _id: id(1) });
  const b = foto({ _id: id(2) });
  const c = foto({ _id: id(3) });

  it('trazerParaFrente leva ao fim do array (topo)', () => {
    expect(trazerParaFrente([a, b, c], id(1)).map((f) => f._id)).toEqual([id(2), id(3), id(1)]);
  });

  it('enviarParaTras leva ao início', () => {
    expect(enviarParaTras([a, b, c], id(3)).map((f) => f._id)).toEqual([id(3), id(1), id(2)]);
  });

  it('já no topo/fundo ou id desconhecido: a ordem não muda', () => {
    expect(trazerParaFrente([a, b, c], id(3)).map((f) => f._id)).toEqual([id(1), id(2), id(3)]);
    expect(enviarParaTras([a, b, c], id(1)).map((f) => f._id)).toEqual([id(1), id(2), id(3)]);
    expect(trazerParaFrente([a, b, c], id(99)).map((f) => f._id)).toEqual([id(1), id(2), id(3)]);
  });

  it('não altera o array recebido', () => {
    const original = [a, b, c];
    trazerParaFrente(original, id(1));
    expect(original.map((f) => f._id)).toEqual([id(1), id(2), id(3)]);
  });
});

describe('aplicarTamanho (RN-05, M2-05)', () => {
  it('mantém o canto superior esquerdo externo e a borda; recentraliza o recorte', () => {
    const original = foto({
      xCm: 40,
      yCm: 30,
      recorte: { offsetX: 0.6, offsetY: -0.2 },
      borda: { larguraCm: 2, cor: '#FFFFFF' },
    });
    const nova = aplicarTamanho(original, tamanhoSugerido('30x40', 'paisagem'));
    expect(nova).toEqual({
      ...original,
      tamanho: { sugeridoId: '30x40', larguraCm: 40, alturaCm: 30 },
      recorte: { offsetX: 0, offsetY: 0 },
    });
  });
});

describe('aplicarBorda (RN-05, M2-05)', () => {
  it('mantém o canto superior esquerdo externo e o recorte', () => {
    const original = foto({ xCm: 40, yCm: 30, recorte: { offsetX: 0.6, offsetY: 0 } });
    const nova = aplicarBorda(original, { larguraCm: 3, cor: '#C8A27A' });
    expect(nova).toEqual({ ...original, borda: { larguraCm: 3, cor: '#C8A27A' } });
  });
});

describe('resumoDaComposicao', () => {
  it('quantidade, bounding box e alertas', () => {
    const fotos = [
      foto({ _id: id(1), xCm: 50, yCm: 50 }),
      foto({ _id: id(2), xCm: 55, yCm: 60 }),
      foto({ _id: id(3), xCm: 295, yCm: 50 }),
    ];
    const resumo = resumoDaComposicao(fotos, AREA, { xCm: 10, yCm: 10, larguraCm: 200, alturaCm: 100 });
    expect(resumo.quantidade).toBe(3);
    expect(resumo.caixa).toEqual({ xCm: 50, yCm: 50, larguraCm: 265, alturaCm: 40 });
    expect(resumo.comSobreposicao).toBe(2);
    expect(resumo.foraDosLimites).toBe(1);
  });

  it('sem fotos: zeros e caixa nula', () => {
    expect(resumoDaComposicao([], AREA, null)).toEqual({
      quantidade: 0,
      caixa: null,
      comSobreposicao: 0,
      foraDosLimites: 0,
    });
  });
});
