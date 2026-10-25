import { describe, expect, it } from 'vitest';
import { tamanhoSugerido } from './tamanho';
import {
  caixaDaComposicao,
  caixaExterna,
  encaixarNoGrid,
  encaixarPosicao,
  moverPorSeta,
  proximaLinhaDoGrid,
  tamanhoExterno,
} from './geometria';

// Geometria das fotos (RN-02, RN-06, RN-15, RN-16, RF-62; spec M2 §4.1, M2-09).

const BRANCA = { larguraCm: 0, cor: '#FFFFFF' };

describe('tamanhoExterno (RN-02)', () => {
  it('sem borda é o próprio tamanho impresso', () => {
    expect(tamanhoExterno({ tamanho: tamanhoSugerido('20x30'), borda: BRANCA })).toEqual({
      larguraCm: 20,
      alturaCm: 30,
    });
  });

  it('10×15 com borda de 2 cm mede 14 × 19 (aceite 2)', () => {
    expect(
      tamanhoExterno({ tamanho: tamanhoSugerido('10x15'), borda: { larguraCm: 2, cor: '#FFFFFF' } }),
    ).toEqual({ larguraCm: 14, alturaCm: 19 });
  });

  it('personalizado com borda fracionária, arredondado a 0,1 cm', () => {
    const tamanho = { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 };
    expect(tamanhoExterno({ tamanho, borda: { larguraCm: 0.5, cor: '#000000' } })).toEqual({
      larguraCm: 22,
      alturaCm: 30.7,
    });
    expect(tamanhoExterno({ tamanho, borda: { larguraCm: 0.05, cor: '#000000' } })).toEqual({
      larguraCm: 21.1,
      alturaCm: 29.8,
    });
  });
});

describe('caixaExterna', () => {
  it('posição + tamanho externo (RN-06)', () => {
    expect(
      caixaExterna({
        xCm: 40,
        yCm: 30,
        tamanho: tamanhoSugerido('20x30'),
        borda: { larguraCm: 1, cor: '#FFFFFF' },
      }),
    ).toEqual({ xCm: 40, yCm: 30, larguraCm: 22, alturaCm: 32 });
  });
});

describe('caixaDaComposicao (RF-62)', () => {
  const foto = (xCm: number, yCm: number, id: string) => ({
    xCm,
    yCm,
    tamanho: tamanhoSugerido(id),
    borda: BRANCA,
  });

  it('sem fotos: null', () => {
    expect(caixaDaComposicao([])).toBeNull();
  });

  it('uma foto: a própria caixa externa', () => {
    expect(caixaDaComposicao([foto(10, 20, '20x30')])).toEqual({
      xCm: 10,
      yCm: 20,
      larguraCm: 20,
      alturaCm: 30,
    });
  });

  it('várias fotos: o retângulo que envolve todas', () => {
    expect(caixaDaComposicao([foto(10, 20, '20x30'), foto(50, 5, '10x15')])).toEqual({
      xCm: 10,
      yCm: 5,
      larguraCm: 50,
      alturaCm: 45,
    });
  });

  it('inclui a borda no envoltório', () => {
    const comBorda = { ...foto(0, 0, '10x15'), borda: { larguraCm: 2, cor: '#FFFFFF' } };
    expect(caixaDaComposicao([comBorda])).toEqual({ xCm: 0, yCm: 0, larguraCm: 14, alturaCm: 19 });
  });
});

describe('encaixarNoGrid (RN-15, aceite 4)', () => {
  it('leva ao múltiplo mais próximo do passo', () => {
    expect(encaixarNoGrid(12, 5)).toBe(10);
    expect(encaixarNoGrid(13, 5)).toBe(15);
    expect(encaixarNoGrid(12.5, 5)).toBe(15);
    expect(encaixarNoGrid(-7.4, 5)).toBe(-5);
  });

  it('passos fracionários sem ruído de ponto flutuante', () => {
    expect(encaixarNoGrid(7.3, 2.5)).toBe(7.5);
    expect(encaixarNoGrid(1, 0.3)).toBe(0.9);
    expect(encaixarNoGrid(3.14, 1)).toBe(3);
  });

  it('nunca devolve -0', () => {
    expect(Object.is(encaixarNoGrid(-0.4, 5), -0)).toBe(false);
    expect(encaixarNoGrid(-0.4, 5)).toBe(0);
  });

  it('encaixarPosicao aplica aos dois eixos', () => {
    expect(encaixarPosicao({ x: 12, y: 18 }, 5)).toEqual({ x: 10, y: 20 });
  });
});

describe('proximaLinhaDoGrid (M2-09)', () => {
  it('entre linhas: a mais próxima na direção', () => {
    expect(proximaLinhaDoGrid(12, 5, 1)).toBe(15);
    expect(proximaLinhaDoGrid(12, 5, -1)).toBe(10);
  });

  it('sobre a linha: a vizinha', () => {
    expect(proximaLinhaDoGrid(15, 5, 1)).toBe(20);
    expect(proximaLinhaDoGrid(15, 5, -1)).toBe(10);
    expect(proximaLinhaDoGrid(0, 5, -1)).toBe(-5);
  });

  it('a tolerância de 0,05 cm conta como sobre a linha', () => {
    expect(proximaLinhaDoGrid(14.97, 5, 1)).toBe(20);
    expect(proximaLinhaDoGrid(15.03, 5, -1)).toBe(10);
  });
});

describe('moverPorSeta (RN-16, M2-09)', () => {
  const sem = { snap: false, passoCm: 5, shift: false };

  it('sem snap: 1 cm; com Shift, 5 cm', () => {
    expect(moverPorSeta({ xCm: 10.3, yCm: 20 }, 'direita', sem)).toEqual({ x: 11.3, y: 20 });
    expect(moverPorSeta({ xCm: 10, yCm: 20 }, 'esquerda', sem)).toEqual({ x: 9, y: 20 });
    expect(moverPorSeta({ xCm: 10, yCm: 20 }, 'cima', sem)).toEqual({ x: 10, y: 19 });
    expect(moverPorSeta({ xCm: 10, yCm: 20 }, 'baixo', { ...sem, shift: true })).toEqual({ x: 10, y: 25 });
  });

  it('com snap: vai à próxima linha do grid; Shift avança 5 linhas', () => {
    const com = { snap: true, passoCm: 5, shift: false };
    expect(moverPorSeta({ xCm: 12, yCm: 20 }, 'direita', com)).toEqual({ x: 15, y: 20 });
    expect(moverPorSeta({ xCm: 12, yCm: 20 }, 'esquerda', com)).toEqual({ x: 10, y: 20 });
    expect(moverPorSeta({ xCm: 12, yCm: 20 }, 'direita', { ...com, shift: true })).toEqual({ x: 35, y: 20 });
    expect(moverPorSeta({ xCm: 12, yCm: 20 }, 'esquerda', { ...com, shift: true })).toEqual({
      x: -10,
      y: 20,
    });
    expect(moverPorSeta({ xCm: 10, yCm: 20 }, 'baixo', { snap: true, passoCm: 10, shift: false })).toEqual({
      x: 10,
      y: 30,
    });
  });
});
