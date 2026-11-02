import type { FotoNaParede } from '../schemas';

// Ciclo de vida das imagens (RF-29, RF-30a, RN-24, M4-04 a M4-09, A-06, A-09;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.1). Funções puras: o relógio chega como parâmetro.

const DIA_MS = 86_400_000;

// M4-05: a foto vira placeholder e guarda a imagem como recomendação; formato, posição, borda e recorte ficam.
export function converterEmPlaceholder(foto: FotoNaParede, imagemId: string): FotoNaParede {
  return { ...foto, imagemId: null, imagemAnteriorId: imagemId };
}

// M4-04: remover do projeto tira as fotos da imagem (sem virar placeholder). Placeholders não são fotos da imagem.
export function removerFotosDaImagem(
  fotos: readonly FotoNaParede[],
  imagemId: string,
): { fotos: FotoNaParede[]; removidas: number } {
  const restantes = fotos.filter((f) => f.imagemId !== imagemId);
  return { fotos: restantes, removidas: fotos.length - restantes.length };
}

export function fotosDaImagem(fotos: readonly Pick<FotoNaParede, 'imagemId'>[], imagemId: string): number {
  return fotos.filter((f) => f.imagemId === imagemId).length;
}

// A-06: as variantes que usam a imagem e quantas vezes cada uma.
export function usosDaImagem(
  variantes: readonly { _id: string; fotos: readonly Pick<FotoNaParede, 'imagemId'>[] }[],
  imagemId: string,
): { varianteId: string; vezes: number }[] {
  return variantes
    .map((v) => ({ varianteId: v._id, vezes: fotosDaImagem(v.fotos, imagemId) }))
    .filter((uso) => uso.vezes > 0);
}

// M4-07: dias até a purga, arredondado para cima; 0 ou menos = vencida.
export function diasRestantes(purgaEm: Date, agora: Date): number {
  return Math.ceil((purgaEm.getTime() - agora.getTime()) / DIA_MS);
}

type MarcasDeExclusao = { excluidaEm: Date | null; purgaEm: Date | null };

// M4-07: só a imagem excluída e ainda dentro do prazo pode ser restaurada.
export function restauravel(imagem: MarcasDeExclusao, agora: Date): boolean {
  return imagem.excluidaEm !== null && imagem.purgaEm !== null && diasRestantes(imagem.purgaEm, agora) > 0;
}

// M4-09: a purga pega as imagens com purgaEm ≤ agora.
export function purgaVencida(imagem: { purgaEm: Date | null }, agora: Date): boolean {
  return imagem.purgaEm !== null && imagem.purgaEm.getTime() <= agora.getTime();
}

// M4-08, A-09: a imagem anterior só é recomendada se estiver ativa e o placeholder ainda estiver vazio.
export function recomendacaoDoPlaceholder<T extends { _id: string }>(
  foto: Pick<FotoNaParede, 'imagemId' | 'imagemAnteriorId'>,
  imagensAtivas: readonly T[],
): T | null {
  if (foto.imagemId !== null || foto.imagemAnteriorId === null) return null;
  return imagensAtivas.find((i) => i._id === foto.imagemAnteriorId) ?? null;
}
