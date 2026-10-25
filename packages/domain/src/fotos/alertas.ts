import { TOLERANCIA_CM } from '../constantes';
import type { AreaUtil, FotoNaParede } from '../schemas';
import { caixaExterna } from './geometria';

// Alertas de posição (RN-11, RN-12, RN-34, RN-36, M2-08). Nunca bloqueiam: só informam.

export interface AlertasDaFoto {
  sobreposicao: boolean;
  // "parede" prevalece sobre "area-util" (DESIGN §2.2).
  fora: 'parede' | 'area-util' | null;
}

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

export function calcularAlertas(
  fotos: readonly FotoGeometrica[],
  paredeInteira: AreaUtil | null,
  areaUtil: AreaUtil | null,
): Map<string, AlertasDaFoto> {
  const caixas = fotos.map((foto) => caixaExterna(foto));
  const sobrepostas = new Set<number>();
  for (let i = 0; i < caixas.length; i += 1) {
    for (let j = i + 1; j < caixas.length; j += 1) {
      if (seSobrepoem(caixas[i]!, caixas[j]!)) {
        sobrepostas.add(i);
        sobrepostas.add(j);
      }
    }
  }

  const mapa = new Map<string, AlertasDaFoto>();
  fotos.forEach((foto, i) => {
    const caixa = caixas[i]!;
    const fora =
      paredeInteira && saiDe(caixa, paredeInteira)
        ? 'parede'
        : areaUtil && saiDe(caixa, areaUtil)
          ? 'area-util'
          : null;
    mapa.set(foto._id, { sobreposicao: sobrepostas.has(i), fora });
  });
  return mapa;
}

export function resumirAlertas(mapa: ReadonlyMap<string, AlertasDaFoto>): {
  comSobreposicao: number;
  foraDosLimites: number;
} {
  let comSobreposicao = 0;
  let foraDosLimites = 0;
  for (const alertas of mapa.values()) {
    if (alertas.sobreposicao) comSobreposicao += 1;
    if (alertas.fora !== null) foraDosLimites += 1;
  }
  return { comSobreposicao, foraDosLimites };
}
