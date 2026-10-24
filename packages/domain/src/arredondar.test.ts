import { describe, expect, it } from 'vitest';
import { arredondarCm } from './arredondar';

describe('arredondarCm (RN-27, DM-08)', () => {
  it.each([
    [24, 24],
    [24.04, 24],
    [24.06, 24.1],
    [4.96, 5],
    [21, 21],
    [29.7, 29.7],
    [10.25, 10.3],
    [150, 150],
  ])('arredonda %s para %s (1 mm = 0,1 cm)', (entrada, esperado) => {
    expect(arredondarCm(entrada)).toBe(esperado);
  });

  it('é idempotente: valor já arredondado não muda', () => {
    for (const v of [5, 12.3, 149.9]) {
      expect(arredondarCm(arredondarCm(v))).toBe(arredondarCm(v));
    }
  });
});
