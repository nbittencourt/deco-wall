import { join } from 'node:path';
import {
  BORDA_PADRAO,
  GRID_PADRAO,
  NOME_VARIANTE_PADRAO,
  validarNomeProjeto,
  type Projeto,
  type Variante,
} from '@deco-wall/domain';
import { ObjectId, type Db } from 'mongodb';
import { apagarArquivo } from '../armazenamento/pasta';
import { ErroHttp, naoEncontrado } from '../erros';
import { oid, paraDominio, paraMongo } from '../repositorios/conversao';

// Projetos (docs/specs/M1-parede-e-escala.md §3.1, §5; A-02, A-05, A-18, RN-17, RN-23, DM-12).
// Sem transações (MongoDB standalone): gravações em mais de uma coleção usam compensação.

export const SCHEMA_VERSION = 1;

export interface ResumoProjeto {
  _id: string;
  nome: string;
  atualizadoEm: Date;
  qtdVariantes: number;
  temParede: boolean;
  thumbUrl: string | null;
}

// RN-23: a "Base" nasce vazia, com o grid padrão e sem área útil (a área só existe depois da escala).
export function montarVarianteBase(projetoId: ObjectId, agora: Date): Variante {
  return {
    _id: new ObjectId().toHexString(),
    projetoId: projetoId.toHexString(),
    nome: NOME_VARIANTE_PADRAO,
    ordem: 0,
    criadaEm: agora,
    revisao: 1,
    salvaEm: agora,
    salvaPorSessao: 'sistema',
    grid: { ...GRID_PADRAO },
    bordaPadrao: { ...BORDA_PADRAO },
    areaUtil: null,
    fotos: [],
    schemaVersion: SCHEMA_VERSION,
  };
}

export function nomeValido(valor: unknown): string {
  const resultado = validarNomeProjeto(valor);
  if (!resultado.ok) throw new ErroHttp(400, resultado.erro);
  return resultado.nome;
}

export async function criarProjeto(
  db: Db,
  nome: string,
  agora: Date,
): Promise<{ projeto: Projeto; variante: Variante }> {
  const projetoId = new ObjectId();
  const variante = montarVarianteBase(projetoId, agora);
  const projeto: Projeto = {
    _id: projetoId.toHexString(),
    nome,
    criadoEm: agora,
    atualizadoEm: agora,
    revisao: 1,
    ultimaVarianteId: variante._id,
    parede: null,
    schemaVersion: SCHEMA_VERSION,
  };
  await db.collection('projetos').insertOne(paraMongo(projeto) as never);
  try {
    await db.collection('variantes').insertOne(paraMongo(variante) as never);
  } catch (erro) {
    // A-18: desfaz o projeto para não deixar um projeto sem variante.
    await db.collection('projetos').deleteOne({ _id: projetoId });
    throw erro;
  }
  return { projeto, variante };
}

export async function listarProjetos(db: Db): Promise<ResumoProjeto[]> {
  const projetos = await db.collection('projetos').find({}).sort({ atualizadoEm: -1 }).toArray();
  const contagens = await db
    .collection('variantes')
    .aggregate<{ _id: ObjectId; total: number }>([{ $group: { _id: '$projetoId', total: { $sum: 1 } } }])
    .toArray();
  const total = new Map(contagens.map((c) => [c._id.toHexString(), c.total]));

  return projetos.map((doc) => {
    const id = doc._id.toHexString();
    const temParede = doc.parede != null;
    return {
      _id: id,
      nome: doc.nome as string,
      atualizadoEm: doc.atualizadoEm as Date,
      qtdVariantes: total.get(id) ?? 0,
      temParede,
      thumbUrl: temParede ? `/api/projetos/${id}/parede/arquivo?tipo=thumb` : null,
    };
  });
}

export async function obterProjeto(db: Db, id: string): Promise<{ projeto: Projeto; variantes: Variante[] }> {
  const _id = oid(id);
  if (!_id) throw naoEncontrado();
  const doc = await db.collection('projetos').findOne({ _id });
  if (!doc) throw naoEncontrado();
  const variantes = await db.collection('variantes').find({ projetoId: _id }).sort({ ordem: 1 }).toArray();
  return { projeto: paraDominio<Projeto>(doc), variantes: variantes.map((v) => paraDominio<Variante>(v)) };
}

// A-05: renomear não usa revisão (vale a última gravação) e atualiza `atualizadoEm`.
export async function renomearProjeto(db: Db, id: string, nome: string, agora: Date): Promise<Projeto> {
  const _id = oid(id);
  if (!_id) throw naoEncontrado();
  const doc = await db
    .collection('projetos')
    .findOneAndUpdate({ _id }, { $set: { nome, atualizadoEm: agora } }, { returnDocument: 'after' });
  if (!doc) throw naoEncontrado();
  return paraDominio<Projeto>(doc);
}

export function caminhosDaParede(pastaFotos: string, id: string) {
  return {
    original: join(pastaFotos, 'paredes', `${id}.webp`),
    thumb: join(pastaFotos, 'paredes', `${id}.thumb.webp`),
    retificada: join(pastaFotos, 'paredes', `${id}.retificada.webp`),
  };
}

// RN-17 / DM-12: exclusão física em cascata, nesta ordem: variantes → rascunhos → arquivos → projeto.
// As imagens da biblioteca ficam; só perdem a associação ao projeto.
export async function excluirProjeto(db: Db, pastaFotos: string, id: string): Promise<void> {
  const _id = oid(id);
  if (!_id) throw naoEncontrado();
  if (!(await db.collection('projetos').findOne({ _id }, { projection: { _id: 1 } }))) throw naoEncontrado();

  await db.collection('variantes').deleteMany({ projetoId: _id });
  await db.collection('rascunhos').deleteMany({ projetoId: _id });
  await db.collection('imagens').updateMany({ projetos: _id }, { $pull: { projetos: _id } } as never);
  const arquivos = caminhosDaParede(pastaFotos, id);
  await Promise.all([arquivos.original, arquivos.thumb, arquivos.retificada].map(apagarArquivo));
  await db.collection('projetos').deleteOne({ _id });
}
