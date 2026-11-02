import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { MongoClient } from 'mongodb';
import { verificarPastaFotos } from '../armazenamento/pasta';

// GET /api/saude (docs/specs/M0-setup.md §5.3): cada componente responde ok ou erro.
// M4-14: 200 com tudo ok; 503 quando mongo ou pasta está em erro. O corpo é o mesmo nos dois casos (a web lê
// o corpo também no 503 para o indicador de status).

export interface DependenciasSaude {
  pastaFotos: string;
  mongo: MongoClient;
}

export async function registrarSaude(app: FastifyInstance, deps: DependenciasSaude): Promise<void> {
  const versao = await lerVersao();

  app.get('/api/saude', async (_request, reply) => {
    const [mongo, pasta] = await Promise.all([verificarMongo(deps.mongo), verificarPasta(deps.pastaFotos)]);
    return reply.code(mongo === 'ok' && pasta === 'ok' ? 200 : 503).send({ api: 'ok', mongo, pasta, versao });
  });
}

async function verificarMongo(client: MongoClient): Promise<'ok' | 'erro'> {
  try {
    await client.db('admin').command({ ping: 1 });
    return 'ok';
  } catch {
    return 'erro';
  }
}

async function verificarPasta(pastaFotos: string): Promise<'ok' | 'erro'> {
  try {
    await verificarPastaFotos(pastaFotos);
    return 'ok';
  } catch {
    return 'erro';
  }
}

async function lerVersao(): Promise<string> {
  const pacote = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version?: string;
  };
  return pacote.version ?? '0.0.0';
}
