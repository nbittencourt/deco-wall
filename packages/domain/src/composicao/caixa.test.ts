import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { boundingBox } from './caixa';

// Bounding box (RF-62; §4.6): envolve o tamanho externo de todas as fotos, placeholders inclusive.

const foto = (n: number, s: Record<string, unknown>) => fotoFixture({ _id: id(n), ...s }) as FotoNaParede;

describe('boundingBox', () => {
  it('sem fotos, nulo', () => {
    expect(boundingBox([])).toBeNull();
  });

  it('com 1 foto, é o retângulo externo dela (A-13)', () => {
    expect(boundingBox([foto(1, { xCm: 10, yCm: 20 })])).toEqual({
      xCm: 10,
      yCm: 20,
      larguraCm: 20,
      alturaCm: 30,
    });
  });

  it('com várias, o mínimo e o máximo dos retângulos externos, incluindo borda', () => {
    const fotos = [
      foto(1, { xCm: 10, yCm: 20, tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 } }),
      foto(2, { xCm: 60, yCm: 5, borda: { larguraCm: 2, cor: '#FFFFFF' } }), // externo 24 × 34
    ];
    expect(boundingBox(fotos)).toEqual({ xCm: 10, yCm: 5, larguraCm: 74, alturaCm: 39 });
  });

  it('placeholders entram no cálculo', () => {
    expect(
      boundingBox([foto(1, { xCm: 0, yCm: 0 }), foto(2, { xCm: 100, yCm: 0, imagemId: null })])?.larguraCm,
    ).toBe(120);
  });

  it('sem ruído de ponto flutuante', () => {
    const r = boundingBox([foto(1, { xCm: 0.1, yCm: 0 }), foto(2, { xCm: 0.2, yCm: 0 })]);
    expect(r).toEqual({ xCm: 0.1, yCm: 0, larguraCm: 20.1, alturaCm: 30 });
  });
});
