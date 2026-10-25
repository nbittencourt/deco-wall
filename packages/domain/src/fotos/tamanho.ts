import { arredondarCm } from '../arredondar';
import { LIMITE_PERSONALIZADO_CM, TAMANHO_PADRAO_ID, TAMANHOS_SUGERIDOS } from '../constantes';
import { formatarCm } from '../formatadores';
import type { Tamanho } from '../schemas';

// Tamanhos das fotos na parede (RN-01, RN-04, RN-05, RN-28; docs/specs/M2-biblioteca-e-composicao.md §4.1).
// O tamanho guarda as medidas já na orientação atual: a orientação é derivada (DM-14).

export type OrientacaoFoto = 'retrato' | 'paisagem' | 'quadrado';
export type OrientacaoEscolhida = 'retrato' | 'paisagem';

interface Medidas {
  larguraCm: number;
  alturaCm: number;
}

export function orientacaoDoTamanho(t: Medidas): OrientacaoFoto {
  if (t.larguraCm < t.alturaCm) return 'retrato';
  if (t.larguraCm > t.alturaCm) return 'paisagem';
  return 'quadrado';
}

export function ehQuadrado(t: Medidas): boolean {
  return t.larguraCm === t.alturaCm;
}

// RN-01: retrato = menor lado na horizontal; paisagem = maior lado na horizontal.
export function tamanhoSugerido(id: string, orientacao: OrientacaoEscolhida = 'retrato'): Tamanho {
  const sugerido = TAMANHOS_SUGERIDOS.find((s) => s.id === id);
  if (!sugerido) throw new Error(`Tamanho sugerido desconhecido: ${id}`);
  const paisagem = orientacao === 'paisagem';
  return {
    sugeridoId: sugerido.id,
    larguraCm: paisagem ? sugerido.maiorCm : sugerido.menorCm,
    alturaCm: paisagem ? sugerido.menorCm : sugerido.maiorCm,
  };
}

// RN-04: 10×15 na orientação natural da imagem.
export function tamanhoDaImagem(orientacaoNatural: OrientacaoEscolhida): Tamanho {
  return tamanhoSugerido(TAMANHO_PADRAO_ID, orientacaoNatural);
}

// RN-28: mensagem de faixa válida do lado do tamanho personalizado; null quando o valor serve.
export function validarLadoPersonalizado(cm: number): string | null {
  const { min, max } = LIMITE_PERSONALIZADO_CM;
  if (Number.isFinite(cm)) {
    const arredondado = arredondarCm(cm);
    if (arredondado >= min && arredondado <= max) return null;
  }
  return `Entre ${formatarCm(min)} e ${formatarCm(max)} cm em cada lado.`;
}

// RN-28: 5 a 150 cm por lado a 0,1 cm; igual a um sugerido (em qualquer orientação) vira o sugerido.
export function tamanhoPersonalizado(larguraCm: number, alturaCm: number): Tamanho | null {
  if (validarLadoPersonalizado(larguraCm) !== null || validarLadoPersonalizado(alturaCm) !== null)
    return null;
  const largura = arredondarCm(larguraCm);
  const altura = arredondarCm(alturaCm);
  const menor = Math.min(largura, altura);
  const maior = Math.max(largura, altura);
  const sugerido = TAMANHOS_SUGERIDOS.find((s) => s.menorCm === menor && s.maiorCm === maior);
  return { sugeridoId: sugerido?.id ?? null, larguraCm: largura, alturaCm: altura };
}

// RN-05: trocar a orientação inverte largura e altura; quadrado não tem orientação.
export function trocarOrientacao(tamanho: Tamanho, nova: OrientacaoEscolhida): Tamanho {
  const atual = orientacaoDoTamanho(tamanho);
  if (atual === 'quadrado' || atual === nova) return { ...tamanho };
  return { ...tamanho, larguraCm: tamanho.alturaCm, alturaCm: tamanho.larguraCm };
}
