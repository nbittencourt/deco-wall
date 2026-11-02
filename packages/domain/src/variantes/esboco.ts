import { retanguloExterno } from '../composicao/foto';
import type { AreaUtil, FotoNaParede } from '../schemas';

// Esboço de variante (A-15, §4.7): um retângulo por foto, normalizado em 0 a 1 em relação à caixa, para o SVG dos
// cartões de conflito, recuperação e template. Sem Konva e sem imagens.

export interface RetanguloEsboco {
  x: number;
  y: number;
  w: number;
  h: number;
  tipo: 'foto' | 'placeholder';
}

const arredondar = (valor: number) => Math.round(valor * 1e6) / 1e6;

export function esbocoDeFotos(fotos: readonly FotoNaParede[], caixaCm: AreaUtil): RetanguloEsboco[] {
  return fotos.map((foto) => {
    const externo = retanguloExterno(foto);
    return {
      x: arredondar((externo.xCm - caixaCm.xCm) / caixaCm.larguraCm),
      y: arredondar((externo.yCm - caixaCm.yCm) / caixaCm.alturaCm),
      w: arredondar(externo.larguraCm / caixaCm.larguraCm),
      h: arredondar(externo.alturaCm / caixaCm.alturaCm),
      tipo: foto.imagemId === null ? 'placeholder' : 'foto',
    };
  });
}
