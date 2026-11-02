import { arredondarCm } from '../arredondar';
import type { AreaUtil } from '../schemas';

// Catálogo de templates (RF-93, TPL-07, TPL-08; docs/specs/templates.md): 12 modelos, uma célula por vaga, em cm,
// com a origem (0,0) no canto superior esquerdo do conjunto. Transcrição fiel do documento; o teste do catálogo
// confere cada linha contra ele.

export interface CelulaTemplate {
  xCm: number;
  yCm: number;
  larguraCm: number;
  alturaCm: number;
}

export interface Template {
  id: string;
  nome: string;
  celulas: readonly CelulaTemplate[];
}

const c = (xCm: number, yCm: number, larguraCm: number, alturaCm: number): CelulaTemplate => ({
  xCm,
  yCm,
  larguraCm,
  alturaCm,
});

export const TEMPLATES: readonly Template[] = [
  {
    id: 'piramide',
    nome: 'Pirâmide',
    celulas: [
      c(66.2, 0, 27.9, 35.6),
      c(100.2, 9.4, 30.5, 30.5),
      c(35.4, 19.6, 25.4, 50.8),
      c(0, 39.9, 30.5, 30.5),
      c(64.9, 39.9, 30.5, 30.5),
      c(100.2, 45.2, 50.8, 25.4),
    ],
  },
  {
    id: 'escada',
    nome: 'Escada',
    celulas: [
      c(0, 0, 25.4, 30.5),
      c(29.9, 4.3, 20.3, 25.4),
      c(55.5, 8.8, 15.2, 20.3),
      c(1.2, 33, 20.3, 20.3),
      c(24.6, 32.4, 20.3, 25.4),
      c(48.9, 33.4, 21, 29.7),
    ],
  },
  {
    id: 'simetria-dividida',
    nome: 'Simetria dividida',
    celulas: [
      c(66.7, 0, 40.6, 50.8),
      c(32, 9.9, 30.5, 40.6),
      c(7, 25.1, 20.3, 25.4),
      c(112.1, 25.1, 20.3, 25.4),
      c(136.8, 30.2, 15.2, 20.3),
      c(99.7, 54.9, 27.9, 35.6),
      c(132.1, 54.9, 15.2, 20.3),
      c(0, 55.3, 15.2, 20.3),
      c(19.7, 55.2, 40.6, 50.8),
      c(64.7, 55.3, 30.5, 40.6),
    ],
  },
  {
    id: 'centralizado',
    nome: 'Centralizado',
    celulas: [
      c(2.3, 0, 20.3, 25.4),
      c(64.2, 0, 20.3, 25.4),
      c(29.7, 1.3, 27.9, 35.6),
      c(0, 28.3, 25.4, 20.3),
      c(61.6, 28.3, 25.4, 20.3),
      c(29.7, 40.2, 27.9, 35.6),
      c(2.3, 51.7, 20.3, 25.4),
      c(64.2, 51.7, 20.3, 25.4),
    ],
  },
  {
    id: 'equilibrado',
    nome: 'Equilibrado',
    celulas: [
      c(0, 0, 30.5, 25.4),
      c(33.6, 0.1, 30.5, 40.6),
      c(67.2, 0, 30.5, 25.4),
      c(100.8, 0.1, 30.5, 40.6),
      c(0, 28.4, 30.5, 40.6),
      c(67.2, 28.4, 30.5, 40.6),
      c(33.6, 43.4, 30.5, 25.4),
      c(100.8, 43.4, 30.5, 25.4),
    ],
  },
  {
    id: 'base-nivelada',
    nome: 'Base nivelada',
    celulas: [
      c(35.4, 0, 30.5, 40.6),
      c(81, 4.6, 20.3, 25.4),
      c(121.1, 14.6, 20.3, 25.4),
      c(10.1, 15.3, 20.3, 25.4),
      c(70.5, 34.7, 40.6, 50.8),
      c(151.4, 40.2, 15.2, 20.3),
      c(116, 44.8, 30.5, 40.6),
      c(0, 45.1, 30.5, 40.6),
      c(35.4, 45.1, 30.5, 40.6),
      c(151.4, 65.3, 15.2, 20.3),
    ],
  },
  {
    id: 'grade',
    nome: 'Grade',
    celulas: [
      c(0, 0, 20.3, 20.3),
      c(25.1, 0, 20.3, 20.3),
      c(50.1, 0, 20.3, 20.3),
      c(0, 24.6, 20.3, 20.3),
      c(25.1, 24.6, 20.3, 20.3),
      c(50.1, 24.6, 20.3, 20.3),
      c(0, 49.2, 20.3, 20.3),
      c(25.1, 49.2, 20.3, 20.3),
      c(50.1, 49.2, 20.3, 20.3),
    ],
  },
  {
    id: 'mini-salao',
    nome: 'Mini salão',
    celulas: [
      c(24.8, 0, 21, 29.7),
      c(0, 4.4, 20.3, 25.4),
      c(50.6, 8.6, 15.2, 20.3),
      c(8.2, 33.4, 20.3, 20.3),
      c(32.6, 33.4, 20.3, 25.4),
    ],
  },
  {
    id: 'cata-vento',
    nome: 'Cata-vento',
    celulas: [c(41.2, 0, 27.9, 35.6), c(0, 7.6, 35.6, 27.9), c(7.8, 41, 27.9, 35.6), c(41, 41.2, 35.6, 27.9)],
  },
  {
    id: 'mondrian',
    nome: 'Mondrian',
    celulas: [
      c(0, 0, 40.6, 50.8),
      c(42.9, 1.6, 30.5, 25.4),
      c(43.9, 30.5, 12.7, 17.8),
      c(59.5, 30.5, 12.7, 17.8),
    ],
  },
  {
    id: 'espiral',
    nome: 'Espiral',
    celulas: [
      c(0, 0, 20.3, 30.5),
      c(23.8, 0.1, 20.3, 20.3),
      c(47.1, 0.1, 30.5, 20.3),
      c(23.6, 24.5, 30.5, 30.5),
      c(57.4, 24.4, 20.3, 20.3),
      c(0.5, 34.6, 20.3, 20.3),
      c(57.4, 49, 20.3, 30.5),
      c(0.3, 59.1, 30.5, 20.3),
      c(33.7, 59.1, 20.3, 20.3),
    ],
  },
  {
    id: 'trio',
    nome: 'Trio',
    celulas: [c(23.7, 0, 29.7, 42), c(0, 6.3, 21, 29.7), c(56.2, 6.3, 21, 29.7)],
  },
];

// Caixa que une as células: o total do modelo (largura e altura).
export function totalDoTemplate(template: Template): Pick<AreaUtil, 'larguraCm' | 'alturaCm'> {
  const minX = Math.min(...template.celulas.map((c) => c.xCm));
  const minY = Math.min(...template.celulas.map((c) => c.yCm));
  return {
    larguraCm: arredondarCm(Math.max(...template.celulas.map((c) => c.xCm + c.larguraCm)) - minX),
    alturaCm: arredondarCm(Math.max(...template.celulas.map((c) => c.yCm + c.alturaCm)) - minY),
  };
}

export function templatePorId(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
