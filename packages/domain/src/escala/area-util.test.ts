import { describe, expect, it } from 'vitest';
import {
  aplicarCampoAreaUtil,
  areaUtilForaDaParede,
  faixaCampoAreaUtil,
  limitarAreaUtil,
  moverAreaUtil,
  redimensionarAreaUtil,
} from './area-util';

// Área útil (RN-33 a RN-35, A-13): mínimo 5 cm por lado, dentro da parede inteira, livre a 0,1 cm.

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const PAREDE_NEGATIVA = { xCm: -50, yCm: -30, larguraCm: 400, alturaCm: 260 };

describe('limitarAreaUtil', () => {
  it('área dentro da parede passa sem mudar', () => {
    const area = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };
    expect(limitarAreaUtil(area, PAREDE)).toEqual(area);
  });

  it('área maior que a parede é reduzida à parede', () => {
    expect(limitarAreaUtil({ xCm: -10, yCm: -10, larguraCm: 999, alturaCm: 999 }, PAREDE)).toEqual(PAREDE);
  });

  it('área que sai por um lado é empurrada para dentro mantendo o tamanho', () => {
    expect(limitarAreaUtil({ xCm: 250, yCm: 10, larguraCm: 100, alturaCm: 50 }, PAREDE)).toEqual({
      xCm: 200,
      yCm: 10,
      larguraCm: 100,
      alturaCm: 50,
    });
    expect(limitarAreaUtil({ xCm: -20, yCm: 190, larguraCm: 100, alturaCm: 50 }, PAREDE)).toEqual({
      xCm: 0,
      yCm: 150,
      larguraCm: 100,
      alturaCm: 50,
    });
  });

  it('impõe o mínimo de 5 cm por lado', () => {
    expect(limitarAreaUtil({ xCm: 10, yCm: 10, larguraCm: 2, alturaCm: 0 }, PAREDE)).toEqual({
      xCm: 10,
      yCm: 10,
      larguraCm: 5,
      alturaCm: 5,
    });
  });

  it('arredonda a 0,1 cm (RN-27)', () => {
    expect(limitarAreaUtil({ xCm: 10.04, yCm: 10.06, larguraCm: 50.04, alturaCm: 50.06 }, PAREDE)).toEqual({
      xCm: 10,
      yCm: 10.1,
      larguraCm: 50,
      alturaCm: 50.1,
    });
  });

  it('funciona com a parede de origem negativa', () => {
    expect(limitarAreaUtil({ xCm: -80, yCm: 0, larguraCm: 100, alturaCm: 50 }, PAREDE_NEGATIVA)).toEqual({
      xCm: -50,
      yCm: 0,
      larguraCm: 100,
      alturaCm: 50,
    });
  });
});

describe('areaUtilForaDaParede (RN-35, aviso §3.4)', () => {
  it('é falso quando a área cabe, inclusive colada nas bordas', () => {
    expect(areaUtilForaDaParede(PAREDE, PAREDE)).toBe(false);
    expect(areaUtilForaDaParede({ xCm: 10, yCm: 10, larguraCm: 50, alturaCm: 50 }, PAREDE)).toBe(false);
  });

  it('é verdadeiro quando qualquer lado sai da parede', () => {
    expect(areaUtilForaDaParede({ xCm: -1, yCm: 0, larguraCm: 100, alturaCm: 100 }, PAREDE)).toBe(true);
    expect(areaUtilForaDaParede({ xCm: 0, yCm: -1, larguraCm: 100, alturaCm: 100 }, PAREDE)).toBe(true);
    expect(areaUtilForaDaParede({ xCm: 250, yCm: 0, larguraCm: 100, alturaCm: 100 }, PAREDE)).toBe(true);
    expect(areaUtilForaDaParede({ xCm: 0, yCm: 150, larguraCm: 100, alturaCm: 100 }, PAREDE)).toBe(true);
  });

  it('ignora diferenças abaixo de 0,1 cm (ruído de arredondamento)', () => {
    expect(areaUtilForaDaParede({ xCm: -0.04, yCm: 0, larguraCm: 100, alturaCm: 100 }, PAREDE)).toBe(false);
  });
});

describe('faixaCampoAreaUtil (A-13: a faixa válida de cada campo)', () => {
  const area = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };

  it('largura e altura vão de 5 cm até a borda da parede', () => {
    expect(faixaCampoAreaUtil('larguraCm', area, PAREDE)).toEqual({ min: 5, max: 280 });
    expect(faixaCampoAreaUtil('alturaCm', area, PAREDE)).toEqual({ min: 5, max: 190 });
  });

  it('X e Y vão da borda da parede até onde a área ainda cabe', () => {
    expect(faixaCampoAreaUtil('xCm', area, PAREDE)).toEqual({ min: 0, max: 200 });
    expect(faixaCampoAreaUtil('yCm', area, PAREDE)).toEqual({ min: 0, max: 120 });
  });

  it('considera a origem da parede', () => {
    expect(faixaCampoAreaUtil('xCm', area, PAREDE_NEGATIVA)).toEqual({ min: -50, max: 250 });
    expect(faixaCampoAreaUtil('larguraCm', area, PAREDE_NEGATIVA)).toEqual({ min: 5, max: 330 });
  });
});

describe('aplicarCampoAreaUtil', () => {
  const area = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };

  it('aplica um valor dentro da faixa', () => {
    expect(aplicarCampoAreaUtil(area, 'larguraCm', 150, PAREDE)).toEqual({
      ok: true,
      area: { ...area, larguraCm: 150 },
    });
  });

  it('aceita os extremos da faixa', () => {
    expect(aplicarCampoAreaUtil(area, 'larguraCm', 280, PAREDE).ok).toBe(true);
    expect(aplicarCampoAreaUtil(area, 'xCm', 0, PAREDE).ok).toBe(true);
    expect(aplicarCampoAreaUtil(area, 'alturaCm', 5, PAREDE).ok).toBe(true);
  });

  it('recusa valor fora da faixa e devolve a faixa para a mensagem', () => {
    expect(aplicarCampoAreaUtil(area, 'larguraCm', 281, PAREDE)).toEqual({
      ok: false,
      faixa: { min: 5, max: 280 },
    });
    expect(aplicarCampoAreaUtil(area, 'xCm', -1, PAREDE)).toEqual({ ok: false, faixa: { min: 0, max: 200 } });
    expect(aplicarCampoAreaUtil(area, 'alturaCm', 4.9, PAREDE).ok).toBe(false);
  });

  it('arredonda a 0,1 cm antes de aplicar', () => {
    expect(aplicarCampoAreaUtil(area, 'xCm', 30.04, PAREDE)).toEqual({
      ok: true,
      area: { ...area, xCm: 30 },
    });
  });

  it('recusa valor que não é número', () => {
    expect(aplicarCampoAreaUtil(area, 'xCm', Number.NaN, PAREDE).ok).toBe(false);
  });
});

// Gestos do modo Área útil (protótipo 13, A-13): arrastar o interior move; arrastar alça redimensiona.
describe('moverAreaUtil', () => {
  const area = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };

  it('desloca mantendo o tamanho', () => {
    expect(moverAreaUtil(area, { x: 30, y: 20 }, PAREDE)).toEqual({ ...area, xCm: 50, yCm: 30 });
  });

  it('não sai da parede por nenhum lado', () => {
    expect(moverAreaUtil(area, { x: -999, y: -999 }, PAREDE)).toEqual({ ...area, xCm: 0, yCm: 0 });
    expect(moverAreaUtil(area, { x: 999, y: 999 }, PAREDE)).toEqual({ ...area, xCm: 200, yCm: 120 });
  });

  it('arredonda a 0,1 cm', () => {
    expect(moverAreaUtil(area, { x: 0.04, y: 0.06 }, PAREDE)).toEqual({ ...area, xCm: 20, yCm: 10.1 });
  });
});

describe('redimensionarAreaUtil (8 alças)', () => {
  const area = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };

  it('alça lateral move só o lado dela', () => {
    expect(redimensionarAreaUtil(area, 'e', { x: 150, y: 999 }, PAREDE)).toEqual({ ...area, larguraCm: 130 });
    expect(redimensionarAreaUtil(area, 'w', { x: 5, y: 999 }, PAREDE)).toEqual({
      ...area,
      xCm: 5,
      larguraCm: 115,
    });
    expect(redimensionarAreaUtil(area, 'n', { x: 999, y: 4 }, PAREDE)).toEqual({
      ...area,
      yCm: 4,
      alturaCm: 86,
    });
    expect(redimensionarAreaUtil(area, 's', { x: 999, y: 150 }, PAREDE)).toEqual({ ...area, alturaCm: 140 });
  });

  it('alça de canto move os dois lados', () => {
    expect(redimensionarAreaUtil(area, 'se', { x: 200, y: 150 }, PAREDE)).toEqual({
      ...area,
      larguraCm: 180,
      alturaCm: 140,
    });
    expect(redimensionarAreaUtil(area, 'nw', { x: 30, y: 20 }, PAREDE)).toEqual({
      xCm: 30,
      yCm: 20,
      larguraCm: 90,
      alturaCm: 70,
    });
    expect(redimensionarAreaUtil(area, 'ne', { x: 130, y: 0 }, PAREDE)).toEqual({
      xCm: 20,
      yCm: 0,
      larguraCm: 110,
      alturaCm: 90,
    });
    expect(redimensionarAreaUtil(area, 'sw', { x: 0, y: 100 }, PAREDE)).toEqual({
      xCm: 0,
      yCm: 10,
      larguraCm: 120,
      alturaCm: 90,
    });
  });

  it('para no mínimo de 5 cm em vez de inverter a área', () => {
    expect(redimensionarAreaUtil(area, 'e', { x: 22, y: 0 }, PAREDE).larguraCm).toBe(5);
    expect(redimensionarAreaUtil(area, 'w', { x: 500, y: 0 }, PAREDE)).toMatchObject({
      xCm: 115,
      larguraCm: 5,
    });
  });

  it('não passa da parede', () => {
    expect(redimensionarAreaUtil(area, 'e', { x: 999, y: 0 }, PAREDE).larguraCm).toBe(280);
    expect(redimensionarAreaUtil(area, 'w', { x: -999, y: 0 }, PAREDE)).toMatchObject({
      xCm: 0,
      larguraCm: 120,
    });
  });

  it('arredonda a 0,1 cm', () => {
    expect(redimensionarAreaUtil(area, 'e', { x: 150.04, y: 0 }, PAREDE).larguraCm).toBe(130);
  });
});
