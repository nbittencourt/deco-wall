import { arredondarCm } from '../arredondar';
import { MARGEM_RETIFICACAO, PREVIA_LARGURA_PX } from '../constantes';
import {
  calcularHomografia,
  inverterHomografia,
  multiplicarHomografias,
  projetarHomografia,
} from '../geometria/homografia';
import { areaPoligono } from '../geometria/quadrilatero';
import type { AreaUtil, Pt } from '../schemas';
import { areaDeBitmap } from './parede-inteira';

// Retificação (ADR-04, M1-03; docs/specs/M1-parede-e-escala.md §4.2). Funções puras: o servidor e o Worker
// chegam às mesmas dimensões a partir dos mesmos dados.

export interface EntradaRetificacao {
  // Sentido horário a partir do superior esquerdo (ordenarCantos).
  cantosPx: readonly Pt[];
  larguraCm: number;
  alturaCm: number;
  larguraImagemPx: number;
  alturaImagemPx: number;
  // Lado maior do bitmap, vindo do perfil da parede (PERFIS[perfil].ladoParedePx).
  ladoMaxPx: number;
}

export interface Retificacao {
  // H: px da foto → cm (origem no canto sup.-esq. do retângulo de referência, RN-07).
  homografia: number[];
  // Canto superior esquerdo do bitmap retificado, em cm (pode ser negativo).
  origemCm: Pt;
  larguraPx: number;
  alturaPx: number;
  pxPorCm: number;
  // Derivada de origemCm, larguraPx, alturaPx e pxPorCm (mesma função de paredeInteira).
  paredeInteiraCm: AreaUtil;
}

const AMOSTRAS_POR_LADO = 64;
const W_MIN = 1e-9;

function retanguloReferencia(larguraCm: number, alturaCm: number): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: larguraCm, y: 0 },
    { x: larguraCm, y: alturaCm },
    { x: 0, y: alturaCm },
  ];
}

// Bordas da foto amostradas (cantos incluídos): a projeção de uma reta é uma reta, mas pontos que passam
// pelo horizonte (w ≤ 0) precisam ser descartados um a um.
function contornoDaFoto(largura: number, altura: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= AMOSTRAS_POR_LADO; i += 1) {
    const t = i / AMOSTRAS_POR_LADO;
    pts.push({ x: t * largura, y: 0 }, { x: t * largura, y: altura });
    pts.push({ x: 0, y: t * altura }, { x: largura, y: t * altura });
  }
  return pts;
}

export function calcularRetificacao(entrada: EntradaRetificacao): Retificacao {
  const { cantosPx, larguraCm, alturaCm, larguraImagemPx, alturaImagemPx, ladoMaxPx } = entrada;
  const homografia = calcularHomografia(cantosPx, retanguloReferencia(larguraCm, alturaCm));

  // Região: foto projetada, cortada na caixa de +100% por lado do retângulo de referência.
  const caixa = {
    minX: -larguraCm * MARGEM_RETIFICACAO,
    maxX: larguraCm * (1 + MARGEM_RETIFICACAO),
    minY: -alturaCm * MARGEM_RETIFICACAO,
    maxY: alturaCm * (1 + MARGEM_RETIFICACAO),
  };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ponto of contornoDaFoto(larguraImagemPx, alturaImagemPx)) {
    const { x, y, w } = projetarHomografia(homografia, ponto);
    if (!(w > W_MIN)) continue;
    const cx = Math.min(Math.max(x / w, caixa.minX), caixa.maxX);
    const cy = Math.min(Math.max(y / w, caixa.minY), caixa.maxY);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    minX = Math.min(minX, cx);
    maxX = Math.max(maxX, cx);
    minY = Math.min(minY, cy);
    maxY = Math.max(maxY, cy);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    throw new Error('A foto não aparece à frente do plano marcado.');
  }

  const origemCm = { x: arredondarCm(minX), y: arredondarCm(minY) };
  const regiaoLarguraCm = arredondarCm(maxX) - origemCm.x;
  const regiaoAlturaCm = arredondarCm(maxY) - origemCm.y;

  // Resolução: o lado maior respeita o perfil e nunca passa da densidade da foto no retângulo marcado.
  const densidade = Math.sqrt(areaPoligono(cantosPx) / (larguraCm * alturaCm));
  const pxPorCm = Math.min(ladoMaxPx / Math.max(regiaoLarguraCm, regiaoAlturaCm), densidade);
  const larguraPx = Math.max(1, Math.round(regiaoLarguraCm * pxPorCm));
  const alturaPx = Math.max(1, Math.round(regiaoAlturaCm * pxPorCm));

  return {
    homografia,
    origemCm,
    larguraPx,
    alturaPx,
    pxPorCm,
    paredeInteiraCm: areaDeBitmap(origemCm, larguraPx, alturaPx, pxPorCm),
  };
}

// Afim "px do bitmap (contínuo) → cm", composta com H⁻¹: px do bitmap → px da foto. É a matriz que o warp usa
// para cada pixel de destino (no centro do pixel, i + 0,5).
function bitmapParaImagem(homografia: readonly number[], pxPorCm: number, origemCm: Pt): number[] {
  const k = 1 / pxPorCm;
  const bitmapParaCm = [k, 0, origemCm.x, 0, k, origemCm.y, 0, 0, 1];
  return multiplicarHomografias(inverterHomografia(homografia), bitmapParaCm);
}

export function homografiaBitmapParaImagem(
  r: Pick<Retificacao, 'homografia' | 'pxPorCm' | 'origemCm'>,
): number[] {
  return bitmapParaImagem(r.homografia, r.pxPorCm, r.origemCm);
}

export interface Previa {
  larguraPx: number;
  alturaPx: number;
  pxPorCm: number;
  homografiaBitmapParaImagem: number[];
}

// RF-06 / DV-06: prévia frontal só do retângulo de referência (sem a margem), com 320 px de largura.
export function calcularPrevia(
  entrada: Pick<EntradaRetificacao, 'cantosPx' | 'larguraCm' | 'alturaCm'>,
  larguraPx = PREVIA_LARGURA_PX,
): Previa {
  const homografia = calcularHomografia(
    entrada.cantosPx,
    retanguloReferencia(entrada.larguraCm, entrada.alturaCm),
  );
  const pxPorCm = larguraPx / entrada.larguraCm;
  return {
    larguraPx,
    alturaPx: Math.max(1, Math.round(entrada.alturaCm * pxPorCm)),
    pxPorCm,
    homografiaBitmapParaImagem: bitmapParaImagem(homografia, pxPorCm, { x: 0, y: 0 }),
  };
}
