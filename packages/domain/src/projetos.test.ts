import { describe, expect, it } from 'vitest';
import { validarNomeProjeto } from './projetos';

// A-02: nome de projeto de 1 a 100 caracteres, sem espaços nas pontas; repetido é permitido.

describe('validarNomeProjeto', () => {
  it('aceita um nome simples', () => {
    expect(validarNomeProjeto('Sala de estar')).toEqual({ ok: true, nome: 'Sala de estar' });
  });

  it('tira os espaços das pontas', () => {
    expect(validarNomeProjeto('  Corredor  ')).toEqual({ ok: true, nome: 'Corredor' });
  });

  it('recusa nome vazio ou só com espaços', () => {
    expect(validarNomeProjeto('')).toEqual({ ok: false, erro: 'Informe um nome para o projeto.' });
    expect(validarNomeProjeto('    ')).toEqual({ ok: false, erro: 'Informe um nome para o projeto.' });
  });

  it('aceita exatamente 100 caracteres e recusa 101', () => {
    expect(validarNomeProjeto('a'.repeat(100)).ok).toBe(true);
    expect(validarNomeProjeto('a'.repeat(101))).toEqual({
      ok: false,
      erro: 'O nome pode ter no máximo 100 caracteres.',
    });
  });

  it('conta o tamanho depois de tirar os espaços', () => {
    expect(validarNomeProjeto(` ${'a'.repeat(100)} `).ok).toBe(true);
  });

  it('recusa o que não é texto', () => {
    expect(validarNomeProjeto(undefined).ok).toBe(false);
    expect(validarNomeProjeto(42).ok).toBe(false);
    expect(validarNomeProjeto(null).ok).toBe(false);
  });
});
