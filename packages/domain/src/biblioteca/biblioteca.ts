// Biblioteca de imagens (RF-22, RF-28, RN-04, M2-05; docs/specs/M2-biblioteca-e-composicao.md §4.1).

export type OrientacaoNatural = 'retrato' | 'paisagem';

// RN-04: largura maior que a altura é paisagem; senão, retrato (a quadrada vale retrato).
export function orientacaoNatural(larguraPx: number, alturaPx: number): OrientacaoNatural {
  return larguraPx > alturaPx ? 'paisagem' : 'retrato';
}

// "Excluídas" é do M4 (M2-07).
export type FiltroBiblioteca = 'todas' | 'projeto' | 'variante';

// M2-05: os filtros mostram só o estado salvo. "Projeto" = imagens com o projeto em `projetos`; "Variante" =
// imagens das fotos da última versão salva da variante. Foto adicionada e ainda não salva não entra.
export function filtrarBiblioteca<T extends { _id: string; projetos: readonly string[] }>(
  imagens: readonly T[],
  filtro: FiltroBiblioteca,
  contexto: { projetoId: string; fotosSalvas: readonly { imagemId: string | null }[] },
): T[] {
  if (filtro === 'todas') return [...imagens];
  if (filtro === 'projeto') return imagens.filter((i) => i.projetos.includes(contexto.projetoId));
  const usadas = new Set(contexto.fotosSalvas.flatMap((f) => (f.imagemId ? [f.imagemId] : [])));
  return imagens.filter((i) => usadas.has(i._id));
}
