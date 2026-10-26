import { describe, expect, it } from 'vitest';
import {
  alternarOrientacao,
  orientacaoDe,
  tamanhoExterno,
  tamanhoPersonalizado,
  tamanhoSugerido,
} from './tamanho';

// Tamanho (RN-01, RN-02, RN-05, RN-28; docs/specs/M2-biblioteca-e-composicao.md §4.1, §4.2).

describe('tamanhoSugerido (RN-01)', () => {
  it('retrato: menor lado na horizontal; paisagem: maior lado na horizontal', () => {
    expect(tamanhoSugerido('20x30', 'retrato')).toEqual({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 });
    expect(tamanhoSugerido('20x30', 'paisagem')).toEqual({
      sugeridoId: '20x30',
      larguraCm: 30,
      alturaCm: 20,
    });
    expect(tamanhoSugerido('10x15', 'paisagem')).toEqual({
      sugeridoId: '10x15',
      larguraCm: 15,
      alturaCm: 10,
    });
  });

  it('sem orientação informada, retrato; quadrado igual nas duas', () => {
    expect(tamanhoSugerido('13x18')).toEqual({ sugeridoId: '13x18', larguraCm: 13, alturaCm: 18 });
    expect(tamanhoSugerido('15x15', 'paisagem')).toEqual({
      sugeridoId: '15x15',
      larguraCm: 15,
      alturaCm: 15,
    });
  });

  it('id desconhecido lança erro', () => {
    expect(() => tamanhoSugerido('99x99', 'retrato')).toThrow();
  });
});

describe('orientacaoDe (DM-14)', () => {
  it('derivada das medidas: largura < altura é retrato; > é paisagem; = é quadrado', () => {
    expect(orientacaoDe({ larguraCm: 20, alturaCm: 30 })).toBe('retrato');
    expect(orientacaoDe({ larguraCm: 30, alturaCm: 20 })).toBe('paisagem');
    expect(orientacaoDe({ larguraCm: 13, alturaCm: 13 })).toBe('quadrado');
  });
});

describe('alternarOrientacao (RN-05)', () => {
  it('troca largura e altura e mantém o id sugerido', () => {
    expect(alternarOrientacao(tamanhoSugerido('20x30', 'retrato'))).toEqual({
      sugeridoId: '20x30',
      larguraCm: 30,
      alturaCm: 20,
    });
    expect(alternarOrientacao({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 })).toEqual({
      sugeridoId: null,
      larguraCm: 29.7,
      alturaCm: 21,
    });
  });

  it('quadrado não tem orientação: devolve o mesmo tamanho', () => {
    const q = tamanhoSugerido('13x13');
    expect(alternarOrientacao(q)).toEqual(q);
  });

  it('não altera o argumento', () => {
    const t = tamanhoSugerido('10x15');
    alternarOrientacao(t);
    expect(t).toEqual({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 });
  });
});

describe('tamanhoPersonalizado (RN-28, PRD aceite 2a)', () => {
  it('21,0 × 29,7 é aceito e fica personalizado', () => {
    expect(tamanhoPersonalizado(21, 29.7)).toEqual({
      ok: true,
      tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 },
    });
  });

  it('4,9 e 150,1 são recusados com a faixa válida, em qualquer lado', () => {
    const faixa = 'Entre 5,0 e 150,0 cm em cada lado.';
    expect(tamanhoPersonalizado(4.9, 20)).toEqual({ ok: false, erro: faixa });
    expect(tamanhoPersonalizado(20, 150.1)).toEqual({ ok: false, erro: faixa });
    expect(tamanhoPersonalizado(Number.NaN, 20)).toEqual({ ok: false, erro: faixa });
  });

  it('os limites 5,0 e 150,0 são aceitos', () => {
    expect(tamanhoPersonalizado(5, 150)).toEqual({
      ok: true,
      tamanho: { sugeridoId: null, larguraCm: 5, alturaCm: 150 },
    });
  });

  it('igual a um sugerido, em qualquer orientação, vira o sugerido', () => {
    expect(tamanhoPersonalizado(20, 30)).toEqual({
      ok: true,
      tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
    });
    expect(tamanhoPersonalizado(30, 20)).toEqual({
      ok: true,
      tamanho: { sugeridoId: '20x30', larguraCm: 30, alturaCm: 20 },
    });
    expect(tamanhoPersonalizado(13, 13)).toEqual({
      ok: true,
      tamanho: { sugeridoId: '13x13', larguraCm: 13, alturaCm: 13 },
    });
  });

  it('arredonda a 0,1 cm', () => {
    expect(tamanhoPersonalizado(21.04, 29.66)).toEqual({
      ok: true,
      tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 },
    });
  });
});

describe('tamanhoExterno (RN-02, PRD aceite 2)', () => {
  it('impresso + 2 × borda: 10×15 com borda 2 → 14 × 19', () => {
    expect(tamanhoExterno(tamanhoSugerido('10x15'), { larguraCm: 2, cor: '#FFFFFF' })).toEqual({
      larguraCm: 14,
      alturaCm: 19,
    });
  });

  it('sem borda, o externo é o impresso; borda fracionária sem ruído de ponto flutuante', () => {
    expect(tamanhoExterno(tamanhoSugerido('20x30'), { larguraCm: 0, cor: '#FFFFFF' })).toEqual({
      larguraCm: 20,
      alturaCm: 30,
    });
    expect(tamanhoExterno(tamanhoSugerido('10x15'), { larguraCm: 0.3, cor: '#FFFFFF' })).toEqual({
      larguraCm: 10.6,
      alturaCm: 15.6,
    });
  });
});
