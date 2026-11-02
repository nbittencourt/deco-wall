import { describe, expect, it } from 'vitest';
import { escolherVarianteDoPainel, parInicial } from './comparacao';

// Comparação de variantes sem troca de lados (RN-36, M4-02, A-21; M3-10 para a abertura).

describe('escolherVarianteDoPainel (RN-36)', () => {
  it('muda só o painel indicado', () => {
    expect(escolherVarianteDoPainel(['A', 'B'], 'esquerdo', 'C')).toEqual(['C', 'B']);
    expect(escolherVarianteDoPainel(['A', 'B'], 'direito', 'C')).toEqual(['A', 'C']);
  });

  it('aceita a mesma variante nos dois painéis, sem trocar os lados', () => {
    expect(escolherVarianteDoPainel(['A', 'B'], 'direito', 'A')).toEqual(['A', 'A']);
    expect(escolherVarianteDoPainel(['A', 'B'], 'esquerdo', 'B')).toEqual(['B', 'B']);
  });

  it('sequência A/B → B/B → C/B: escolher outra no primeiro não mexe no segundo', () => {
    const p1 = escolherVarianteDoPainel(['A', 'B'], 'esquerdo', 'B');
    expect(p1).toEqual(['B', 'B']);
    expect(escolherVarianteDoPainel(p1, 'esquerdo', 'C')).toEqual(['C', 'B']);
  });

  it('não altera o par recebido', () => {
    const par: [string, string] = ['A', 'B'];
    escolherVarianteDoPainel(par, 'esquerdo', 'C');
    expect(par).toEqual(['A', 'B']);
  });
});

describe('parInicial (M3-10)', () => {
  const lista = [{ _id: 'A' }, { _id: 'B' }, { _id: 'C' }];

  it('a ativa à esquerda e a seguinte na ordem à direita', () => {
    expect(parInicial(lista, 'A')).toEqual(['A', 'B']);
    expect(parInicial(lista, 'B')).toEqual(['B', 'C']);
  });

  it('se a ativa é a última, a anterior fica à direita', () => {
    expect(parInicial(lista, 'C')).toEqual(['C', 'B']);
  });

  it('null com menos de 2 variantes ou ativa desconhecida', () => {
    expect(parInicial([{ _id: 'A' }], 'A')).toBeNull();
    expect(parInicial([], 'A')).toBeNull();
    expect(parInicial(lista, 'Z')).toBeNull();
    expect(parInicial(lista, null)).toBeNull();
  });
});
