import { describe, expect, it } from 'vitest';
import { retificarPixels } from './warp';

// Warp bilinear (ADR-04, §4.1): só Uint8ClampedArray, sem API do browser. A matriz leva
// pixels do destino a pixels da origem; o centro do pixel é (i + 0,5, j + 0,5).

const IDENTIDADE = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function imagem(
  largura: number,
  altura: number,
  pixel: (x: number, y: number) => [number, number, number, number],
) {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) dados.set(pixel(x, y), (y * largura + x) * 4);
  }
  return { dados, largura, altura };
}

function px(dados: Uint8ClampedArray, largura: number, x: number, y: number): number[] {
  const i = (y * largura + x) * 4;
  return [dados[i]!, dados[i + 1]!, dados[i + 2]!, dados[i + 3]!];
}

describe('retificarPixels', () => {
  it('com a identidade copia a origem exatamente', () => {
    const origem = imagem(4, 3, (x, y) => [x * 40, y * 80, (x + y) * 20, 255]);
    const saida = retificarPixels(origem, IDENTIDADE, 4, 3);
    expect(Array.from(saida)).toEqual(Array.from(origem.dados));
  });

  it('devolve RGBA com largura × altura × 4 bytes', () => {
    const origem = imagem(2, 2, () => [10, 20, 30, 255]);
    expect(retificarPixels(origem, IDENTIDADE, 5, 7)).toHaveLength(5 * 7 * 4);
  });

  it('translação: o destino lê a origem deslocada e fica transparente fora da foto', () => {
    // Destino (x, y) lê a origem (x + 2, y).
    const origem = imagem(4, 1, (x) => [x * 60, 0, 0, 255]);
    const saida = retificarPixels(origem, [1, 0, 2, 0, 1, 0, 0, 0, 1], 4, 1);
    expect(px(saida, 4, 0, 0)).toEqual([120, 0, 0, 255]);
    expect(px(saida, 4, 1, 0)).toEqual([180, 0, 0, 255]);
    expect(px(saida, 4, 2, 0)[3]).toBe(0);
    expect(px(saida, 4, 3, 0)[3]).toBe(0);
  });

  it('interpola bilinearmente entre dois pixels vizinhos', () => {
    // Origem 2×1: preto | branco. O centro do destino cai na fronteira dos dois pixels.
    const origem = imagem(2, 1, (x) => (x === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const saida = retificarPixels(origem, [2, 0, 0, 0, 1, 0, 0, 0, 1], 1, 1);
    const [r, g, b, a] = px(saida, 1, 0, 0);
    expect(Math.abs(r! - 127.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(g! - 127.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(b! - 127.5)).toBeLessThanOrEqual(1);
    expect(a).toBe(255);
  });

  it('ampliação 2× de um xadrez mantém os blocos (nos centros)', () => {
    const origem = imagem(2, 2, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0, 255] : [200, 200, 200, 255]));
    // Destino 4×4 lê a origem com escala 1/2.
    const saida = retificarPixels(origem, [0.5, 0, 0, 0, 0.5, 0, 0, 0, 1], 4, 4);
    // Pixels de borda do destino equivalem aos pixels de borda da origem (amostra presa à borda).
    expect(px(saida, 4, 0, 0)[0]).toBe(0);
    expect(px(saida, 4, 3, 0)[0]).toBe(200);
    expect(px(saida, 4, 0, 3)[0]).toBe(200);
    expect(px(saida, 4, 3, 3)[0]).toBe(0);
    expect(px(saida, 4, 2, 2)[3]).toBe(255);
  });

  it('preserva o alfa da origem', () => {
    const origem = imagem(2, 2, () => [10, 20, 30, 128]);
    const saida = retificarPixels(origem, IDENTIDADE, 2, 2);
    expect(px(saida, 2, 1, 1)).toEqual([10, 20, 30, 128]);
  });

  it('pontos com w ≤ 0 (atrás do horizonte) ficam transparentes', () => {
    const origem = imagem(2, 2, () => [255, 255, 255, 255]);
    // w = −1 em todo o destino.
    const saida = retificarPixels(origem, [1, 0, 0, 0, 1, 0, 0, 0, -1], 2, 2);
    for (let i = 3; i < saida.length; i += 4) expect(saida[i]).toBe(0);
  });

  it('redução 2×: cada metade da origem aparece na metade certa do destino', () => {
    // Origem 100×100: metade esquerda vermelha, direita azul; destino 50×50 lê a origem com escala 2.
    const origem = imagem(100, 100, (x) => (x < 50 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const saida = retificarPixels(origem, [2, 0, 0, 0, 2, 0, 0, 0, 1], 50, 50);
    expect(px(saida, 50, 5, 25)).toEqual([255, 0, 0, 255]);
    expect(px(saida, 50, 45, 25)).toEqual([0, 0, 255, 255]);
  });
});
