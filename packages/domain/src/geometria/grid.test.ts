import { describe, expect, it } from 'vitest';
import { gridVisivelNoZoom, linhasVisiveis } from './grid';

// A-07 / RN-34: linhas a partir da origem 0,0, só dentro da parede inteira;
// abaixo de 4 px na tela o grid não é desenhado.

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };

describe('linhasVisiveis', () => {
  it('gera as linhas múltiplas do passo dentro da parede, bordas incluídas', () => {
    const { xs, ys } = linhasVisiveis({
      passoCm: 50,
      limitesCm: PAREDE,
      janelaCm: { xCm: -100, yCm: -100, larguraCm: 800, alturaCm: 600 },
      pxPorCmTela: 2,
    });
    expect(xs).toEqual([0, 50, 100, 150, 200, 250, 300]);
    expect(ys).toEqual([0, 50, 100, 150, 200]);
  });

  it('só gera as linhas da janela visível', () => {
    const { xs, ys } = linhasVisiveis({
      passoCm: 50,
      limitesCm: PAREDE,
      janelaCm: { xCm: 90, yCm: 40, larguraCm: 120, alturaCm: 70 },
      pxPorCmTela: 2,
    });
    expect(xs).toEqual([100, 150, 200]);
    expect(ys).toEqual([50, 100]);
  });

  it('parede com origem negativa (retificada com margem) alinha as linhas em 0,0', () => {
    const { xs, ys } = linhasVisiveis({
      passoCm: 100,
      limitesCm: { xCm: -250, yCm: -120, larguraCm: 700, alturaCm: 400 },
      janelaCm: { xCm: -1000, yCm: -1000, larguraCm: 3000, alturaCm: 3000 },
      pxPorCmTela: 1,
    });
    expect(xs).toEqual([-200, -100, 0, 100, 200, 300, 400]);
    expect(ys).toEqual([-100, 0, 100, 200, 300]);
  });

  it('passo fracionário não acumula erro de ponto flutuante', () => {
    const { xs } = linhasVisiveis({
      passoCm: 0.1,
      limitesCm: { xCm: 0, yCm: 0, larguraCm: 0.5, alturaCm: 0.5 },
      janelaCm: { xCm: 0, yCm: 0, larguraCm: 0.5, alturaCm: 0.5 },
      pxPorCmTela: 100,
    });
    expect(xs).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it('abaixo de 4 px na tela não gera linhas (A-07)', () => {
    const vazio = linhasVisiveis({
      passoCm: 1,
      limitesCm: PAREDE,
      janelaCm: PAREDE,
      pxPorCmTela: 3.9,
    });
    expect(vazio).toEqual({ xs: [], ys: [] });

    const exato = linhasVisiveis({ passoCm: 1, limitesCm: PAREDE, janelaCm: PAREDE, pxPorCmTela: 4 });
    expect(exato.xs.length).toBeGreaterThan(0);
  });

  it('janela fora da parede não gera linhas', () => {
    const { xs, ys } = linhasVisiveis({
      passoCm: 10,
      limitesCm: PAREDE,
      janelaCm: { xCm: 1000, yCm: 1000, larguraCm: 100, alturaCm: 100 },
      pxPorCmTela: 5,
    });
    expect(xs).toEqual([]);
    expect(ys).toEqual([]);
  });
});

describe('gridVisivelNoZoom', () => {
  it('é falso quando o passo na tela fica abaixo de 4 px', () => {
    expect(gridVisivelNoZoom(5, 0.5)).toBe(false);
    expect(gridVisivelNoZoom(5, 0.8)).toBe(true);
    expect(gridVisivelNoZoom(1, 3.99)).toBe(false);
    expect(gridVisivelNoZoom(1, 4)).toBe(true);
  });
});
