import type { Pt } from '../schemas';

// Calibração linear (RF-10, RN-08): um segmento na foto com comprimento real conhecido.

export function pxPorCmLinear(p1: Pt, p2: Pt, comprimentoCm: number): number {
  const comprimentoPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (!(comprimentoCm > 0)) throw new Error('O comprimento real precisa ser maior que zero.');
  if (!(comprimentoPx > 0)) throw new Error('O segmento precisa ter comprimento maior que zero.');
  return comprimentoPx / comprimentoCm;
}

// H = escala(1/pxPorCm): px da foto → cm, com a origem no canto superior esquerdo da foto (RN-07).
export function homografiaLinear(pxPorCm: number): number[] {
  if (!(pxPorCm > 0)) throw new Error('A escala precisa ser maior que zero.');
  const k = 1 / pxPorCm;
  return [k, 0, 0, 0, k, 0, 0, 0, 1];
}
