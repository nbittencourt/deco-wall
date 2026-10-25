import type { AreaUtil, Borda, Grid, OffsetRecorte, Pt, Tamanho } from '@deco-wall/domain';

// Descrição, em dados, do que o Palco desenha. Não importa Konva: as telas montam a cena e o Palco
// (único módulo que fala com o Konva) a desenha. Assim as telas rodam nos testes de componente (jsdom).
//
// Unidade do conteúdo: cm no editor e na Área útil (parede com escala); px da foto nos modos Perspectiva e
// Calibração e na parede sem escala.

export interface RetanguloConteudo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

// Uma foto posicionada, pronta para desenhar (spec M2 §3.3). `imagem` é null quando a imagem não está na
// biblioteca carregada: a foto aparece como um retângulo neutro, continua selecionável e movível.
export interface FotoCena {
  id: string;
  nome: string;
  xCm: number;
  yCm: number;
  tamanho: Tamanho;
  borda: Borda;
  recorte: OffsetRecorte;
  imagem: { url: string; larguraPx: number; alturaPx: number } | null;
}

// Modo de recorte (RN-14): a foto que está sendo enquadrada, com o rascunho de tamanho e recorte.
export interface RecorteCena {
  foto: FotoCena;
  tamanho: Tamanho;
  offset: OffsetRecorte;
  onOffsetChange: (offset: OffsetRecorte) => void;
}

export interface CenaParede {
  tipo: 'parede';
  // Muda quando o enquadramento inicial deve ser refeito (outro modo, outra parede, outra escala).
  chave: string;
  imagemUrl: string;
  // Onde a imagem fica no espaço do conteúdo.
  imagem: RetanguloConteudo;
  // px do bitmap por unidade do conteúdo (pxPorCm com escala; 1 sem escala). 100% de zoom = 1 px do bitmap.
  pxPorUnidade: number;
  comEscala: boolean;
  paredeInteira: AreaUtil | null;
  grid: Grid | null;
  areaUtil: AreaUtil | null;
  // M2: fotos na parede, em ordem de empilhamento (a última fica por cima).
  fotos: FotoCena[];
  selecaoId: string | null;
  // Só no editor as fotos reagem ao mouse (selecionar, arrastar, duplo clique).
  interativa: boolean;
  onSelecionar?: (id: string | null) => void;
  // Chamado uma vez, ao soltar a foto arrastada (já encaixada no grid, se o snap estiver ligado).
  onMoverFoto?: (id: string, xCm: number, yCm: number) => void;
  onAbrirRecorte?: (id: string) => void;
}

export interface CenaAreaUtil extends Omit<CenaParede, 'tipo'> {
  tipo: 'area-util';
  area: AreaUtil;
  onAreaChange: (area: AreaUtil) => void;
}

export interface CenaRecorte extends Omit<CenaParede, 'tipo'> {
  tipo: 'recorte';
  recorte: RecorteCena;
}

export interface CenaPerspectiva {
  tipo: 'perspectiva';
  chave: string;
  imagemUrl: string;
  larguraPx: number;
  alturaPx: number;
  // Os quatro cantos na ordem das alças (reordenados só ao soltar).
  cantos: Pt[];
  // `final` é verdadeiro ao soltar a alça (momento de reordenar e invalidar a prévia).
  onCantosChange: (cantos: Pt[], final: boolean) => void;
}

export interface CenaCalibracao {
  tipo: 'calibracao';
  chave: string;
  imagemUrl: string;
  larguraPx: number;
  alturaPx: number;
  p1: Pt;
  p2: Pt;
  onSegmentoChange: (p1: Pt, p2: Pt) => void;
}

export type Cena = CenaParede | CenaAreaUtil | CenaRecorte | CenaPerspectiva | CenaCalibracao;

export interface EstadoPalco {
  zoomPercentual: number;
  // O grid está ligado, mas o passo na tela ficou abaixo de 4 px (A-07).
  gridOculto: boolean;
}

// Comandos que a toolbar do editor dá ao palco.
export interface PalcoApi {
  zoomMais: () => void;
  zoomMenos: () => void;
  ajustar: () => void;
  // Ponto da página (clientX/clientY de um evento) no espaço do conteúdo atual (cm); usado ao soltar
  // uma miniatura da biblioteca sobre o canvas. null antes do enquadramento inicial.
  dePaginaParaConteudo: (clientX: number, clientY: number) => Pt | null;
}
