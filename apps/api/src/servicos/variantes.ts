import { AreaUtilSchema, BordaSchema, FotoNaParedeSchema, GridSchema } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
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

// Ids das imagens usadas pelas fotos (sem repetir; placeholders não têm imagem).
function imagensUsadas(fotos: CorpoSalvarVariante['fotos']): ObjectId[] {
  const ids = new Set(fotos.flatMap((f) => (f.imagemId ? [f.imagemId] : [])));
  return [...ids].map((id) => new ObjectId(id));
}

// M2-06: fotos só com escala definida (RN-08), com ids únicos e com imagens que existem e estão ativas.
async function conferirFotos(
  ctx: ContextoApi,
  idProjeto: ObjectId,
  fotos: CorpoSalvarVariante['fotos'],
): Promise<void> {
  if (fotos.length === 0) return;

  const projeto = await ctx.db.collection('projetos').findOne({ _id: idProjeto });
  const escala = (projeto?.parede as { escala?: { metodo?: string | null } } | null | undefined)?.escala;
  if (!escala?.metodo) throw new ErroHttp(422, 'Defina a escala da parede antes de posicionar fotos.');

  if (new Set(fotos.map((f) => f._id)).size !== fotos.length) {
    throw new ErroHttp(422, 'Há fotos com o mesmo identificador.');
  }

  const ids = imagensUsadas(fotos);
  if (ids.length > 0) {
    const ativas = await ctx.db.collection('imagens').countDocuments({ _id: { $in: ids }, excluidaEm: null });
    if (ativas !== ids.length) {
      throw new ErroHttp(422, 'Há fotos que usam imagens inexistentes ou excluídas.');
    }
  }
}

// DM-05: "fotos do projeto" = carregadas no projeto ou usadas em qualquer variante dele.
async function registrarProjetoNasImagens(
  ctx: ContextoApi,
  idProjeto: ObjectId,
  fotos: CorpoSalvarVariante['fotos'],
): Promise<void> {
  const ids = imagensUsadas(fotos);
  if (ids.length === 0) return;
  await ctx.db
    .collection('imagens')
    .updateMany({ _id: { $in: ids } }, { $addToSet: { projetos: idProjeto } });
}

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

  await conferirFotos(ctx, idProjeto, corpo.fotos);

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

  await registrarProjetoNasImagens(ctx, idProjeto, corpo.fotos);

  // SV-02: o hard save apaga o rascunho da própria sessão.
  await ctx.db.collection('rascunhos').deleteOne({ varianteId: idVariante, sessaoId: corpo.sessaoId });
  await ctx.db
    .collection('projetos')
    .updateOne({ _id: idProjeto }, { $set: { atualizadoEm: salvaEm, ultimaVarianteId: idVariante } });
  return { revisao: corpo.revisaoBase + 1, salvaEm };
}
