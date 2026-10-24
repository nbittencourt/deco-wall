import { describe, expect, it } from 'vitest';
import { PERSPECTIVA } from '../../../../tests/fixtures/paredes';
import { ordenarCantos, validarQuadrilatero } from './quadrilatero';

const AREA_IMAGEM = PERSPECTIVA.larguraImagemPx * PERSPECTIVA.alturaImagemPx;

const TL = { x: 100, y: 100 };
const TR = { x: 900, y: 120 };
const BR = { x: 920, y: 700 };
const BL = { x: 80, y: 680 };

describe('ordenarCantos (A-10: sentido horário a partir do superior esquerdo)', () => {
  it('mantém a ordem quando já está certa', () => {
    expect(ordenarCantos([TL, TR, BR, BL])).toEqual([TL, TR, BR, BL]);
  });

  it('reordena uma lista embaralhada', () => {
    expect(ordenarCantos([BR, TL, BL, TR])).toEqual([TL, TR, BR, BL]);
    expect(ordenarCantos([BL, BR, TR, TL])).toEqual([TL, TR, BR, BL]);
  });

  it('desfaz o cruzamento de alças (gravata-borboleta)', () => {
    // Alças 3 e 4 trocadas: o polígono TL → TR → BL → BR se cruza.
    expect(ordenarCantos([TL, TR, BL, BR])).toEqual([TL, TR, BR, BL]);
  });

  it('não altera a lista recebida', () => {
    const entrada = [BR, TL, BL, TR];
    ordenarCantos(entrada);
    expect(entrada).toEqual([BR, TL, BL, TR]);
  });

  it('exige exatamente quatro pontos', () => {
    expect(() => ordenarCantos([TL, TR, BR])).toThrow();
  });
});

describe('validarQuadrilatero (A-11)', () => {
  it('aceita o quadrilátero da fixture', () => {
    expect(validarQuadrilatero(PERSPECTIVA.cantosPx, AREA_IMAGEM)).toEqual({ ok: true });
  });

  it('recusa quadrilátero côncavo', () => {
    const concavo = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 400 },
    ];
    expect(validarQuadrilatero(concavo, AREA_IMAGEM)).toEqual({ ok: false, motivo: 'nao-convexo' });
  });

  it('recusa três cantos alinhados', () => {
    const alinhados = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 300 },
    ];
    expect(validarQuadrilatero(alinhados, AREA_IMAGEM)).toEqual({ ok: false, motivo: 'alinhados' });
  });

  it('recusa área abaixo de 1% da foto', () => {
    const pequeno = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 110 },
      { x: 100, y: 110 },
    ];
    expect(validarQuadrilatero(pequeno, AREA_IMAGEM)).toEqual({ ok: false, motivo: 'area-pequena' });
  });

  it('aceita área exatamente igual a 1% da foto', () => {
    const lado = Math.sqrt(AREA_IMAGEM * 0.01);
    const quadrado = [
      { x: 0, y: 0 },
      { x: lado, y: 0 },
      { x: lado, y: lado },
      { x: 0, y: lado },
    ];
    expect(validarQuadrilatero(quadrado, AREA_IMAGEM)).toEqual({ ok: true });
  });
});
