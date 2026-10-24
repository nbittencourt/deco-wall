import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { abrirBancoTesteLimpo } from '../../../../tests/fixtures/banco-teste';
import { executarMigracoes } from '../migracoes/executar';
import { criarProjeto } from './projetos';
import type { MongoClient } from 'mongodb';

// A-18: sem transações (Mongo standalone). Criar projeto + "Base" desfaz o projeto se a variante falhar.

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  ({ client, db } = await abrirBancoTesteLimpo());
  await executarMigracoes(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await Promise.all(['projetos', 'variantes'].map((c) => db.collection(c).deleteMany({})));
});

describe('criarProjeto (A-18: compensação sem transações)', () => {
  it('cria o projeto e a "Base" ligados entre si', async () => {
    const { projeto, variante } = await criarProjeto(db, 'Sala', new Date('2026-10-24T12:00:00Z'));
    expect(variante.projetoId).toBe(projeto._id);
    expect(projeto.ultimaVarianteId).toBe(variante._id);
    expect(await db.collection('projetos').countDocuments()).toBe(1);
    expect(await db.collection('variantes').countDocuments()).toBe(1);
  });

  it('se a gravação da variante falhar, o projeto é removido e o erro volta ao chamador', async () => {
    const bancoQuebrado = new Proxy(db, {
      get(alvo, propriedade, receptor) {
        if (propriedade === 'collection') {
          return (nome: string) => {
            if (nome === 'variantes') {
              return {
                insertOne: async () => {
                  throw new Error('falha simulada na variante');
                },
              };
            }
            return alvo.collection(nome);
          };
        }
        const valor = Reflect.get(alvo, propriedade, receptor);
        return typeof valor === 'function' ? valor.bind(alvo) : valor;
      },
    }) as Db;

    await expect(criarProjeto(bancoQuebrado, 'Sala', new Date())).rejects.toThrow(
      'falha simulada na variante',
    );
    expect(await db.collection('projetos').countDocuments()).toBe(0);
    expect(await db.collection('variantes').countDocuments()).toBe(0);
  });
});
