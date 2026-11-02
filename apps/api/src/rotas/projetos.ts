import { NOME_PROJETO_PADRAO } from '@deco-wall/domain';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import {
  criarProjeto,
  excluirProjeto,
  listarProjetos,
  atualizarProjeto,
  nomeValido,
  obterProjeto,
} from '../servicos/projetos';
import { resumirRascunhos } from '../servicos/variantes';

// Rotas de projetos (docs/specs/M1-parede-e-escala.md §5).
export async function registrarProjetos(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  app.get('/api/projetos', async () => listarProjetos(ctx.db));

  app.post('/api/projetos', async (request, reply) => {
    const corpo = (request.body ?? {}) as { nome?: unknown };
    const nome = corpo.nome === undefined ? NOME_PROJETO_PADRAO : nomeValido(corpo.nome);
    const { projeto, variante } = await criarProjeto(ctx.db, nome, ctx.agora());
    return reply.code(201).send({ projeto, variantes: [variante] });
  });

  // M3-08: junto do projeto vem o resumo dos rascunhos elegíveis (um por variante).
  app.get<{ Params: { id: string } }>('/api/projetos/:id', async (request) => {
    const base = await obterProjeto(ctx.db, request.params.id);
    const rascunhos = await resumirRascunhos(ctx, new ObjectId(request.params.id), base.variantes);
    return { ...base, rascunhos };
  });

  app.patch<{ Params: { id: string } }>('/api/projetos/:id', async (request) => {
    const corpo = (request.body ?? {}) as { nome?: unknown; ultimaVarianteId?: unknown };
    const temNome = 'nome' in corpo;
    const temUltima = corpo.ultimaVarianteId !== undefined;
    if (!temNome && !temUltima) throw new ErroHttp(400, 'Nada para atualizar.');
    if (temUltima && typeof corpo.ultimaVarianteId !== 'string') {
      throw new ErroHttp(400, 'Variante inválida.');
    }
    return atualizarProjeto(
      ctx.db,
      request.params.id,
      {
        ...(temNome ? { nome: nomeValido(corpo.nome) } : {}),
        ...(temUltima ? { ultimaVarianteId: corpo.ultimaVarianteId as string } : {}),
      },
      ctx.agora(),
    );
  });

  app.delete<{ Params: { id: string } }>('/api/projetos/:id', async (request, reply) => {
    await excluirProjeto(ctx.db, ctx.pastaFotos, request.params.id);
    return reply.code(204).send();
  });
}
