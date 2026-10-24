import { describe, expect, it } from 'vitest';
import { referenciaPequena, validarMedidaReferencia } from './referencia';

// A-09: medidas do retângulo de referência e comprimento linear, de 10 a 2000 cm; abaixo de 100 cm só avisa.

describe('validarMedidaReferencia', () => {
  it('aceita de 10 a 2000 cm, com vírgula ou ponto', () => {
    expect(validarMedidaReferencia('300')).toEqual({ ok: true, valor: 300 });
    expect(validarMedidaReferencia('300,5')).toEqual({ ok: true, valor: 300.5 });
    expect(validarMedidaReferencia('10')).toEqual({ ok: true, valor: 10 });
    expect(validarMedidaReferencia('2000')).toEqual({ ok: true, valor: 2000 });
  });

  it('recusa fora da faixa e o que não é número, com a mensagem da faixa', () => {
    const erro = { ok: false, erro: 'Informe de 10 a 2000 cm.' };
    expect(validarMedidaReferencia('9,9')).toEqual(erro);
    expect(validarMedidaReferencia('2000,1')).toEqual(erro);
    expect(validarMedidaReferencia('')).toEqual(erro);
    expect(validarMedidaReferencia('abc')).toEqual(erro);
    expect(validarMedidaReferencia('-50')).toEqual(erro);
  });

  it('arredonda a 0,1 cm (RN-27)', () => {
    expect(validarMedidaReferencia('120,04')).toEqual({ ok: true, valor: 120 });
  });
});

describe('referenciaPequena (aviso RF-14)', () => {
  it('é verdadeira quando algum lado fica abaixo de 100 cm', () => {
    expect(referenciaPequena(99.9, 300)).toBe(true);
    expect(referenciaPequena(300, 50)).toBe(true);
  });

  it('é falsa a partir de 100 cm nos dois lados', () => {
    expect(referenciaPequena(100, 100)).toBe(false);
    expect(referenciaPequena(300, 200)).toBe(false);
  });
});
