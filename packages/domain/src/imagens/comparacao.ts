// Comparação de variantes (RN-36, M4-02, A-21, M3-10).

export type PainelComparacao = 'esquerdo' | 'direito';
export type ParComparacao = [string, string];

// RN-36: a escolha vale só para o painel em que o usuário escolheu; a mesma variante pode estar nos dois.
export function escolherVarianteDoPainel(
  par: Readonly<ParComparacao>,
  painel: PainelComparacao,
  varianteId: string,
): ParComparacao {
  return painel === 'esquerdo' ? [varianteId, par[1]] : [par[0], varianteId];
}

// M3-10: a ativa à esquerda e a seguinte na ordem à direita (a anterior, se a ativa for a última).
export function parInicial(
  variantes: readonly { _id: string }[],
  ativaId: string | null | undefined,
): ParComparacao | null {
  const i = variantes.findIndex((v) => v._id === ativaId);
  const outra = variantes[i + 1] ?? variantes[i - 1];
  return i >= 0 && outra ? [variantes[i]!._id, outra._id] : null;
}
