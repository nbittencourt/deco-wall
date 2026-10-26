import { TOLERANCIA_CM } from '../constantes';
import type { AreaUtil, FotoNaParede } from '../schemas';
import { boundingBox } from './caixa';
import { retanguloExterno } from './foto';

// Alertas de posição (RN-11, RN-12, RN-34; docs/specs/M2-biblioteca-e-composicao.md §4.5, A-12, A-14). Nunca
// bloqueiam: só informam. Sobre os retângulos externos, com tolerância ε = 0,05 cm para evitar falso alerta por
// arredondamento.

type FotoGeometrica = Pick<FotoNaParede, '_id' | 'xCm' | 'yCm' | 'tamanho' | 'borda'>;

function saiDe(caixa: AreaUtil, limite: AreaUtil): boolean {
  return (
    caixa.xCm < limite.xCm - TOLERANCIA_CM ||
    caixa.yCm < limite.yCm - TOLERANCIA_CM ||
    caixa.xCm + caixa.larguraCm > limite.xCm + limite.larguraCm + TOLERANCIA_CM ||
    caixa.yCm + caixa.alturaCm > limite.yCm + limite.alturaCm + TOLERANCIA_CM
  );
}

// Interseção com largura e altura acima da tolerância: fotos apenas encostadas não se sobrepõem.
function seSobrepoem(a: AreaUtil, b: AreaUtil): boolean {
  const largura = Math.min(a.xCm + a.larguraCm, b.xCm + b.larguraCm) - Math.max(a.xCm, b.xCm);
  const altura = Math.min(a.yCm + a.alturaCm, b.yCm + b.alturaCm) - Math.max(a.yCm, b.yCm);
  return largura > TOLERANCIA_CM && altura > TOLERANCIA_CM;
}

export interface Sobreposicoes {
  // Cada par é [abaixo, acima] pela ordem da pilha.
  pares: [string, string][];
  // Todas as fotos envolvidas em alguma sobreposição.
  ids: string[];
  // As fotos da camada superior de algum par: recebem a pill "Sobreposição", uma por foto (A-12).
  acima: string[];
}

// RN-11: placeholders entram.
export function sobreposicoes(fotos: readonly FotoGeometrica[]): Sobreposicoes {
  const caixas = fotos.map((f) => retanguloExterno(f));
  const pares: [string, string][] = [];
  const ids = new Set<string>();
  const acima = new Set<string>();
  for (let i = 0; i < fotos.length; i += 1) {
    for (let j = i + 1; j < fotos.length; j += 1) {
      if (!seSobrepoem(caixas[i]!, caixas[j]!)) continue;
      pares.push([fotos[i]!._id, fotos[j]!._id]);
      ids.add(fotos[i]!._id);
      ids.add(fotos[j]!._id);
      acima.add(fotos[j]!._id);
    }
  }
  return { pares, ids: [...ids], acima: [...acima] };
}

// RN-12: o retângulo externo não cabe na parede inteira.
export function foraDaParede(foto: FotoGeometrica, paredeInteira: AreaUtil): boolean {
  return saiDe(retanguloExterno(foto), paredeInteira);
}

// RN-34: o retângulo externo não cabe na área útil da variante (sem área útil, nunca está fora).
export function foraDaAreaUtil(foto: FotoGeometrica, areaUtil: AreaUtil | null): boolean {
  return areaUtil !== null && saiDe(retanguloExterno(foto), areaUtil);
}

export interface AlertasDaFoto {
  sobreposicao: boolean;
  // "parede" prevalece sobre "area-util" (DESIGN §2.2).
  fora: 'parede' | 'area-util' | null;
}

export function alertasPorFoto(
  fotos: readonly FotoGeometrica[],
  paredeInteira: AreaUtil | null,
  areaUtil: AreaUtil | null,
): Map<string, AlertasDaFoto> {
  const envolvidas = new Set(sobreposicoes(fotos).ids);
  const mapa = new Map<string, AlertasDaFoto>();
  for (const foto of fotos) {
    const fora =
      paredeInteira && foraDaParede(foto, paredeInteira)
        ? 'parede'
        : foraDaAreaUtil(foto, areaUtil)
          ? 'area-util'
          : null;
    mapa.set(foto._id, { sobreposicao: envolvidas.has(foto._id), fora });
  }
  return mapa;
}

export interface ResumoDaComposicao {
  fotos: number;
  // Fotos sem imagem (placeholders).
  semFoto: number;
  // Fotos envolvidas em alguma sobreposição.
  sobrepostas: number;
  // Fotos fora da parede ou fora da área útil (RN-34 "conta como alerta").
  foraDaArea: number;
  areaTotal: AreaUtil | null;
}

// A-14: contagens do painel Composição.
export function alertasDaComposicao(
  variante: { fotos: readonly FotoNaParede[]; areaUtil: AreaUtil | null },
  paredeInteira: AreaUtil | null,
): ResumoDaComposicao {
  const porFoto = alertasPorFoto(variante.fotos, paredeInteira, variante.areaUtil);
  let sobrepostas = 0;
  let foraDaArea = 0;
  for (const alertas of porFoto.values()) {
    if (alertas.sobreposicao) sobrepostas += 1;
    if (alertas.fora !== null) foraDaArea += 1;
  }
  return {
    fotos: variante.fotos.length,
    semFoto: variante.fotos.filter((f) => f.imagemId === null).length,
    sobrepostas,
    foraDaArea,
    areaTotal: boundingBox(variante.fotos),
  };
}
