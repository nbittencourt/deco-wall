import { arredondarCm } from '../arredondar';
import {
  CASCATA_TENTATIVAS,
  DESLOCAMENTO_SEM_SNAP_CM,
  TAMANHO_PADRAO_ID,
  TOLERANCIA_CM,
} from '../constantes';
import type { AreaUtil, Borda, FotoNaParede, Pt, Tamanho } from '../schemas';
import { encaixarPosicao, type GridDeSnap } from './snap';
import { tamanhoExterno, tamanhoSugerido, type OrientacaoEscolhida } from './tamanho';

// Foto na parede (RN-02, RN-03, RN-04, RN-05, RN-13; M2-09, M2-10, A-04, A-25;
// docs/specs/M2-biblioteca-e-composicao.md §4.1). Funções puras: devolvem objetos novos e nunca alteram os
// argumentos. O domínio não gera ids: o id chega como parâmetro.

const copiaBorda = (b: Borda): Borda => ({ larguraCm: b.larguraCm, cor: b.cor });
const copiaTamanho = (t: Tamanho): Tamanho => ({
  sugeridoId: t.sugeridoId,
  larguraCm: t.larguraCm,
  alturaCm: t.alturaCm,
});

// O deslocamento da cascata e da cópia: um passo do grid com snap; 5 cm sem snap (A-04, A-25).
const passoDeDeslocamento = (grid: GridDeSnap) => (grid.snap ? grid.passoCm : DESLOCAMENTO_SEM_SNAP_CM);

// RN-03, RN-04, A-04: 10×15 na orientação natural da imagem, borda padrão, recorte centralizado. O centro do
// retângulo externo vai para `centroCm` (centro da área útil no botão; ponto de soltura no arraste), com o canto
// superior esquerdo encaixado no grid. Se outra foto já tem o mesmo canto, a nova desloca em cascata, até 10 vezes.
export function novaFoto(args: {
  id: string;
  imagem: { _id: string; orientacaoNatural: OrientacaoEscolhida };
  bordaPadrao: Borda;
  centroCm: Pt;
  grid: GridDeSnap;
  fotos?: readonly Pick<FotoNaParede, 'xCm' | 'yCm'>[];
}): FotoNaParede {
  const tamanho = tamanhoSugerido(TAMANHO_PADRAO_ID, args.imagem.orientacaoNatural);
  const borda = copiaBorda(args.bordaPadrao);
  const externo = tamanhoExterno(tamanho, borda);

  let p = encaixarPosicao(
    { x: args.centroCm.x - externo.larguraCm / 2, y: args.centroCm.y - externo.alturaCm / 2 },
    args.grid,
  );
  const passo = passoDeDeslocamento(args.grid);
  const ocupado = (q: Pt) =>
    (args.fotos ?? []).some(
      (f) => Math.abs(f.xCm - q.x) < TOLERANCIA_CM && Math.abs(f.yCm - q.y) < TOLERANCIA_CM,
    );
  for (let i = 0; i < CASCATA_TENTATIVAS && ocupado(p); i += 1) {
    p = { x: arredondarCm(p.x + passo), y: arredondarCm(p.y + passo) };
  }

  return {
    _id: args.id,
    imagemId: args.imagem._id,
    imagemAnteriorId: null,
    tamanho,
    xCm: p.x,
    yCm: p.y,
    recorte: { offsetX: 0, offsetY: 0 },
    borda,
  };
}

// RN-06: o retângulo do tamanho externo, com o canto superior esquerdo em (xCm, yCm).
export function retanguloExterno(foto: Pick<FotoNaParede, 'xCm' | 'yCm' | 'tamanho' | 'borda'>): AreaUtil {
  return { xCm: foto.xCm, yCm: foto.yCm, ...tamanhoExterno(foto.tamanho, foto.borda) };
}

// RN-05, M2-09: o canto superior esquerdo externo não se mexe; o recorte volta ao centro.
export function mudarTamanho(foto: FotoNaParede, tamanho: Tamanho): FotoNaParede {
  return { ...foto, tamanho: copiaTamanho(tamanho), recorte: { offsetX: 0, offsetY: 0 } };
}

// RN-02, M2-10: a borda soma por fora; o canto superior esquerdo externo não se mexe (a área impressa se
// desloca), e o recorte não muda porque a área impressa tem o mesmo tamanho.
export function mudarBorda(foto: FotoNaParede, borda: Borda): FotoNaParede {
  return { ...foto, borda: copiaBorda(borda) };
}

// A-25: copia imagem, tamanho, borda e recorte; a cópia sai 1 passo (snap) ou 5 cm (sem snap) adiante em X e Y.
export function duplicarFoto(foto: FotoNaParede, novoId: string, grid: GridDeSnap): FotoNaParede {
  const passo = passoDeDeslocamento(grid);
  const p = encaixarPosicao({ x: foto.xCm + passo, y: foto.yCm + passo }, grid);
  return {
    ...foto,
    _id: novoId,
    tamanho: copiaTamanho(foto.tamanho),
    recorte: { ...foto.recorte },
    borda: copiaBorda(foto.borda),
    xCm: p.x,
    yCm: p.y,
  };
}
