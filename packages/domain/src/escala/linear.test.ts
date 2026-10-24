import { describe, expect, it } from 'vitest';
import { aplicarHomografia } from '../geometria/homografia';
import { homografiaLinear, pxPorCmLinear } from './linear';

// Calibração linear (RF-10, RN-08): um segmento na foto com comprimento real conhecido.

describe('pxPorCmLinear', () => {
  it('divide o comprimento do segmento em px pelo comprimento real em cm', () => {
    // Segmento de 520 px (3-4-5 × 104) com 130 cm reais → 4,0 px/cm (protótipo 05).
    const px = pxPorCmLinear({ x: 100, y: 100 }, { x: 100 + 312, y: 100 + 416 }, 130);
    expect(px).toBeCloseTo(4, 9);
  });

  it('não depende da direção do segmento', () => {
    const a = pxPorCmLinear({ x: 0, y: 0 }, { x: 600, y: 0 }, 150);
    const b = pxPorCmLinear({ x: 600, y: 0 }, { x: 0, y: 0 }, 150);
    expect(a).toBe(b);
    expect(a).toBeCloseTo(4, 9);
  });

  it('recusa comprimento real não positivo', () => {
    expect(() => pxPorCmLinear({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toThrow();
    expect(() => pxPorCmLinear({ x: 0, y: 0 }, { x: 10, y: 0 }, -5)).toThrow();
  });

  it('recusa segmento de comprimento zero', () => {
    expect(() => pxPorCmLinear({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toThrow();
  });
});

describe('homografiaLinear (H = escala(1/pxPorCm))', () => {
  it('converte px da imagem em cm com a origem no canto superior esquerdo (RN-07)', () => {
    const h = homografiaLinear(4);
    const origem = aplicarHomografia(h, { x: 0, y: 0 });
    expect(origem.x).toBeCloseTo(0, 9);
    expect(origem.y).toBeCloseTo(0, 9);
    const p = aplicarHomografia(h, { x: 1200, y: 800 });
    expect(p.x).toBeCloseTo(300, 9);
    expect(p.y).toBeCloseTo(200, 9);
  });

  it('é uma matriz 3×3 linha a linha', () => {
    expect(homografiaLinear(4)).toEqual([0.25, 0, 0, 0, 0.25, 0, 0, 0, 1]);
  });

  it('recusa escala não positiva', () => {
    expect(() => homografiaLinear(0)).toThrow();
  });
});
