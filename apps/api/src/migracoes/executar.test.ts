import type { Db, MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirBancoTesteLimpo } from '../../../../tests/fixtures/banco-teste';
import { executarMigracoes } from './executar';

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  ({ client, db } = await abrirBancoTesteLimpo());
});

afterAll(async () => {
  await client.close();
});

const COLECOES = ['imagens', 'projetos', 'variantes', 'rascunhos', 'migracoes'];

async function chavesDeIndice(colecao: string): Promise<Record<string, number>[]> {
  return (await db.collection(colecao).indexes()).map((i) => i.key as Record<string, number>);
}

describe('migração 0001-inicial (docs/specs/M0-setup.md §4.7, §5.3)', () => {
  it('cria as coleções imagens, projetos, variantes, rascunhos e migracoes', async () => {
    await executarMigracoes(db);
    const nomes = (await db.listCollections().toArray()).map((c) => c.name);
    expect(nomes).toEqual(expect.arrayContaining(COLECOES));
  });

  it('cria os índices de imagens (§4.3)', async () => {
    const chaves = await chavesDeIndice('imagens');
    expect(chaves).toContainEqual({ excluidaEm: 1, criadaEm: -1 });
    expect(chaves).toContainEqual({ projetos: 1, excluidaEm: 1 });
    expect(chaves).toContainEqual({ purgaEm: 1 });
    expect(chaves).toContainEqual({ nomeOriginal: 1 });
  });

  it('cria o índice de projetos (§4.4)', async () => {
    expect(await chavesDeIndice('projetos')).toContainEqual({ atualizadoEm: -1 });
  });

  it('cria os índices de variantes (§4.5)', async () => {
    const chaves = await chavesDeIndice('variantes');
    expect(chaves).toContainEqual({ projetoId: 1, ordem: 1 });
    expect(chaves).toContainEqual({ 'fotos.imagemId': 1 });
    expect(chaves).toContainEqual({ 'fotos.imagemAnteriorId': 1 });
  });

  it('cria os índices de rascunhos, sendo {varianteId, sessaoId} único (§4.6)', async () => {
    const indices = await db.collection('rascunhos').indexes();
    const unico = indices.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ varianteId: 1, sessaoId: 1 }),
    );
    expect(unico?.unique).toBe(true);
    expect(await chavesDeIndice('rascunhos')).toContainEqual({ projetoId: 1 });
  });

  it('aplica validador $jsonSchema strict com validationAction error em cada coleção (DM-07)', async () => {
    for (const nome of ['imagens', 'projetos', 'variantes', 'rascunhos']) {
      const info = await db.listCollections({ name: nome }, { nameOnly: false }).next();
      const opcoes = info?.options as Record<string, unknown>;
      expect(opcoes.validationLevel, nome).toBe('strict');
      expect(opcoes.validationAction, nome).toBe('error');
      expect((opcoes.validator as { $jsonSchema?: unknown } | undefined)?.$jsonSchema, nome).toBeTruthy();
    }
  });

  it('registra 0001-inicial na coleção migracoes', async () => {
    const registros = await db.collection('migracoes').find({}).toArray();
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ _id: '0001-inicial', aplicadaEm: expect.any(Date) });
  });

  it('é idempotente: rodar de novo não falha, não duplica registro nem índice', async () => {
    const indicesAntes = await chavesDeIndice('variantes');
    await expect(executarMigracoes(db)).resolves.not.toThrow();
    await expect(executarMigracoes(db)).resolves.not.toThrow();
    expect(await db.collection('migracoes').countDocuments({})).toBe(1);
    expect(await chavesDeIndice('variantes')).toEqual(indicesAntes);
  });
});
