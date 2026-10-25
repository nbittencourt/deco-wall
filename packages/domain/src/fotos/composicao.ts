import { arredondarCm } from '../arredondar';
import { DESLOCAMENTO_DUPLICAR_CM, PASSO_CASCATA_CM, TOLERANCIA_CM } from '../constantes';
import type { AreaUtil, Borda, FotoNaParede, Pt, Tamanho } from '../schemas';
import { calcularAlertas, resumirAlertas } from './alertas';
import { caixaDaComposicao, encaixarPosicao } from './geometria';
import { tamanhoDaImagem, type OrientacaoEscolhida } from './tamanho';

// Composição: criar, posicionar, duplicar e ordenar fotos (RN-03, RN-04, RN-05, RN-13, B-06, M2-04, M2-05).
// Funções puras: devolvem objetos novos e nunca alteram os argumentos.

interface GridDaPosicao {
  snap: boolean;
  passoCm: number;
}
interface Externo {
  larguraCm: number;
  alturaCm: number;
}

const copiaBorda = (b: Borda): Borda => ({ larguraCm: b.larguraCm, cor: b.cor });
const copiaTamanho = (t: Tamanho): Tamanho => ({
  sugeridoId: t.sugeridoId,
  larguraCm: t.larguraCm,
  alturaCm: t.alturaCm,
});

// RN-03, RN-04: 10×15 na orientação natural da imagem, borda padrão, recorte centralizado.
export function criarFoto(args: {
  id: string;
  imagem: { _id: string; orientacaoNatural: OrientacaoEscolhida };
  bordaPadrao: Borda;
  posicao: Pt;
}): FotoNaParede {
  return {
    _id: args.id,
    imagemId: args.imagem._id,
    imagemAnteriorId: null,
    tamanho: tamanhoDaImagem(args.imagem.orientacaoNatural),
    xCm: args.posicao.x,
    yCm: args.posicao.y,
    recorte: { offsetX: 0, offsetY: 0 },
    borda: copiaBorda(args.bordaPadrao),
  };
}

function ajustar(p: Pt, grid: GridDaPosicao): Pt {
  return grid.snap ? encaixarPosicao(p, grid.passoCm) : { x: arredondarCm(p.x), y: arredondarCm(p.y) };
}

// M2-04: centro da área útil, encaixado no grid; em cascata se já houver foto exatamente no lugar.
export function posicaoInicial(args: {
  area: AreaUtil | null;
  fotos: readonly Pick<FotoNaParede, 'xCm' | 'yCm'>[];
  externo: Externo;
  grid: GridDaPosicao;
}): Pt {
  const { area, fotos, externo, grid } = args;
  if (!area) return { x: 0, y: 0 };
  let p = ajustar(
    {
      x: area.xCm + (area.larguraCm - externo.larguraCm) / 2,
      y: area.yCm + (area.alturaCm - externo.alturaCm) / 2,
    },
    grid,
  );
  const passo = grid.snap ? grid.passoCm : PASSO_CASCATA_CM;
  const ocupado = (q: Pt) =>
    fotos.some((f) => Math.abs(f.xCm - q.x) < TOLERANCIA_CM && Math.abs(f.yCm - q.y) < TOLERANCIA_CM);
  for (let i = 0; i < 1000 && ocupado(p); i += 1) {
    p = { x: arredondarCm(p.x + passo), y: arredondarCm(p.y + passo) };
  }
  return p;
}

// M2-04: o centro da foto vai para o ponto de soltura; o canto superior esquerdo é encaixado no grid.
export function posicaoDoDrop(args: { ponto: Pt; externo: Externo; grid: GridDaPosicao }): Pt {
  const { ponto, externo, grid } = args;
  return ajustar({ x: ponto.x - externo.larguraCm / 2, y: ponto.y - externo.alturaCm / 2 }, grid);
}

// B-06: a cópia vai um passo adiante (snap ligado) ou 5 cm (desligado), no topo da ordem.
export function duplicarFoto(foto: FotoNaParede, novoId: string, grid: GridDaPosicao): FotoNaParede {
  const deslocamento = grid.snap ? grid.passoCm : DESLOCAMENTO_DUPLICAR_CM;
  return {
    ...foto,
    _id: novoId,
    tamanho: copiaTamanho(foto.tamanho),
    recorte: { ...foto.recorte },
    borda: copiaBorda(foto.borda),
    xCm: arredondarCm(foto.xCm + deslocamento),
    yCm: arredondarCm(foto.yCm + deslocamento),
  };
}

// O array é o z-index: o último fica por cima.
export function trazerParaFrente(fotos: readonly FotoNaParede[], id: string): FotoNaParede[] {
  const alvo = fotos.find((f) => f._id === id);
  if (!alvo) return [...fotos];
  return [...fotos.filter((f) => f._id !== id), alvo];
}

export function enviarParaTras(fotos: readonly FotoNaParede[], id: string): FotoNaParede[] {
  const alvo = fotos.find((f) => f._id === id);
  if (!alvo) return [...fotos];
  return [alvo, ...fotos.filter((f) => f._id !== id)];
}

// RN-05, M2-05: o canto superior esquerdo externo não se mexe; o recorte volta ao centro.
export function aplicarTamanho(foto: FotoNaParede, tamanho: Tamanho): FotoNaParede {
  return { ...foto, tamanho: copiaTamanho(tamanho), recorte: { offsetX: 0, offsetY: 0 } };
}

export function aplicarBorda(foto: FotoNaParede, borda: Borda): FotoNaParede {
  return { ...foto, borda: copiaBorda(borda) };
}

export function resumoDaComposicao(
  fotos: readonly FotoNaParede[],
  paredeInteira: AreaUtil | null,
  areaUtil: AreaUtil | null,
): { quantidade: number; caixa: AreaUtil | null; comSobreposicao: number; foraDosLimites: number } {
  return {
    quantidade: fotos.length,
    caixa: caixaDaComposicao(fotos),
    ...resumirAlertas(calcularAlertas(fotos, paredeInteira, areaUtil)),
  };
}
