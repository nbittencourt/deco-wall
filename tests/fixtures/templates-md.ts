import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Lê o catálogo de templates de `docs/specs/templates.md` (TPL-07, TPL-08) para os testes do M3 conferirem o
// código contra a fonte, e não contra si mesmos.

export interface LinhaModelo {
  numero: number;
  moldura: string;
  celula: { larguraCm: number; alturaCm: number };
  xCm: number;
  yCm: number;
  // "Foto (borda 0)": largura × altura na orientação da célula.
  foto: { larguraCm: number; alturaCm: number };
}

export interface ModeloMd {
  id: string;
  nome: string;
  totalCm: { larguraCm: number; alturaCm: number };
  vagas: number;
  linhas: LinhaModelo[];
}

const numero = (texto: string) => Number(texto.trim().replace(',', '.'));

export function lerModelosDoMarkdown(): ModeloMd[] {
  const caminho = fileURLToPath(new URL('../../docs/specs/templates.md', import.meta.url));
  const linhas = readFileSync(caminho, 'utf-8').split(/\r?\n/);
  const modelos: ModeloMd[] = [];
  let atual: ModeloMd | null = null;

  for (const linha of linhas) {
    const titulo = /^### 2\.\d+ (.+) \(`([a-z-]+)`\)$/.exec(linha);
    if (titulo) {
      atual = {
        id: titulo[2]!,
        nome: titulo[1]!,
        totalCm: { larguraCm: 0, alturaCm: 0 },
        vagas: 0,
        linhas: [],
      };
      modelos.push(atual);
      continue;
    }
    if (!atual) continue;
    const total = /^Total calculado \*\*([\d,]+) × ([\d,]+) cm\*\* .* (\d+) vagas$/.exec(linha);
    if (total) {
      atual.totalCm = { larguraCm: numero(total[1]!), alturaCm: numero(total[2]!) };
      atual.vagas = Number(total[3]);
      continue;
    }
    const celula =
      /^\| (\d+) \| (.+?) \| ([\d,]+) × ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| (\d+) × (\d+) \|$/.exec(linha);
    if (celula) {
      atual.linhas.push({
        numero: Number(celula[1]),
        moldura: celula[2]!,
        celula: { larguraCm: numero(celula[3]!), alturaCm: numero(celula[4]!) },
        xCm: numero(celula[5]!),
        yCm: numero(celula[6]!),
        foto: { larguraCm: Number(celula[7]), alturaCm: Number(celula[8]) },
      });
    }
  }
  return modelos;
}
