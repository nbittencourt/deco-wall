import { describe, expect, it } from 'vitest';
import { HISTORICO_LIMITE } from './constantes';
import {
  criarHistorico,
  desfazer,
  podeDesfazer,
  podeRefazer,
  refazer,
  registrar,
  type Historico,
} from './historico';

// Pilha de desfazer/refazer (RF-70, RN-18, M2-02): pura, um passo por intenção, limite de 100.

describe('historico', () => {
  it('nasce vazio', () => {
    const h = criarHistorico<number>();
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(false);
    expect(desfazer(h, 1)).toBeNull();
    expect(refazer(h, 1)).toBeNull();
  });

  it('o limite é de 100 passos', () => {
    expect(HISTORICO_LIMITE).toBe(100);
  });

  it('registrar guarda o estado anterior; desfazer devolve-o e guarda o atual para refazer', () => {
    let h = registrar(criarHistorico<string>(), 'A'); // A → B
    expect(podeDesfazer(h)).toBe(true);

    const volta = desfazer(h, 'B')!;
    expect(volta.estado).toBe('A');
    h = volta.historico;
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(true);

    const avanca = refazer(h, 'A')!;
    expect(avanca.estado).toBe('B');
    expect(podeDesfazer(avanca.historico)).toBe(true);
    expect(podeRefazer(avanca.historico)).toBe(false);
  });

  it('desfaz na ordem inversa', () => {
    let h = criarHistorico<number>();
    h = registrar(h, 1); // 1 → 2
    h = registrar(h, 2); // 2 → 3
    const a = desfazer(h, 3)!;
    expect(a.estado).toBe(2);
    const b = desfazer(a.historico, 2)!;
    expect(b.estado).toBe(1);
    expect(desfazer(b.historico, 1)).toBeNull();
  });

  it('um passo novo descarta o que dava para refazer', () => {
    let h = registrar(criarHistorico<number>(), 1);
    h = desfazer(h, 2)!.historico;
    expect(podeRefazer(h)).toBe(true);
    h = registrar(h, 1);
    expect(podeRefazer(h)).toBe(false);
  });

  it('acima do limite, descarta os passos mais antigos', () => {
    let h: Historico<number> = criarHistorico<number>();
    for (let i = 0; i < 5; i += 1) h = registrar(h, i, 3);
    expect(h.passado).toEqual([2, 3, 4]);
  });

  it('o limite padrão é HISTORICO_LIMITE', () => {
    let h: Historico<number> = criarHistorico<number>();
    for (let i = 0; i < HISTORICO_LIMITE + 10; i += 1) h = registrar(h, i);
    expect(h.passado).toHaveLength(HISTORICO_LIMITE);
    expect(h.passado[0]).toBe(10);
  });

  it('não altera o histórico recebido', () => {
    const h = registrar(criarHistorico<number>(), 1);
    desfazer(h, 2);
    registrar(h, 9);
    expect(h.passado).toEqual([1]);
    expect(h.futuro).toEqual([]);
  });
});
