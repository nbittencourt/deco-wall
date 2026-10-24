import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uriBancoTeste } from '../../../../tests/fixtures/banco-teste';
import { prepararPastaFotos } from '../armazenamento/pasta';
import { conectarMongo } from '../repositorios/mongo';
import { registrarSaude } from './saude';

let pasta: string;
let mongo: MongoClient;
let mortoClient: MongoClient;

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), 'parede-fotos-saude-'));
  await prepararPastaFotos(pasta);
  mongo = await conectarMongo(uriBancoTeste());
  // Cliente apontando para porta fechada: simula MongoDB fora do ar.
  mortoClient = new MongoClient('mongodb://127.0.0.1:1/parede-fotos', {
    serverSelectionTimeoutMS: 300,
  });
});

afterAll(async () => {
  await mongo.close();
  await mortoClient.close().catch(() => undefined);
  await rm(pasta, { recursive: true, force: true });
});

async function servidor(pastaFotos: string, cliente: MongoClient): Promise<FastifyInstance> {
  const app = Fastify();
  await registrarSaude(app, { pastaFotos, mongo: cliente });
  await app.ready();
  return app;
}

describe('GET /api/saude (docs/specs/M0-setup.md §5.3)', () => {
  it('responde api, mongo e pasta como ok, com a versão', async () => {
    const app = await servidor(pasta, mongo);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/saude' });
      expect(res.json()).toEqual({
        api: 'ok',
        mongo: 'ok',
        pasta: 'ok',
        versao: expect.any(String),
      });
    } finally {
      await app.close();
    }
  });

  it('marca mongo como erro quando o banco não responde, sem derrubar a API', async () => {
    const app = await servidor(pasta, mortoClient);
    try {
      const corpo = (await app.inject({ method: 'GET', url: '/api/saude' })).json();
      expect(corpo).toMatchObject({ api: 'ok', mongo: 'erro', pasta: 'ok' });
    } finally {
      await app.close();
    }
  });

  it('marca pasta como erro quando PASTA_FOTOS não existe', async () => {
    const app = await servidor(join(pasta, 'nao-existe'), mongo);
    try {
      const corpo = (await app.inject({ method: 'GET', url: '/api/saude' })).json();
      expect(corpo).toMatchObject({ api: 'ok', mongo: 'ok', pasta: 'erro' });
    } finally {
      await app.close();
    }
  });
});
