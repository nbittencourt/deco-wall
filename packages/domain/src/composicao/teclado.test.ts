import { describe, expect, it } from 'vitest';
import { foto as fotoFixture } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { moverPorTeclado } from './teclado';

// Teclado (RN-16, M2-01, A-08): com snap, seta = 1 passo e Shift + seta = 5 passos; sem snap, 1 cm e 5 cm.

const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const SNAP = { snap: true, passoCm: 5 };
const LIVRE = { snap: false, passoCm: 5 };

describe('moverPorTeclado sem snap', () => {
  it('seta move 1 cm e Shift + seta move 5 cm, nas quatro direções', () => {
    const f = foto({ xCm: 40, yCm: 30 });
    expect(moverPorTeclado(f, 'direita', { shift: false, grid: LIVRE })).toEqual({ xCm: 41, yCm: 30 });
    expect(moverPorTeclado(f, 'esquerda', { shift: false, grid: LIVRE })).toEqual({ xCm: 39, yCm: 30 });
    expect(moverPorTeclado(f, 'baixo', { shift: false, grid: LIVRE })).toEqual({ xCm: 40, yCm: 31 });
    expect(moverPorTeclado(f, 'cima', { shift: false, grid: LIVRE })).toEqual({ xCm: 40, yCm: 29 });
    expect(moverPorTeclado(f, 'direita', { shift: true, grid: LIVRE })).toEqual({ xCm: 45, yCm: 30 });
    expect(moverPorTeclado(f, 'cima', { shift: true, grid: LIVRE })).toEqual({ xCm: 40, yCm: 25 });
  });

  it('mantém a casa decimal', () => {
    expect(moverPorTeclado(foto({ xCm: 40.3 }), 'direita', { shift: false, grid: LIVRE }).xCm).toBe(41.3);
  });
});

describe('moverPorTeclado com snap (M2-01)', () => {
  it('seta move 1 passo do grid e Shift + seta move 5 passos', () => {
    const f = foto({ xCm: 40, yCm: 30 });
    expect(moverPorTeclado(f, 'direita', { shift: false, grid: SNAP })).toEqual({ xCm: 45, yCm: 30 });
    expect(moverPorTeclado(f, 'baixo', { shift: true, grid: SNAP })).toEqual({ xCm: 40, yCm: 55 });
    expect(moverPorTeclado(f, 'esquerda', { shift: true, grid: { snap: true, passoCm: 2 } })).toEqual({
      xCm: 30,
      yCm: 30,
    });
  });

  it('foto fora do grid: a primeira seta vai até a linha seguinte naquela direção (A-08)', () => {
    const f = foto({ xCm: 42, yCm: 31 });
    expect(moverPorTeclado(f, 'direita', { shift: false, grid: SNAP })).toEqual({ xCm: 45, yCm: 31 });
    expect(moverPorTeclado(f, 'esquerda', { shift: false, grid: SNAP })).toEqual({ xCm: 40, yCm: 31 });
    expect(moverPorTeclado(f, 'baixo', { shift: false, grid: SNAP })).toEqual({ xCm: 42, yCm: 35 });
    expect(moverPorTeclado(f, 'cima', { shift: false, grid: SNAP })).toEqual({ xCm: 42, yCm: 30 });
  });

  it('com Shift e fora do grid: linha seguinte + 4 passos', () => {
    expect(moverPorTeclado(foto({ xCm: 42 }), 'direita', { shift: true, grid: SNAP }).xCm).toBe(65);
  });
});
