import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  diasRestantes,
  PRAZO_PURGA_DIAS,
  restauravel,
  usosDaImagem,
  type Imagem,
  type Projeto,
  type Variante,
} from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { apagarArquivo, gravarTemporario, promoverTemporario } from '../armazenamento/pasta';
import type { ContextoApi } from '../contexto';
import { ErroHttp, naoEncontrado } from '../erros';
import { oid, paraDominio } from '../repositorios/conversao';
import { processarFoto } from './imagem';
import { PerfilSchema } from './parede';
import { SCHEMA_VERSION } from './projetos';

// Biblioteca de imagens (docs/specs/M2-biblioteca-e-composicao.md §3.2, §5; RF-20, RF-22, RF-25, RF-26,
// RF-27, RN-04, RN-21, RN-25, DM-05). O original nunca é guardado; só a versão processada.

const NOME_MAX = 255;

// O navegador pode informar o caminho relativo (envio de pasta): fica só o nome do arquivo.
function nomeDoArquivo(informado: string | undefined): string {
  const nome = (informado ?? '').split(/[\\/]/).pop()?.trim() ?? '';
  return nome === '' ? 'sem-nome' : nome.slice(0, NOME_MAX);
}

export async function enviarImagem(
  ctx: ContextoApi,
  entrada: { perfil: unknown; projetoId: unknown; nomeOriginal: string | undefined; arquivo: Buffer | null },
): Promise<Imagem> {
  const perfil = PerfilSchema.safeParse(entrada.perfil);
  if (!perfil.success) throw new ErroHttp(400, 'Perfil de qualidade inválido.');
  if (typeof entrada.projetoId !== 'string' || entrada.projetoId === '') {
    throw new ErroHttp(400, 'Informe o projeto de origem das fotos.');
  }
  if (!entrada.arquivo) throw new ErroHttp(400, 'Envie a foto.');

  const idProjeto = oid(entrada.projetoId);
  const projeto = idProjeto && (await ctx.db.collection('projetos').findOne({ _id: idProjeto }));
  if (!idProjeto || !projeto) throw naoEncontrado();

  const processada = await processarFoto(entrada.arquivo, perfil.data);

  const _id = new ObjectId();
  const hex = _id.toHexString();
  const relativos = { render: `imagens/${hex}.webp`, thumb: `imagens/${hex}.thumb.webp` };
  const tmpPrincipal = await gravarTemporario(ctx.pastaFotos, processada.principal);
  const tmpThumb = await gravarTemporario(ctx.pastaFotos, processada.thumb);
  const limpar = () => Promise.all([apagarArquivo(tmpPrincipal), apagarArquivo(tmpThumb)]);

  const documento = {
    _id,
    nomeOriginal: nomeDoArquivo(entrada.nomeOriginal),
    perfil: perfil.data,
    larguraPx: processada.larguraPx,
    alturaPx: processada.alturaPx,
    orientacaoNatural: processada.orientacaoNatural,
    bytes: processada.principal.length,
    arquivos: relativos,
    mime: 'image/webp' as const,
    criadaEm: ctx.agora(),
    projetos: [idProjeto],
    excluidaEm: null,
    purgaEm: null,
    schemaVersion: SCHEMA_VERSION,
  };

  try {
    await ctx.db.collection('imagens').insertOne(documento);
  } catch (erro) {
    await limpar();
    throw erro;
  }
  try {
    await promoverTemporario(tmpPrincipal, join(ctx.pastaFotos, relativos.render));
    await promoverTemporario(tmpThumb, join(ctx.pastaFotos, relativos.thumb));
  } catch (erro) {
    // Registro sem arquivo é pior que nenhum registro: desfaz.
    await ctx.db.collection('imagens').deleteOne({ _id });
    await Promise.all([
      limpar(),
      apagarArquivo(join(ctx.pastaFotos, relativos.render)),
      apagarArquivo(join(ctx.pastaFotos, relativos.thumb)),
    ]);
    throw erro;
  }
  return paraDominio<Imagem>(documento);
}

export type SituacaoImagens = 'ativas' | 'excluidas';

export type ImagemExcluida = Imagem & { diasRestantes: number };

// RF-27, RF-28, M4-07: biblioteca global. As excluídas (soft delete) só aparecem enquanto o prazo não vence.
export async function listarImagens(
  ctx: ContextoApi,
  situacao: SituacaoImagens = 'ativas',
): Promise<Imagem[] | ImagemExcluida[]> {
  const colecao = ctx.db.collection('imagens');
  if (situacao === 'ativas') {
    const docs = await colecao.find({ excluidaEm: null }).sort({ criadaEm: -1, _id: -1 }).toArray();
    return docs.map((doc) => paraDominio<Imagem>(doc));
  }
  const agora = ctx.agora();
  const docs = await colecao
    .find({ excluidaEm: { $ne: null }, purgaEm: { $gt: agora } })
    .sort({ excluidaEm: -1, _id: -1 })
    .toArray();
  return docs.map((doc) => {
    const imagem = paraDominio<Imagem>(doc);
    return { ...imagem, diasRestantes: diasRestantes(imagem.purgaEm!, agora) };
  });
}

export type TipoArquivoImagem = 'render' | 'thumb';

export async function lerArquivoImagem(
  ctx: ContextoApi,
  id: string,
  tipo: TipoArquivoImagem,
): Promise<Buffer> {
  const _id = oid(id);
  const doc = _id && (await ctx.db.collection('imagens').findOne({ _id }));
  if (!doc) throw naoEncontrado('Imagem não encontrada.');
  try {
    return await readFile(join(ctx.pastaFotos, (doc.arquivos as Record<string, string>)[tipo]!));
  } catch {
    throw naoEncontrado('Imagem não encontrada.');
  }
}

// ---- ciclo de vida (M4): associações, excluir, restaurar e remover do projeto ----

const MENSAGEM_NAO_ENCONTRADA = 'Imagem não encontrada.';
const MENSAGEM_VENCIDA = 'Esta imagem passou do prazo de 30 dias e será removida.';
const DIA_MS = 86_400_000;

async function carregarImagem(ctx: ContextoApi, id: string) {
  const _id = oid(id);
  const doc = _id && (await ctx.db.collection('imagens').findOne({ _id }));
  if (!_id || !doc) throw naoEncontrado(MENSAGEM_NAO_ENCONTRADA);
  return { _id, imagem: paraDominio<Imagem>(doc) };
}

export interface Associacoes {
  imagem: { _id: string; nomeOriginal: string; thumbUrl: string };
  usos: { projetoId: string; projetoNome: string; varianteId: string; varianteNome: string; vezes: number }[];
  projetos: { projetoId: string; projetoNome: string }[];
}

const porTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

// RF-29, A-06: onde a imagem aparece, nas variantes salvas, e os projetos em que foi carregada.
export async function associacoesDaImagem(ctx: ContextoApi, id: string): Promise<Associacoes> {
  const { _id, imagem } = await carregarImagem(ctx, id);
  const variantes = (await ctx.db.collection('variantes').find({ 'fotos.imagemId': _id }).toArray()).map(
    (doc) => paraDominio<Variante>(doc),
  );
  const idsProjetos = [...new Set([...imagem.projetos, ...variantes.map((v) => v.projetoId)])];
  const projetos = (
    await ctx.db
      .collection('projetos')
      .find({ _id: { $in: idsProjetos.map((p) => new ObjectId(p)) } }, { projection: { nome: 1 } })
      .toArray()
  ).map((doc) => paraDominio<Pick<Projeto, '_id' | 'nome'>>(doc));
  const nomeDo = new Map(projetos.map((p) => [p._id, p.nome]));

  const usos = usosDaImagem(variantes, imagem._id).map((uso) => {
    const variante = variantes.find((v) => v._id === uso.varianteId)!;
    return {
      projetoId: variante.projetoId,
      projetoNome: nomeDo.get(variante.projetoId) ?? '',
      varianteId: variante._id,
      varianteNome: variante.nome,
      vezes: uso.vezes,
      ordem: variante.ordem,
    };
  });
  usos.sort((a, b) => porTexto(a.projetoNome, b.projetoNome) || a.ordem - b.ordem);

  return {
    imagem: {
      _id: imagem._id,
      nomeOriginal: imagem.nomeOriginal,
      thumbUrl: `/api/imagens/${imagem._id}/arquivo?tipo=thumb`,
    },
    usos: usos.map((uso) => ({
      projetoId: uso.projetoId,
      projetoNome: uso.projetoNome,
      varianteId: uso.varianteId,
      varianteNome: uso.varianteNome,
      vezes: uso.vezes,
    })),
    projetos: imagem.projetos
      .filter((p) => nomeDo.has(p))
      .map((p) => ({ projetoId: p, projetoNome: nomeDo.get(p)! }))
      .sort((a, b) => porTexto(a.projetoNome, b.projetoNome)),
  };
}

export interface VarianteAfetada {
  projetoId: string;
  varianteId: string;
  revisao: number;
  fotos: number;
}

const contarDaImagem = (fotos: { imagemId?: ObjectId | null }[], _id: ObjectId) =>
  fotos.filter((f) => f.imagemId?.equals(_id)).length;

// M4-05: cada operação é atômica por documento (arrayFilters + $inc), então um salvamento concorrente nunca
// é sobrescrito; a revisão sobe 1 e `salvaEm`/`salvaPorSessao` ficam como estão (não é um salvamento do usuário).
async function converterFotosDaImagem(
  ctx: ContextoApi,
  _id: ObjectId,
): Promise<{ afetadas: VarianteAfetada[]; fotosConvertidas: number }> {
  const variantes = ctx.db.collection('variantes');
  const candidatas = await variantes.find({ 'fotos.imagemId': _id }, { projection: { _id: 1 } }).toArray();
  const afetadas: VarianteAfetada[] = [];
  for (const { _id: varianteId } of candidatas) {
    const antes = await variantes.findOneAndUpdate(
      { _id: varianteId, 'fotos.imagemId': _id },
      {
        $set: { 'fotos.$[f].imagemId': null, 'fotos.$[f].imagemAnteriorId': _id },
        $inc: { revisao: 1 },
      },
      { arrayFilters: [{ 'f.imagemId': _id }], returnDocument: 'before' },
    );
    if (!antes) continue;
    afetadas.push({
      projetoId: (antes.projetoId as ObjectId).toHexString(),
      varianteId: varianteId.toHexString(),
      revisao: (antes.revisao as number) + 1,
      fotos: contarDaImagem(antes.fotos, _id),
    });
  }
  await ctx.db
    .collection('rascunhos')
    .updateMany(
      { 'conteudo.fotos.imagemId': _id },
      { $set: { 'conteudo.fotos.$[f].imagemId': null, 'conteudo.fotos.$[f].imagemAnteriorId': _id } },
      { arrayFilters: [{ 'f.imagemId': _id }] },
    );
  return { afetadas, fotosConvertidas: afetadas.reduce((soma, a) => soma + a.fotos, 0) };
}

// RN-24, M4-05: marca o prazo de 30 dias e converte as fotos em placeholder em todos os projetos. Repetir é
// seguro: a marca não muda e a conversão só encontra o que sobrou.
export async function excluirImagem(ctx: ContextoApi, id: string) {
  const { _id, imagem } = await carregarImagem(ctx, id);
  let { excluidaEm, purgaEm } = imagem;
  if (excluidaEm === null || purgaEm === null) {
    excluidaEm = ctx.agora();
    purgaEm = new Date(excluidaEm.getTime() + PRAZO_PURGA_DIAS * DIA_MS);
    await ctx.db.collection('imagens').updateOne({ _id }, { $set: { excluidaEm, purgaEm } });
  }
  const { afetadas, fotosConvertidas } = await converterFotosDaImagem(ctx, _id);
  return { imagem: { _id: imagem._id, excluidaEm, purgaEm }, afetadas, fotosConvertidas };
}

// M4-07: sem confirmação e sem repor placeholders (RF-30a); vencida, 410.
export async function restaurarImagem(ctx: ContextoApi, id: string): Promise<{ imagem: Imagem }> {
  const { _id, imagem } = await carregarImagem(ctx, id);
  if (imagem.excluidaEm === null) return { imagem };
  if (!restauravel(imagem, ctx.agora())) throw new ErroHttp(410, MENSAGEM_VENCIDA);
  await ctx.db.collection('imagens').updateOne({ _id }, { $set: { excluidaEm: null, purgaEm: null } });
  return { imagem: { ...imagem, excluidaEm: null, purgaEm: null } };
}

// RF-29, M4-04: tira a imagem do projeto e as fotos dela das variantes salvas e dos rascunhos do projeto.
export async function removerImagemDoProjeto(
  ctx: ContextoApi,
  projetoId: string,
  imagemId: string,
): Promise<{ afetadas: Omit<VarianteAfetada, 'projetoId'>[]; fotosRemovidas: number }> {
  const idProjeto = oid(projetoId);
  const projeto = idProjeto && (await ctx.db.collection('projetos').findOne({ _id: idProjeto }));
  if (!idProjeto || !projeto) throw naoEncontrado();
  const { _id } = await carregarImagem(ctx, imagemId);

  await ctx.db.collection('imagens').updateOne({ _id }, { $pull: { projetos: idProjeto } } as never);

  const variantes = ctx.db.collection('variantes');
  const candidatas = await variantes
    .find({ projetoId: idProjeto, 'fotos.imagemId': _id }, { projection: { _id: 1 } })
    .toArray();
  const afetadas: Omit<VarianteAfetada, 'projetoId'>[] = [];
  for (const { _id: varianteId } of candidatas) {
    const antes = await variantes.findOneAndUpdate(
      { _id: varianteId, 'fotos.imagemId': _id },
      { $pull: { fotos: { imagemId: _id } }, $inc: { revisao: 1 } } as never,
      { returnDocument: 'before' },
    );
    if (!antes) continue;
    afetadas.push({
      varianteId: varianteId.toHexString(),
      revisao: (antes.revisao as number) + 1,
      fotos: contarDaImagem(antes.fotos, _id),
    });
  }
  await ctx.db.collection('rascunhos').updateMany({ projetoId: idProjeto, 'conteudo.fotos.imagemId': _id }, {
    $pull: { 'conteudo.fotos': { imagemId: _id } },
  } as never);
  return { afetadas, fotosRemovidas: afetadas.reduce((soma, a) => soma + a.fotos, 0) };
}
