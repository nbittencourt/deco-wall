import { describe, expect, it } from 'vitest';
import { foto as fotoFixture, id } from '../../../../tests/fixtures/dominio';
import type { FotoNaParede } from '../schemas';
import { enviarParaTras, trazerParaFrente } from './ordem';

// Ordem (RF-35, M2-08, A-24): o array é o z-index; cada clique anda UMA posição.

const foto = (n: number) => fotoFixture({ _id: id(n) }) as FotoNaParede;
const ids = (fotos: FotoNaParede[]) => fotos.map((f) => f._id);
const pilha = [foto(1), foto(2), foto(3), foto(4)];

describe('trazerParaFrente', () => {
  it('troca a foto com a seguinte na pilha', () => {
    expect(ids(trazerParaFrente(pilha, id(2)))).toEqual([id(1), id(3), id(2), id(4)]);
    expect(ids(trazerParaFrente(pilha, id(1)))).toEqual([id(2), id(1), id(3), id(4)]);
  });

  it('no topo, não muda', () => {
    expect(ids(trazerParaFrente(pilha, id(4)))).toEqual([id(1), id(2), id(3), id(4)]);
  });

  it('id desconhecido: não muda', () => {
    expect(ids(trazerParaFrente(pilha, id(99)))).toEqual(ids(pilha));
  });
});

describe('enviarParaTras', () => {
  it('troca a foto com a anterior na pilha', () => {
    expect(ids(enviarParaTras(pilha, id(3)))).toEqual([id(1), id(3), id(2), id(4)]);
    expect(ids(enviarParaTras(pilha, id(4)))).toEqual([id(1), id(2), id(4), id(3)]);
  });

  it('no fundo, não muda', () => {
    expect(ids(enviarParaTras(pilha, id(1)))).toEqual([id(1), id(2), id(3), id(4)]);
  });

  it('não altera o array recebido', () => {
    enviarParaTras(pilha, id(3));
    trazerParaFrente(pilha, id(2));
    expect(ids(pilha)).toEqual([id(1), id(2), id(3), id(4)]);
  });
});
