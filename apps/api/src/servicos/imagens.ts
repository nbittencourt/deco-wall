import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Imagem } from '@deco-wall/domain';
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

// RF-27: biblioteca global. As excluídas (soft delete) só aparecem no fluxo do M4.
export async function listarImagens(ctx: ContextoApi): Promise<Imagem[]> {
  const docs = await ctx.db
    .collection('imagens')
    .find({ excluidaEm: null })
    .sort({ criadaEm: -1, _id: -1 })
    .toArray();
  return docs.map((doc) => paraDominio<Imagem>(doc));
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
