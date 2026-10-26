import type { Tamanho } from '../schemas';

// Recorte cover (RF-33, RN-14, M2-09; docs/specs/M2-biblioteca-e-composicao.md §4.3). A imagem preenche o quadro
// (a área impressa, sem a borda); o offset (−1 a +1) escolhe a parte que aparece no eixo com sobra.

export interface OffsetRecorte {
  offsetX: number;
  offsetY: number;
}

export interface ImagemPx {
  larguraPx: number;
  alturaPx: number;
}
export interface RetanguloPx {
  x: number;
  y: number;
  largura: number;
  altura: number;
}
interface Quadro {
  larguraCm: number;
  alturaCm: number;
}

const FOLGA = 1e-9;
const entre = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);
const tresCasas = (valor: number) => Math.round(valor * 1000) / 1000;

// Janela do recorte em px da imagem e o que sobra em cada eixo (0 quando não há sobra).
function medidas(imagem: ImagemPx, quadro: Quadro) {
  const ri = imagem.larguraPx / imagem.alturaPx;
  const rq = quadro.larguraCm / quadro.alturaCm;
  const horizontal = ri > rq; // a sobra é horizontal
  const largura = horizontal ? imagem.alturaPx * rq : imagem.larguraPx;
  const altura = horizontal ? imagem.alturaPx : imagem.larguraPx / rq;
  const sobraX = imagem.larguraPx - largura > FOLGA ? imagem.larguraPx - largura : 0;
  const sobraY = imagem.alturaPx - altura > FOLGA ? imagem.alturaPx - altura : 0;
  return { largura, altura, sobraX, sobraY };
}

// A janela, em px da imagem: x = (sobraX / 2) · (1 + offsetX), idem em Y; 0 centraliza, −1 encosta à esquerda
// (ou no topo) e +1 à direita (ou embaixo). No eixo sem sobra, o offset não tem efeito.
export function calcularRecorte(imagem: ImagemPx, tamanho: Quadro, recorte: OffsetRecorte): RetanguloPx {
  const m = medidas(imagem, tamanho);
  return {
    x: (m.sobraX / 2) * (1 + entre(recorte.offsetX, -1, 1)),
    y: (m.sobraY / 2) * (1 + entre(recorte.offsetY, -1, 1)),
    largura: m.sobraX > 0 ? m.largura : imagem.larguraPx,
    altura: m.sobraY > 0 ? m.altura : imagem.alturaPx,
  };
}

// §4.3 passo 6: mover a imagem `d` px (da imagem) para a direita leva a janela para a esquerda:
// offsetX −= 2d / sobraX (idem em Y), limitado a [−1, 1] e arredondado a 3 casas. O eixo sem sobra fica em 0.
export function deslocarRecorte(
  recorte: OffsetRecorte,
  deltaPx: { x: number; y: number },
  imagem: ImagemPx,
  tamanho: Quadro | Tamanho,
): OffsetRecorte {
  const m = medidas(imagem, tamanho);
  const novo = (sobra: number, offset: number, d: number) =>
    sobra > 0 ? tresCasas(entre(offset - (2 * d) / sobra, -1, 1)) : 0;
  return {
    offsetX: novo(m.sobraX, recorte.offsetX, deltaPx.x),
    offsetY: novo(m.sobraY, recorte.offsetY, deltaPx.y),
  };
}
