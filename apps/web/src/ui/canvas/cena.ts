import type { AreaUtil, Grid, Pt } from '@deco-wall/domain';

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
}

export interface CenaAreaUtil extends Omit<CenaParede, 'tipo'> {
  tipo: 'area-util';
  area: AreaUtil;
  onAreaChange: (area: AreaUtil) => void;
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

export type Cena = CenaParede | CenaAreaUtil | CenaPerspectiva | CenaCalibracao;

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
}
