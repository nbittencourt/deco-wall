import { GRID_PASSO_MIN_PX } from '../constantes';
import type { AreaUtil } from '../schemas';

// Grid (A-07, RN-34): linhas a partir da origem 0,0, só dentro da parede inteira.

export function gridVisivelNoZoom(passoCm: number, pxPorCmTela: number): boolean {
  return passoCm * pxPorCmTela >= GRID_PASSO_MIN_PX - 1e-9;
}

export function linhasVisiveis(opcoes: {
  passoCm: number;
  limitesCm: AreaUtil;
  janelaCm: AreaUtil;
  pxPorCmTela: number;
}): { xs: number[]; ys: number[] } {
  const { passoCm, limitesCm: l, janelaCm: j, pxPorCmTela } = opcoes;
  if (!gridVisivelNoZoom(passoCm, pxPorCmTela)) return { xs: [], ys: [] };
  return {
    xs: multiplos(passoCm, Math.max(l.xCm, j.xCm), Math.min(l.xCm + l.larguraCm, j.xCm + j.larguraCm)),
    ys: multiplos(passoCm, Math.max(l.yCm, j.yCm), Math.min(l.yCm + l.alturaCm, j.yCm + j.alturaCm)),
  };
}

// Múltiplos do passo em [de, ate], bordas incluídas; arredondados para não acumular erro de ponto flutuante.
function multiplos(passo: number, de: number, ate: number): number[] {
  if (ate < de) return [];
  const saida: number[] = [];
  const primeiro = Math.ceil(de / passo - 1e-9);
  const ultimo = Math.floor(ate / passo + 1e-9);
  for (let k = primeiro; k <= ultimo; k += 1) saida.push(Number((k * passo).toFixed(6)));
  return saida;
}
