import { describe, expect, it } from 'vitest';
import {
  ehQuadrado,
  orientacaoDoTamanho,
  tamanhoDaImagem,
  tamanhoPersonalizado,
  tamanhoSugerido,
  trocarOrientacao,
  validarLadoPersonalizado,
} from './tamanho';

// Tamanhos das fotos (RN-01, RN-04, RN-05, RN-28; docs/specs/M2-biblioteca-e-composicao.md §4.1).

describe('orientacaoDoTamanho', () => {
  it('largura menor que a altura é retrato; maior, paisagem; igual, quadrado', () => {
    expect(orientacaoDoTamanho({ larguraCm: 20, alturaCm: 30 })).toBe('retrato');
    expect(orientacaoDoTamanho({ larguraCm: 30, alturaCm: 20 })).toBe('paisagem');
    expect(orientacaoDoTamanho({ larguraCm: 13, alturaCm: 13 })).toBe('quadrado');
  });

  it('ehQuadrado só vale para lados iguais', () => {
    expect(ehQuadrado({ larguraCm: 15, alturaCm: 15 })).toBe(true);
    expect(ehQuadrado({ larguraCm: 15, alturaCm: 15.1 })).toBe(false);
  });
});

describe('tamanhoSugerido', () => {
  it('retrato: menor lado na horizontal (RN-01)', () => {
    expect(tamanhoSugerido('20x30', 'retrato')).toEqual({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 });
  });

  it('paisagem: maior lado na horizontal', () => {
    expect(tamanhoSugerido('20x30', 'paisagem')).toEqual({
      sugeridoId: '20x30',
      larguraCm: 30,
      alturaCm: 20,
    });
  });

  it('o padrão é retrato', () => {
    expect(tamanhoSugerido('10x15')).toEqual({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 });
  });

  it('quadrado ignora a orientação', () => {
    expect(tamanhoSugerido('13x13', 'paisagem')).toEqual({
      sugeridoId: '13x13',
      larguraCm: 13,
      alturaCm: 13,
    });
  });

  it('id desconhecido é erro', () => {
    expect(() => tamanhoSugerido('99x99')).toThrow();
  });
});

describe('tamanhoDaImagem (RN-04)', () => {
  it('10×15 na orientação natural da imagem', () => {
    expect(tamanhoDaImagem('retrato')).toEqual({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 });
    expect(tamanhoDaImagem('paisagem')).toEqual({ sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 });
  });
});

describe('tamanhoPersonalizado (RN-28)', () => {
  it('21,0 × 29,7 é aceito como personalizado (aceite 2a)', () => {
    expect(tamanhoPersonalizado(21, 29.7)).toEqual({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 });
  });

  it('4,9 e 150,1 em um lado são rejeitados (aceite 2a)', () => {
    expect(tamanhoPersonalizado(4.9, 10)).toBeNull();
    expect(tamanhoPersonalizado(10, 4.9)).toBeNull();
    expect(tamanhoPersonalizado(150.1, 10)).toBeNull();
    expect(tamanhoPersonalizado(10, 150.1)).toBeNull();
  });

  it('os limites 5,0 e 150,0 são aceitos', () => {
    expect(tamanhoPersonalizado(5, 150)).toEqual({ sugeridoId: null, larguraCm: 5, alturaCm: 150 });
    expect(tamanhoPersonalizado(150, 150)).toEqual({ sugeridoId: null, larguraCm: 150, alturaCm: 150 });
  });

  it('arredonda a 0,1 cm antes de validar', () => {
    expect(tamanhoPersonalizado(21.04, 29.66)).toEqual({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 });
    expect(tamanhoPersonalizado(4.96, 10)).toEqual({ sugeridoId: null, larguraCm: 5, alturaCm: 10 });
  });

  it('igual a um sugerido, em qualquer orientação, é tratado como o sugerido', () => {
    expect(tamanhoPersonalizado(20, 30)).toEqual({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 });
    expect(tamanhoPersonalizado(15, 10)).toEqual({ sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 });
    expect(tamanhoPersonalizado(13, 13)).toEqual({ sugeridoId: '13x13', larguraCm: 13, alturaCm: 13 });
  });

  it('valores que não são número são rejeitados', () => {
    expect(tamanhoPersonalizado(Number.NaN, 10)).toBeNull();
    expect(tamanhoPersonalizado(10, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('validarLadoPersonalizado', () => {
  it('devolve a faixa válida em pt-BR quando fora do limite', () => {
    const mensagem = 'Entre 5,0 e 150,0 cm em cada lado.';
    expect(validarLadoPersonalizado(4.9)).toBe(mensagem);
    expect(validarLadoPersonalizado(150.1)).toBe(mensagem);
    expect(validarLadoPersonalizado(Number.NaN)).toBe(mensagem);
  });

  it('null dentro do limite', () => {
    expect(validarLadoPersonalizado(5)).toBeNull();
    expect(validarLadoPersonalizado(150)).toBeNull();
    expect(validarLadoPersonalizado(29.7)).toBeNull();
  });
});

describe('trocarOrientacao (RN-05)', () => {
  it('retrato para paisagem inverte largura e altura e mantém o sugerido', () => {
    expect(trocarOrientacao(tamanhoSugerido('20x30'), 'paisagem')).toEqual({
      sugeridoId: '20x30',
      larguraCm: 30,
      alturaCm: 20,
    });
  });

  it('paisagem para retrato volta', () => {
    expect(trocarOrientacao(tamanhoSugerido('20x30', 'paisagem'), 'retrato')).toEqual(
      tamanhoSugerido('20x30', 'retrato'),
    );
  });

  it('já na orientação pedida: não muda', () => {
    const t = tamanhoSugerido('20x30');
    expect(trocarOrientacao(t, 'retrato')).toEqual(t);
  });

  it('quadrado não tem orientação', () => {
    const t = tamanhoSugerido('15x15');
    expect(trocarOrientacao(t, 'paisagem')).toEqual(t);
  });

  it('personalizado também troca largura e altura', () => {
    expect(trocarOrientacao({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 }, 'paisagem')).toEqual({
      sugeridoId: null,
      larguraCm: 29.7,
      alturaCm: 21,
    });
  });
});
