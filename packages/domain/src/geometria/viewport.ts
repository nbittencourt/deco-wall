import { ZOOM } from '../constantes';
import type { Pt } from '../schemas';

// Viewport (A-06): tela = conteúdo × escala + (x, y). A unidade do conteúdo é livre (cm no editor,
// px da foto nos modos Perspectiva e Calibração).

export interface Viewport {
  escala: number;
  x: number;
  y: number;
}

export interface LimitesEscala {
  min: number;
  max: number;
}

// Zoom em torno de um ponto da tela: o ponto do conteúdo sob o cursor não se move.
export function zoomNoPonto(
  viewport: Viewport,
  fator: number,
  pontoTela: Pt,
  limites?: LimitesEscala,
): Viewport {
  let escala = viewport.escala * fator;
  if (limites) escala = Math.min(Math.max(escala, limites.min), limites.max);
  const razao = escala / viewport.escala;
  return {
    escala,
    x: pontoTela.x - (pontoTela.x - viewport.x) * razao,
    y: pontoTela.y - (pontoTela.y - viewport.y) * razao,
  };
}

export function ajustarATela(
  conteudo: { x: number; y: number; largura: number; altura: number },
  tela: { largura: number; altura: number },
  margemPx = 0,
): Viewport {
  const escala = Math.min(
    (tela.largura - 2 * margemPx) / conteudo.largura,
    (tela.altura - 2 * margemPx) / conteudo.altura,
  );
  return {
    escala,
    x: (tela.largura - conteudo.largura * escala) / 2 - conteudo.x * escala,
    y: (tela.altura - conteudo.altura * escala) / 2 - conteudo.y * escala,
  };
}

// A-06: de 10% (ou metade do "Ajustar à tela", o que for menor) até 800%. `zoom` e `zoomAjustado` em
// razão (1 = 100% = 1 px do bitmap por px de tela).
export function limitarZoom(zoom: number, zoomAjustado: number): number {
  const minimo = Math.min(ZOOM.min, zoomAjustado / 2);
  return Math.min(Math.max(zoom, minimo), ZOOM.max);
}
