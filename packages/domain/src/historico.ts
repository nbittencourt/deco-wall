import { LIMITE_HISTORICO } from './constantes';

// Pilha de desfazer/refazer (RF-70, RN-18, M2-02). Pura e imutável: guarda instantâneos do que é desfeito.
// A store mantém uma pilha por variante e decide quando registrar um passo (um por intenção do usuário).

export interface Historico<T> {
  passado: T[];
  futuro: T[];
}

export function criarHistorico<T>(): Historico<T> {
  return { passado: [], futuro: [] };
}

// Guarda o estado de antes da mudança. Uma mudança nova descarta o que dava para refazer.
export function registrar<T>(h: Historico<T>, anterior: T, limite: number = LIMITE_HISTORICO): Historico<T> {
  return { passado: [...h.passado, anterior].slice(-limite), futuro: [] };
}

export function desfazer<T>(h: Historico<T>, atual: T): { historico: Historico<T>; estado: T } | null {
  if (h.passado.length === 0) return null;
  const estado = h.passado[h.passado.length - 1]!;
  return {
    historico: { passado: h.passado.slice(0, -1), futuro: [...h.futuro, atual] },
    estado,
  };
}

export function refazer<T>(h: Historico<T>, atual: T): { historico: Historico<T>; estado: T } | null {
  if (h.futuro.length === 0) return null;
  const estado = h.futuro[h.futuro.length - 1]!;
  return {
    historico: { passado: [...h.passado, atual].slice(-LIMITE_HISTORICO), futuro: h.futuro.slice(0, -1) },
    estado,
  };
}

export const podeDesfazer = <T>(h: Historico<T>): boolean => h.passado.length > 0;
export const podeRefazer = <T>(h: Historico<T>): boolean => h.futuro.length > 0;
