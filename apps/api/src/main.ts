import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepararPastaFotos, verificarPastaFotos } from './armazenamento/pasta';
import { ErroConfiguracao, lerConfig, type Config } from './config';
import { executarMigracoes } from './migracoes/executar';
import { conectarMongo } from './repositorios/mongo';
import { criarApp } from './app';
import { repararInconsistencias } from './servicos/reparo';
import type { MongoClient } from 'mongodb';

// Ponto de entrada da API (docs/specs/M0-setup.md §5.3, T7). Em produção local a API serve o build da web.
const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));
const ARQUIVO_ENV = join(RAIZ, '.env');
const PASTA_WEB = join(RAIZ, 'apps', 'web', 'dist');

if (existsSync(ARQUIVO_ENV)) process.loadEnvFile(ARQUIVO_ENV);

// Falha de inicialização: mensagem clara e saída com código de erro (aceite 3).
function encerrar(motivo: string): never {
  console.error(`\nA API não iniciou.\n${motivo}\n`);
  process.exit(1);
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

async function registrarWeb(app: FastifyInstance): Promise<boolean> {
  if (!existsSync(PASTA_WEB)) return false;
  await app.register(fastifyStatic, { root: PASTA_WEB, prefix: '/' });
  // Rotas do cliente (ex.: /editor) caem no index.html; caminhos /api inexistentes continuam 404.
  app.setNotFoundHandler(async (requisicao, resposta) => {
    if (requisicao.url.startsWith('/api/')) return resposta.code(404).send({ erro: 'Não encontrado' });
    return resposta.sendFile('index.html');
  });
  return true;
}

async function iniciar(config: Config): Promise<void> {
  try {
    await verificarPastaFotos(config.pastaFotos);
    await prepararPastaFotos(config.pastaFotos);
  } catch (erro) {
    encerrar(mensagem(erro));
  }

  let mongo: MongoClient;
  try {
    mongo = await conectarMongo(config.mongoUri);
  } catch (erro) {
    encerrar(mensagem(erro));
  }
  await executarMigracoes(mongo.db());

  // A-18: sem transações, restos de falhas anteriores são corrigidos na inicialização.
  const reparo = await repararInconsistencias(mongo.db(), new Date());
  const app = await criarApp({
    pastaFotos: config.pastaFotos,
    mongo,
    uploadMaxMb: config.uploadMaxMb,
    logger: true,
  });
  if (reparo.variantesCriadas + reparo.variantesApagadas + reparo.rascunhosApagados > 0) {
    app.log.warn(reparo, 'Inconsistências corrigidas na inicialização');
  }
  const servindoWeb = await registrarWeb(app);
  if (!servindoWeb) {
    app.log.warn('apps/web/dist não encontrado: rode "npm run build" para servir a interface.');
  }

  const desligar = async () => {
    await app.close();
    await mongo.close();
    process.exit(0);
  };
  process.once('SIGINT', desligar);
  process.once('SIGTERM', desligar);

  try {
    await app.listen({ host: config.hostApi, port: config.apiPort });
  } catch (erro) {
    encerrar(mensagem(erro));
  }
}

try {
  const config = lerConfig(process.env);
  await iniciar(config);
} catch (erro) {
  if (erro instanceof ErroConfiguracao) encerrar(erro.message);
  throw erro;
}
