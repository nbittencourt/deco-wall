import { describe, expect, it } from 'vitest';
import { deslocarRecorte, recorteCover } from './recorte';

// Enquadramento cover e modo de recorte (RF-33, RN-14; spec M2 §4.2).

const PAISAGEM = { larguraPx: 1000, alturaPx: 500 };
const RETRATO_20X30 = { larguraCm: 20, alturaCm: 30 };

describe('recorteCover', () => {
  it('centralizado por padrão: sobra nos dois lados do eixo largo', () => {
    // s = max(20/1000, 30/500) = 0,06 cm/px → recorte de 333,33 × 500 px
    const r = recorteCover(PAISAGEM, RETRATO_20X30, { offsetX: 0, offsetY: 0 });
    expect(r.x).toBeCloseTo(333.333, 2);
    expect(r.y).toBe(0);
    expect(r.largura).toBeCloseTo(333.333, 2);
    expect(r.altura).toBeCloseTo(500, 6);
  });

  it('offset -1 mostra a borda esquerda; +1, a direita', () => {
    expect(recorteCover(PAISAGEM, RETRATO_20X30, { offsetX: -1, offsetY: 0 }).x).toBe(0);
    expect(recorteCover(PAISAGEM, RETRATO_20X30, { offsetX: 1, offsetY: 0 }).x).toBeCloseTo(666.667, 2);
  });

  it('imagem em retrato num quadro em paisagem: a sobra é vertical', () => {
    const r = recorteCover(
      { larguraPx: 500, alturaPx: 1000 },
      { larguraCm: 30, alturaCm: 20 },
      { offsetX: 0, offsetY: -1 },
    );
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.largura).toBeCloseTo(500, 6);
    expect(r.altura).toBeCloseTo(333.333, 2);
  });

  it('mesma proporção: sem sobra, o offset não importa', () => {
    const r = recorteCover({ larguraPx: 600, alturaPx: 900 }, RETRATO_20X30, { offsetX: 1, offsetY: -1 });
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0, 6);
    expect(r.largura).toBeCloseTo(600, 6);
    expect(r.altura).toBeCloseTo(900, 6);
  });

  it('o recorte sempre cabe dentro da imagem', () => {
    for (const offsetX of [-1, -0.3, 0, 0.7, 1]) {
      const r = recorteCover(PAISAGEM, { larguraCm: 10, alturaCm: 15 }, { offsetX, offsetY: 0 });
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.largura).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });
});

describe('deslocarRecorte (arrastar a imagem no modo de recorte)', () => {
  it('arrastar a imagem para a direita mostra mais da esquerda', () => {
    // 6 cm = 100 px da imagem; o recorte começa em 333,33 e vai para 233,33 → offset -0,3
    const novo = deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: 0, offsetY: 0 }, { x: 6, y: 0 });
    expect(novo.offsetX).toBeCloseTo(-0.3, 6);
    expect(novo.offsetY).toBe(0);
  });

  it('arrastar para a esquerda mostra mais da direita', () => {
    const novo = deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: 0, offsetY: 0 }, { x: -6, y: 0 });
    expect(novo.offsetX).toBeCloseTo(0.3, 6);
  });

  it('limita a [-1, 1]', () => {
    expect(
      deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: 0, offsetY: 0 }, { x: 999, y: 0 }).offsetX,
    ).toBe(-1);
    expect(
      deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: 0, offsetY: 0 }, { x: -999, y: 0 }).offsetX,
    ).toBe(1);
  });

  it('só se move no eixo com sobra', () => {
    const novo = deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: 0.5, offsetY: 0.2 }, { x: 0, y: 12 });
    expect(novo.offsetX).toBeCloseTo(0.5, 6);
    expect(novo.offsetY).toBe(0);
  });

  it('parte do offset atual', () => {
    const novo = deslocarRecorte(PAISAGEM, RETRATO_20X30, { offsetX: -0.3, offsetY: 0 }, { x: -6, y: 0 });
    expect(novo.offsetX).toBeCloseTo(0, 6);
  });
});
