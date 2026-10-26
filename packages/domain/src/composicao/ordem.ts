import type { FotoNaParede } from '../schemas';

// Ordem (RF-35, M2-08, A-24): o array `fotos` é o z-index, e a última fica por cima. Cada chamada anda UMA
// posição; no topo (ou no fundo) não muda nada.

function trocar(fotos: readonly FotoNaParede[], id: string, deslocamento: 1 | -1): FotoNaParede[] {
  const copia = [...fotos];
  const i = copia.findIndex((f) => f._id === id);
  const j = i + deslocamento;
  if (i < 0 || j < 0 || j >= copia.length) return copia;
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

export const trazerParaFrente = (fotos: readonly FotoNaParede[], id: string): FotoNaParede[] =>
  trocar(fotos, id, 1);

export const enviarParaTras = (fotos: readonly FotoNaParede[], id: string): FotoNaParede[] =>
  trocar(fotos, id, -1);
