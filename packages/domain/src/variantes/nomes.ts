import { NOME_VARIANTE_MAX } from '../constantes';

// Nomes sugeridos de variante (A-03, M3-04; docs/specs/M3-variantes-templates-e-salvamento.md §4.5). Nome repetido é
// permitido; os sugeridos só evitam repetir os existentes. Sempre até NOME_VARIANTE_MAX, preservando o sufixo.

// Junta nome e sufixo; passando do limite, corta o prefixo (com "…") e preserva o sufixo.
export function truncarNome(nome: string, sufixo = ''): string {
  const inteiro = `${nome}${sufixo}`;
  if (inteiro.length <= NOME_VARIANTE_MAX) return inteiro;
  const prefixo = Math.max(NOME_VARIANTE_MAX - sufixo.length - 1, 0);
  return `${nome.slice(0, prefixo)}…${sufixo}`.slice(0, NOME_VARIANTE_MAX);
}

export const nomeComSufixo = truncarNome;

// Em branco: "Variante N", menor N ≥ 2 ainda não usado.
export function nomeNovaVariante(existentes: readonly string[]): string {
  for (let n = 2; ; n += 1) {
    const nome = `Variante ${n}`;
    if (!existentes.includes(nome)) return nome;
  }
}

// Cópia: "<nome> (cópia)", depois "(cópia 2)"…
export function nomeCopia(base: string, existentes: readonly string[]): string {
  const primeiro = truncarNome(base, ' (cópia)');
  if (!existentes.includes(primeiro)) return primeiro;
  for (let n = 2; ; n += 1) {
    const nome = truncarNome(base, ` (cópia ${n})`);
    if (!existentes.includes(nome)) return nome;
  }
}

// Template: o nome do modelo; depois "Pirâmide 2"…
export function nomeDoTemplateUnico(nomeModelo: string, existentes: readonly string[]): string {
  if (!existentes.includes(nomeModelo)) return nomeModelo;
  for (let n = 2; ; n += 1) {
    const nome = truncarNome(nomeModelo, ` ${n}`);
    if (!existentes.includes(nome)) return nome;
  }
}
