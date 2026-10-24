// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Aceite 14 (docs/specs/M0-setup.md §6): contraste ≥ 4,5:1 nos pares de texto da DESIGN §2.1.
// Lê os tokens do próprio theme.css, para que o teste use os valores reais do app.
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const tokens = new Map(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1]!, m[2]!]),
);

function canal(valor: number): number {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = canal((n >> 16) & 0xff);
  const g = canal((n >> 8) & 0xff);
  const b = canal(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(texto: string, fundo: string): number {
  const [claro, escuro] = [luminancia(texto), luminancia(fundo)].sort((a, b) => b - a) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
}

// texto, fundo — `surface` é branco (#FFFFFF), usado sobre accent e danger.
const PARES: [string, string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink-2', 'paper'],
  ['ink-2', 'surface'],
  ['ink-2', 'sand'],
  ['ink-3', 'paper'],
  ['ink-3', 'surface'],
  ['surface', 'accent'],
  ['surface', 'danger'],
  ['danger-ink', 'danger-tint'],
  ['danger-ink-strong', 'danger-tint'],
  ['accent-ink', 'accent-tint'],
  ['warning-ink', 'warning-tint'],
];

describe('contraste dos tokens (aceite 14)', () => {
  it('todos os tokens dos pares existem no theme.css', () => {
    for (const [texto, fundo] of PARES) {
      expect(tokens.has(texto), `token ${texto}`).toBe(true);
      expect(tokens.has(fundo), `token ${fundo}`).toBe(true);
    }
  });

  it.each(PARES)('%s sobre %s tem contraste ≥ 4,5:1', (texto, fundo) => {
    const valor = contraste(tokens.get(texto)!, tokens.get(fundo)!);
    expect(valor, `${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
  });
});
