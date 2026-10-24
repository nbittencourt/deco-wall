import { arredondarCm } from '../arredondar';
import { AREA_UTIL_MIN_CM } from '../constantes';
import type { AreaUtil, Pt } from '../schemas';

// Área útil (RN-33 a RN-35, A-13): mínimo de 5 cm por lado, dentro da parede inteira, livre a 0,1 cm.

const TOLERANCIA_FORA_CM = 0.05;
const FOLGA = 1e-9;

const entre = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

export function limitarAreaUtil(area: AreaUtil, parede: AreaUtil): AreaUtil {
  const larguraCm = entre(arredondarCm(area.larguraCm), AREA_UTIL_MIN_CM, parede.larguraCm);
  const alturaCm = entre(arredondarCm(area.alturaCm), AREA_UTIL_MIN_CM, parede.alturaCm);
  return {
    xCm: entre(arredondarCm(area.xCm), parede.xCm, arredondarCm(parede.xCm + parede.larguraCm - larguraCm)),
    yCm: entre(arredondarCm(area.yCm), parede.yCm, arredondarCm(parede.yCm + parede.alturaCm - alturaCm)),
    larguraCm,
    alturaCm,
  };
}

// RN-35: a área mantém os valores em cm quando a escala é refeita; se sair da parede, o app avisa.
export function areaUtilForaDaParede(area: AreaUtil, parede: AreaUtil): boolean {
  return (
    area.xCm < parede.xCm - TOLERANCIA_FORA_CM ||
    area.yCm < parede.yCm - TOLERANCIA_FORA_CM ||
    area.xCm + area.larguraCm > parede.xCm + parede.larguraCm + TOLERANCIA_FORA_CM ||
    area.yCm + area.alturaCm > parede.yCm + parede.alturaCm + TOLERANCIA_FORA_CM
  );
}

export type CampoAreaUtil = 'xCm' | 'yCm' | 'larguraCm' | 'alturaCm';
export interface Faixa {
  min: number;
  max: number;
}

// A-13: a faixa válida de cada campo, dados os demais.
export function faixaCampoAreaUtil(campo: CampoAreaUtil, area: AreaUtil, parede: AreaUtil): Faixa {
  const direita = parede.xCm + parede.larguraCm;
  const base = parede.yCm + parede.alturaCm;
  switch (campo) {
    case 'larguraCm':
      return { min: AREA_UTIL_MIN_CM, max: arredondarCm(direita - area.xCm) };
    case 'alturaCm':
      return { min: AREA_UTIL_MIN_CM, max: arredondarCm(base - area.yCm) };
    case 'xCm':
      return { min: parede.xCm, max: arredondarCm(direita - area.larguraCm) };
    case 'yCm':
      return { min: parede.yCm, max: arredondarCm(base - area.alturaCm) };
  }
}

export type ResultadoCampoAreaUtil = { ok: true; area: AreaUtil } | { ok: false; faixa: Faixa };

export function aplicarCampoAreaUtil(
  area: AreaUtil,
  campo: CampoAreaUtil,
  valor: number,
  parede: AreaUtil,
): ResultadoCampoAreaUtil {
  const faixa = faixaCampoAreaUtil(campo, area, parede);
  if (!Number.isFinite(valor)) return { ok: false, faixa };
  const arredondado = arredondarCm(valor);
  if (arredondado < faixa.min - FOLGA || arredondado > faixa.max + FOLGA) return { ok: false, faixa };
  return { ok: true, area: { ...area, [campo]: arredondado } };
}

// Arrastar o interior da área.
export function moverAreaUtil(area: AreaUtil, deltaCm: Pt, parede: AreaUtil): AreaUtil {
  return limitarAreaUtil({ ...area, xCm: area.xCm + deltaCm.x, yCm: area.yCm + deltaCm.y }, parede);
}

export type AlcaAreaUtil = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

// Arrastar uma das 8 alças até `pontoCm`: os lados opostos ficam fixos; o mínimo de 5 cm e a parede
// limitam o movimento (a área nunca se inverte).
export function redimensionarAreaUtil(
  area: AreaUtil,
  alca: AlcaAreaUtil,
  pontoCm: Pt,
  parede: AreaUtil,
): AreaUtil {
  let esquerda = area.xCm;
  let direita = area.xCm + area.larguraCm;
  let topo = area.yCm;
  let base = area.yCm + area.alturaCm;
  const limiteDireita = parede.xCm + parede.larguraCm;
  const limiteBase = parede.yCm + parede.alturaCm;

  if (alca.includes('w')) esquerda = entre(pontoCm.x, parede.xCm, direita - AREA_UTIL_MIN_CM);
  if (alca.includes('e')) direita = entre(pontoCm.x, esquerda + AREA_UTIL_MIN_CM, limiteDireita);
  if (alca.includes('n')) topo = entre(pontoCm.y, parede.yCm, base - AREA_UTIL_MIN_CM);
  if (alca.includes('s')) base = entre(pontoCm.y, topo + AREA_UTIL_MIN_CM, limiteBase);

  return limitarAreaUtil(
    { xCm: esquerda, yCm: topo, larguraCm: direita - esquerda, alturaCm: base - topo },
    parede,
  );
}
