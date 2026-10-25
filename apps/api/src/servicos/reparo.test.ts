import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { abrirBancoTesteLimpo, paraMongo } from '../../../../tests/fixtures/banco-teste';
import { id, projeto, rascunho, variante } from '../../../../tests/fixtures/dominio';
import { executarMigracoes } from '../migracoes/executar';
import { repararInconsistencias } from './reparo';

// A-18: na inicialização a API corrige restos de falha (não há transações).

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
  await Promise.all(['projetos', 'variantes', 'rascunhos'].map((c) => db.collection(c).deleteMany({})));
});

describe('repararInconsistencias (A-18)', () => {
  it('projeto sem variante ganha a "Base" e passa a apontar para ela', async () => {
    const semUltima = projeto() as Record<string, unknown>;
    delete semUltima.ultimaVarianteId;
    await db.collection('projetos').insertOne(paraMongo(semUltima) as never);

    const resumo = await repararInconsistencias(db, new Date('2026-10-24T12:00:00Z'));

    expect(resumo).toEqual({ variantesCriadas: 1, variantesApagadas: 0, rascunhosApagados: 0 });
    const variantes = await db
      .collection('variantes')
      .find({ projetoId: new ObjectId(id(301)) })
      .toArray();
    expect(variantes).toHaveLength(1);
    expect(variantes[0]).toMatchObject({ nome: 'Base', ordem: 0, revisao: 1, areaUtil: null, fotos: [] });
    const p = await db.collection('projetos').findOne({ _id: new ObjectId(id(301)) });
    expect(p?.ultimaVarianteId?.toHexString()).toBe(variantes[0]!._id.toHexString());
  });

  it('apaga variantes e rascunhos de projeto que não existe mais', async () => {
    await db.collection('variantes').insertOne(paraMongo(variante({ projetoId: id(777) })) as never);
    await db.collection('rascunhos').insertOne(paraMongo(rascunho({ projetoId: id(777) })) as never);

    const resumo = await repararInconsistencias(db, new Date());

    expect(resumo).toEqual({ variantesCriadas: 0, variantesApagadas: 1, rascunhosApagados: 1 });
    expect(await db.collection('variantes').countDocuments()).toBe(0);
    expect(await db.collection('rascunhos').countDocuments()).toBe(0);
  });

  it('não mexe em dados íntegros e é idempotente', async () => {
    await db.collection('projetos').insertOne(paraMongo(projeto()) as never);
    await db.collection('variantes').insertOne(paraMongo(variante()) as never);
    await db.collection('rascunhos').insertOne(paraMongo(rascunho()) as never);

    const primeira = await repararInconsistencias(db, new Date());
    const segunda = await repararInconsistencias(db, new Date());

    const nada = { variantesCriadas: 0, variantesApagadas: 0, rascunhosApagados: 0 };
    expect(primeira).toEqual(nada);
    expect(segunda).toEqual(nada);
    expect(await db.collection('variantes').countDocuments()).toBe(1);
    expect(await db.collection('rascunhos').countDocuments()).toBe(1);
  });
});
