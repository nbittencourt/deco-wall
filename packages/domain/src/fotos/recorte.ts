// Enquadramento cover e modo de recorte (RF-33, RN-14; docs/specs/M2-biblioteca-e-composicao.md §4.2).
// A imagem preenche o quadro (tamanho impresso); o offset (-1..1) escolhe a parte que aparece no eixo com sobra.

export interface ImagemPx {
  larguraPx: number;
  alturaPx: number;
}
export interface QuadroCm {
  larguraCm: number;
  alturaCm: number;
}
export interface OffsetRecorte {
  offsetX: number;
  offsetY: number;
}
export interface RetanguloPx {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

const FOLGA = 1e-9;
const entre = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

// cm do quadro por px da imagem, na escala que cobre o quadro.
function cmPorPx(imagem: ImagemPx, quadro: QuadroCm): number {
  return Math.max(quadro.larguraCm / imagem.larguraPx, quadro.alturaCm / imagem.alturaPx);
}

// Tamanho do recorte em px da imagem e o que sobra em cada eixo (0 quando não há sobra).
function medidas(imagem: ImagemPx, quadro: QuadroCm) {
  const s = cmPorPx(imagem, quadro);
  const largura = quadro.larguraCm / s;
  const altura = quadro.alturaCm / s;
  const sobraX = imagem.larguraPx - largura > FOLGA ? imagem.larguraPx - largura : 0;
  const sobraY = imagem.alturaPx - altura > FOLGA ? imagem.alturaPx - altura : 0;
  return { s, largura, altura, sobraX, sobraY };
}

export function recorteCover(imagem: ImagemPx, quadro: QuadroCm, offset: OffsetRecorte): RetanguloPx {
  const m = medidas(imagem, quadro);
  return {
    x: (m.sobraX / 2) * (1 + entre(offset.offsetX, -1, 1)),
    y: (m.sobraY / 2) * (1 + entre(offset.offsetY, -1, 1)),
    largura: m.sobraX > 0 ? m.largura : imagem.larguraPx,
    altura: m.sobraY > 0 ? m.altura : imagem.alturaPx,
  };
}

// Arrastar a imagem `deltaCm` (no quadro, em cm) para a direita mostra mais da esquerda: o recorte anda
// no sentido contrário. Só o eixo com sobra se move; o outro volta a 0.
export function deslocarRecorte(
  imagem: ImagemPx,
  quadro: QuadroCm,
  atual: OffsetRecorte,
  deltaCm: { x: number; y: number },
): OffsetRecorte {
  const m = medidas(imagem, quadro);
  const novo = (sobra: number, offset: number, deltaPx: number) => {
    if (sobra <= 0) return 0;
    const inicio = (sobra / 2) * (1 + offset);
    return entre((inicio - deltaPx) / (sobra / 2) - 1, -1, 1);
  };
  return {
    offsetX: novo(m.sobraX, atual.offsetX, deltaCm.x / m.s),
    offsetY: novo(m.sobraY, atual.offsetY, deltaCm.y / m.s),
  };
}
