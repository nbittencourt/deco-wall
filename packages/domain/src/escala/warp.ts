// Warp bilinear (ADR-04, docs/specs/M1-parede-e-escala.md §4.1). Só Uint8ClampedArray, sem API do browser:
// o mesmo código roda no Worker (browser) e nos testes (Node).

export interface ImagemRGBA {
  dados: Uint8ClampedArray;
  largura: number;
  altura: number;
}

// `h` leva pixels do destino a pixels da origem (coordenadas contínuas; o centro do pixel i é i + 0,5).
// Fora da foto, ou atrás do horizonte (w ≤ 0), o pixel de destino fica transparente (alfa 0).
//
// O laço interno é o caminho quente do app (28 MP no perfil Alto): sem alocações, uma divisão por pixel,
// índices inteiros e as quatro vizinhas lidas de uma vez.
export function retificarPixels(
  origem: ImagemRGBA,
  h: readonly number[],
  larguraPx: number,
  alturaPx: number,
): Uint8ClampedArray {
  // Escreve num Uint8Array (sem a conversão com saturação do Uint8ClampedArray, que custa caro por pixel):
  // uma combinação convexa de bytes nunca sai de 0–255. O resultado é o mesmo buffer visto como clamped.
  const memoria = new ArrayBuffer(larguraPx * alturaPx * 4);
  const saida = new Uint8Array(memoria);
  const { dados, largura: W, altura: H } = origem;
  const h0 = h[0]!;
  const h1 = h[1]!;
  const h2 = h[2]!;
  const h3 = h[3]!;
  const h4 = h[4]!;
  const h5 = h[5]!;
  const h6 = h[6]!;
  const h7 = h[7]!;
  const h8 = h[8]!;
  const ultimoX = W - 1;
  const ultimoY = H - 1;
  const passoLinha = W * 4;

  for (let j = 0; j < alturaPx; j += 1) {
    const y = j + 0.5;
    // Parte do numerador e do peso que não depende de i.
    const nx0 = h1 * y + h2;
    const ny0 = h4 * y + h5;
    const nw0 = h7 * y + h8;
    let destino = j * larguraPx * 4;
    for (let i = 0; i < larguraPx; i += 1, destino += 4) {
      const x = i + 0.5;
      const w = h6 * x + nw0;
      if (!(w > 1e-12)) continue;
      const inverso = 1 / w;
      const u = (h0 * x + nx0) * inverso;
      const v = (h3 * x + ny0) * inverso;
      if (u < 0 || u > W || v < 0 || v > H) continue;

      // Centro do pixel da origem em (k + 0,5): a amostra fica entre os pixels x0 e x0 + 1.
      const fx = u - 0.5;
      const fy = v - 0.5;
      // fx, fy ≥ −0,5: o piso é −1 só na primeira coluna/linha, onde a vizinha presa à borda repete o pixel 0.
      let x0 = fx < 0 ? -1 : fx | 0;
      let y0 = fy < 0 ? -1 : fy | 0;
      const tx = fx - x0;
      const ty = fy - y0;
      let x1 = x0 + 1;
      let y1 = y0 + 1;
      if (x0 < 0) x0 = 0;
      if (y0 < 0) y0 = 0;
      if (x1 > ultimoX) x1 = ultimoX;
      if (y1 > ultimoY) y1 = ultimoY;
      if (x0 > ultimoX) x0 = ultimoX;
      if (y0 > ultimoY) y0 = ultimoY;

      const linha0 = y0 * passoLinha;
      const linha1 = y1 * passoLinha;
      const a = linha0 + x0 * 4;
      const b = linha0 + x1 * 4;
      const c = linha1 + x0 * 4;
      const d = linha1 + x1 * 4;
      const wb = tx * (1 - ty);
      const wc = (1 - tx) * ty;
      const wd = tx * ty;
      const wa = 1 - wb - wc - wd;
      saida[destino] = (dados[a]! * wa + dados[b]! * wb + dados[c]! * wc + dados[d]! * wd + 0.5) | 0;
      saida[destino + 1] =
        (dados[a + 1]! * wa + dados[b + 1]! * wb + dados[c + 1]! * wc + dados[d + 1]! * wd + 0.5) | 0;
      saida[destino + 2] =
        (dados[a + 2]! * wa + dados[b + 2]! * wb + dados[c + 2]! * wc + dados[d + 2]! * wd + 0.5) | 0;
      saida[destino + 3] =
        (dados[a + 3]! * wa + dados[b + 3]! * wb + dados[c + 3]! * wc + dados[d + 3]! * wd + 0.5) | 0;
    }
  }
  return new Uint8ClampedArray(memoria);
}
