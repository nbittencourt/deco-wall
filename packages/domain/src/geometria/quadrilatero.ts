import type { Pt } from '../schemas';

// Quadrilátero dos cantos da perspectiva (A-10, A-11).

// Sentido horário a partir do superior esquerdo (y cresce para baixo). Ordena pelo ângulo em torno do
// centro, o que desfaz alças cruzadas. O primeiro é o canto de menor x + y.
export function ordenarCantos(pts: readonly Pt[]): Pt[] {
  if (pts.length !== 4) throw new Error('São necessários exatamente quatro cantos.');
  const cx = pts.reduce((soma, p) => soma + p.x, 0) / 4;
  const cy = pts.reduce((soma, p) => soma + p.y, 0) / 4;
  const porAngulo = [...pts].sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  let inicio = 0;
  porAngulo.forEach((p, i) => {
    if (p.x + p.y < porAngulo[inicio]!.x + porAngulo[inicio]!.y) inicio = i;
  });
  return [...porAngulo.slice(inicio), ...porAngulo.slice(0, inicio)];
}

export type MotivoQuadrilateroInvalido = 'nao-convexo' | 'alinhados' | 'area-pequena';
export type ResultadoQuadrilatero = { ok: true } | { ok: false; motivo: MotivoQuadrilateroInvalido };

export const MENSAGEM_QUADRILATERO_INVALIDO = 'Os cantos precisam formar um quadrilátero.';

// A-11: convexo, sem três cantos alinhados, área ≥ 1% da foto. Os pontos vêm em ordem (ordenarCantos).
export function validarQuadrilatero(pts: readonly Pt[], areaImagemPx: number): ResultadoQuadrilatero {
  const cruzamentos: number[] = [];
  let alinhado = false;
  for (let i = 0; i < 4; i += 1) {
    const p = pts[i]!;
    const q = pts[(i + 1) % 4]!;
    const r = pts[(i + 2) % 4]!;
    const ax = q.x - p.x;
    const ay = q.y - p.y;
    const bx = r.x - q.x;
    const by = r.y - q.y;
    const cruz = ax * by - ay * bx;
    cruzamentos.push(cruz);
    // Seno do ângulo entre os dois lados abaixo de 0,1%: na prática, em linha reta.
    if (Math.abs(cruz) <= 1e-3 * Math.hypot(ax, ay) * Math.hypot(bx, by)) alinhado = true;
  }
  if (alinhado) return { ok: false, motivo: 'alinhados' };
  if (!(cruzamentos.every((c) => c > 0) || cruzamentos.every((c) => c < 0))) {
    return { ok: false, motivo: 'nao-convexo' };
  }
  if (areaPoligono(pts) < areaImagemPx * 0.01 * (1 - 1e-9)) return { ok: false, motivo: 'area-pequena' };
  return { ok: true };
}

export function areaPoligono(pts: readonly Pt[]): number {
  let soma = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    soma += p.x * q.y - q.x * p.y;
  });
  return Math.abs(soma) / 2;
}
