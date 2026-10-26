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

// §5: todo `imagemId` não nulo precisa existir em `imagens`; senão, 422 com a lista. A imagem excluída conta
// como existente (a exclusão e o placeholder automático são do M4), e o placeholder (`imagemId` nulo) é aceito.
async function conferirImagens(ctx: ContextoApi, fotos: CorpoSalvarVariante['fotos']): Promise<void> {
  const ids = imagensUsadas(fotos);
  if (ids.length === 0) return;
  const existentes = await ctx.db
    .collection('imagens')
    .find({ _id: { $in: ids } }, { projection: { _id: 1 } })
    .toArray();
  const achadas = new Set(existentes.map((d) => d._id.toHexString()));
  const imagensInexistentes = ids.map((id) => id.toHexString()).filter((id) => !achadas.has(id));
  if (imagensInexistentes.length > 0) {
    const erro = 'Há fotos que usam imagens inexistentes.';
    throw new ErroHttp(422, erro, { erro, detalhes: { imagensInexistentes } });
  }
}

// DM-05, M2-05: "fotos do projeto" = carregadas no projeto ou usadas em qualquer variante dele. Falha aqui não
// desfaz o salvamento: vai para o log e o próximo salvamento repete, porque cada um associa todas as imagens usadas.
async function registrarProjetoNasImagens(
  ctx: ContextoApi,
  idProjeto: ObjectId,
  fotos: CorpoSalvarVariante['fotos'],
): Promise<void> {
  const ids = imagensUsadas(fotos);
  if (ids.length === 0) return;
  try {
    await ctx.db
      .collection('imagens')
      .updateMany({ _id: { $in: ids } }, { $addToSet: { projetos: idProjeto } });
  } catch (erro) {
    ctx.log.error(erro, 'Não foi possível associar o projeto às imagens usadas.');
  }
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

  await conferirImagens(ctx, corpo.fotos);

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
