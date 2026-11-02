import { arredondarCm } from '../arredondar';
import { limitarPosicao } from '../composicao/limites';
import { encaixarPosicao, type GridDeSnap } from '../composicao/snap';
import { tamanhoExterno, tamanhoSugerido } from '../composicao/tamanho';
import { PASSADAS_AFASTAMENTO, TAMANHOS_SUGERIDOS, TOLERANCIA_CM } from '../constantes';
import type { AreaUtil, Borda, FotoNaParede, Tamanho } from '../schemas';
import type { CelulaTemplate, Template } from './catalogo';

// Aplicação de template (RN-29 a RN-32, M3-06; docs/specs/M3-variantes-templates-e-salvamento.md §4.2 a §4.4).

interface Medidas {
  larguraCm: number;
  alturaCm: number;
}

interface PosicaoCm {
  xCm: number;
  yCm: number;
}

// §4.2: o sugerido de maior área impressa cujo tamanho externo (impresso + 2 × borda) cabe na célula, na orientação
// da célula (quadrada = retrato). Nenhum cabe: 10×15 na orientação da célula e `cresceu`.
export function tamanhoParaCelula(celula: Medidas, bordaCm: number): { tamanho: Tamanho; cresceu: boolean } {
  const orientacao = celula.larguraCm > celula.alturaCm ? 'paisagem' : 'retrato';
  let melhor: Tamanho | null = null;
  for (const sugerido of TAMANHOS_SUGERIDOS) {
    const tamanho = tamanhoSugerido(sugerido.id, orientacao);
    const cabe =
      tamanho.larguraCm + 2 * bordaCm <= celula.larguraCm + TOLERANCIA_CM &&
      tamanho.alturaCm + 2 * bordaCm <= celula.alturaCm + TOLERANCIA_CM;
    if (!cabe) continue;
    if (!melhor || tamanho.larguraCm * tamanho.alturaCm > melhor.larguraCm * melhor.alturaCm)
      melhor = tamanho;
  }
  if (melhor) return { tamanho: melhor, cresceu: false };
  return { tamanho: tamanhoSugerido('10x15', orientacao), cresceu: true };
}

interface Retangulo {
  x: number;
  y: number;
  l: number;
  a: number;
  cresceu: boolean;
  empurrada: boolean;
}

const sobreposicao = (a: Retangulo, b: Retangulo) => ({
  x: Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x),
  y: Math.min(a.y + a.a, b.y + b.a) - Math.max(a.y, b.y),
});

const paraCima = (valor: number) => Math.ceil(valor * 10 - 1e-9) / 10;

// §4.3 passo 3 (A-31): afasta as vagas vizinhas das que cresceram ou foram empurradas, no eixo de menor
// penetração, em até PASSADAS_AFASTAMENTO passadas.
function afastar(retangulos: Retangulo[]): void {
  for (let passada = 0; passada < PASSADAS_AFASTAMENTO; passada += 1) {
    let moveu = false;
    for (let i = 0; i < retangulos.length; i += 1) {
      for (let j = i + 1; j < retangulos.length; j += 1) {
        const a = retangulos[i]!;
        const b = retangulos[j]!;
        const ativoA = a.cresceu || a.empurrada;
        const ativoB = b.cresceu || b.empurrada;
        if (!ativoA && !ativoB) continue;
        const o = sobreposicao(a, b);
        if (o.x <= TOLERANCIA_CM || o.y <= TOLERANCIA_CM) continue;
        // Move o que não é crescido/empurrado; se ambos forem, o posterior na ordem.
        const [parado, movido] = ativoA && !ativoB ? [a, b] : !ativoA && ativoB ? [b, a] : [a, b];
        if (o.x <= o.y) {
          const sentido = movido.x + movido.l / 2 >= parado.x + parado.l / 2 ? 1 : -1;
          movido.x += sentido * paraCima(o.x);
        } else {
          const sentido = movido.y + movido.a / 2 >= parado.y + parado.a / 2 ? 1 : -1;
          movido.y += sentido * paraCima(o.y);
        }
        movido.empurrada = true;
        moveu = true;
      }
    }
    if (!moveu) return;
  }
}

export interface ResultadoTemplate {
  fotos: FotoNaParede[];
  // Caixa do conjunto (células e vagas), com o canto superior esquerdo em `posicaoCm`.
  conjunto: AreaUtil;
  // Quantas vagas não couberam na célula e cresceram (RN-29).
  vagasMaiores: number;
}

// §4.3. `posicaoCm` é o canto superior esquerdo do conjunto. As vagas saem em ordem, como placeholders (RN-31).
export function aplicarTemplate(args: {
  template: Template;
  posicaoCm: PosicaoCm;
  borda: Borda;
  novoId: () => string;
}): ResultadoTemplate {
  const { template, posicaoCm, borda, novoId } = args;
  const celulas: readonly CelulaTemplate[] = template.celulas;

  const dados = celulas.map((celula) => {
    const { tamanho, cresceu } = tamanhoParaCelula(celula, borda.larguraCm);
    const externo = tamanhoExterno(tamanho, borda);
    // Retângulo externo centralizado na célula (o que cresceu mantém o centro), a 0,1 cm.
    const retangulo: Retangulo = {
      x: arredondarCm(celula.xCm + (celula.larguraCm - externo.larguraCm) / 2),
      y: arredondarCm(celula.yCm + (celula.alturaCm - externo.alturaCm) / 2),
      l: externo.larguraCm,
      a: externo.alturaCm,
      cresceu,
      empurrada: false,
    };
    return { tamanho, retangulo };
  });

  const retangulos = dados.map((d) => d.retangulo);
  if (retangulos.some((r) => r.cresceu)) afastar(retangulos);

  const caixa = [
    ...celulas.map((c) => ({ x: c.xCm, y: c.yCm, l: c.larguraCm, a: c.alturaCm })),
    ...retangulos,
  ];
  const minX = Math.min(...caixa.map((r) => r.x));
  const minY = Math.min(...caixa.map((r) => r.y));
  const maxX = Math.max(...caixa.map((r) => r.x + r.l));
  const maxY = Math.max(...caixa.map((r) => r.y + r.a));

  const fotos: FotoNaParede[] = dados.map(({ tamanho, retangulo }) => ({
    _id: novoId(),
    imagemId: null,
    imagemAnteriorId: null,
    tamanho,
    xCm: arredondarCm(posicaoCm.xCm + (retangulo.x - minX)),
    yCm: arredondarCm(posicaoCm.yCm + (retangulo.y - minY)),
    recorte: { offsetX: 0, offsetY: 0 },
    borda: { larguraCm: borda.larguraCm, cor: borda.cor },
  }));

  return {
    fotos,
    conjunto: {
      xCm: posicaoCm.xCm,
      yCm: posicaoCm.yCm,
      larguraCm: arredondarCm(maxX - minX),
      alturaCm: arredondarCm(maxY - minY),
    },
    vagasMaiores: retangulos.filter((r) => r.cresceu).length,
  };
}

// §4.3 passo 8: o conjunto é maior que a área útil em algum eixo (com a folga de 0,05 cm).
export function maiorQueAreaUtil(conjunto: Medidas, areaUtil: Medidas): boolean {
  return (
    conjunto.larguraCm > areaUtil.larguraCm + TOLERANCIA_CM ||
    conjunto.alturaCm > areaUtil.alturaCm + TOLERANCIA_CM
  );
}

// §4.4: centraliza o conjunto na área útil, também quando é maior (estoura igualmente dos dois lados).
export function centralizarNaAreaUtil(conjunto: Medidas, areaUtil: AreaUtil): PosicaoCm {
  return {
    xCm: arredondarCm(areaUtil.xCm + (areaUtil.larguraCm - conjunto.larguraCm) / 2),
    yCm: arredondarCm(areaUtil.yCm + (areaUtil.alturaCm - conjunto.alturaCm) / 2),
  };
}

// Snap só no canto superior esquerdo do conjunto (M3-06).
export function encaixarConjunto(posicao: PosicaoCm, grid: GridDeSnap): PosicaoCm {
  const p = encaixarPosicao({ x: posicao.xCm, y: posicao.yCm }, grid);
  return { xCm: p.x, yCm: p.y };
}

// M3-06, M2-11: a caixa do conjunto mantém 1 cm dentro da parede inteira, em cada eixo.
export function limitarConjunto(posicao: PosicaoCm, conjunto: Medidas, paredeInteira: AreaUtil): PosicaoCm {
  return limitarPosicao(
    {
      xCm: posicao.xCm,
      yCm: posicao.yCm,
      tamanho: { sugeridoId: null, larguraCm: conjunto.larguraCm, alturaCm: conjunto.alturaCm },
      borda: { larguraCm: 0, cor: '#FFFFFF' },
    },
    paredeInteira,
  );
}
