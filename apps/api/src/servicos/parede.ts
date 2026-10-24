import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  arredondarCm,
  calcularRetificacao,
  homografiaLinear,
  LIMITES_REFERENCIA_CM,
  MENSAGEM_MEDIDA_REFERENCIA,
  MENSAGEM_QUADRILATERO_INVALIDO,
  ordenarCantos,
  paredeInteira,
  PERFIS,
  PtSchema,
  pxPorCmLinear,
  validarQuadrilatero,
  type AreaUtil,
  type Parede,
  type Perfil,
  type Projeto,
} from '@deco-wall/domain';
import type { ObjectId } from 'mongodb';
import { z } from 'zod';
import { apagarArquivo, gravarTemporario, promoverTemporario } from '../armazenamento/pasta';
import type { ContextoApi } from '../contexto';
import { ErroHttp, naoEncontrado } from '../erros';
import { oid, paraDominio } from '../repositorios/conversao';
import { lerMetadados, processarParede } from './imagem';
import { caminhosDaParede } from './projetos';

// Parede: upload, troca e escala (docs/specs/M1-parede-e-escala.md §3.3 a §3.6, §4.2, §5;
// M1-02, M1-05, M1-08, RN-08, RN-10, RN-33, RN-35, SV-09).

const MENSAGEM_CONFLITO_PROJETO = 'Este projeto foi alterado em outra aba.';
const MENSAGEM_SEM_PAREDE = 'Carregue a foto da parede primeiro.';
const MENSAGEM_COM_PERSPECTIVA = 'Com a perspectiva aplicada, use Perspectiva para refazer a escala.';
const MENSAGEM_COM_FOTOS = 'Não é possível trocar a parede: há fotos posicionadas.';

export interface VarianteAlterada {
  _id: string;
  revisao: number;
  areaUtil: AreaUtil | null;
}

export interface RespostaParede {
  projeto: Projeto;
  variantesAlteradas: VarianteAlterada[];
}

// ---- utilidades ----

async function carregarProjeto(ctx: ContextoApi, id: string) {
  const _id = oid(id);
  if (!_id) throw naoEncontrado();
  const doc = await ctx.db.collection('projetos').findOne({ _id });
  if (!doc) throw naoEncontrado();
  return { _id, projeto: paraDominio<Projeto>(doc) };
}

// SV-09: a alteração da parede só vale se a revisão do projeto ainda for a que a sessão conhece.
async function gravarNoProjeto(
  ctx: ContextoApi,
  _id: ObjectId,
  revisaoBase: number,
  alteracao: { $set: Record<string, unknown>; $unset?: Record<string, ''> },
): Promise<Projeto | null> {
  const doc = await ctx.db.collection('projetos').findOneAndUpdate(
    { _id, revisao: revisaoBase },
    {
      $set: { ...alteracao.$set, atualizadoEm: ctx.agora() },
      ...(alteracao.$unset ? { $unset: alteracao.$unset } : {}),
      $inc: { revisao: 1 },
    },
    { returnDocument: 'after' },
  );
  return doc ? paraDominio<Projeto>(doc) : null;
}

// Ajusta a área útil das variantes que combinam com o filtro e devolve as novas revisões, para a web
// adotá-las (senão o próximo salvamento da variante daria 409 contra si mesmo).
async function atualizarAreasUtil(
  ctx: ContextoApi,
  projetoId: ObjectId,
  quando: 'sem-area' | 'com-area',
  novaArea: AreaUtil | null,
): Promise<VarianteAlterada[]> {
  const variantes = ctx.db.collection('variantes');
  const candidatas = await variantes
    .find({ projetoId, areaUtil: quando === 'sem-area' ? null : { $ne: null } })
    .toArray();
  const alteradas: VarianteAlterada[] = [];
  for (const v of candidatas) {
    const r = await variantes.updateOne(
      { _id: v._id, revisao: v.revisao },
      { $set: { areaUtil: novaArea }, $inc: { revisao: 1 } },
    );
    if (r.matchedCount === 1) {
      alteradas.push({
        _id: (v._id as ObjectId).toHexString(),
        revisao: (v.revisao as number) + 1,
        areaUtil: novaArea,
      });
    }
  }
  return alteradas;
}

function exigirRevisao(projeto: Projeto, revisaoBase: number): void {
  if (projeto.revisao !== revisaoBase) throw new ErroHttp(409, MENSAGEM_CONFLITO_PROJETO);
}

// ---- upload / troca da parede (RF-01, RF-07, M1-05) ----

export const PerfilSchema = z.enum(['leve', 'medio', 'alto']);
const RevisaoSchema = z.int().min(1);

export async function enviarParede(
  ctx: ContextoApi,
  projetoId: string,
  entrada: { perfil: unknown; revisaoBase: unknown; arquivo: Buffer | null },
): Promise<RespostaParede> {
  const perfilLido = PerfilSchema.safeParse(entrada.perfil);
  if (!perfilLido.success) throw new ErroHttp(400, 'Perfil de qualidade inválido.');
  const revisaoLida = RevisaoSchema.safeParse(
    typeof entrada.revisaoBase === 'string' ? Number(entrada.revisaoBase) : entrada.revisaoBase,
  );
  if (!revisaoLida.success) throw new ErroHttp(400, 'Revisão do projeto inválida.');
  if (!entrada.arquivo) throw new ErroHttp(400, 'Envie a foto da parede.');
  const perfil: Perfil = perfilLido.data;

  const { _id, projeto } = await carregarProjeto(ctx, projetoId);
  exigirRevisao(projeto, revisaoLida.data);

  // M1-05: só se troca a parede enquanto nenhuma variante tem fotos.
  if (projeto.parede) {
    const comFotos = await ctx.db
      .collection('variantes')
      .countDocuments({ projetoId: _id, 'fotos.0': { $exists: true } });
    if (comFotos > 0) throw new ErroHttp(409, MENSAGEM_COM_FOTOS);
  }

  const processada = await processarParede(entrada.arquivo, perfil);
  const caminhos = caminhosDaParede(ctx.pastaFotos, projetoId);
  const tmpPrincipal = await gravarTemporario(ctx.pastaFotos, processada.principal);
  const tmpThumb = await gravarTemporario(ctx.pastaFotos, processada.thumb);

  const parede: Parede = {
    perfil,
    arquivo: `paredes/${projetoId}.webp`,
    thumb: `paredes/${projetoId}.thumb.webp`,
    larguraPx: processada.larguraPx,
    alturaPx: processada.alturaPx,
    escala: { metodo: null },
  };

  let atualizado: Projeto | null;
  try {
    atualizado = await gravarNoProjeto(ctx, _id, revisaoLida.data, { $set: { parede } });
  } catch (erro) {
    await Promise.all([apagarArquivo(tmpPrincipal), apagarArquivo(tmpThumb)]);
    throw erro;
  }
  if (!atualizado) {
    await Promise.all([apagarArquivo(tmpPrincipal), apagarArquivo(tmpThumb)]);
    throw new ErroHttp(409, MENSAGEM_CONFLITO_PROJETO);
  }

  // Parede nova: a escala e a área útil anteriores deixam de valer.
  const variantesAlteradas = await atualizarAreasUtil(ctx, _id, 'com-area', null);
  await promoverTemporario(tmpPrincipal, caminhos.original);
  await promoverTemporario(tmpThumb, caminhos.thumb);
  await apagarArquivo(caminhos.retificada);
  return { projeto: atualizado, variantesAlteradas };
}

// ---- escala linear (RF-10) ----

const CorpoLinearSchema = z
  .object({
    revisaoBase: RevisaoSchema,
    metodo: z.literal('linear'),
    linear: z.object({ p1: PtSchema, p2: PtSchema, comprimentoCm: z.number() }).strict(),
  })
  .strict();

export async function aplicarCalibracao(
  ctx: ContextoApi,
  projetoId: string,
  corpo: unknown,
): Promise<RespostaParede> {
  const lido = CorpoLinearSchema.safeParse(corpo);
  const { _id, projeto } = await carregarProjeto(ctx, projetoId);
  if (!projeto.parede) throw new ErroHttp(422, MENSAGEM_SEM_PAREDE);
  if (!lido.success) throw new ErroHttp(422, 'Dados da calibração inválidos.');
  const { revisaoBase, linear } = lido.data;
  exigirRevisao(projeto, revisaoBase);
  // M1-02: com a perspectiva aplicada, a calibração linear não existe.
  if (projeto.parede.escala.metodo === 'perspectiva') throw new ErroHttp(422, MENSAGEM_COM_PERSPECTIVA);

  const comprimentoCm = arredondarCm(linear.comprimentoCm);
  if (comprimentoCm < LIMITES_REFERENCIA_CM.min || comprimentoCm > LIMITES_REFERENCIA_CM.max) {
    throw new ErroHttp(422, MENSAGEM_MEDIDA_REFERENCIA);
  }
  const { larguraPx, alturaPx } = projeto.parede;
  const dentro = (p: { x: number; y: number }) => p.x >= 0 && p.x <= larguraPx && p.y >= 0 && p.y <= alturaPx;
  if (!dentro(linear.p1) || !dentro(linear.p2))
    throw new ErroHttp(422, 'Os pontos do segmento precisam estar sobre a foto.');
  const distancia = Math.hypot(linear.p2.x - linear.p1.x, linear.p2.y - linear.p1.y);
  if (!(distancia > 0)) throw new ErroHttp(422, 'O segmento precisa ter comprimento maior que zero.');

  const pxPorCm = pxPorCmLinear(linear.p1, linear.p2, comprimentoCm);
  const escala = {
    metodo: 'linear' as const,
    linear: { p1: linear.p1, p2: linear.p2, comprimentoCm },
    homografia: homografiaLinear(pxPorCm),
  };
  const atualizado = await gravarNoProjeto(ctx, _id, revisaoBase, {
    $set: { 'parede.escala': escala },
    $unset: { 'parede.retificada': '' },
  });
  if (!atualizado) throw new ErroHttp(409, MENSAGEM_CONFLITO_PROJETO);

  // M1-08: a primeira escala grava a área útil = parede inteira, com a mesma função que a web usa.
  const variantesAlteradas = await atualizarAreasUtil(
    ctx,
    _id,
    'sem-area',
    paredeInteira(atualizado.parede!),
  );
  return { projeto: atualizado, variantesAlteradas };
}

// ---- escala por perspectiva (RF-05, ADR-04) ----

const CorpoPerspectivaSchema = z
  .object({
    revisaoBase: RevisaoSchema,
    metodo: z.literal('perspectiva'),
    perspectiva: z
      .object({ cantosPx: z.array(PtSchema).length(4), larguraCm: z.number(), alturaCm: z.number() })
      .strict(),
  })
  .strict();

export async function aplicarPerspectiva(
  ctx: ContextoApi,
  projetoId: string,
  entrada: { dados: unknown; retificada: Buffer | null },
): Promise<RespostaParede> {
  const lido = CorpoPerspectivaSchema.safeParse(entrada.dados);
  const { _id, projeto } = await carregarProjeto(ctx, projetoId);
  if (!projeto.parede) throw new ErroHttp(422, MENSAGEM_SEM_PAREDE);
  if (!lido.success) throw new ErroHttp(422, 'Dados da perspectiva inválidos.');
  const { revisaoBase, perspectiva } = lido.data;
  exigirRevisao(projeto, revisaoBase);

  const { larguraPx: larguraImagemPx, alturaPx: alturaImagemPx, perfil } = projeto.parede;
  const cantosPx = ordenarCantos(perspectiva.cantosPx);
  const quadrilatero = validarQuadrilatero(cantosPx, larguraImagemPx * alturaImagemPx);
  if (!quadrilatero.ok) throw new ErroHttp(422, MENSAGEM_QUADRILATERO_INVALIDO);
  const larguraCm = arredondarCm(perspectiva.larguraCm);
  const alturaCm = arredondarCm(perspectiva.alturaCm);
  for (const medida of [larguraCm, alturaCm]) {
    if (!(medida >= LIMITES_REFERENCIA_CM.min && medida <= LIMITES_REFERENCIA_CM.max)) {
      throw new ErroHttp(422, MENSAGEM_MEDIDA_REFERENCIA);
    }
  }
  if (!entrada.retificada) throw new ErroHttp(422, 'Envie a imagem retificada.');

  // O servidor recalcula H e a geometria (fonte da verdade) e confere o bitmap recebido (±1 px).
  let r;
  try {
    r = calcularRetificacao({
      cantosPx,
      larguraCm,
      alturaCm,
      larguraImagemPx,
      alturaImagemPx,
      ladoMaxPx: PERFIS[perfil].ladoParedePx,
    });
  } catch {
    throw new ErroHttp(422, MENSAGEM_QUADRILATERO_INVALIDO);
  }
  let meta;
  try {
    meta = await lerMetadados(entrada.retificada);
  } catch {
    throw new ErroHttp(422, 'A imagem retificada não pôde ser lida.');
  }
  if (
    meta.format !== 'webp' ||
    Math.abs((meta.width ?? 0) - r.larguraPx) > 1 ||
    Math.abs((meta.height ?? 0) - r.alturaPx) > 1
  ) {
    throw new ErroHttp(
      422,
      `As dimensões da imagem retificada não conferem: esperado ${r.larguraPx} × ${r.alturaPx} px.`,
    );
  }

  const caminhos = caminhosDaParede(ctx.pastaFotos, projetoId);
  const tmp = await gravarTemporario(ctx.pastaFotos, entrada.retificada);
  const escala = {
    metodo: 'perspectiva' as const,
    perspectiva: { cantosPx, larguraCm, alturaCm },
    homografia: r.homografia,
  };
  const retificada = {
    arquivo: `paredes/${projetoId}.retificada.webp`,
    larguraPx: r.larguraPx,
    alturaPx: r.alturaPx,
    pxPorCm: r.pxPorCm,
    origemCm: r.origemCm,
  };

  let atualizado: Projeto | null;
  try {
    atualizado = await gravarNoProjeto(ctx, _id, revisaoBase, {
      $set: { 'parede.escala': escala, 'parede.retificada': retificada },
    });
  } catch (erro) {
    await apagarArquivo(tmp);
    throw erro;
  }
  if (!atualizado) {
    await apagarArquivo(tmp);
    throw new ErroHttp(409, MENSAGEM_CONFLITO_PROJETO);
  }

  const variantesAlteradas = await atualizarAreasUtil(
    ctx,
    _id,
    'sem-area',
    paredeInteira(atualizado.parede!),
  );
  await promoverTemporario(tmp, caminhos.retificada);
  return { projeto: atualizado, variantesAlteradas };
}

// ---- arquivos da parede (A-19) ----

export type TipoArquivoParede = 'original' | 'retificada' | 'thumb';

export async function lerArquivoParede(
  ctx: ContextoApi,
  projetoId: string,
  tipo: TipoArquivoParede,
): Promise<{ conteudo: Buffer; etag: string }> {
  const { projeto } = await carregarProjeto(ctx, projetoId);
  const relativo =
    tipo === 'original'
      ? projeto.parede?.arquivo
      : tipo === 'thumb'
        ? projeto.parede?.thumb
        : projeto.parede?.retificada?.arquivo;
  if (!relativo) throw naoEncontrado('Arquivo não encontrado.');
  const caminho = join(ctx.pastaFotos, relativo);
  try {
    const [conteudo, info] = await Promise.all([readFile(caminho), stat(caminho)]);
    // O nome do arquivo não muda na troca da parede nem ao refazer a perspectiva: o ETag segue o conteúdo.
    return { conteudo, etag: `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"` };
  } catch {
    throw naoEncontrado('Arquivo não encontrado.');
  }
}
