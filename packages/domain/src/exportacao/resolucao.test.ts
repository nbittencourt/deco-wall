import { describe, expect, it } from 'vitest';
import { parede as paredeFixture } from '../../../../tests/fixtures/dominio';
import type { ParedeGeometria } from '../escala/parede-inteira';
import {
  formatoPadraoDaExportacao,
  pngDemorado,
  regiaoDeExportacao,
  resolucaoDaPrevia,
  resolucaoDeExportacao,
} from './resolucao';

// Região e resolução da exportação (RF-80, RN-12, RN-33, M4-10, M4-18, A-14, A-28;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.1).

const perspectiva = paredeFixture() as unknown as ParedeGeometria; // retificada 3072 × 2048 a 10,24 px/cm
const linear: ParedeGeometria = {
  larguraPx: 1200,
  alturaPx: 900,
  escala: {
    metodo: 'linear',
    linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 }, // 4 px/cm
  },
};

describe('regiaoDeExportacao (M4-10)', () => {
  it('é a parede inteira, em cm (perspectiva)', () => {
    expect(regiaoDeExportacao(perspectiva)).toEqual({ xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 });
  });

  it('é a parede inteira, em cm (escala linear)', () => {
    expect(regiaoDeExportacao(linear)).toEqual({ xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 });
  });

  it('respeita a origem da retificada', () => {
    const comOrigem = {
      ...perspectiva,
      retificada: { ...perspectiva.retificada!, origemCm: { x: -100, y: -50 } },
    };
    expect(regiaoDeExportacao(comOrigem)).toMatchObject({ xCm: -100, yCm: -50 });
  });

  it('sem escala definida, falha', () => {
    expect(() => regiaoDeExportacao({ larguraPx: 10, alturaPx: 10, escala: { metodo: null } })).toThrow();
  });
});

describe('resolucaoDeExportacao (M4-10, A-14)', () => {
  it('perspectiva: o bitmap retificado e o px/cm dele', () => {
    expect(resolucaoDeExportacao(perspectiva)).toEqual({ larguraPx: 3072, alturaPx: 2048, pxPorCm: 10.24 });
  });

  it('linear: a foto processada da parede e o px/cm da calibração', () => {
    expect(resolucaoDeExportacao(linear)).toEqual({ larguraPx: 1200, alturaPx: 900, pxPorCm: 4 });
  });

  it('sem escala definida, falha', () => {
    expect(() => resolucaoDeExportacao({ larguraPx: 10, alturaPx: 10, escala: { metodo: null } })).toThrow();
  });
});

describe('resolucaoDaPrevia (M4-12, A-17)', () => {
  it('reduz para o lado maior pedido e escala o px/cm', () => {
    const r = resolucaoDaPrevia({ larguraPx: 3072, alturaPx: 2048, pxPorCm: 10.24 }, 480);
    expect(r).toEqual({ larguraPx: 480, alturaPx: 320, pxPorCm: 1.6 });
  });

  it('retrato: o lado maior é a altura', () => {
    const r = resolucaoDaPrevia({ larguraPx: 2048, alturaPx: 3072, pxPorCm: 10 }, 480);
    expect(r.alturaPx).toBe(480);
    expect(r.larguraPx).toBe(320);
  });

  it('nunca amplia', () => {
    const original = { larguraPx: 400, alturaPx: 300, pxPorCm: 2 };
    expect(resolucaoDaPrevia(original, 480)).toEqual(original);
  });

  it('arredonda para pixels inteiros e nunca devolve 0', () => {
    const r = resolucaoDaPrevia({ larguraPx: 6144, alturaPx: 7, pxPorCm: 20 }, 480);
    expect(Number.isInteger(r.larguraPx) && Number.isInteger(r.alturaPx)).toBe(true);
    expect(r.alturaPx).toBeGreaterThanOrEqual(1);
  });
});

describe('formatoPadraoDaExportacao e pngDemorado (M4-18, A-28)', () => {
  const res = (larguraPx: number, alturaPx: number) => ({ larguraPx, alturaPx, pxPorCm: 10 });

  it('Leve e Médio (até 4096 × 3072) ficam abaixo do limite: PNG, sem aviso', () => {
    expect(formatoPadraoDaExportacao(res(3072, 2304))).toBe('png');
    expect(formatoPadraoDaExportacao(res(4096, 3072))).toBe('png');
    expect(pngDemorado(res(4096, 3072))).toBe(false);
  });

  it('Alto (6144 × 4608, 28 MP) passa do limite: JPG como padrão e PNG demorado', () => {
    expect(formatoPadraoDaExportacao(res(6144, 4608))).toBe('jpg');
    expect(pngDemorado(res(6144, 4608))).toBe(true);
  });

  it('exatamente 16 MP não é "acima": PNG, sem aviso', () => {
    expect(formatoPadraoDaExportacao(res(4000, 4000))).toBe('png');
    expect(pngDemorado(res(4000, 4000))).toBe(false);
  });

  it('um pixel acima de 16 MP já conta', () => {
    expect(pngDemorado(res(4001, 4000))).toBe(true);
    expect(formatoPadraoDaExportacao(res(4001, 4000))).toBe('jpg');
  });
});
