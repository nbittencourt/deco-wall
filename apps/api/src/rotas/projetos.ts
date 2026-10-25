import { NOME_PROJETO_PADRAO } from '@deco-wall/domain';
import type { FastifyInstance } from 'fastify';
import type { ContextoApi } from '../contexto';
import {
  criarProjeto,
  excluirProjeto,
  listarProjetos,
  nomeValido,
  obterProjeto,
  renomearProjeto,
} from '../servicos/projetos';

// Rotas de projetos (docs/specs/M1-parede-e-escala.md §5).
export async function registrarProjetos(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  app.get('/api/projetos', async () => listarProjetos(ctx.db));

  app.post('/api/projetos', async (request, reply) => {
    const corpo = (request.body ?? {}) as { nome?: unknown };
    const nome = corpo.nome === undefined ? NOME_PROJETO_PADRAO : nomeValido(corpo.nome);
    const { projeto, variante } = await criarProjeto(ctx.db, nome, ctx.agora());
    return reply.code(201).send({ projeto, variantes: [variante] });
  });

  app.get<{ Params: { id: string } }>('/api/projetos/:id', async (request) =>
    obterProjeto(ctx.db, request.params.id),
  );

  app.patch<{ Params: { id: string } }>('/api/projetos/:id', async (request) => {
    const corpo = (request.body ?? {}) as { nome?: unknown };
    return renomearProjeto(ctx.db, request.params.id, nomeValido(corpo.nome), ctx.agora());
  });

  app.delete<{ Params: { id: string } }>('/api/projetos/:id', async (request, reply) => {
    await excluirProjeto(ctx.db, ctx.pastaFotos, request.params.id);
    return reply.code(204).send();
  });
}
