import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import type { MongoClient } from 'mongodb';
import type { ContextoApi } from './contexto';
import { ErroHttp } from './erros';
import { registrarParede } from './rotas/parede';
import { registrarProjetos } from './rotas/projetos';
import { registrarSaude } from './rotas/saude';
import { registrarVariantes } from './rotas/variantes';

// Monta a API completa (rotas, multipart, erros em pt-BR). Usado por main.ts e pelos testes de integração.
export interface DependenciasApp {
  pastaFotos: string;
  mongo: MongoClient;
  // Limite por arquivo no upload (UPLOAD_MAX_MB); padrão 50.
  uploadMaxMb?: number;
  agora?: () => Date;
  logger?: boolean;
}

export async function criarApp(deps: DependenciasApp): Promise<FastifyInstance> {
  const uploadMaxMb = deps.uploadMaxMb ?? 50;
  const ctx: ContextoApi = {
    db: deps.mongo.db(),
    pastaFotos: deps.pastaFotos,
    uploadMaxMb,
    agora: deps.agora ?? (() => new Date()),
  };

  // O limite do corpo JSON acompanha o do upload; o multipart tem limite próprio por arquivo.
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: (uploadMaxMb + 1) * 1024 * 1024 });
  await app.register(multipart, { limits: { fileSize: uploadMaxMb * 1024 * 1024, files: 2, fields: 10 } });

  app.setErrorHandler((erro, request, reply) => {
    if (erro instanceof ErroHttp) return reply.code(erro.status).send(erro.corpo);
    const status = (erro as { statusCode?: number }).statusCode;
    if (status === 413) return reply.code(413).send({ erro: `Arquivo maior que ${uploadMaxMb} MB.` });
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ erro: 'Requisição inválida.' });
    request.log.error(erro);
    return reply.code(500).send({ erro: 'Erro interno do servidor.' });
  });

  await registrarSaude(app, { pastaFotos: deps.pastaFotos, mongo: deps.mongo });
  await registrarProjetos(app, ctx);
  await registrarParede(app, ctx);
  await registrarVariantes(app, ctx);
  return app;
}
