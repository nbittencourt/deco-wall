import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { alertasDaComposicao, foraDaAreaUtil, foraDaParede, sobreposicoes } from './alertas';

// Alertas (RN-11, RN-12, RN-34; §4.5, A-12, A-14). Nunca bloqueiam. Tolerância ε = 0,05 cm.

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const AREA = { xCm: 20, yCm: 20, larguraCm: 200, alturaCm: 120 };
// A fixture é 20 × 30 sem borda.
const foto = (n: number, s: Record<string, unknown> = {}) =>
  fotoFixture({ _id: id(n), xCm: 100, yCm: 100, ...s }) as FotoNaParede;

describe('sobreposicoes (RN-11)', () => {
  it('fotos que só encostam não se sobrepõem', () => {
    const r = sobreposicoes([foto(1, { xCm: 100 }), foto(2, { xCm: 120 })]);
    expect(r.pares).toEqual([]);
    expect(r.ids).toEqual([]);
  });

  it('invasão acima de ε conta; abaixo de ε (0,05 cm) não', () => {
    expect(sobreposicoes([foto(1, { xCm: 100 }), foto(2, { xCm: 119.9 })]).ids).toHaveLength(2);
    expect(sobreposicoes([foto(1, { xCm: 100 }), foto(2, { xCm: 119.96 })]).ids).toEqual([]);
  });

  it('é preciso invadir nos dois eixos', () => {
    expect(sobreposicoes([foto(1), foto(2, { xCm: 110, yCm: 130 })]).ids).toEqual([]);
  });

  it('devolve pares [abaixo, acima] pela ordem da pilha e os ids envolvidos', () => {
    const r = sobreposicoes([foto(1), foto(2, { xCm: 110 })]);
    expect(r.pares).toEqual([[id(1), id(2)]]);
    expect([...r.ids].sort()).toEqual([id(1), id(2)]);
  });

  it('acima: só a foto da camada superior de cada par, uma vez cada, mesmo cobrindo várias (A-12)', () => {
    // A 3 (última da pilha, 110..150) cobre a 1 (100..120) e a 2 (140..160); 1 e 2 não se tocam.
    const larga = { sugeridoId: null, larguraCm: 40, alturaCm: 30 };
    const fotos = [foto(1, { xCm: 100 }), foto(2, { xCm: 140 }), foto(3, { xCm: 110, tamanho: larga })];
    const r = sobreposicoes(fotos);
    expect(r.pares).toEqual([
      [id(1), id(3)],
      [id(2), id(3)],
    ]);
    expect(r.acima).toEqual([id(3)]);
  });

  it('placeholders entram no cálculo', () => {
    expect(sobreposicoes([foto(1, { imagemId: null }), foto(2, { xCm: 110 })]).ids).toHaveLength(2);
  });

  it('o retângulo externo inclui a borda', () => {
    const comBorda = foto(1, { xCm: 100, borda: { larguraCm: 2, cor: '#FFFFFF' } }); // externo 24 × 34
    expect(sobreposicoes([comBorda, foto(2, { xCm: 122 })]).ids).toHaveLength(2);
  });
});

describe('foraDaParede (RN-12) e foraDaAreaUtil (RN-34)', () => {
  it('dentro: falso; ultrapassando a parede: verdadeiro', () => {
    expect(foraDaParede(foto(1), PAREDE)).toBe(false);
    expect(foraDaParede(foto(1, { xCm: 290 }), PAREDE)).toBe(true);
    expect(foraDaParede(foto(1, { yCm: -1 }), PAREDE)).toBe(true);
  });

  it('exatamente na borda, ou dentro de ε, é dentro', () => {
    expect(foraDaParede(foto(1, { xCm: 280 }), PAREDE)).toBe(false);
    expect(foraDaParede(foto(1, { xCm: 280.04 }), PAREDE)).toBe(false);
    expect(foraDaParede(foto(1, { xCm: 280.1 }), PAREDE)).toBe(true);
  });

  it('fora da área útil, mas dentro da parede', () => {
    const f = foto(1, { xCm: 10 });
    expect(foraDaParede(f, PAREDE)).toBe(false);
    expect(foraDaAreaUtil(f, AREA)).toBe(true);
    expect(foraDaAreaUtil(foto(1), AREA)).toBe(false);
  });

  it('sem área útil, nunca está fora dela', () => {
    expect(foraDaAreaUtil(foto(1), null)).toBe(false);
  });
});

describe('alertasDaComposicao (A-14, RF-62)', () => {
  it('sem fotos: tudo zerado e área total nula', () => {
    expect(alertasDaComposicao({ fotos: [], areaUtil: AREA }, PAREDE)).toEqual({
      fotos: 0,
      semFoto: 0,
      sobrepostas: 0,
      foraDaArea: 0,
      areaTotal: null,
    });
  });

  it('conta fotos, placeholders, sobrepostas e fora da área (parede ou área útil)', () => {
    const fotos = [
      foto(1, { xCm: 100 }),
      foto(2, { xCm: 110 }), // sobrepõe a 1
      foto(3, { xCm: 10, yCm: 100 }), // fora da área útil
      foto(4, { xCm: 290, yCm: 100, imagemId: null }), // fora da parede; placeholder
    ];
    const r = alertasDaComposicao({ fotos, areaUtil: AREA }, PAREDE);
    expect(r.fotos).toBe(4);
    expect(r.semFoto).toBe(1);
    expect(r.sobrepostas).toBe(2);
    expect(r.foraDaArea).toBe(2);
    expect(r.areaTotal).toEqual({ xCm: 10, yCm: 100, larguraCm: 300, alturaCm: 30 });
  });

  it('com a foto fora da parede e da área útil, conta uma vez', () => {
    const r = alertasDaComposicao({ fotos: [foto(1, { xCm: 500 })], areaUtil: AREA }, PAREDE);
    expect(r.foraDaArea).toBe(1);
  });
});
