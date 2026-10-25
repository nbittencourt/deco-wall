import { describe, expect, it } from 'vitest';
import { PERSPECTIVA } from '../../../../tests/fixtures/paredes';
import {
  aplicarHomografia,
  calcularHomografia,
  inverterHomografia,
  multiplicarHomografias,
  projetarHomografia,
} from './homografia';

// Homografia 3×3 (ADR-04, docs/specs/M1-parede-e-escala.md §4.1): 9 números, linha a linha.

const IDENTIDADE = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const RETANGULO_300x200 = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 200 },
  { x: 0, y: 200 },
];

function normalizar(h: readonly number[]): number[] {
  return h.map((v) => v / h[8]!);
}

describe('calcularHomografia', () => {
  it('quadrado unitário para ele mesmo dá a identidade', () => {
    const quadrado = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const h = normalizar(calcularHomografia(quadrado, quadrado));
    h.forEach((valor, i) => expect(valor).toBeCloseTo(IDENTIDADE[i]!, 9));
  });

  it('escala e translação levam cada canto ao destino', () => {
    const origem = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ];
    const destino = [
      { x: 100, y: 200 },
      { x: 120, y: 200 },
      { x: 120, y: 210 },
      { x: 100, y: 210 },
    ];
    const h = calcularHomografia(origem, destino);
    origem.forEach((p, i) => {
      const r = aplicarHomografia(h, p);
      expect(r.x).toBeCloseTo(destino[i]!.x, 6);
      expect(r.y).toBeCloseTo(destino[i]!.y, 6);
    });
    const centro = aplicarHomografia(h, { x: 5, y: 2.5 });
    expect(centro.x).toBeCloseTo(110, 6);
    expect(centro.y).toBeCloseTo(205, 6);
  });

  it('quadrilátero em perspectiva da fixture vira o retângulo 300 × 200 cm (RN-07)', () => {
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    PERSPECTIVA.cantosPx.forEach((p, i) => {
      const r = aplicarHomografia(h, p);
      expect(r.x).toBeCloseTo(RETANGULO_300x200[i]!.x, 6);
      expect(r.y).toBeCloseTo(RETANGULO_300x200[i]!.y, 6);
    });
    // Um ponto dentro do quadrilátero cai dentro do retângulo.
    const dentro = aplicarHomografia(h, { x: 800, y: 600 });
    expect(dentro.x).toBeGreaterThan(0);
    expect(dentro.x).toBeLessThan(300);
    expect(dentro.y).toBeGreaterThan(0);
    expect(dentro.y).toBeLessThan(200);
  });

  it('exige quatro pontos em cada lista', () => {
    expect(() => calcularHomografia(RETANGULO_300x200.slice(0, 3), RETANGULO_300x200)).toThrow();
  });

  it('recusa pontos degenerados (três alinhados)', () => {
    const alinhados = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(() => calcularHomografia(alinhados, RETANGULO_300x200)).toThrow();
  });
});

describe('inverterHomografia', () => {
  it('H · H⁻¹ é a identidade (a menos de escala)', () => {
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    const produto = normalizar(multiplicarHomografias(h, inverterHomografia(h)));
    produto.forEach((valor, i) => expect(valor).toBeCloseTo(IDENTIDADE[i]!, 6));
  });

  it('a inversa devolve o ponto original', () => {
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    const inversa = inverterHomografia(h);
    const ponto = { x: 733.5, y: 412.25 };
    const volta = aplicarHomografia(inversa, aplicarHomografia(h, ponto));
    expect(volta.x).toBeCloseTo(ponto.x, 6);
    expect(volta.y).toBeCloseTo(ponto.y, 6);
  });

  it('recusa matriz singular', () => {
    expect(() => inverterHomografia([1, 2, 3, 2, 4, 6, 0, 0, 0])).toThrow();
  });
});

describe('multiplicarHomografias', () => {
  it('multiplicar pela identidade não muda a matriz', () => {
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    multiplicarHomografias(h, IDENTIDADE).forEach((valor, i) => expect(valor).toBeCloseTo(h[i]!, 9));
  });

  it('aplicar a composição equivale a aplicar uma e depois a outra', () => {
    const a = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    const b = [2, 0, 5, 0, 3, -7, 0, 0, 1];
    const p = { x: 321, y: 654 };
    const composta = aplicarHomografia(multiplicarHomografias(a, b), p);
    const passo = aplicarHomografia(a, aplicarHomografia(b, p));
    expect(composta.x).toBeCloseTo(passo.x, 6);
    expect(composta.y).toBeCloseTo(passo.y, 6);
  });
});

describe('projetarHomografia', () => {
  it('devolve também o peso w (w > 0 à frente do horizonte)', () => {
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO_300x200);
    const { x, y, w } = projetarHomografia(h, { x: 800, y: 600 });
    expect(w).toBeGreaterThan(0);
    const direto = aplicarHomografia(h, { x: 800, y: 600 });
    expect(x / w).toBeCloseTo(direto.x, 9);
    expect(y / w).toBeCloseTo(direto.y, 9);
  });
});
