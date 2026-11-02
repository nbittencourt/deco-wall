import { describe, expect, it } from 'vitest';
import { NOME_VARIANTE_MAX } from '../constantes';
import { nomeComSufixo, nomeCopia, nomeDoTemplateUnico, nomeNovaVariante, truncarNome } from './nomes';

// Nomes sugeridos de variante (A-03, M3-04; docs/specs/M3-variantes-templates-e-salvamento.md §4.5).

describe('nomeNovaVariante', () => {
  it('menor N ≥ 2 ainda não usado', () => {
    expect(nomeNovaVariante(['Base'])).toBe('Variante 2');
    expect(nomeNovaVariante(['Base', 'Variante 2'])).toBe('Variante 3');
  });

  it('preenche o buraco da numeração', () => {
    expect(nomeNovaVariante(['Base', 'Variante 3'])).toBe('Variante 2');
  });
});

describe('nomeCopia', () => {
  it('"<nome> (cópia)", depois "(cópia 2)"…', () => {
    expect(nomeCopia('Base', ['Base'])).toBe('Base (cópia)');
    expect(nomeCopia('Base', ['Base', 'Base (cópia)'])).toBe('Base (cópia 2)');
    expect(nomeCopia('Base', ['Base', 'Base (cópia)', 'Base (cópia 2)'])).toBe('Base (cópia 3)');
  });

  it('nunca passa de 60 caracteres e preserva o sufixo', () => {
    const longo = 'A'.repeat(60);
    const nome = nomeCopia(longo, [longo]);
    expect(nome.length).toBeLessThanOrEqual(NOME_VARIANTE_MAX);
    expect(nome.endsWith(' (cópia)')).toBe(true);
  });
});

describe('nomeDoTemplateUnico', () => {
  it('o nome do modelo; depois "Pirâmide 2"…', () => {
    expect(nomeDoTemplateUnico('Pirâmide', ['Base'])).toBe('Pirâmide');
    expect(nomeDoTemplateUnico('Pirâmide', ['Base', 'Pirâmide'])).toBe('Pirâmide 2');
    expect(nomeDoTemplateUnico('Pirâmide', ['Pirâmide', 'Pirâmide 2'])).toBe('Pirâmide 3');
  });
});

describe('nomeComSufixo / truncarNome', () => {
  it('cabendo em 60, junta nome e sufixo', () => {
    expect(nomeComSufixo('Base', ' (cópia 14:35)')).toBe('Base (cópia 14:35)');
    expect(truncarNome('Base')).toBe('Base');
  });

  it('passando de 60, corta o prefixo com "…" e preserva o sufixo', () => {
    const nome = nomeComSufixo('B'.repeat(80), ' (cópia 14:35)');
    expect(nome).toHaveLength(NOME_VARIANTE_MAX);
    expect(nome.endsWith('… (cópia 14:35)')).toBe(true);
    expect(nome.startsWith('BBBB')).toBe(true);
  });

  it('sem sufixo, trunca o próprio nome', () => {
    const nome = truncarNome('C'.repeat(90));
    expect(nome).toHaveLength(NOME_VARIANTE_MAX);
    expect(nome.endsWith('…')).toBe(true);
  });
});
