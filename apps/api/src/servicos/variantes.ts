import { AreaUtilSchema, BordaSchema, FotoNaParedeSchema, GridSchema } from '@deco-wall/domain';
import { z } from 'zod';
import { ErroHttp, naoEncontrado } from '../erros';
import type { ContextoApi } from '../contexto';
import { oid, paraDominio, paraMongo } from '../repositorios/conversao';

// Salvamento manual da variante — hard save (M1-01, SV-02, SV-04; docs/specs/M1-parede-e-escala.md §3.8, §5).

export const CorpoSalvarVarianteSchema = z
  .object({
    sessaoId: z.string().min(1),
    revisaoBase: z.int().min(1),
    grid: GridSchema,
    bordaPadrao: BordaSchema,
    areaUtil: AreaUtilSchema.nullable(),
    fotos: z.array(FotoNaParedeSchema),
  })
  .strict();

export type CorpoSalvarVariante = z.infer<typeof CorpoSalvarVarianteSchema>;

export async function salvarVariante(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
  corpo: CorpoSalvarVariante,
): Promise<{ revisao: number; salvaEm: Date }> {
  const idProjeto = oid(projetoId);
  const idVariante = oid(varianteId);
  if (!idProjeto || !idVariante) throw naoEncontrado('Variante não encontrada.');

  const variantes = ctx.db.collection('variantes');
  const existente = await variantes.findOne({ _id: idVariante, projetoId: idProjeto });
  if (!existente) throw naoEncontrado('Variante não encontrada.');

  const salvaEm = ctx.agora();
  // SV-04: a escrita só vale se a revisão oficial ainda for a que esta sessão carregou.
  const resultado = await variantes.updateOne(
    { _id: idVariante, projetoId: idProjeto, revisao: corpo.revisaoBase },
    {
      $set: {
        grid: corpo.grid,
        bordaPadrao: corpo.bordaPadrao,
        areaUtil: corpo.areaUtil,
        fotos: paraMongo(corpo.fotos),
        salvaEm,
        salvaPorSessao: corpo.sessaoId,
      },
      $inc: { revisao: 1 },
    },
  );

  if (resultado.matchedCount === 0) {
    const atual = paraDominio<{ revisao: number; salvaEm: Date; salvaPorSessao: string }>(
      await variantes.findOne({ _id: idVariante, projetoId: idProjeto }),
    );
    throw new ErroHttp(409, 'Esta variante foi salva em outra aba.', {
      revisao: atual.revisao,
      salvaEm: atual.salvaEm,
      salvaPorSessao: atual.salvaPorSessao,
    });
  }

  // SV-02: o hard save apaga o rascunho da própria sessão.
  await ctx.db.collection('rascunhos').deleteOne({ varianteId: idVariante, sessaoId: corpo.sessaoId });
  await ctx.db
    .collection('projetos')
    .updateOne({ _id: idProjeto }, { $set: { atualizadoEm: salvaEm, ultimaVarianteId: idVariante } });
  return { revisao: corpo.revisaoBase + 1, salvaEm };
}
