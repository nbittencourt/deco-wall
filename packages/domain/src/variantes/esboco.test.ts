import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { esbocoDeFotos } from './esboco';

// Esboço de variante (A-15, §4.7): retângulos normalizados em 0 a 1 para o SVG dos cartões.

const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const CAIXA = { xCm: 0, yCm: 0, larguraCm: 200, alturaCm: 100 };

describe('esbocoDeFotos', () => {
  it('um retângulo por foto, na ordem da pilha, relativo à caixa', () => {
    const r = esbocoDeFotos(
      [
        foto({ _id: id(1), xCm: 20, yCm: 10, tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 } }),
        foto({ _id: id(2), xCm: 100, yCm: 50, imagemId: null }),
      ],
      CAIXA,
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ x: 0.1, y: 0.1, w: 0.1, h: 0.3, tipo: 'foto' });
    expect(r[1]).toMatchObject({ x: 0.5, y: 0.5, tipo: 'placeholder' });
  });

  it('usa o retângulo externo (com a borda)', () => {
    const [r] = esbocoDeFotos(
      [
        foto({
          xCm: 20,
          yCm: 10,
          tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
          borda: { larguraCm: 5, cor: '#FFFFFF' },
        }),
      ],
      CAIXA,
    );
    expect(r).toEqual({ x: 0.1, y: 0.1, w: 0.15, h: 0.4, tipo: 'foto' });
  });

  it('caixa com origem fora de 0,0', () => {
    const [r] = esbocoDeFotos(
      [foto({ xCm: 60, yCm: 30, tamanho: { sugeridoId: null, larguraCm: 10, alturaCm: 10 } })],
      { xCm: 50, yCm: 20, larguraCm: 100, alturaCm: 100 },
    );
    expect(r).toEqual({ x: 0.1, y: 0.1, w: 0.1, h: 0.1, tipo: 'foto' });
  });

  it('sem fotos: lista vazia', () => {
    expect(esbocoDeFotos([], CAIXA)).toEqual([]);
  });
});
