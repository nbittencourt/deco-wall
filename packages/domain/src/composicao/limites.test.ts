import { describe, expect, it } from 'vitest';
import { foto as fotoFixture } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { limitarPosicao } from './limites';

// Limite de posição (M2-11, RN-12): pelo menos 1 cm do retângulo externo dentro da parede inteira, por eixo.

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
// A fixture é 20 × 30 sem borda: externo 20 × 30.

describe('limitarPosicao', () => {
  it('dentro da parede, não muda', () => {
    expect(limitarPosicao(foto({ xCm: 40, yCm: 30 }), PAREDE)).toEqual({ xCm: 40, yCm: 30 });
  });

  it('a foto pode sair da parede, mas mantém 1 cm dentro em cada eixo', () => {
    expect(limitarPosicao(foto({ xCm: -500, yCm: -500 }), PAREDE)).toEqual({ xCm: -19, yCm: -29 });
    expect(limitarPosicao(foto({ xCm: 900, yCm: 900 }), PAREDE)).toEqual({ xCm: 299, yCm: 199 });
  });

  it('parcialmente fora, até o limite, é aceito', () => {
    expect(limitarPosicao(foto({ xCm: -19, yCm: 199 }), PAREDE)).toEqual({ xCm: -19, yCm: 199 });
  });

  it('considera a borda no retângulo externo', () => {
    const f = foto({ xCm: -500, borda: { larguraCm: 2, cor: '#FFFFFF' } });
    expect(limitarPosicao(f, PAREDE).xCm).toBe(-23); // externo com 24 cm de largura: 1 - 24
  });

  it('parede inteira com origem fora de 0,0', () => {
    const parede = { xCm: -50, yCm: -20, larguraCm: 400, alturaCm: 300 };
    expect(limitarPosicao(foto({ xCm: -999, yCm: 999 }), parede)).toEqual({ xCm: -69, yCm: 279 });
  });
});
