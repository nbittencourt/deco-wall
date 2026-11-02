// Estado de salvamento (A-06, SV-08) e rascunho (M3-08, §4.6; docs/specs/M3-variantes-templates-e-salvamento.md).

export type EstadoDeSalvamento =
  | { tipo: 'conflito' }
  | { tipo: 'salvando' }
  | { tipo: 'alteracoes' }
  | { tipo: 'rascunho'; em: Date }
  | { tipo: 'salvo'; em: Date | undefined };

// A-06: conflito › salvando › alterações não salvas › rascunho salvo › salvo.
// `sujoOficial`: o conteúdo difere da versão oficial. `sujoRascunho`: mudou depois do último rascunho (ou do último
// salvamento oficial). Voltar por desfazer ao conteúdo oficial vale "Salvo" (M2 A-26).
export function estadoDeSalvamento(args: {
  conflito: boolean;
  salvando: boolean;
  sujoOficial: boolean;
  sujoRascunho: boolean;
  salvoEm: Date | undefined;
  rascunhoEm: Date | undefined;
}): EstadoDeSalvamento {
  if (args.conflito) return { tipo: 'conflito' };
  if (args.salvando) return { tipo: 'salvando' };
  if (args.sujoOficial) {
    if (args.sujoRascunho || !args.rascunhoEm) return { tipo: 'alteracoes' };
    return { tipo: 'rascunho', em: args.rascunhoEm };
  }
  return { tipo: 'salvo', em: args.salvoEm };
}

// §4.6: o rascunho elegível é o mais recente, de qualquer sessão, mais novo que a versão oficial.
export function rascunhoElegivel<T extends { salvoEm: Date }>(
  variante: { salvaEm: Date },
  rascunhos: readonly T[],
): T | null {
  let melhor: T | null = null;
  for (const r of rascunhos) {
    if (r.salvoEm.getTime() <= variante.salvaEm.getTime()) continue;
    if (!melhor || r.salvoEm.getTime() > melhor.salvoEm.getTime()) melhor = r;
  }
  return melhor;
}

// Base antiga: o servidor mudou a revisão sem salvar a variante (primeira escala, troca de parede).
export function rascunhoDesatualizado(
  rascunho: { revisaoBase: number },
  variante: { revisao: number },
): boolean {
  return rascunho.revisaoBase < variante.revisao;
}

// Obsoleto: não é mais novo que a versão oficial; o hard save o apaga (A-10).
export function rascunhoObsoleto(rascunho: { salvoEm: Date }, salvaEm: Date): boolean {
  return rascunho.salvoEm.getTime() <= salvaEm.getTime();
}
