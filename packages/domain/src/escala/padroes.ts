import { SEGMENTO_MIN_PX } from '../constantes';
import type { Pt } from '../schemas';

// Posições iniciais das alças, para o usuário só arrastar até os pontos reais.

// A-10: quatro cantos num retângulo a 25% das bordas da foto, em sentido horário a partir do superior esquerdo.
export function cantosPadrao(larguraImagemPx: number, alturaImagemPx: number): Pt[] {
  const x0 = larguraImagemPx * 0.25;
  const x1 = larguraImagemPx * 0.75;
  const y0 = alturaImagemPx * 0.25;
  const y1 = alturaImagemPx * 0.75;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

// A-12: segmento horizontal no centro da foto, com metade da largura (mínimo de 20 px).
export function segmentoPadrao(larguraImagemPx: number, alturaImagemPx: number): { p1: Pt; p2: Pt } {
  const metade = Math.max(larguraImagemPx * 0.25, SEGMENTO_MIN_PX / 2);
  const centro = larguraImagemPx / 2;
  const y = alturaImagemPx / 2;
  return { p1: { x: centro - metade, y }, p2: { x: centro + metade, y } };
}
