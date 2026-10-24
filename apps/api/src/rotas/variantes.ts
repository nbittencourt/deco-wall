import type { FastifyInstance } from 'fastify';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import { CorpoSalvarVarianteSchema, salvarVariante } from '../servicos/variantes';

// Salvamento manual da variante (docs/specs/M1-parede-e-escala.md §3.8, §5).
export async function registrarVariantes(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  app.put<{ Params: { projetoId: string; id: string } }>(
    '/api/projetos/:projetoId/variantes/:id',
    async (request) => {
      const corpo = CorpoSalvarVarianteSchema.safeParse(request.body);
      if (!corpo.success) {
        throw new ErroHttp(400, 'Dados da variante inválidos.', {
          erro: 'Dados da variante inválidos.',
          detalhes: corpo.error.issues.map((i) => ({ caminho: i.path.join('.'), mensagem: i.message })),
        });
      }
      const { revisao, salvaEm } = await salvarVariante(
        ctx,
        request.params.projetoId,
        request.params.id,
        corpo.data,
      );
      return { revisao, salvaEm };
    },
  );
}
