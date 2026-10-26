import { describe, expect, it } from 'vitest';
import { calcularRecorte, deslocarRecorte } from './recorte';

// Recorte cover (RN-14, M2-09; §4.3). A janela é em px da imagem; offsets em [−1, 1].

const CENTRO = { offsetX: 0, offsetY: 0 };

describe('calcularRecorte — sobra horizontal (imagem mais larga que o quadro)', () => {
  // imagem 2000 × 1000 (2:1), quadro 10 × 10 cm (1:1): janela 1000 × 1000, sobraX 1000.
  const imagem = { larguraPx: 2000, alturaPx: 1000 };
  const quadro = { larguraCm: 10, alturaCm: 10 };

  it('offset 0 centraliza; −1 encosta à esquerda; +1 encosta à direita', () => {
    expect(calcularRecorte(imagem, quadro, CENTRO)).toEqual({ x: 500, y: 0, largura: 1000, altura: 1000 });
    expect(calcularRecorte(imagem, quadro, { offsetX: -1, offsetY: 0 })).toEqual({
      x: 0,
      y: 0,
      largura: 1000,
      altura: 1000,
    });
    expect(calcularRecorte(imagem, quadro, { offsetX: 1, offsetY: 0 })).toEqual({
      x: 1000,
      y: 0,
      largura: 1000,
      altura: 1000,
    });
  });

  it('no eixo sem sobra, o offset não tem efeito', () => {
    expect(calcularRecorte(imagem, quadro, { offsetX: 0, offsetY: 0.8 }).y).toBe(0);
  });
});

describe('calcularRecorte — sobra vertical (imagem mais alta que o quadro)', () => {
  // imagem 1000 × 2000, quadro 10 × 10: janela 1000 × 1000, sobraY 1000.
  const imagem = { larguraPx: 1000, alturaPx: 2000 };
  const quadro = { larguraCm: 10, alturaCm: 10 };

  it('offset 0 centraliza; −1 encosta no topo; +1 embaixo', () => {
    expect(calcularRecorte(imagem, quadro, CENTRO)).toEqual({ x: 0, y: 500, largura: 1000, altura: 1000 });
    expect(calcularRecorte(imagem, quadro, { offsetX: 0, offsetY: -1 }).y).toBe(0);
    expect(calcularRecorte(imagem, quadro, { offsetX: 0, offsetY: 1 }).y).toBe(1000);
  });
});

describe('calcularRecorte — proporção igual e valores fora da faixa', () => {
  it('mesma proporção: a janela é a imagem inteira', () => {
    expect(
      calcularRecorte({ larguraPx: 1500, alturaPx: 1000 }, { larguraCm: 15, alturaCm: 10 }, CENTRO),
    ).toEqual({
      x: 0,
      y: 0,
      largura: 1500,
      altura: 1000,
    });
  });

  it('offset fora de [−1, 1] é limitado', () => {
    const r = calcularRecorte(
      { larguraPx: 2000, alturaPx: 1000 },
      { larguraCm: 10, alturaCm: 10 },
      {
        offsetX: 7,
        offsetY: 0,
      },
    );
    expect(r.x).toBe(1000);
  });
});

describe('deslocarRecorte (§4.3 passo 6)', () => {
  const imagem = { larguraPx: 2000, alturaPx: 1000 };
  const tamanho = { sugeridoId: null, larguraCm: 10, alturaCm: 10 };

  it('mover a imagem d px para a direita leva o recorte para a esquerda: offsetX −= 2d / sobraX', () => {
    // sobraX = 1000: d = 250 → −0,5
    expect(deslocarRecorte(CENTRO, { x: 250, y: 0 }, imagem, tamanho)).toEqual({ offsetX: -0.5, offsetY: 0 });
    expect(deslocarRecorte(CENTRO, { x: -250, y: 0 }, imagem, tamanho)).toEqual({ offsetX: 0.5, offsetY: 0 });
  });

  it('é limitado a [−1, 1]', () => {
    expect(deslocarRecorte(CENTRO, { x: 99999, y: 0 }, imagem, tamanho).offsetX).toBe(-1);
    expect(deslocarRecorte(CENTRO, { x: -99999, y: 0 }, imagem, tamanho).offsetX).toBe(1);
  });

  it('arredonda a 3 casas decimais', () => {
    // 2 × 100 / 1000 = 0,2; 2 × 33,3333 / 1000 = 0,0666666 → 0,067
    expect(deslocarRecorte(CENTRO, { x: -33.3333, y: 0 }, imagem, tamanho).offsetX).toBe(0.067);
  });

  it('só o eixo com sobra se move; o outro fica em 0', () => {
    expect(deslocarRecorte({ offsetX: 0, offsetY: 0.4 }, { x: -250, y: 300 }, imagem, tamanho)).toEqual({
      offsetX: 0.5,
      offsetY: 0,
    });
  });

  it('parte do offset atual', () => {
    expect(deslocarRecorte({ offsetX: 0.5, offsetY: 0 }, { x: 250, y: 0 }, imagem, tamanho).offsetX).toBe(0);
  });
});
