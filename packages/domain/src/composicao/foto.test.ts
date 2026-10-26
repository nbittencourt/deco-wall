import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { duplicarFoto, mudarBorda, mudarTamanho, novaFoto, retanguloExterno } from './foto';
import { tamanhoSugerido } from './tamanho';

// Foto (RN-02, RN-03, RN-04, RN-05, RN-13; M2-09, M2-10, A-04, A-25; §4.1).

const GRID_ON = { snap: true, passoCm: 5 };
const GRID_OFF = { snap: false, passoCm: 5 };
const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const imagem = (orientacaoNatural: 'retrato' | 'paisagem' = 'retrato') => ({ _id: id(7), orientacaoNatural });
const BORDA_0 = { larguraCm: 0, cor: '#FFFFFF' };

describe('novaFoto — valores iniciais (RN-03, RN-04, A-04)', () => {
  it('10×15 na orientação natural, borda padrão, recorte centralizado, sem imagem anterior', () => {
    const f = novaFoto({
      id: id(500),
      imagem: imagem('retrato'),
      bordaPadrao: { larguraCm: 2, cor: '#112233' },
      centroCm: { x: 100, y: 100 },
      grid: GRID_OFF,
    });
    expect(f).toMatchObject({
      _id: id(500),
      imagemId: id(7),
      imagemAnteriorId: null,
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      recorte: { offsetX: 0, offsetY: 0 },
      borda: { larguraCm: 2, cor: '#112233' },
    });
    const paisagem = novaFoto({
      id: id(501),
      imagem: imagem('paisagem'),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 100 },
      grid: GRID_OFF,
    });
    expect(paisagem.tamanho).toEqual({ sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 });
  });

  it('a borda é cópia: mudar o objeto de origem depois não altera a foto', () => {
    const origem = { larguraCm: 1, cor: '#FFFFFF' };
    const f = novaFoto({
      id: id(500),
      imagem: imagem(),
      bordaPadrao: origem,
      centroCm: { x: 50, y: 50 },
      grid: GRID_OFF,
    });
    origem.larguraCm = 9;
    expect(f.borda.larguraCm).toBe(1);
  });
});

describe('novaFoto — posição (A-04)', () => {
  it('o centro do retângulo externo vai para o centroCm (sem snap)', () => {
    // externo 14 × 19 (borda 2): canto = centro − metade do externo.
    const f = novaFoto({
      id: id(500),
      imagem: imagem(),
      bordaPadrao: { larguraCm: 2, cor: '#FFFFFF' },
      centroCm: { x: 100, y: 80 },
      grid: GRID_OFF,
    });
    expect({ x: f.xCm, y: f.yCm }).toEqual({ x: 93, y: 70.5 });
  });

  it('com snap, o canto superior esquerdo externo encaixa no grid', () => {
    const f = novaFoto({
      id: id(500),
      imagem: imagem(),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 80 },
      grid: GRID_ON,
    });
    // canto (95, 72,5) → encaixado (95, 70) ou (95, 75): round(14,5)=15 → 75
    expect(f.xCm % 5).toBe(0);
    expect(f.yCm % 5).toBe(0);
    expect({ x: f.xCm, y: f.yCm }).toEqual({ x: 95, y: 75 });
  });

  it('cascata: se outra foto já tem o mesmo canto, desloca +1 passo (snap) em X e Y', () => {
    const base = {
      id: id(500),
      imagem: imagem(),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 80 },
      grid: GRID_ON,
    };
    const primeira = novaFoto(base);
    const segunda = novaFoto({ ...base, id: id(501), fotos: [primeira] });
    expect({ x: segunda.xCm, y: segunda.yCm }).toEqual({ x: primeira.xCm + 5, y: primeira.yCm + 5 });
    const terceira = novaFoto({ ...base, id: id(502), fotos: [primeira, segunda] });
    expect({ x: terceira.xCm, y: terceira.yCm }).toEqual({ x: primeira.xCm + 10, y: primeira.yCm + 10 });
  });

  it('cascata sem snap: +5 cm em X e Y', () => {
    const base = {
      id: id(500),
      imagem: imagem(),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 80 },
      grid: GRID_OFF,
    };
    const primeira = novaFoto(base);
    const segunda = novaFoto({ ...base, id: id(501), fotos: [primeira] });
    expect({ x: segunda.xCm, y: segunda.yCm }).toEqual({ x: primeira.xCm + 5, y: primeira.yCm + 5 });
  });

  it('cascata com passo do grid de 2 cm desloca 2 cm', () => {
    const grid = { snap: true, passoCm: 2 };
    const base = { id: id(500), imagem: imagem(), bordaPadrao: BORDA_0, centroCm: { x: 100, y: 80 }, grid };
    const primeira = novaFoto(base);
    const segunda = novaFoto({ ...base, id: id(501), fotos: [primeira] });
    expect(segunda.xCm - primeira.xCm).toBe(2);
  });

  it('cascata para depois de 10 tentativas, mesmo que o lugar continue ocupado', () => {
    const base = {
      id: id(500),
      imagem: imagem(),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 80 },
      grid: GRID_ON,
    };
    const origem = novaFoto(base);
    const ocupadas = Array.from({ length: 12 }, (_, i) =>
      foto({ _id: id(600 + i), xCm: origem.xCm + 5 * i, yCm: origem.yCm + 5 * i }),
    );
    const nova = novaFoto({ ...base, id: id(900), fotos: ocupadas });
    expect(nova.xCm).toBe(origem.xCm + 50);
    expect(nova.yCm).toBe(origem.yCm + 50);
  });

  it('fotos em outro canto não provocam cascata', () => {
    const base = {
      id: id(500),
      imagem: imagem(),
      bordaPadrao: BORDA_0,
      centroCm: { x: 100, y: 80 },
      grid: GRID_ON,
    };
    const origem = novaFoto(base);
    const nova = novaFoto({ ...base, id: id(501), fotos: [foto({ xCm: origem.xCm + 5, yCm: origem.yCm })] });
    expect({ x: nova.xCm, y: nova.yCm }).toEqual({ x: origem.xCm, y: origem.yCm });
  });
});

describe('retanguloExterno (RN-06)', () => {
  it('canto superior esquerdo externo e tamanho externo', () => {
    const f = foto({
      xCm: 10,
      yCm: 20,
      tamanho: tamanhoSugerido('10x15'),
      borda: { larguraCm: 2, cor: '#FFFFFF' },
    });
    expect(retanguloExterno(f)).toEqual({ xCm: 10, yCm: 20, larguraCm: 14, alturaCm: 19 });
  });
});

describe('mudarTamanho (RN-05, M2-09, M2-10)', () => {
  it('mantém o canto superior esquerdo externo e recentraliza o recorte', () => {
    const f = foto({ xCm: 12, yCm: 34, recorte: { offsetX: 0.5, offsetY: -0.3 } });
    const nova = mudarTamanho(f, tamanhoSugerido('10x15', 'paisagem'));
    expect(nova.xCm).toBe(12);
    expect(nova.yCm).toBe(34);
    expect(nova.tamanho).toEqual({ sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 });
    expect(nova.recorte).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('não altera a foto original', () => {
    const f = foto({ recorte: { offsetX: 0.5, offsetY: 0 } });
    mudarTamanho(f, tamanhoSugerido('10x15'));
    expect(f.recorte).toEqual({ offsetX: 0.5, offsetY: 0 });
    expect(f.tamanho.sugeridoId).toBe('20x30');
  });
});

describe('mudarBorda (RN-02, M2-10)', () => {
  it('mantém o canto superior esquerdo externo e o recorte; só a borda muda', () => {
    const f = foto({ xCm: 12, yCm: 34, recorte: { offsetX: 0.5, offsetY: 0 } });
    const nova = mudarBorda(f, { larguraCm: 3, cor: '#112233' });
    expect(nova.borda).toEqual({ larguraCm: 3, cor: '#112233' });
    expect([nova.xCm, nova.yCm]).toEqual([12, 34]);
    expect(nova.recorte).toEqual({ offsetX: 0.5, offsetY: 0 });
    expect(nova.tamanho).toEqual(f.tamanho);
  });
});

describe('duplicarFoto (A-25)', () => {
  it('copia imagem, tamanho, borda e recorte, com id novo', () => {
    const f = foto({ borda: { larguraCm: 2, cor: '#112233' }, recorte: { offsetX: 0.4, offsetY: 0 } });
    const copia = duplicarFoto(f, id(777), GRID_ON);
    expect(copia._id).toBe(id(777));
    expect(copia.imagemId).toBe(f.imagemId);
    expect(copia.tamanho).toEqual(f.tamanho);
    expect(copia.borda).toEqual(f.borda);
    expect(copia.recorte).toEqual(f.recorte);
  });

  it('a cópia sai +1 passo (snap) ou +5 cm (sem snap) em X e Y', () => {
    const f = foto({ xCm: 40, yCm: 30 });
    expect(duplicarFoto(f, id(777), GRID_ON)).toMatchObject({ xCm: 45, yCm: 35 });
    expect(duplicarFoto(f, id(777), { snap: true, passoCm: 2 })).toMatchObject({ xCm: 42, yCm: 32 });
    expect(duplicarFoto(f, id(777), GRID_OFF)).toMatchObject({ xCm: 45, yCm: 35 });
  });

  it('com snap e a foto fora do grid, a cópia encaixa no grid', () => {
    const copia = duplicarFoto(foto({ xCm: 41, yCm: 31 }), id(777), GRID_ON);
    expect(copia.xCm % 5).toBe(0);
    expect(copia.yCm % 5).toBe(0);
  });

  it('não compartilha objetos com a original', () => {
    const f = foto();
    const copia = duplicarFoto(f, id(777), GRID_ON);
    expect(copia.tamanho).not.toBe(f.tamanho);
    expect(copia.borda).not.toBe(f.borda);
    expect(copia.recorte).not.toBe(f.recorte);
  });
});
