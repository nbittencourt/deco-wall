import { describe, expect, it } from 'vitest';
import { ajustarATela, limitarZoom, zoomNoPonto, type Viewport } from './viewport';

// A-06: tela = conteúdo × escala + (x, y). Unidade do conteúdo é livre (cm ou px da imagem).

function paraTela(v: Viewport, p: { x: number; y: number }) {
  return { x: p.x * v.escala + v.x, y: p.y * v.escala + v.y };
}

describe('zoomNoPonto', () => {
  it('mantém fixo o ponto do conteúdo sob o cursor', () => {
    const v: Viewport = { escala: 2, x: 30, y: -10 };
    const cursor = { x: 400, y: 250 };
    const conteudoAntes = { x: (cursor.x - v.x) / v.escala, y: (cursor.y - v.y) / v.escala };

    const novo = zoomNoPonto(v, 1.1, cursor);
    expect(novo.escala).toBeCloseTo(2.2, 9);
    const depois = paraTela(novo, conteudoAntes);
    expect(depois.x).toBeCloseTo(cursor.x, 9);
    expect(depois.y).toBeCloseTo(cursor.y, 9);
  });

  it('respeita os limites e ainda mantém o ponto fixo', () => {
    const v: Viewport = { escala: 7, x: 0, y: 0 };
    const cursor = { x: 100, y: 100 };
    const novo = zoomNoPonto(v, 2, cursor, { min: 0.1, max: 8 });
    expect(novo.escala).toBe(8);
    const conteudo = { x: 100 / 7, y: 100 / 7 };
    const depois = paraTela(novo, conteudo);
    expect(depois.x).toBeCloseTo(100, 9);
    expect(depois.y).toBeCloseTo(100, 9);
  });

  it('reduzir abaixo do mínimo trava no mínimo', () => {
    const novo = zoomNoPonto({ escala: 0.11, x: 0, y: 0 }, 0.5, { x: 0, y: 0 }, { min: 0.1, max: 8 });
    expect(novo.escala).toBe(0.1);
  });
});

describe('ajustarATela', () => {
  it('cabe o conteúdo na tela com a margem e o centraliza', () => {
    const conteudo = { x: 0, y: 0, largura: 300, altura: 200 };
    const v = ajustarATela(conteudo, { largura: 1000, altura: 600 }, 20);
    // min((1000 − 40) / 300, (600 − 40) / 200) = min(3,2; 2,8)
    expect(v.escala).toBeCloseTo(2.8, 9);
    const centro = paraTela(v, { x: 150, y: 100 });
    expect(centro.x).toBeCloseTo(500, 9);
    expect(centro.y).toBeCloseTo(300, 9);
  });

  it('funciona com conteúdo de origem negativa (parede retificada com margem)', () => {
    const conteudo = { x: -300, y: -200, largura: 900, altura: 600 };
    const v = ajustarATela(conteudo, { largura: 900, altura: 600 }, 0);
    expect(v.escala).toBeCloseTo(1, 9);
    const canto = paraTela(v, { x: -300, y: -200 });
    expect(canto.x).toBeCloseTo(0, 9);
    expect(canto.y).toBeCloseTo(0, 9);
  });

  it('conteúdo maior que a tela reduz abaixo de 1', () => {
    const v = ajustarATela({ x: 0, y: 0, largura: 6000, altura: 4000 }, { largura: 1200, altura: 800 }, 0);
    expect(v.escala).toBeCloseTo(0.2, 9);
  });
});

describe('limitarZoom (A-06)', () => {
  it('mínimo é 10% ou metade do "Ajustar à tela", o que for menor', () => {
    expect(limitarZoom(0.01, 0.5)).toBeCloseTo(0.1, 9);
    expect(limitarZoom(0.01, 0.1)).toBeCloseTo(0.05, 9);
    expect(limitarZoom(0.01, 0.04)).toBeCloseTo(0.02, 9);
  });

  it('máximo é 800%', () => {
    expect(limitarZoom(20, 0.5)).toBe(8);
  });

  it('valor dentro da faixa passa sem mudar', () => {
    expect(limitarZoom(1.5, 0.5)).toBe(1.5);
  });
});
