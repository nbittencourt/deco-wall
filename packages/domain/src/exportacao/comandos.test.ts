import { describe, expect, it } from 'vitest';
import {
  borda,
  foto as fotoFixture,
  grid as gridFixture,
  id,
  parede as paredeFixture,
  tamanho,
} from '../../../../tests/fixtures/dominio';
import type { FotoNaParede, Grid, Parede } from '../schemas';
import { comandosDeExportacao } from './comandos';

// Comandos de desenho da exportação (RF-80, RN-12, RN-19, ADR-08, M4-10, M4-11, A-15, A-16;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.5). Tudo em cm; o executor converte para px.

const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const vaga = (s: Record<string, unknown> = {}) => foto({ imagemId: null, ...s });
const parede = (s: Record<string, unknown> = {}) => paredeFixture(s) as unknown as Parede;
const grid = (s: Record<string, unknown> = {}) => gridFixture(s) as Grid;

const entrada = (fotos: FotoNaParede[], extra: Record<string, unknown> = {}) => ({
  variante: { grid: grid(), fotos },
  parede: parede(),
  incluirGrid: false,
  ...extra,
});

describe('comandosDeExportacao — ordem das camadas (RN-19, M4-11)', () => {
  it('parede, grid (opcional, abaixo das fotos) e fotos na ordem da pilha', () => {
    const fotos = [foto({ _id: id(1) }), vaga({ _id: id(2) }), foto({ _id: id(3) })];
    const comandos = comandosDeExportacao(entrada(fotos, { incluirGrid: true }));
    expect(comandos.map((c) => c.tipo)).toEqual(['parede', 'grid', 'foto', 'placeholder', 'foto']);
    expect(comandos.slice(2).map((c) => (c as { fotoId: string }).fotoId)).toEqual([id(1), id(2), id(3)]);
  });

  it('sem "Incluir grid" não há comando de grid', () => {
    const comandos = comandosDeExportacao(entrada([foto()]));
    expect(comandos.map((c) => c.tipo)).toEqual(['parede', 'foto']);
  });

  it('só existem os tipos parede, grid, foto e placeholder: nada de seleção, alças, alertas, área útil ou origem', () => {
    const comandos = comandosDeExportacao(entrada([foto(), vaga()], { incluirGrid: true }));
    const tipos = new Set(comandos.map((c) => c.tipo));
    expect([...tipos].every((t) => ['parede', 'grid', 'foto', 'placeholder'].includes(t))).toBe(true);
  });

  it('variante sem fotos exporta só a parede', () => {
    expect(comandosDeExportacao(entrada([])).map((c) => c.tipo)).toEqual(['parede']);
  });
});

describe('comandosDeExportacao — parede (M4-10)', () => {
  it('perspectiva: o arquivo retificado, na origem e no tamanho da parede inteira', () => {
    const [c] = comandosDeExportacao(entrada([]));
    expect(c).toEqual({
      tipo: 'parede',
      arquivo: `paredes/${id(301)}.retificada.webp`,
      origemCm: { x: 0, y: 0 },
      tamanhoCm: { larguraCm: 300, alturaCm: 200 },
    });
  });

  it('perspectiva com origem negativa leva a origem para o comando', () => {
    const p = parede({
      retificada: {
        arquivo: 'paredes/r.webp',
        larguraPx: 3072,
        alturaPx: 2048,
        pxPorCm: 10.24,
        origemCm: { x: -150, y: -100 },
      },
    });
    const [c] = comandosDeExportacao({ ...entrada([]), parede: p });
    expect(c).toMatchObject({ origemCm: { x: -150, y: -100 }, arquivo: 'paredes/r.webp' });
  });

  it('escala linear: a foto processada da parede, a partir de 0,0', () => {
    const p = parede({
      arquivo: 'paredes/original.webp',
      larguraPx: 1200,
      alturaPx: 900,
      escala: {
        metodo: 'linear',
        linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
        homografia: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 1],
      },
      retificada: undefined,
    });
    const [c] = comandosDeExportacao({ ...entrada([]), parede: p });
    expect(c).toEqual({
      tipo: 'parede',
      arquivo: 'paredes/original.webp',
      origemCm: { x: 0, y: 0 },
      tamanhoCm: { larguraCm: 300, alturaCm: 225 },
    });
  });
});

describe('comandosDeExportacao — grid (A-15)', () => {
  it('usa passo, cor e opacidade da variante e os limites da parede inteira', () => {
    const g = grid({ passoCm: 10, cor: '#8C8C8C', opacidade: 0.2 });
    const comandos = comandosDeExportacao({
      ...entrada([]),
      variante: { grid: g, fotos: [] },
      incluirGrid: true,
    });
    expect(comandos[1]).toEqual({
      tipo: 'grid',
      passoCm: 10,
      cor: '#8C8C8C',
      opacidade: 0.2,
      origemCm: { x: 0, y: 0 },
      tamanhoCm: { larguraCm: 300, alturaCm: 200 },
    });
  });

  it('independe de grid.visivel', () => {
    const g = grid({ visivel: false });
    const comandos = comandosDeExportacao({
      ...entrada([]),
      variante: { grid: g, fotos: [] },
      incluirGrid: true,
    });
    expect(comandos.map((c) => c.tipo)).toEqual(['parede', 'grid']);
  });
});

describe('comandosDeExportacao — fotos e placeholders (RN-19, A-16)', () => {
  it('foto com imagem: retângulo externo, impresso (externo − borda), borda e recorte', () => {
    const f = foto({
      _id: id(5),
      imagemId: id(8),
      xCm: 40,
      yCm: 30,
      tamanho: tamanho({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 }),
      borda: borda({ larguraCm: 2, cor: '#F5F1E8' }),
      recorte: { offsetX: 0.5, offsetY: -0.25 },
    });
    const [, c] = comandosDeExportacao(entrada([f]));
    expect(c).toEqual({
      tipo: 'foto',
      fotoId: id(5),
      imagemId: id(8),
      externo: { xCm: 40, yCm: 30, larguraCm: 24, alturaCm: 34 },
      impresso: { xCm: 42, yCm: 32, larguraCm: 20, alturaCm: 30 },
      borda: { larguraCm: 2, cor: '#F5F1E8' },
      recorte: { offsetX: 0.5, offsetY: -0.25 },
    });
  });

  it('borda 0: sem retângulo de borda e impresso = externo', () => {
    const [, c] = comandosDeExportacao(entrada([foto({ borda: borda({ larguraCm: 0 }) })]));
    expect(c).toMatchObject({ tipo: 'foto', borda: null });
    expect((c as { impresso: unknown }).impresso).toEqual((c as { externo: unknown }).externo);
  });

  it('placeholder: só o retângulo externo, sem borda (A-16)', () => {
    const v = vaga({ _id: id(6), xCm: 10, yCm: 20, borda: borda({ larguraCm: 3 }) });
    const [, c] = comandosDeExportacao(entrada([v]));
    expect(c).toEqual({
      tipo: 'placeholder',
      fotoId: id(6),
      externo: { xCm: 10, yCm: 20, larguraCm: 26, alturaCm: 36 },
    });
  });

  it('a parte que passa da parede continua nos comandos: o recorte é do executor (RN-12)', () => {
    const [, c] = comandosDeExportacao(entrada([foto({ xCm: 290, yCm: 190 })]));
    expect(c).toMatchObject({ tipo: 'foto', externo: { xCm: 290, yCm: 190 } });
  });

  it('não altera os argumentos', () => {
    const e = entrada([foto(), vaga()], { incluirGrid: true });
    const antes = JSON.stringify(e);
    comandosDeExportacao(e);
    expect(JSON.stringify(e)).toBe(antes);
  });
});
