import type { ImagemDto } from '../infra/dto';

// Filtros da biblioteca (RF-28, B-08). "Excluídas" é do M4. A lista vem da API na ordem de exibição.
export type FiltroBiblioteca = 'todas' | 'projeto' | 'variante';

// "Projeto" = carregada no projeto (`imagens.projetos`) OU usada numa foto da variante aberta — esta
// segunda parte inclui o que ainda não foi salvo (a API só registra o projeto no salvamento, DM-05).
export function filtrarImagens(
  imagens: readonly ImagemDto[],
  filtro: FiltroBiblioteca,
  projetoId: string,
  fotos: readonly { imagemId: string | null }[],
): ImagemDto[] {
  if (filtro === 'todas') return [...imagens];
  const usadas = new Set(fotos.flatMap((f) => (f.imagemId ? [f.imagemId] : [])));
  if (filtro === 'variante') return imagens.filter((i) => usadas.has(i._id));
  return imagens.filter((i) => i.projetos.includes(projetoId) || usadas.has(i._id));
}
