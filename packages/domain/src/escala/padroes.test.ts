import { describe, expect, it } from 'vitest';
import { SEGMENTO_MIN_PX } from '../constantes';
import { cantosPadrao, segmentoPadrao } from './padroes';

// A-10 e A-12: as alças já aparecem prontas, para o usuário só arrastar até os cantos reais.

describe('cantosPadrao (A-10)', () => {
  it('retângulo a 25% das bordas da foto, em sentido horário a partir do superior esquerdo', () => {
    expect(cantosPadrao(1600, 1200)).toEqual([
      { x: 400, y: 300 },
      { x: 1200, y: 300 },
      { x: 1200, y: 900 },
      { x: 400, y: 900 },
    ]);
  });
});

describe('segmentoPadrao (A-12)', () => {
  it('horizontal, no centro da foto, com metade da largura', () => {
    expect(segmentoPadrao(1600, 1200)).toEqual({ p1: { x: 400, y: 600 }, p2: { x: 1200, y: 600 } });
  });

  it('respeita o mínimo de 20 px em fotos pequenas', () => {
    const { p1, p2 } = segmentoPadrao(100, 100);
    expect(p2.x - p1.x).toBeGreaterThanOrEqual(SEGMENTO_MIN_PX);
  });
});
