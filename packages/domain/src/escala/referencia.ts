import { arredondarCm } from '../arredondar';
import { LIMITES_REFERENCIA_CM } from '../constantes';
import { lerCm } from '../formatadores';

// A-09: medidas do retângulo de referência e comprimento da calibração linear, de 10 a 2000 cm.

export const MENSAGEM_MEDIDA_REFERENCIA = `Informe de ${LIMITES_REFERENCIA_CM.min} a ${LIMITES_REFERENCIA_CM.max} cm.`;

export type ResultadoMedida = { ok: true; valor: number } | { ok: false; erro: string };

export function validarMedidaReferencia(texto: string): ResultadoMedida {
  const lido = lerCm(texto);
  if (lido === null) return { ok: false, erro: MENSAGEM_MEDIDA_REFERENCIA };
  const valor = arredondarCm(lido);
  if (valor < LIMITES_REFERENCIA_CM.min || valor > LIMITES_REFERENCIA_CM.max) {
    return { ok: false, erro: MENSAGEM_MEDIDA_REFERENCIA };
  }
  return { ok: true, valor };
}

// RF-14: abaixo de 1 m a precisão diminui (só avisa, não bloqueia).
export function referenciaPequena(larguraCm: number, alturaCm: number): boolean {
  return Math.min(larguraCm, alturaCm) < 100;
}
