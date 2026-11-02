import { LIMITE_PNG_MP } from '../constantes';
import { paredeInteira, type ParedeGeometria } from '../escala/parede-inteira';
import { pxPorCmLinear } from '../escala/linear';
import type { AreaUtil } from '../schemas';

// Região e resolução da exportação (RF-80, RN-12, RN-33, M4-10, M4-18, A-14, A-28;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.1).

export interface ResolucaoExportacao {
  larguraPx: number;
  alturaPx: number;
  pxPorCm: number;
}

export type FormatoExportacao = 'png' | 'jpg';

// M4-10: a região é a parede inteira, não a área útil.
export function regiaoDeExportacao(parede: ParedeGeometria): AreaUtil {
  return paredeInteira(parede);
}

// M4-10: a resolução é a do bitmap exibido no editor, com a densidade (px/cm) dele.
export function resolucaoDeExportacao(parede: ParedeGeometria): ResolucaoExportacao {
  const { escala } = parede;
  if (escala.metodo === 'perspectiva' && parede.retificada) {
    const r = parede.retificada;
    return { larguraPx: r.larguraPx, alturaPx: r.alturaPx, pxPorCm: r.pxPorCm };
  }
  if (escala.metodo === 'linear' && escala.linear) {
    const { p1, p2, comprimentoCm } = escala.linear;
    return {
      larguraPx: parede.larguraPx,
      alturaPx: parede.alturaPx,
      pxPorCm: pxPorCmLinear(p1, p2, comprimentoCm),
    };
  }
  throw new Error('A parede ainda não tem escala definida.');
}

// M4-12: a prévia usa o mesmo compositor em escala reduzida (lado maior = ladoMaxPx); nunca amplia.
export function resolucaoDaPrevia(resolucao: ResolucaoExportacao, ladoMaxPx: number): ResolucaoExportacao {
  const maior = Math.max(resolucao.larguraPx, resolucao.alturaPx);
  if (maior <= ladoMaxPx) return { ...resolucao };
  const fator = ladoMaxPx / maior;
  return {
    larguraPx: Math.max(1, Math.round(resolucao.larguraPx * fator)),
    alturaPx: Math.max(1, Math.round(resolucao.alturaPx * fator)),
    pxPorCm: resolucao.pxPorCm * fator,
  };
}

const MEGAPIXEL = 1_000_000;

// A-28: "caso limite" = saída acima de 16 MP (o perfil Alto).
export function pngDemorado(resolucao: Pick<ResolucaoExportacao, 'larguraPx' | 'alturaPx'>): boolean {
  return resolucao.larguraPx * resolucao.alturaPx > LIMITE_PNG_MP * MEGAPIXEL;
}

// M4-18: o padrão é JPG nos casos limite; PNG nos demais.
export function formatoPadraoDaExportacao(
  resolucao: Pick<ResolucaoExportacao, 'larguraPx' | 'alturaPx'>,
): FormatoExportacao {
  return pngDemorado(resolucao) ? 'jpg' : 'png';
}
