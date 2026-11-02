import { describe, expect, it } from 'vitest';
import { areaUtil, borda, foto as fotoFixture, grid, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { conteudoIgual, copiarParaNovaVariante, preencherVaga, semFoto } from './variante';

// Operações de variante (M3-01, M3-04, A-06, A-23; docs/specs/M3-variantes-templates-e-salvamento.md §4.1).

const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const vaga = (s: Record<string, unknown> = {}) => foto({ imagemId: null, ...s });

const conteudo = (fotos: FotoNaParede[] = [foto()]) => ({
  grid: grid(),
  bordaPadrao: borda(),
  areaUtil: areaUtil(),
  fotos,
});

describe('semFoto (M3-02)', () => {
  it('conta os placeholders', () => {
    expect(semFoto([])).toBe(0);
    expect(semFoto([foto(), vaga(), vaga({ _id: id(9) })])).toBe(2);
  });

  it('foto com imagem não conta, mesmo com imagemAnteriorId', () => {
    expect(semFoto([foto({ imagemAnteriorId: id(5) })])).toBe(0);
  });
});

describe('copiarParaNovaVariante (M3-04)', () => {
  it('gera ids novos para as fotos e preserva o resto', () => {
    let n = 100;
    const original = conteudo([foto({ _id: id(1) }), vaga({ _id: id(2) })]);
    const copia = copiarParaNovaVariante(original, () => id((n += 1)));
    expect(copia.fotos.map((f) => f._id)).toEqual([id(101), id(102)]);
    expect(copia.fotos[0]).toEqual({ ...original.fotos[0], _id: id(101) });
    expect(copia.fotos[1]).toEqual({ ...original.fotos[1], _id: id(102) });
    expect(copia.grid).toEqual(original.grid);
    expect(copia.bordaPadrao).toEqual(original.bordaPadrao);
    expect(copia.areaUtil).toEqual(original.areaUtil);
  });

  it('não compartilha objetos com a origem e não altera a origem', () => {
    const original = conteudo([foto({ _id: id(1) })]);
    const antes = JSON.stringify(original);
    const copia = copiarParaNovaVariante(original, () => id(50));
    expect(JSON.stringify(original)).toBe(antes);
    expect(copia.fotos[0]!.tamanho).not.toBe(original.fotos[0]!.tamanho);
    expect(copia.fotos[0]!.borda).not.toBe(original.fotos[0]!.borda);
    expect(copia.fotos[0]!.recorte).not.toBe(original.fotos[0]!.recorte);
    expect(copia.areaUtil).not.toBe(original.areaUtil);
  });

  it('área útil nula continua nula', () => {
    const copia = copiarParaNovaVariante({ ...conteudo(), areaUtil: null }, () => id(1));
    expect(copia.areaUtil).toBeNull();
  });
});

describe('conteudoIgual (A-06)', () => {
  it('compara por valor, não por referência', () => {
    expect(conteudoIgual(conteudo(), conteudo())).toBe(true);
  });

  it('ignora a ordem das chaves', () => {
    const a = conteudo();
    const b = { fotos: a.fotos, areaUtil: { ...a.areaUtil }, bordaPadrao: a.bordaPadrao, grid: a.grid };
    expect(conteudoIgual(a, b)).toBe(true);
  });

  it('detecta mudança de foto, ordem das fotos, área útil, borda padrão e grid', () => {
    const base = conteudo([foto({ _id: id(1) }), foto({ _id: id(2) })]);
    expect(conteudoIgual(base, conteudo([foto({ _id: id(1), xCm: 99 }), foto({ _id: id(2) })]))).toBe(false);
    expect(conteudoIgual(base, conteudo([foto({ _id: id(2) }), foto({ _id: id(1) })]))).toBe(false);
    expect(conteudoIgual(base, { ...base, areaUtil: null })).toBe(false);
    expect(conteudoIgual(base, { ...base, bordaPadrao: borda({ larguraCm: 3 }) })).toBe(false);
    expect(conteudoIgual(base, { ...base, grid: grid({ passoCm: 10 }) })).toBe(false);
    expect(conteudoIgual(base, conteudo([foto({ _id: id(1) })]))).toBe(false);
  });
});

describe('preencherVaga (M3-01, A-23)', () => {
  it('só troca a imagem: id, tamanho, posição e borda ficam; o recorte volta a 0,0', () => {
    const original = vaga({
      _id: id(7),
      xCm: 33,
      yCm: 44,
      tamanho: { sugeridoId: '20x25', larguraCm: 20, alturaCm: 25 },
      borda: { larguraCm: 2, cor: '#8C8C8C' },
      imagemAnteriorId: id(3),
      recorte: { offsetX: 4, offsetY: -2 },
    });
    const preenchida = preencherVaga(original, id(55));
    expect(preenchida).toEqual({ ...original, imagemId: id(55), recorte: { offsetX: 0, offsetY: 0 } });
  });

  it('não altera a vaga original', () => {
    const original = vaga();
    const antes = JSON.stringify(original);
    preencherVaga(original, id(55));
    expect(JSON.stringify(original)).toBe(antes);
  });

  it('foto que já tem imagem não aceita outra (trocar a imagem é a RF-37, ideia futura)', () => {
    const original = foto({ imagemId: id(1) });
    expect(preencherVaga(original, id(2))).toEqual(original);
  });
});
