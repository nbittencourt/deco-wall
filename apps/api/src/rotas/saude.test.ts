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
      expect(res.statusCode).toBe(200);
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

  it('marca mongo como erro quando o banco não responde, sem derrubar a API (503 com o mesmo corpo)', async () => {
    const app = await servidor(pasta, mortoClient);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/saude' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ api: 'ok', mongo: 'erro', pasta: 'ok', versao: expect.any(String) });
    } finally {
      await app.close();
    }
  });

  it('marca pasta como erro quando PASTA_FOTOS não existe (503 com o mesmo corpo)', async () => {
    const app = await servidor(join(pasta, 'nao-existe'), mongo);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/saude' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ api: 'ok', mongo: 'ok', pasta: 'erro', versao: expect.any(String) });
    } finally {
      await app.close();
    }
  });

  it('com mongo e pasta em erro, 503 e os dois componentes marcados (M4-14, A-23)', async () => {
    const app = await servidor(join(pasta, 'nao-existe'), mortoClient);
    try {
      const res = await app.inject({ method: 'GET', url: '/api/saude' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ api: 'ok', mongo: 'erro', pasta: 'erro' });
    } finally {
      await app.close();
    }
  });
});
