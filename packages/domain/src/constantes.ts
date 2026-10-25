// Constantes de negócio do domínio (PRD §6 e docs/specs/M0-setup.md §5.2).

export type GrupoTamanho = 'padrao' | 'quadrado' | 'grande';

export interface TamanhoSugerido {
  id: string;
  menorCm: number;
  maiorCm: number;
  grupo: GrupoTamanho;
}

// RN-01 / FMT-01: lados em cm, menor × maior. Ordem de exibição dentro de cada grupo.
export const TAMANHOS_SUGERIDOS: readonly TamanhoSugerido[] = [
  { id: '10x15', menorCm: 10, maiorCm: 15, grupo: 'padrao' },
  { id: '13x18', menorCm: 13, maiorCm: 18, grupo: 'padrao' },
  { id: '15x21', menorCm: 15, maiorCm: 21, grupo: 'padrao' },
  { id: '20x25', menorCm: 20, maiorCm: 25, grupo: 'padrao' },
  { id: '20x30', menorCm: 20, maiorCm: 30, grupo: 'padrao' },
  { id: '13x13', menorCm: 13, maiorCm: 13, grupo: 'quadrado' },
  { id: '15x15', menorCm: 15, maiorCm: 15, grupo: 'quadrado' },
  { id: '30x40', menorCm: 30, maiorCm: 40, grupo: 'grande' },
  { id: '30x45', menorCm: 30, maiorCm: 45, grupo: 'grande' },
  { id: '40x50', menorCm: 40, maiorCm: 50, grupo: 'grande' },
  { id: '40x60', menorCm: 40, maiorCm: 60, grupo: 'grande' },
  { id: '50x60', menorCm: 50, maiorCm: 60, grupo: 'grande' },
  { id: '50x70', menorCm: 50, maiorCm: 70, grupo: 'grande' },
  { id: '60x80', menorCm: 60, maiorCm: 80, grupo: 'grande' },
  { id: '60x90', menorCm: 60, maiorCm: 90, grupo: 'grande' },
  { id: '70x100', menorCm: 70, maiorCm: 100, grupo: 'grande' },
  { id: '75x120', menorCm: 75, maiorCm: 120, grupo: 'grande' },
];

// RN-28: tamanho personalizado, por lado, em cm.
export const LIMITE_PERSONALIZADO_CM = { min: 5, max: 150, passo: 0.1 } as const;

export type Perfil = 'leve' | 'medio' | 'alto';

// ADR-05: lado maior das fotos e da parede (px) e qualidade do WebP por perfil.
export const PERFIS: Record<Perfil, { ladoFotoPx: number; ladoParedePx: number; qualidadeWebp: number }> = {
  leve: { ladoFotoPx: 1024, ladoParedePx: 3072, qualidadeWebp: 0.8 },
  medio: { ladoFotoPx: 2048, ladoParedePx: 4096, qualidadeWebp: 0.85 },
  alto: { ladoFotoPx: 3072, ladoParedePx: 6144, qualidadeWebp: 0.9 },
};

export const PERFIL_PADRAO: Perfil = 'leve'; // RF-25

// RN-15 / A-08: passo padrão de 5 cm, visível e com snap ligados; linhas em tinta a 8% (DESIGN §2.2).
export const GRID_PADRAO = {
  visivel: true,
  snap: true,
  passoCm: 5,
  principalACada: 5,
  cor: '#1F1B16',
  opacidade: 0.08,
} as const;
export const PASSOS_GRID_CM = [1, 2, 5, 10] as const;
// A-08: passo "Outro", em cm, e as cores prontas das linhas do grid.
export const LIMITE_PASSO_GRID_CM = { min: 0.5, max: 100, passo: 0.1 } as const;
export const CORES_GRID = [
  { nome: 'Tinta', hex: '#1F1B16' },
  { nome: 'Branco', hex: '#FFFFFF' },
  { nome: 'Cinza', hex: '#8C8C8C' },
] as const;
// A-07: abaixo disto (px na tela entre duas linhas) o grid não é desenhado.
export const GRID_PASSO_MIN_PX = 4;

// RN-03: borda padrão 0 cm, cor branca.
export const BORDA_PADRAO = { larguraCm: 0, cor: '#FFFFFF' } as const;

// RN-04: tamanho ao adicionar uma foto.
export const TAMANHO_PADRAO_ID = '10x15';

export const NOME_VARIANTE_PADRAO = 'Base'; // RN-23

export const PRAZO_PURGA_DIAS = 30; // RN-24

// ---- M1 (docs/specs/M1-parede-e-escala.md §4.1) ----

// M1-03: a retificação vai até +100% de L e de A em cada lado do retângulo de referência.
export const MARGEM_RETIFICACAO = 1;

// A-09: medidas do retângulo de referência e comprimento da calibração linear.
export const LIMITES_REFERENCIA_CM = { min: 10, max: 2000 } as const;

// RN-33 / A-13: área útil com no mínimo 5 cm por lado.
export const AREA_UTIL_MIN_CM = 5;

export const THUMB_PAREDE_PX = 400; // A-17: miniatura do card
export const PREVIA_LARGURA_PX = 320; // RF-06 / DV-06: prévia frontal da perspectiva
export const SEGMENTO_MIN_PX = 20; // A-12: segmento mínimo da calibração linear

// A-06: 100% = 1 px do bitmap por px de tela; a roda dá zoom em passos de 1,1.
export const ZOOM = { min: 0.1, max: 8, passo: 1.1 } as const;

// A-02: nome do projeto.
export const NOME_PROJETO_PADRAO = 'Projeto sem nome';
export const LIMITE_NOME_PROJETO = 100;
