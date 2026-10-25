import { describe, expect, it } from 'vitest';
import { calcularAlertas, resumirAlertas } from './alertas';
import { tamanhoSugerido } from './tamanho';

// Alertas de posição (RN-11, RN-12, RN-34, RN-36, M2-08).

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const AREA = { xCm: 10, yCm: 10, larguraCm: 200, alturaCm: 100 };

function foto(id: string, xCm: number, yCm: number, tamanho = '10x15', borda = 0) {
  return {
    _id: id,
    xCm,
    yCm,
    tamanho: tamanhoSugerido(tamanho),
    borda: { larguraCm: borda, cor: '#FFFFFF' },
  };
}

describe('sobreposição', () => {
  it('fotos que se cruzam marcam as duas', () => {
    const mapa = calcularAlertas([foto('a', 50, 50), foto('b', 55, 60), foto('c', 200, 50)], PAREDE, AREA);
    expect(mapa.get('a')?.sobreposicao).toBe(true);
    expect(mapa.get('b')?.sobreposicao).toBe(true);
    expect(mapa.get('c')?.sobreposicao).toBe(false);
  });

  it('fotos apenas encostadas não se sobrepõem', () => {
    const mapa = calcularAlertas([foto('a', 50, 50), foto('b', 60, 50)], PAREDE, AREA);
    expect(mapa.get('a')?.sobreposicao).toBe(false);
    expect(mapa.get('b')?.sobreposicao).toBe(false);
  });

  it('a tolerância de 0,05 cm separa ruído de sobreposição', () => {
    expect(
      calcularAlertas([foto('a', 50, 50), foto('b', 59.96, 50)], PAREDE, AREA).get('a')?.sobreposicao,
    ).toBe(false);
    expect(
      calcularAlertas([foto('a', 50, 50), foto('b', 59.9, 50)], PAREDE, AREA).get('a')?.sobreposicao,
    ).toBe(true);
  });

  it('a borda conta (tamanho externo, RN-06)', () => {
    const mapa = calcularAlertas([foto('a', 50, 50, '10x15', 2), foto('b', 61, 50)], PAREDE, AREA);
    expect(mapa.get('a')?.sobreposicao).toBe(true);
  });
});

describe('fora dos limites', () => {
  it('dentro da área útil: sem alerta', () => {
    expect(calcularAlertas([foto('a', 50, 50)], PAREDE, AREA).get('a')).toEqual({
      sobreposicao: false,
      fora: null,
    });
  });

  it('passando da área útil, mas dentro da parede: "area-util"', () => {
    expect(calcularAlertas([foto('a', 5, 50)], PAREDE, AREA).get('a')?.fora).toBe('area-util');
    expect(calcularAlertas([foto('a', 205, 50)], PAREDE, AREA).get('a')?.fora).toBe('area-util');
  });

  it('passando da parede: "parede" prevalece sobre a área útil', () => {
    expect(calcularAlertas([foto('a', 295, 50)], PAREDE, AREA).get('a')?.fora).toBe('parede');
    expect(calcularAlertas([foto('a', -3, 50)], PAREDE, AREA).get('a')?.fora).toBe('parede');
  });

  it('a borda entra na conta', () => {
    expect(calcularAlertas([foto('a', 11, 50, '10x15', 2)], PAREDE, AREA).get('a')?.fora).toBeNull();
    expect(calcularAlertas([foto('a', 9, 50, '10x15', 2)], PAREDE, AREA).get('a')?.fora).toBe('area-util');
  });

  it('tolerância de 0,05 cm nos limites', () => {
    expect(calcularAlertas([foto('a', 9.96, 50)], PAREDE, AREA).get('a')?.fora).toBeNull();
    expect(calcularAlertas([foto('a', 9.9, 50)], PAREDE, AREA).get('a')?.fora).toBe('area-util');
  });

  it('sem área útil ou sem parede, só vale o que existe', () => {
    expect(calcularAlertas([foto('a', 5, 50)], PAREDE, null).get('a')?.fora).toBeNull();
    expect(calcularAlertas([foto('a', 295, 50)], PAREDE, null).get('a')?.fora).toBe('parede');
    expect(calcularAlertas([foto('a', 295, 50)], null, AREA).get('a')?.fora).toBe('area-util');
    expect(calcularAlertas([foto('a', 295, 50)], null, null).get('a')?.fora).toBeNull();
  });
});

describe('mapa e resumo', () => {
  it('toda foto tem entrada no mapa', () => {
    const fotos = [foto('a', 50, 50), foto('b', 150, 60)];
    expect([...calcularAlertas(fotos, PAREDE, AREA).keys()]).toEqual(['a', 'b']);
    expect(calcularAlertas([], PAREDE, AREA).size).toBe(0);
  });

  it('resumirAlertas conta fotos com sobreposição e fora dos limites', () => {
    const mapa = calcularAlertas(
      [foto('a', 50, 50), foto('b', 55, 60), foto('c', 295, 50), foto('d', 5, 50), foto('e', 120, 90)],
      PAREDE,
      AREA,
    );
    expect(resumirAlertas(mapa)).toEqual({ comSobreposicao: 2, foraDosLimites: 2 });
  });
});
