import { arredondarCm } from '../arredondar';
import type { AreaUtil, Pt } from '../schemas';
import { pxPorCmLinear } from './linear';

// Parede inteira (RN-33, M1-03): região com pixels da foto, em cm. É a base da área útil padrão e do grid.
// Uma única função serve ao servidor (que grava a área útil inicial) e à web (que avisa quando a área
// fica fora da parede): assim os dois lados nunca divergem por arredondamento.

export interface ParedeGeometria {
  larguraPx: number;
  alturaPx: number;
  escala: {
    metodo: 'perspectiva' | 'linear' | null;
    linear?: { p1: Pt; p2: Pt; comprimentoCm: number };
  };
  retificada?: { larguraPx: number; alturaPx: number; pxPorCm: number; origemCm: Pt };
}

// Retângulo em cm de um bitmap de `larguraPx × alturaPx` px a `pxPorCm` px/cm, com canto superior esquerdo em `origemCm`.
export function areaDeBitmap(origemCm: Pt, larguraPx: number, alturaPx: number, pxPorCm: number): AreaUtil {
  return {
    xCm: origemCm.x,
    yCm: origemCm.y,
    larguraCm: arredondarCm(larguraPx / pxPorCm),
    alturaCm: arredondarCm(alturaPx / pxPorCm),
  };
}

export function paredeInteira(parede: ParedeGeometria): AreaUtil {
  const { escala } = parede;
  if (escala.metodo === 'perspectiva' && parede.retificada) {
    const r = parede.retificada;
    return areaDeBitmap(r.origemCm, r.larguraPx, r.alturaPx, r.pxPorCm);
  }
  if (escala.metodo === 'linear' && escala.linear) {
    const { p1, p2, comprimentoCm } = escala.linear;
    return areaDeBitmap(
      { x: 0, y: 0 },
      parede.larguraPx,
      parede.alturaPx,
      pxPorCmLinear(p1, p2, comprimentoCm),
    );
  }
  throw new Error('A parede ainda não tem escala definida.');
}

// Escala exibida no chip e no painel (§3.7): px por cm do bitmap retificado ou da foto.
export function escalaPxPorCm(parede: ParedeGeometria): number | null {
  const { escala } = parede;
  if (escala.metodo === 'perspectiva' && parede.retificada) return parede.retificada.pxPorCm;
  if (escala.metodo === 'linear' && escala.linear) {
    const { p1, p2, comprimentoCm } = escala.linear;
    return pxPorCmLinear(p1, p2, comprimentoCm);
  }
  return null;
}
