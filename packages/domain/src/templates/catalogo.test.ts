import { describe, expect, it } from 'vitest';
import { lerModelosDoMarkdown } from '../../../../tests/fixtures/templates-md';
import { templatePorId, TEMPLATES, totalDoTemplate } from './catalogo';

// Catálogo de templates (TPL-07, TPL-08; docs/specs/M3-variantes-templates-e-salvamento.md §4.1): a constante do
// código tem de bater com a fonte, `docs/specs/templates.md`.

const MODELOS = lerModelosDoMarkdown();

describe('TEMPLATES (fonte: docs/specs/templates.md)', () => {
  it('tem os 12 modelos, na ordem do documento', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(MODELOS.map((m) => m.id));
    expect(TEMPLATES).toHaveLength(12);
  });

  it('nomes em português iguais aos do documento', () => {
    expect(TEMPLATES.map((t) => t.nome)).toEqual(MODELOS.map((m) => m.nome));
  });

  it.each(MODELOS)('$id: células iguais às linhas do documento', (modelo) => {
    const template = TEMPLATES.find((t) => t.id === modelo.id)!;
    expect(template.celulas).toHaveLength(modelo.linhas.length);
    modelo.linhas.forEach((linha, i) => {
      const c = template.celulas[i]!;
      expect(c.xCm).toBeCloseTo(linha.xCm, 5);
      expect(c.yCm).toBeCloseTo(linha.yCm, 5);
      expect(c.larguraCm).toBeCloseTo(linha.celula.larguraCm, 5);
      expect(c.alturaCm).toBeCloseTo(linha.celula.alturaCm, 5);
    });
  });

  it('o documento tem 82 linhas de vaga', () => {
    expect(MODELOS.reduce((soma, m) => soma + m.linhas.length, 0)).toBe(82);
  });
});

describe('totalDoTemplate', () => {
  it.each(MODELOS)('$id: caixa das células igual ao total calculado do documento (±0,1 cm)', (modelo) => {
    const total = totalDoTemplate(TEMPLATES.find((t) => t.id === modelo.id)!);
    expect(Math.abs(total.larguraCm - modelo.totalCm.larguraCm)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(total.alturaCm - modelo.totalCm.alturaCm)).toBeLessThanOrEqual(0.1);
  });

  it('a origem do conjunto é 0,0', () => {
    for (const t of TEMPLATES) {
      expect(Math.min(...t.celulas.map((c) => c.xCm))).toBeCloseTo(0, 5);
      expect(Math.min(...t.celulas.map((c) => c.yCm))).toBeCloseTo(0, 5);
    }
  });
});

describe('templatePorId', () => {
  it('acha o modelo', () => {
    expect(templatePorId('piramide')?.nome).toBe('Pirâmide');
  });

  it('id desconhecido: undefined', () => {
    expect(templatePorId('nao-existe')).toBeUndefined();
  });
});
