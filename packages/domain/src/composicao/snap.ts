import { arredondarCm } from '../arredondar';
import type { Pt } from '../schemas';

// Snap (RF-53, RN-06, RN-15; docs/specs/M2-biblioteca-e-composicao.md §4.4): múltiplos do passo, a partir da
// origem 0,0 (a mesma do grid).

export interface GridDeSnap {
  snap: boolean;
  passoCm: number;
}

// Leva ao múltiplo mais próximo do passo, sem ruído de ponto flutuante nem -0.
export function encaixar(valorCm: number, passoCm: number): number {
  const encaixado = arredondarCm(Math.round(valorCm / passoCm) * passoCm);
  return encaixado === 0 ? 0 : encaixado;
}

// Só encaixa com `grid.snap` ligado; desligado, a posição vale como está, a 0,1 cm (DM-08).
export function encaixarPosicao(p: Pt, grid: GridDeSnap): Pt {
  if (!grid.snap) return { x: arredondarCm(p.x), y: arredondarCm(p.y) };
  return { x: encaixar(p.x, grid.passoCm), y: encaixar(p.y, grid.passoCm) };
}
