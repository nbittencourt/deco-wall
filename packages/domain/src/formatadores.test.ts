import { describe, expect, it } from 'vitest';
import {
  formatarCm,
  formatarData,
  formatarDimensao,
  formatarEscala,
  formatarHora,
  formatarTamanho,
} from './formatadores';

// DESIGN §8 e DS-02: vírgula decimal, 1 casa em cm, "×" (U+00D7) com espaços.
describe('formatadores pt-BR (DESIGN §8)', () => {
  it('formatarCm usa vírgula e 1 casa decimal', () => {
    expect(formatarCm(24)).toBe('24,0');
    expect(formatarCm(0.5)).toBe('0,5');
    expect(formatarCm(120)).toBe('120,0');
    expect(formatarCm(24.04)).toBe('24,0');
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
