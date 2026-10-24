import { describe, expect, it } from 'vitest';
import {
  formatarCm,
  formatarCmCurto,
  formatarData,
  formatarDimensao,
  formatarEditadoEm,
  formatarEscala,
  formatarHora,
  formatarMetaProjeto,
  formatarTamanho,
  lerCm,
} from './formatadores';

// DESIGN §8 e DS-02: vírgula decimal, 1 casa em cm, "×" (U+00D7) com espaços.
describe('formatadores pt-BR (DESIGN §8)', () => {
  it('formatarCm usa vírgula e 1 casa decimal', () => {
    expect(formatarCm(24)).toBe('24,0');
    expect(formatarCm(0.5)).toBe('0,5');
    expect(formatarCm(120)).toBe('120,0');
    expect(formatarCm(24.04)).toBe('24,0');
  });

  it('formatarCmCurto tira a casa decimal quando o valor é inteiro', () => {
    expect(formatarCmCurto(5)).toBe('5');
    expect(formatarCmCurto(2.5)).toBe('2,5');
    expect(formatarCmCurto(10.04)).toBe('10');
  });

  it('formatarDimensao junta largura e altura com × e unidade', () => {
    expect(formatarDimensao(24, 34)).toBe('24,0 × 34,0 cm');
  });

  it('formatarEscala mostra px/cm com 1 casa', () => {
    expect(formatarEscala(4)).toBe('4,0 px/cm');
  });

  it('formatarTamanho sugerido não tem casa decimal e segue a orientação atual', () => {
    expect(formatarTamanho({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 })).toBe('20 × 30');
    expect(formatarTamanho({ sugeridoId: '20x30', larguraCm: 30, alturaCm: 20 })).toBe('30 × 20');
  });

  it('formatarTamanho personalizado tem 1 casa decimal (DS-02)', () => {
    expect(formatarTamanho({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 })).toBe('21,0 × 29,7');
  });

  it('formatarHora mostra "às hh:mm" no horário de Brasília (DV-11)', () => {
    // 17:35 UTC = 14:35 em Brasília (UTC-3, sem horário de verão desde 2019)
    expect(formatarHora(new Date('2026-10-12T17:35:00Z'))).toBe('às 14:35');
  });

  it('formatarData mostra dd/MM', () => {
    expect(formatarData(new Date('2026-10-12T15:00:00Z'))).toBe('12/10');
  });
});

// Spec M1 A-04: "editado hoje, 14:35", "editado ontem, 09:10", "editado em 12/10" (com ano se for de outro ano).
describe('formatarEditadoEm (A-04)', () => {
  const agora = new Date('2026-10-24T15:00:00-03:00');

  it('hoje e ontem trazem a hora', () => {
    expect(formatarEditadoEm(new Date('2026-10-24T14:35:00-03:00'), agora)).toBe('editado hoje, 14:35');
    expect(formatarEditadoEm(new Date('2026-10-23T09:10:00-03:00'), agora)).toBe('editado ontem, 09:10');
  });

  it('antes de ontem mostra dd/MM', () => {
    expect(formatarEditadoEm(new Date('2026-10-12T14:35:00-03:00'), agora)).toBe('editado em 12/10');
  });

  it('de outro ano mostra dd/MM/aaaa', () => {
    expect(formatarEditadoEm(new Date('2025-10-12T14:35:00-03:00'), agora)).toBe('editado em 12/10/2025');
  });

  it('compara os dias no fuso de Brasília, não em UTC', () => {
    // 23:30 de 23/10 em Brasília já é 02:30Z de 24/10: em UTC pareceria "hoje".
    expect(
      formatarEditadoEm(new Date('2026-10-23T23:30:00-03:00'), new Date('2026-10-24T01:00:00-03:00')),
    ).toBe('editado ontem, 23:30');
  });

  it('virada de ano: 31/12 visto em 02/01 mostra o ano', () => {
    expect(
      formatarEditadoEm(new Date('2025-12-31T10:00:00-03:00'), new Date('2026-01-02T10:00:00-03:00')),
    ).toBe('editado em 31/12/2025');
  });

  it('data no futuro (relógio adiantado) conta como hoje', () => {
    expect(formatarEditadoEm(new Date('2026-10-24T15:01:00-03:00'), agora)).toBe('editado hoje, 15:01');
  });
});

describe('formatarMetaProjeto (A-04)', () => {
  const agora = new Date('2026-10-24T15:00:00-03:00');
  const editado = new Date('2026-10-24T14:35:00-03:00');

  it('singular e plural de variantes', () => {
    expect(formatarMetaProjeto({ qtdVariantes: 1, temParede: true, atualizadoEm: editado }, agora)).toBe(
      '1 variante · editado hoje, 14:35',
    );
    expect(formatarMetaProjeto({ qtdVariantes: 3, temParede: true, atualizadoEm: editado }, agora)).toBe(
      '3 variantes · editado hoje, 14:35',
    );
  });

  it('sem parede mostra "parede não definida"', () => {
    expect(formatarMetaProjeto({ qtdVariantes: 1, temParede: false, atualizadoEm: editado }, agora)).toBe(
      '1 variante · parede não definida',
    );
  });
});

describe('lerCm (campos numéricos com vírgula decimal)', () => {
  it('aceita vírgula ou ponto e ignora espaços nas pontas', () => {
    expect(lerCm('12,5')).toBe(12.5);
    expect(lerCm('12.5')).toBe(12.5);
    expect(lerCm('  7 ')).toBe(7);
    expect(lerCm('0,0')).toBe(0);
  });

  it('aceita negativos (X e Y podem ser negativos)', () => {
    expect(lerCm('-3,5')).toBe(-3.5);
  });

  it('recusa vazio, texto, mais de um separador e notação científica', () => {
    expect(lerCm('')).toBeNull();
    expect(lerCm('   ')).toBeNull();
    expect(lerCm('abc')).toBeNull();
    expect(lerCm('1,2,3')).toBeNull();
    expect(lerCm('1e3')).toBeNull();
    expect(lerCm('12 cm')).toBeNull();
  });
});
