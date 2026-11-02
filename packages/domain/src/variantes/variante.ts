import type { AreaUtil, Borda, FotoNaParede, Grid } from '../schemas';

// Operações de variante (M3-01, M3-02, M3-04, A-06, A-23; docs/specs/M3-variantes-templates-e-salvamento.md §4.1).

// O conteúdo salvável de uma variante (e de um rascunho): o que o hard save e o soft save gravam.
export interface ConteudoSalvavel {
  grid: Grid;
  bordaPadrao: Borda;
  areaUtil: AreaUtil | null;
  fotos: FotoNaParede[];
}

// M3-02: quantos placeholders (vagas sem foto) a composição tem.
export function semFoto(fotos: readonly Pick<FotoNaParede, 'imagemId'>[]): number {
  return fotos.filter((f) => f.imagemId === null).length;
}

const copiar = <T>(valor: T): T => structuredClone(valor);

// M3-04: duplicar copia o estado em tela; as fotos ganham ids novos (o domínio não gera ids).
export function copiarParaNovaVariante(conteudo: ConteudoSalvavel, novoId: () => string): ConteudoSalvavel {
  return {
    grid: copiar(conteudo.grid),
    bordaPadrao: copiar(conteudo.bordaPadrao),
    areaUtil: conteudo.areaUtil ? copiar(conteudo.areaUtil) : null,
    fotos: conteudo.fotos.map((f) => ({ ...copiar(f), _id: novoId() })),
  };
}

// Serialização estável (chaves ordenadas): compara por valor, sem depender da ordem das chaves.
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const chaves = Object.keys(valor).sort();
    return `{${chaves
      .map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor) ?? 'null';
}

// A-06: comparação estrutural do conteúdo (grid, borda padrão, área útil e fotos, na ordem da pilha).
export function conteudoIgual(a: ConteudoSalvavel, b: ConteudoSalvavel): boolean {
  return (
    canonico(a.grid) === canonico(b.grid) &&
    canonico(a.bordaPadrao) === canonico(b.bordaPadrao) &&
    canonico(a.areaUtil) === canonico(b.areaUtil) &&
    canonico(a.fotos) === canonico(b.fotos)
  );
}

// M3-01, A-23: a vaga vira foto. Mantém id, tamanho, posição, borda e imagemAnteriorId; o recorte volta a 0,0.
// Foto que já tem imagem não aceita outra (trocar a imagem é a RF-37, ideia futura).
export function preencherVaga(foto: FotoNaParede, imagemId: string): FotoNaParede {
  if (foto.imagemId !== null) return foto;
  return { ...foto, imagemId, recorte: { offsetX: 0, offsetY: 0 } };
}
