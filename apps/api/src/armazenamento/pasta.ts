import { randomUUID } from 'node:crypto';
import { access, constants, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Estrutura de PASTA_FOTOS (docs/specs/M0-setup.md §4.8).
const SUBPASTAS = ['imagens', 'paredes', 'tmp'] as const;

export async function prepararPastaFotos(raiz: string): Promise<void> {
  for (const sub of SUBPASTAS) {
    await mkdir(join(raiz, sub), { recursive: true });
  }
}

// ADR-11 / §5.3: a pasta precisa existir e aceitar gravação. Lança com mensagem que cita PASTA_FOTOS.
export async function verificarPastaFotos(raiz: string): Promise<void> {
  let info;
  try {
    info = await stat(raiz);
  } catch {
    throw new Error(`PASTA_FOTOS não existe: ${raiz}`);
  }
  if (!info.isDirectory()) throw new Error(`PASTA_FOTOS não é uma pasta: ${raiz}`);
  try {
    await access(raiz, constants.W_OK);
  } catch {
    throw new Error(`PASTA_FOTOS sem permissão de gravação: ${raiz}`);
  }
}

// ADR-07 / §4.8: grava em tmp/ e troca de nome (rename), para que o destino nunca fique pela metade.
export async function gravarAtomico(raiz: string, destino: string, conteudo: Buffer): Promise<void> {
  const tmp = join(raiz, 'tmp', randomUUID());
  await mkdir(join(raiz, 'tmp'), { recursive: true });
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(tmp, conteudo);
  await rename(tmp, destino);
}

// Gravação em duas fases, para só trocar o arquivo definitivo depois que o banco aceitar a alteração (409 não deixa rastro).
export async function gravarTemporario(raiz: string, conteudo: Buffer): Promise<string> {
  const tmp = join(raiz, 'tmp', randomUUID());
  await mkdir(join(raiz, 'tmp'), { recursive: true });
  await writeFile(tmp, conteudo);
  return tmp;
}

export async function promoverTemporario(tmp: string, destino: string): Promise<void> {
  await mkdir(dirname(destino), { recursive: true });
  await rename(tmp, destino);
}

export async function apagarArquivo(caminho: string): Promise<void> {
  await rm(caminho, { force: true });
}
