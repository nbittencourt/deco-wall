import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import {
  converterEmPlaceholder,
  diasRestantes,
  fotosDaImagem,
  purgaVencida,
  recomendacaoDoPlaceholder,
  removerFotosDaImagem,
  restauravel,
  usosDaImagem,
} from './ciclo-de-vida';

// Ciclo de vida das imagens (RF-29, RF-30a, RN-24, M4-04 a M4-09; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.1).

const foto = (s: Record<string, unknown> = {}) => fotoFixture(s) as FotoNaParede;
const vaga = (s: Record<string, unknown> = {}) => foto({ imagemId: null, ...s });

const DIA = 86_400_000;
const AGORA = new Date('2026-11-02T12:00:00-03:00');
const emDias = (dias: number) => new Date(AGORA.getTime() + dias * DIA);

describe('converterEmPlaceholder (M4-05)', () => {
  it('zera a imagem, guarda a anterior e preserva formato, posição, borda e recorte', () => {
    const original = foto({
      _id: id(7),
      imagemId: id(1),
      xCm: 12.5,
      yCm: 8,
      recorte: { offsetX: 0.4, offsetY: -0.2 },
      borda: { larguraCm: 2, cor: '#F5F1E8' },
      tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 },
    });
    expect(converterEmPlaceholder(original, id(1))).toEqual({
      ...original,
      imagemId: null,
      imagemAnteriorId: id(1),
    });
  });

  it('sobrescreve uma imagemAnteriorId antiga', () => {
    const original = foto({ imagemId: id(2), imagemAnteriorId: id(9) });
    expect(converterEmPlaceholder(original, id(2)).imagemAnteriorId).toBe(id(2));
  });

  it('não altera o argumento', () => {
    const original = foto();
    const antes = JSON.stringify(original);
    converterEmPlaceholder(original, id(1));
    expect(JSON.stringify(original)).toBe(antes);
  });
});

describe('removerFotosDaImagem (M4-04)', () => {
  it('tira as fotos da imagem, conta as removidas e mantém as outras na ordem', () => {
    const fotos = [
      foto({ _id: id(1), imagemId: id(10) }),
      foto({ _id: id(2), imagemId: id(11) }),
      foto({ _id: id(3), imagemId: id(10) }),
      vaga({ _id: id(4) }),
    ];
    const r = removerFotosDaImagem(fotos, id(10));
    expect(r.removidas).toBe(2);
    expect(r.fotos.map((f) => f._id)).toEqual([id(2), id(4)]);
  });

  it('não confunde o placeholder com imagemAnteriorId igual: ele não é uma foto da imagem', () => {
    const fotos = [vaga({ _id: id(4), imagemAnteriorId: id(10) })];
    expect(removerFotosDaImagem(fotos, id(10))).toEqual({ fotos, removidas: 0 });
  });

  it('sem usos devolve as mesmas fotos e zero removidas', () => {
    const fotos = [foto()];
    expect(removerFotosDaImagem(fotos, id(99))).toEqual({ fotos, removidas: 0 });
  });
});

describe('fotosDaImagem e usosDaImagem (A-06)', () => {
  it('fotosDaImagem conta as fotos que usam a imagem', () => {
    const fotos = [foto({ imagemId: id(1) }), foto({ imagemId: id(1) }), foto({ imagemId: id(2) }), vaga()];
    expect(fotosDaImagem(fotos, id(1))).toBe(2);
    expect(fotosDaImagem(fotos, id(3))).toBe(0);
  });

  it('usosDaImagem lista só as variantes que usam a imagem, com a quantidade', () => {
    const variantes = [
      { _id: id(201), fotos: [foto({ imagemId: id(1) }), foto({ imagemId: id(1) })] },
      { _id: id(202), fotos: [foto({ imagemId: id(2) })] },
      { _id: id(203), fotos: [foto({ imagemId: id(1) }), vaga()] },
    ];
    expect(usosDaImagem(variantes, id(1))).toEqual([
      { varianteId: id(201), vezes: 2 },
      { varianteId: id(203), vezes: 1 },
    ]);
    expect(usosDaImagem(variantes, id(9))).toEqual([]);
  });
});

describe('diasRestantes, restauravel e purgaVencida (RN-24, M4-07)', () => {
  it('arredonda para cima', () => {
    expect(diasRestantes(emDias(30), AGORA)).toBe(30);
    expect(diasRestantes(new Date(AGORA.getTime() + 29 * DIA + 1000), AGORA)).toBe(30);
    expect(diasRestantes(new Date(AGORA.getTime() + 1000), AGORA)).toBe(1);
  });

  it('vencida (agora ≥ purgaEm) devolve 0 ou menos', () => {
    expect(diasRestantes(AGORA, AGORA)).toBeLessThanOrEqual(0);
    expect(diasRestantes(emDias(-3), AGORA)).toBeLessThanOrEqual(0);
  });

  it('restauravel: excluída com prazo futuro', () => {
    expect(restauravel({ excluidaEm: AGORA, purgaEm: emDias(10) }, AGORA)).toBe(true);
  });

  it('restauravel: vencida, ativa ou sem prazo não', () => {
    expect(restauravel({ excluidaEm: emDias(-31), purgaEm: emDias(-1) }, AGORA)).toBe(false);
    expect(restauravel({ excluidaEm: AGORA, purgaEm: AGORA }, AGORA)).toBe(false);
    expect(restauravel({ excluidaEm: null, purgaEm: null }, AGORA)).toBe(false);
  });

  it('purgaVencida: purgaEm ≤ agora', () => {
    expect(purgaVencida({ purgaEm: emDias(-1) }, AGORA)).toBe(true);
    expect(purgaVencida({ purgaEm: AGORA }, AGORA)).toBe(true);
    expect(purgaVencida({ purgaEm: emDias(1) }, AGORA)).toBe(false);
    expect(purgaVencida({ purgaEm: null }, AGORA)).toBe(false);
  });
});

describe('recomendacaoDoPlaceholder (RF-30a, M4-08, A-09)', () => {
  const ativas = [{ _id: id(1), nomeOriginal: 'praia.jpg' }];

  it('devolve a imagem anterior quando está ativa', () => {
    expect(recomendacaoDoPlaceholder(vaga({ imagemAnteriorId: id(1) }), ativas)).toEqual(ativas[0]);
  });

  it('nula quando a anterior não está entre as ativas (excluída ou purgada)', () => {
    expect(recomendacaoDoPlaceholder(vaga({ imagemAnteriorId: id(2) }), ativas)).toBeNull();
  });

  it('nula quando não há imagem anterior', () => {
    expect(recomendacaoDoPlaceholder(vaga({ imagemAnteriorId: null }), ativas)).toBeNull();
  });

  it('nula quando a foto já tem imagem', () => {
    expect(recomendacaoDoPlaceholder(foto({ imagemId: id(5), imagemAnteriorId: id(1) }), ativas)).toBeNull();
  });
});
