import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gravarAtomico, prepararPastaFotos, verificarPastaFotos } from './pasta';

let raiz: string;

beforeAll(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'parede-fotos-'));
});

afterAll(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('prepararPastaFotos (docs/specs/M0-setup.md §4.8)', () => {
  it('cria imagens, paredes e tmp dentro de PASTA_FOTOS', async () => {
    await prepararPastaFotos(raiz);
    for (const sub of ['imagens', 'paredes', 'tmp']) {
      expect((await readdir(join(raiz, sub))).length).toBe(0);
    }
  });

  it('é idempotente', async () => {
    await expect(prepararPastaFotos(raiz)).resolves.not.toThrow();
  });
});

describe('verificarPastaFotos (ADR-11, §5.3)', () => {
  it('aceita pasta existente e gravável', async () => {
    await expect(verificarPastaFotos(raiz)).resolves.toBeUndefined();
  });

  it('informa PASTA_FOTOS quando a pasta não existe', async () => {
    await expect(verificarPastaFotos(join(raiz, 'nao-existe'))).rejects.toThrow(/PASTA_FOTOS/);
  });
});

describe('gravarAtomico (ADR-07, §4.8)', () => {
  it('grava o conteúdo no destino final', async () => {
    await prepararPastaFotos(raiz);
    const destino = join(raiz, 'imagens', 'teste.webp');
    await gravarAtomico(raiz, destino, Buffer.from('conteudo'));
    expect((await readFile(destino)).toString()).toBe('conteudo');
  });

  it('não deixa arquivo temporário em tmp/ depois de gravar', async () => {
    expect(await readdir(join(raiz, 'tmp'))).toEqual([]);
  });
});
