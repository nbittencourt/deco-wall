import { describe, expect, it } from 'vitest';
import { encaixar, encaixarPosicao } from './snap';

// Snap (RF-53, RN-06, RN-15; §4.4): múltiplos do passo a partir da origem 0,0.

describe('encaixar', () => {
  it('leva ao múltiplo mais próximo do passo', () => {
    expect(encaixar(12, 5)).toBe(10);
    expect(encaixar(13, 5)).toBe(15);
    expect(encaixar(0, 5)).toBe(0);
  });

  it('passo fracionário (2,5), sem ruído de ponto flutuante', () => {
    expect(encaixar(6.3, 2.5)).toBe(5);
    expect(encaixar(6.4, 2.5)).toBe(7.5);
    expect(encaixar(0.3, 0.1)).toBe(0.3);
  });

  it('valores negativos encaixam, e o zero negativo vira zero', () => {
    expect(encaixar(-12, 5)).toBe(-10);
    expect(encaixar(-13, 5)).toBe(-15);
    expect(Object.is(encaixar(-1, 5), 0)).toBe(true);
  });
});

describe('encaixarPosicao', () => {
  it('com snap ligado encaixa X e Y', () => {
    expect(encaixarPosicao({ x: 12, y: 13 }, { snap: true, passoCm: 5 })).toEqual({ x: 10, y: 15 });
  });

  it('com snap desligado só arredonda a 0,1 cm', () => {
    expect(encaixarPosicao({ x: 12.34, y: 13.06 }, { snap: false, passoCm: 5 })).toEqual({
      x: 12.3,
      y: 13.1,
    });
  });
});
