import {
  aplicarTemplate,
  AreaUtilSchema,
  BORDA_MAX_CM,
  BordaSchema,
  copiarParaNovaVariante,
  FotoNaParedeSchema,
  GridSchema,
  NOME_VARIANTE_MAX,
  rascunhoElegivel,
  templatePorId,
  type Projeto,
  type Variante,
} from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ErroHttp, naoEncontrado } from '../erros';
import type { ContextoApi } from '../contexto';
import { oid, paraDominio, paraMongo } from '../repositorios/conversao';
import { SCHEMA_VERSION } from './projetos';

// Variantes: hard save (M1-01, SV-02, SV-04), CRUD (M3-04), template (M3-06) e rascunhos — soft save (SV-01,
// SV-04, SV-06, SV-07, M3-07, M3-08; docs/specs/M3-variantes-templates-e-salvamento.md §5).

const MENSAGEM_SEM_ESCALA = 'A parede está sem escala.';
const MENSAGEM_ULTIMA = 'Todo projeto precisa de ao menos uma variante.';
const NAO_ENCONTRADA = 'Variante não encontrada.';

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

const NomeVarianteSchema = z.string().trim().min(1).max(NOME_VARIANTE_MAX);

export const CorpoRenomearVarianteSchema = z.object({ nome: NomeVarianteSchema }).strict();

const OrigemVarianteSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('vazia') }).strict(),
  z.object({ tipo: z.literal('copia'), fotos: z.array(FotoNaParedeSchema) }).strict(),
  z
    .object({
      tipo: z.literal('template'),
      templateId: z.string().min(1),
      posicaoCm: z.object({ xCm: z.number(), yCm: z.number() }).strict(),
      borda: BordaSchema.refine((b) => b.larguraCm <= BORDA_MAX_CM),
    })
    .strict(),
]);

export const CorpoCriarVarianteSchema = z
  .object({
    sessaoId: z.string().min(1),
    nome: NomeVarianteSchema,
    grid: GridSchema,
    bordaPadrao: BordaSchema,
    areaUtil: AreaUtilSchema.nullable(),
    origem: OrigemVarianteSchema,
  })
  .strict();

export type CorpoCriarVariante = z.infer<typeof CorpoCriarVarianteSchema>;

export const CorpoRascunhoSchema = z
  .object({
    sessaoId: z.string().min(1),
    revisaoBase: z.int().min(1),
    conteudo: z
      .object({
        grid: GridSchema,
        bordaPadrao: BordaSchema,
        areaUtil: AreaUtilSchema.nullable(),
        fotos: z.array(FotoNaParedeSchema),
      })
      .strict(),
  })
  .strict();

export type CorpoRascunho = z.infer<typeof CorpoRascunhoSchema>;

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

async function carregarProjeto(ctx: ContextoApi, projetoId: string) {
  const _id = oid(projetoId);
  if (!_id) throw naoEncontrado();
  const doc = await ctx.db.collection('projetos').findOne({ _id });
  if (!doc) throw naoEncontrado();
  return { _id, projeto: paraDominio<Projeto>(doc) };
}

// A variante precisa existir e ser do projeto.
async function carregarVariante(ctx: ContextoApi, projetoId: string, varianteId: string) {
  const idProjeto = oid(projetoId);
  const idVariante = oid(varianteId);
  if (!idProjeto || !idVariante) throw naoEncontrado(NAO_ENCONTRADA);
  const doc = await ctx.db.collection('variantes').findOne({ _id: idVariante, projetoId: idProjeto });
  if (!doc) throw naoEncontrado(NAO_ENCONTRADA);
  return { idProjeto, idVariante, variante: paraDominio<Variante>(doc) };
}

const semEscala = (projeto: Projeto) => (projeto.parede?.escala.metodo ?? null) === null;

export async function salvarVariante(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
  corpo: CorpoSalvarVariante,
): Promise<{ revisao: number; salvaEm: Date }> {
  const { idProjeto, idVariante } = await carregarVariante(ctx, projetoId, varianteId);
  const { projeto } = await carregarProjeto(ctx, projetoId);

  // A-11: fotos em cm precisam de uma parede com escala.
  if (corpo.fotos.length > 0 && semEscala(projeto)) throw new ErroHttp(422, MENSAGEM_SEM_ESCALA);
  await conferirImagens(ctx, corpo.fotos);

  const variantes = ctx.db.collection('variantes');
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

  // SV-02, A-10: o hard save apaga o rascunho da própria sessão e os obsoletos (não mais novos que a nova versão).
  await ctx.db.collection('rascunhos').deleteMany({
    varianteId: idVariante,
    $or: [{ sessaoId: corpo.sessaoId }, { salvoEm: { $lte: salvaEm } }],
  });
  await ctx.db
    .collection('projetos')
    .updateOne({ _id: idProjeto }, { $set: { atualizadoEm: salvaEm, ultimaVarianteId: idVariante } });
  return { revisao: corpo.revisaoBase + 1, salvaEm };
}

// ---- CRUD (M3-04) ----

export async function obterVariante(ctx: ContextoApi, projetoId: string, varianteId: string) {
  return (await carregarVariante(ctx, projetoId, varianteId)).variante;
}

export async function criarVariante(
  ctx: ContextoApi,
  projetoId: string,
  corpo: CorpoCriarVariante,
): Promise<Variante> {
  const { _id: idProjeto, projeto } = await carregarProjeto(ctx, projetoId);
  const { origem } = corpo;
  const novoId = () => new ObjectId().toHexString();

  let fotos: Variante['fotos'] = [];
  let bordaPadrao = corpo.bordaPadrao;
  let templateOrigem: string | null = null;
  if (origem.tipo === 'template') {
    const template = templatePorId(origem.templateId);
    if (!template) throw naoEncontrado('Template não encontrado.');
    if (semEscala(projeto)) throw new ErroHttp(422, MENSAGEM_SEM_ESCALA);
    // M3-06, RN-30: o servidor aplica o template; o cliente só envia a escolha.
    fotos = aplicarTemplate({ template, posicaoCm: origem.posicaoCm, borda: origem.borda, novoId }).fotos;
    bordaPadrao = origem.borda;
    templateOrigem = template.id;
  } else if (origem.tipo === 'copia') {
    if (origem.fotos.length > 0 && semEscala(projeto)) throw new ErroHttp(422, MENSAGEM_SEM_ESCALA);
    await conferirImagens(ctx, origem.fotos);
    fotos = copiarParaNovaVariante(
      { grid: corpo.grid, bordaPadrao, areaUtil: corpo.areaUtil, fotos: origem.fotos },
      novoId,
    ).fotos;
  }

  const ultima = await ctx.db
    .collection('variantes')
    .find({ projetoId: idProjeto }, { projection: { ordem: 1 } })
    .sort({ ordem: -1 })
    .limit(1)
    .toArray();
  const agora = ctx.agora();
  const variante: Variante = {
    _id: novoId(),
    projetoId,
    nome: corpo.nome,
    ordem: ((ultima[0]?.ordem as number | undefined) ?? -1) + 1,
    criadaEm: agora,
    revisao: 1,
    salvaEm: agora,
    salvaPorSessao: corpo.sessaoId,
    grid: corpo.grid,
    bordaPadrao,
    areaUtil: corpo.areaUtil,
    ...(templateOrigem ? { templateOrigem } : {}),
    fotos,
    schemaVersion: SCHEMA_VERSION,
  };
  await ctx.db.collection('variantes').insertOne(paraMongo(variante) as never);
  await registrarProjetoNasImagens(ctx, idProjeto, fotos);
  await ctx.db
    .collection('projetos')
    .updateOne(
      { _id: idProjeto },
      { $set: { atualizadoEm: agora, ultimaVarianteId: new ObjectId(variante._id) } },
    );
  return variante;
}

// M3-04: renomear não gera revisão.
export async function renomearVariante(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
  nome: string,
): Promise<{ _id: string; nome: string }> {
  const { idVariante } = await carregarVariante(ctx, projetoId, varianteId);
  await ctx.db.collection('variantes').updateOne({ _id: idVariante }, { $set: { nome } });
  return { _id: varianteId, nome };
}

// M3-04, RN-23: exclusão física (variante + rascunhos); a última variante não se exclui. Se era a aberta por último,
// o projeto passa a abrir na anterior na ordem (ou na seguinte, se era a primeira).
export async function excluirVariante(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
): Promise<void> {
  const { idProjeto, idVariante, variante } = await carregarVariante(ctx, projetoId, varianteId);
  const variantes = ctx.db.collection('variantes');
  const todas = await variantes
    .find({ projetoId: idProjeto }, { projection: { ordem: 1 } })
    .sort({ ordem: 1 })
    .toArray();
  if (todas.length <= 1) throw new ErroHttp(409, MENSAGEM_ULTIMA);

  await ctx.db.collection('rascunhos').deleteMany({ varianteId: idVariante });
  await variantes.deleteOne({ _id: idVariante });

  const restantes = todas.filter((v) => !(v._id as ObjectId).equals(idVariante));
  const anteriores = restantes.filter((v) => (v.ordem as number) < variante.ordem);
  const vizinha = anteriores.length > 0 ? anteriores[anteriores.length - 1]! : restantes[0]!;
  await ctx.db
    .collection('projetos')
    .updateOne({ _id: idProjeto, ultimaVarianteId: idVariante }, { $set: { ultimaVarianteId: vizinha._id } });
}

// ---- rascunhos — soft save (M3-07, M3-08) ----

export async function salvarRascunho(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
  corpo: CorpoRascunho,
): Promise<{ salvoEm: Date }> {
  const { idProjeto, idVariante, variante } = await carregarVariante(ctx, projetoId, varianteId);
  // M3-07: o servidor confere a revisão também no rascunho; em conflito, nada é gravado.
  if (variante.revisao !== corpo.revisaoBase) {
    throw new ErroHttp(409, 'Esta variante foi salva em outra aba.', {
      revisao: variante.revisao,
      salvaEm: variante.salvaEm,
      salvaPorSessao: variante.salvaPorSessao,
    });
  }
  const salvoEm = ctx.agora();
  await ctx.db.collection('rascunhos').updateOne(
    { varianteId: idVariante, sessaoId: corpo.sessaoId },
    {
      $set: {
        projetoId: idProjeto,
        revisaoBase: corpo.revisaoBase,
        conteudo: paraMongo(corpo.conteudo),
        salvoEm,
      },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
  return { salvoEm };
}

export interface RascunhoCompleto {
  sessaoId: string;
  revisaoBase: number;
  conteudo: CorpoRascunho['conteudo'];
  salvoEm: Date;
}

// Com `sessaoId`, o rascunho daquela sessão; sem, o mais recente elegível (mais novo que a versão oficial).
export async function obterRascunho(
  ctx: ContextoApi,
  projetoId: string,
  varianteId: string,
  sessaoId: string | undefined,
): Promise<RascunhoCompleto> {
  const { idVariante, variante } = await carregarVariante(ctx, projetoId, varianteId);
  const colecao = ctx.db.collection('rascunhos');
  const doc = sessaoId
    ? await colecao.findOne({ varianteId: idVariante, sessaoId })
    : await colecao
        .find({ varianteId: idVariante, salvoEm: { $gt: new Date(variante.salvaEm) } })
        .sort({ salvoEm: -1 })
        .limit(1)
        .next();
  if (!doc) throw naoEncontrado('Rascunho não encontrado.');
  const r = paraDominio<RascunhoCompleto>(doc);
  return { sessaoId: r.sessaoId, revisaoBase: r.revisaoBase, conteudo: r.conteudo, salvoEm: r.salvoEm };
}

// Idempotente: sem rascunho, também termina bem.
export async function apagarRascunho(ctx: ContextoApi, varianteId: string, sessaoId: string): Promise<void> {
  const idVariante = oid(varianteId);
  if (!idVariante) return;
  await ctx.db.collection('rascunhos').deleteOne({ varianteId: idVariante, sessaoId });
}

export interface ResumoRascunho {
  varianteId: string;
  sessaoId: string;
  salvoEm: Date;
  revisaoBase: number;
  qtdFotos: number;
}

// M3-08: um por variante, o mais recente de qualquer sessão que seja mais novo que a versão oficial.
export async function resumirRascunhos(
  ctx: ContextoApi,
  idProjeto: ObjectId,
  variantes: readonly Pick<Variante, '_id' | 'salvaEm'>[],
): Promise<ResumoRascunho[]> {
  const docs = await ctx.db
    .collection('rascunhos')
    .aggregate<Record<string, unknown>>([
      { $match: { projetoId: idProjeto } },
      {
        $project: {
          varianteId: 1,
          sessaoId: 1,
          salvoEm: 1,
          revisaoBase: 1,
          qtdFotos: { $size: '$conteudo.fotos' },
        },
      },
    ])
    .toArray();
  const todos = docs.map((d) => paraDominio<ResumoRascunho>(d));
  const resumo: ResumoRascunho[] = [];
  for (const variante of variantes) {
    const elegivel = rascunhoElegivel(
      { salvaEm: new Date(variante.salvaEm) },
      todos.filter((r) => r.varianteId === variante._id),
    );
    if (elegivel) {
      resumo.push({
        varianteId: elegivel.varianteId,
        sessaoId: elegivel.sessaoId,
        salvoEm: elegivel.salvoEm,
        revisaoBase: elegivel.revisaoBase,
        qtdFotos: elegivel.qtdFotos,
      });
    }
  }
  return resumo;
}
