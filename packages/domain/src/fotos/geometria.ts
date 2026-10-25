import { arredondarCm } from '../arredondar';
import { TOLERANCIA_CM } from '../constantes';
import type { AreaUtil, Borda, FotoNaParede, Pt, Tamanho } from '../schemas';

// Geometria das fotos (RN-02, RN-06, RN-15, RN-16, RF-62; docs/specs/M2-biblioteca-e-composicao.md §4.1).
// Todas as medidas em cm; posição = canto superior esquerdo do tamanho externo (RN-06).

interface ComTamanhoEBorda {
  tamanho: Tamanho;
  borda: Borda;
}

// RN-02: tamanho externo = impresso + 2 × borda.
export function tamanhoExterno(foto: ComTamanhoEBorda): { larguraCm: number; alturaCm: number } {
  const borda = foto.borda.larguraCm;
  return {
    larguraCm: arredondarCm(foto.tamanho.larguraCm + 2 * borda),
    alturaCm: arredondarCm(foto.tamanho.alturaCm + 2 * borda),
  };
}

export function caixaExterna(foto: ComTamanhoEBorda & Pick<FotoNaParede, 'xCm' | 'yCm'>): AreaUtil {
  return { xCm: foto.xCm, yCm: foto.yCm, ...tamanhoExterno(foto) };
}

// RF-62: o retângulo que envolve o tamanho externo de todas as fotos.
export function caixaDaComposicao(
  fotos: readonly (ComTamanhoEBorda & Pick<FotoNaParede, 'xCm' | 'yCm'>)[],
): AreaUtil | null {
  if (fotos.length === 0) return null;
  let esquerda = Infinity;
  let topo = Infinity;
  let direita = -Infinity;
  let base = -Infinity;
  for (const foto of fotos) {
    const caixa = caixaExterna(foto);
    esquerda = Math.min(esquerda, caixa.xCm);
    topo = Math.min(topo, caixa.yCm);
    direita = Math.max(direita, caixa.xCm + caixa.larguraCm);
    base = Math.max(base, caixa.yCm + caixa.alturaCm);
  }
  return {
    xCm: arredondarCm(esquerda),
    yCm: arredondarCm(topo),
    larguraCm: arredondarCm(direita - esquerda),
    alturaCm: arredondarCm(base - topo),
  };
}

// RN-15: leva ao múltiplo mais próximo do passo (origem 0,0), sem ruído de ponto flutuante nem -0.
export function encaixarNoGrid(valorCm: number, passoCm: number): number {
  const encaixado = arredondarCm(Math.round(valorCm / passoCm) * passoCm);
  return encaixado === 0 ? 0 : encaixado;
}

export function encaixarPosicao(p: Pt, passoCm: number): Pt {
  return { x: encaixarNoGrid(p.x, passoCm), y: encaixarNoGrid(p.y, passoCm) };
}

// M2-09: a próxima linha do grid na direção. Sobre a linha (dentro da tolerância), a vizinha.
export function proximaLinhaDoGrid(valorCm: number, passoCm: number, direcao: 1 | -1): number {
  const k = valorCm / passoCm;
  const maisProxima = Math.round(k);
  const sobreALinha = Math.abs(valorCm - maisProxima * passoCm) <= TOLERANCIA_CM;
  const indice = sobreALinha ? maisProxima + direcao : direcao > 0 ? Math.ceil(k) : Math.floor(k);
  return encaixarNoGrid(indice * passoCm, passoCm);
}

export type DirecaoSeta = 'esquerda' | 'direita' | 'cima' | 'baixo';

const PASSOS_COM_SHIFT = 5;

// RN-16, M2-09: sem snap, 1 cm (Shift: 5 cm); com snap, 1 linha do grid (Shift: 5 linhas).
export function moverPorSeta(
  posicao: { xCm: number; yCm: number },
  direcao: DirecaoSeta,
  opcoes: { snap: boolean; passoCm: number; shift: boolean },
): Pt {
  const horizontal = direcao === 'esquerda' || direcao === 'direita';
  const sinal: 1 | -1 = direcao === 'direita' || direcao === 'baixo' ? 1 : -1;
  const repeticoes = opcoes.shift ? PASSOS_COM_SHIFT : 1;

  let valor = horizontal ? posicao.xCm : posicao.yCm;
  if (opcoes.snap) {
    for (let i = 0; i < repeticoes; i += 1) valor = proximaLinhaDoGrid(valor, opcoes.passoCm, sinal);
  } else {
    valor = arredondarCm(valor + sinal * repeticoes);
  }
  return horizontal ? { x: valor, y: posicao.yCm } : { x: posicao.xCm, y: valor };
}
