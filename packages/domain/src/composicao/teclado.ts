import { arredondarCm } from '../arredondar';
import { PASSOS_COM_SHIFT, TOLERANCIA_CM } from '../constantes';
import type { FotoNaParede } from '../schemas';
import { encaixar, type GridDeSnap } from './snap';

// Teclado (RN-16, M2-01, A-08; docs/specs/M2-biblioteca-e-composicao.md §4.1): com snap, a seta move 1 passo do
// grid e Shift + seta, 5 passos; sem snap, 1 cm e 5 cm.

export type DirecaoSeta = 'esquerda' | 'direita' | 'cima' | 'baixo';

// A próxima linha do grid na direção. Sobre a linha (dentro da tolerância), a vizinha; fora dela, a seguinte
// naquela direção (A-08).
function proximaLinhaDoGrid(valorCm: number, passoCm: number, direcao: 1 | -1): number {
  const k = valorCm / passoCm;
  const maisProxima = Math.round(k);
  const sobreALinha = Math.abs(valorCm - maisProxima * passoCm) <= TOLERANCIA_CM;
  const indice = sobreALinha ? maisProxima + direcao : direcao > 0 ? Math.ceil(k) : Math.floor(k);
  return encaixar(indice * passoCm, passoCm);
}

export function moverPorTeclado(
  foto: Pick<FotoNaParede, 'xCm' | 'yCm'>,
  direcao: DirecaoSeta,
  opcoes: { shift: boolean; grid: GridDeSnap },
): { xCm: number; yCm: number } {
  const horizontal = direcao === 'esquerda' || direcao === 'direita';
  const sinal: 1 | -1 = direcao === 'direita' || direcao === 'baixo' ? 1 : -1;
  const repeticoes = opcoes.shift ? PASSOS_COM_SHIFT : 1;

  let valor = horizontal ? foto.xCm : foto.yCm;
  if (opcoes.grid.snap) {
    for (let i = 0; i < repeticoes; i += 1) valor = proximaLinhaDoGrid(valor, opcoes.grid.passoCm, sinal);
  } else {
    valor = arredondarCm(valor + sinal * repeticoes);
  }
  return horizontal ? { xCm: valor, yCm: foto.yCm } : { xCm: foto.xCm, yCm: valor };
}
