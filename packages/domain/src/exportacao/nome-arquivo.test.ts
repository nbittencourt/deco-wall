import { describe, expect, it } from 'vitest';
import { nomeDoArquivoExportado, slugDoNome } from './nome-arquivo';

// Nome do arquivo exportado (RF-80, DV-11, A-18; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.6).

describe('slugDoNome (A-18)', () => {
  it('minúsculas, sem acentos, espaços viram hífen', () => {
    expect(slugDoNome('Sala de Estar')).toBe('sala-de-estar');
    expect(slugDoNome('Pirâmide 2')).toBe('piramide-2');
    expect(slugDoNome('Coração São João')).toBe('coracao-sao-joao');
  });

  it('qualquer sequência fora de a-z0-9 vira um só hífen; as pontas são aparadas', () => {
    expect(slugDoNome('  ??Quarto -- do   bebê!!  ')).toBe('quarto-do-bebe');
    expect(slugDoNome('a/b\\c:d*e')).toBe('a-b-c-d-e');
  });

  it('corta em 60 caracteres e apara o hífen que sobrar na ponta', () => {
    const longo = 'a'.repeat(59) + ' b';
    expect(slugDoNome(longo)).toBe('a'.repeat(59));
    expect(slugDoNome('x'.repeat(80))).toHaveLength(60);
  });

  it('sem nenhum caractere aproveitável, devolve texto vazio', () => {
    expect(slugDoNome('')).toBe('');
    expect(slugDoNome('!!! ???')).toBe('');
    expect(slugDoNome('日本')).toBe('');
  });
});

describe('nomeDoArquivoExportado (DV-11, A-18)', () => {
  const data = new Date('2026-11-02T14:35:00-03:00');

  it('<projeto>-<variante>-AAAAMMDD-HHmm.<ext>', () => {
    expect(
      nomeDoArquivoExportado({ projeto: 'Sala de Estar', variante: 'Pirâmide 2', data, formato: 'png' }),
    ).toBe('sala-de-estar-piramide-2-20261102-1435.png');
    expect(nomeDoArquivoExportado({ projeto: 'Sala', variante: 'Base', data, formato: 'jpg' })).toBe(
      'sala-base-20261102-1435.jpg',
    );
  });

  it('usa a data e a hora de Brasília, não as de UTC', () => {
    // 01:30 UTC de 3/11 ainda é 22:30 de 2/11 em Brasília.
    const tarde = new Date('2026-11-03T01:30:00Z');
    expect(nomeDoArquivoExportado({ projeto: 'p', variante: 'v', data: tarde, formato: 'png' })).toBe(
      'p-v-20261102-2230.png',
    );
  });

  it('parte vazia vira "projeto" ou "variante"', () => {
    expect(nomeDoArquivoExportado({ projeto: '???', variante: '', data, formato: 'png' })).toBe(
      'projeto-variante-20261102-1435.png',
    );
  });

  it('meia-noite sai como 0000, não 2400', () => {
    const meiaNoite = new Date('2026-11-02T00:05:00-03:00');
    expect(nomeDoArquivoExportado({ projeto: 'p', variante: 'v', data: meiaNoite, formato: 'png' })).toBe(
      'p-v-20261102-0005.png',
    );
  });
});
