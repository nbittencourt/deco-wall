import { arredondarCm } from '../arredondar';
import type { AreaUtil, FotoNaParede } from '../schemas';
import { retanguloExterno } from './foto';

// Bounding box (RF-62; docs/specs/M2-biblioteca-e-composicao.md §4.6): o retângulo que envolve o tamanho externo
// de todas as fotos da variante, placeholders inclusive. Nulo sem fotos.
export function boundingBox(
  fotos: readonly Pick<FotoNaParede, 'xCm' | 'yCm' | 'tamanho' | 'borda'>[],
): AreaUtil | null {
  if (fotos.length === 0) return null;
  let esquerda = Infinity;
  let topo = Infinity;
  let direita = -Infinity;
  let base = -Infinity;
  for (const foto of fotos) {
    const r = retanguloExterno(foto);
    esquerda = Math.min(esquerda, r.xCm);
    topo = Math.min(topo, r.yCm);
    direita = Math.max(direita, r.xCm + r.larguraCm);
    base = Math.max(base, r.yCm + r.alturaCm);
  }
  return {
    xCm: arredondarCm(esquerda),
    yCm: arredondarCm(topo),
    larguraCm: arredondarCm(direita - esquerda),
    alturaCm: arredondarCm(base - topo),
  };
}
