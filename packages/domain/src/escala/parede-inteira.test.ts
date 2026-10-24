import { describe, expect, it } from 'vitest';
import { parede } from '../../../../tests/fixtures/dominio';
import { ParedeSchema } from '../schemas';
import { escalaPxPorCm, paredeInteira } from './parede-inteira';

// Parede inteira (RN-33, M1-03): base da área útil padrão e do grid.

const linear = ParedeSchema.parse(
  parede({
    larguraPx: 1200,
    alturaPx: 900,
    escala: {
      metodo: 'linear',
      linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
      homografia: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 1],
    },
    retificada: undefined,
  }),
);

const perspectiva = ParedeSchema.parse(
  parede({
    larguraPx: 1600,
    alturaPx: 1200,
    retificada: {
      arquivo: 'paredes/x.retificada.webp',
      larguraPx: 1700,
      alturaPx: 1100,
      pxPorCm: 4,
      origemCm: { x: -50.5, y: -30.2 },
    },
  }),
);

describe('paredeInteira', () => {
  it('escala linear: a foto toda, com origem no canto superior esquerdo (RN-07)', () => {
    // 600 px para 150 cm = 4 px/cm → 1200 × 900 px = 300 × 225 cm.
    expect(paredeInteira(linear)).toEqual({ xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 });
  });

  it('perspectiva: o bitmap retificado em cm, a partir de origemCm', () => {
    expect(paredeInteira(perspectiva)).toEqual({ xCm: -50.5, yCm: -30.2, larguraCm: 425, alturaCm: 275 });
  });

  it('arredonda a 0,1 cm (RN-27)', () => {
    const p = ParedeSchema.parse(
      parede({
        retificada: {
          arquivo: 'paredes/x.retificada.webp',
          larguraPx: 1000,
          alturaPx: 1000,
          pxPorCm: 3,
          origemCm: { x: 0, y: 0 },
        },
      }),
    );
    expect(paredeInteira(p)).toEqual({ xCm: 0, yCm: 0, larguraCm: 333.3, alturaCm: 333.3 });
  });

  it('sem escala definida lança erro (a área útil só existe depois da escala)', () => {
    const semEscala = ParedeSchema.parse(parede({ escala: { metodo: null }, retificada: undefined }));
    expect(() => paredeInteira(semEscala)).toThrow();
  });
});

describe('escalaPxPorCm (painel e chip, §3.7)', () => {
  it('perspectiva: pxPorCm do bitmap retificado', () => {
    expect(escalaPxPorCm(perspectiva)).toBe(4);
  });

  it('linear: px da foto por cm', () => {
    expect(escalaPxPorCm(linear)).toBeCloseTo(4, 9);
  });

  it('sem escala: null', () => {
    const semEscala = ParedeSchema.parse(parede({ escala: { metodo: null }, retificada: undefined }));
    expect(escalaPxPorCm(semEscala)).toBeNull();
  });
});
