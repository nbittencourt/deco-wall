import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import {
  apagarRascunho,
  CorpoCriarVarianteSchema,
  CorpoRascunhoSchema,
  CorpoRenomearVarianteSchema,
  CorpoSalvarVarianteSchema,
  criarVariante,
  excluirVariante,
  obterRascunho,
  obterVariante,
  renomearVariante,
  salvarRascunho,
  salvarVariante,
} from '../servicos/variantes';

// Variantes e rascunhos (docs/specs/M1-parede-e-escala.md §3.8, §5; docs/specs/M3-variantes-templates-e-salvamento.md §5).

function lerCorpo<T extends z.ZodType>(schema: T, corpo: unknown, mensagem: string): z.infer<T> {
  const lido = schema.safeParse(corpo);
  if (!lido.success) {
    throw new ErroHttp(400, mensagem, {
      erro: mensagem,
      detalhes: lido.error.issues.map((i) => ({ caminho: i.path.join('.'), mensagem: i.message })),
    });
  }
  return lido.data;
}

type ParamsVariante = { projetoId: string; id: string };

export async function registrarVariantes(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  const base = '/api/projetos/:projetoId/variantes';

  app.post<{ Params: { projetoId: string } }>(base, async (request, reply) => {
    const corpo = lerCorpo(CorpoCriarVarianteSchema, request.body, 'Dados da variante inválidos.');
    const { variante, imagensExcluidas } = await criarVariante(ctx, request.params.projetoId, corpo);
    return reply.code(201).send({ variante, imagensExcluidas });
  });

  app.get<{ Params: ParamsVariante }>(`${base}/:id`, async (request) =>
    obterVariante(ctx, request.params.projetoId, request.params.id),
  );

  app.put<{ Params: ParamsVariante }>(`${base}/:id`, async (request) => {
    const corpo = lerCorpo(CorpoSalvarVarianteSchema, request.body, 'Dados da variante inválidos.');
    const { revisao, salvaEm, imagensExcluidas } = await salvarVariante(
      ctx,
      request.params.projetoId,
      request.params.id,
      corpo,
    );
    return { revisao, salvaEm, imagensExcluidas };
  });

  app.patch<{ Params: ParamsVariante }>(`${base}/:id`, async (request) => {
    const corpo = lerCorpo(CorpoRenomearVarianteSchema, request.body, 'Nome da variante inválido.');
    return renomearVariante(ctx, request.params.projetoId, request.params.id, corpo.nome);
  });

  app.delete<{ Params: ParamsVariante }>(`${base}/:id`, async (request, reply) => {
    await excluirVariante(ctx, request.params.projetoId, request.params.id);
    return reply.code(204).send();
  });

  app.put<{ Params: ParamsVariante }>(`${base}/:id/rascunho`, async (request) => {
    const corpo = lerCorpo(CorpoRascunhoSchema, request.body, 'Dados do rascunho inválidos.');
    return salvarRascunho(ctx, request.params.projetoId, request.params.id, corpo);
  });

  app.get<{ Params: ParamsVariante; Querystring: { sessaoId?: string } }>(
    `${base}/:id/rascunho`,
    async (request) =>
      obterRascunho(ctx, request.params.projetoId, request.params.id, request.query.sessaoId || undefined),
  );

  app.delete<{ Params: ParamsVariante; Querystring: { sessaoId?: string } }>(
    `${base}/:id/rascunho`,
    async (request, reply) => {
      const sessaoId = request.query.sessaoId;
      if (!sessaoId) throw new ErroHttp(400, 'Informe a sessão do rascunho.');
      await apagarRascunho(ctx, request.params.id, sessaoId);
      return reply.code(204).send();
    },
  );
}
