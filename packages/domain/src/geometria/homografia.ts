import type { Pt } from '../schemas';

// Homografia 3×3 (ADR-04, docs/specs/M1-parede-e-escala.md §4.1): 9 números, linha a linha
// [a b c / d e f / g h i]. Pontos são { x, y } e a matriz atua em coordenadas homogêneas.

export type Homografia = readonly number[];

const EPS = 1e-10;

// Normalização de Hartley: centra os pontos na origem com distância média √2. Deixa o sistema 8×8
// bem condicionado mesmo com px (milhares) de um lado e cm (centenas) do outro.
function normalizacao(pts: readonly Pt[]): number[] {
  const n = pts.length;
  const cx = pts.reduce((soma, p) => soma + p.x, 0) / n;
  const cy = pts.reduce((soma, p) => soma + p.y, 0) / n;
  const media = pts.reduce((soma, p) => soma + Math.hypot(p.x - cx, p.y - cy), 0) / n;
  const escala = media > 0 ? Math.SQRT2 / media : 1;
  return [escala, 0, -escala * cx, 0, escala, -escala * cy, 0, 0, 1];
}

// DLT com h33 = 1: oito equações lineares, resolvidas por eliminação de Gauss com pivô parcial.
export function calcularHomografia(origem: readonly Pt[], destino: readonly Pt[]): number[] {
  if (origem.length !== 4 || destino.length !== 4) {
    throw new Error('A homografia exige quatro pontos de origem e quatro de destino.');
  }
  const ts = normalizacao(origem);
  const td = normalizacao(destino);
  const o = origem.map((p) => aplicarHomografia(ts, p));
  const d = destino.map((p) => aplicarHomografia(td, p));

  const m: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = o[i]!;
    const { x: u, y: v } = d[i]!;
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const normalizada = [...resolverSistema(m), 1];
  // H = Td⁻¹ · H' · Ts
  const bruta = multiplicarHomografias(inverterHomografia(td), multiplicarHomografias(normalizada, ts));
  const h = bruta.map((valor) => valor / bruta[8]!);

  // Com três pontos alinhados o sistema é singular, mas a eliminação pode devolver lixo sem pivô nulo:
  // conferir se a matriz de fato leva cada ponto ao seu destino.
  const escala = Math.max(1, ...destino.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
  const confere = origem.every((p, i) => {
    const r = aplicarHomografia(h, p);
    return Math.hypot(r.x - destino[i]!.x, r.y - destino[i]!.y) <= 1e-6 * escala;
  });
  if (!h.every(Number.isFinite) || !confere) {
    throw new Error('Pontos degenerados: três ou mais alinhados ou repetidos.');
  }
  return h;
}

function resolverSistema(m: number[][]): number[] {
  const n = 8;
  for (let col = 0; col < n; col += 1) {
    let pivo = col;
    for (let lin = col + 1; lin < n; lin += 1) {
      if (Math.abs(m[lin]![col]!) > Math.abs(m[pivo]![col]!)) pivo = lin;
    }
    if (Math.abs(m[pivo]![col]!) < EPS) {
      throw new Error('Pontos degenerados: três ou mais alinhados ou repetidos.');
    }
    [m[col], m[pivo]] = [m[pivo]!, m[col]!];
    for (let lin = col + 1; lin < n; lin += 1) {
      const fator = m[lin]![col]! / m[col]![col]!;
      for (let k = col; k <= n; k += 1) m[lin]![k]! -= fator * m[col]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let lin = n - 1; lin >= 0; lin -= 1) {
    let soma = m[lin]![n]!;
    for (let k = lin + 1; k < n; k += 1) soma -= m[lin]![k]! * x[k]!;
    x[lin] = soma / m[lin]![lin]!;
  }
  return x;
}

// Coordenadas homogêneas sem dividir por w; w ≤ 0 está atrás do horizonte.
export function projetarHomografia(h: Homografia, p: Pt): { x: number; y: number; w: number } {
  return {
    x: h[0]! * p.x + h[1]! * p.y + h[2]!,
    y: h[3]! * p.x + h[4]! * p.y + h[5]!,
    w: h[6]! * p.x + h[7]! * p.y + h[8]!,
  };
}

export function aplicarHomografia(h: Homografia, p: Pt): Pt {
  const { x, y, w } = projetarHomografia(h, p);
  return { x: x / w, y: y / w };
}

export function multiplicarHomografias(a: Homografia, b: Homografia): number[] {
  const r = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
    }
  }
  return r;
}

export function inverterHomografia(h: Homografia): number[] {
  const [a, b, c, d, e, f, g, i, j] = h as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  // Cofatores transpostos (adjunta) e determinante.
  const adjunta = [
    e * j - f * i,
    c * i - b * j,
    b * f - c * e,
    f * g - d * j,
    a * j - c * g,
    c * d - a * f,
    d * i - e * g,
    b * g - a * i,
    a * e - b * d,
  ];
  const det = a * adjunta[0]! + b * adjunta[3]! + c * adjunta[6]!;
  const grandeza = Math.max(...h.map(Math.abs));
  if (!Number.isFinite(det) || Math.abs(det) <= 1e-12 * grandeza ** 3) {
    throw new Error('Matriz singular: não tem inversa.');
  }
  return adjunta.map((valor) => valor / det);
}
