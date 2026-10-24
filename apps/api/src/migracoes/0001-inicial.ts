import type { Db } from 'mongodb';
import {
  gerarJsonSchema,
  ImagemSchema,
  ProjetoSchema,
  RascunhoSchema,
  VarianteSchema,
} from '@deco-wall/domain';

// Migração 0001-inicial (docs/specs/M0-setup.md §4.3 a §4.7, DM-07).
// Cria coleções, índices e validadores $jsonSchema gerados dos schemas Zod.
// Idempotente: pode rodar de novo sem erro nem duplicidade.

type Colecao = {
  nome: string;
  validador?: Record<string, unknown>;
  indices: { chave: Record<string, 1 | -1>; unico?: boolean }[];
};

const COLECOES: Colecao[] = [
  {
    nome: 'imagens',
    validador: gerarJsonSchema(ImagemSchema),
    indices: [
      { chave: { excluidaEm: 1, criadaEm: -1 } },
      { chave: { projetos: 1, excluidaEm: 1 } },
      { chave: { purgaEm: 1 } },
      { chave: { nomeOriginal: 1 } },
    ],
  },
  {
    nome: 'projetos',
    validador: gerarJsonSchema(ProjetoSchema),
    indices: [{ chave: { atualizadoEm: -1 } }],
  },
  {
    nome: 'variantes',
    validador: gerarJsonSchema(VarianteSchema),
    indices: [
      { chave: { projetoId: 1, ordem: 1 } },
      { chave: { 'fotos.imagemId': 1 } },
      { chave: { 'fotos.imagemAnteriorId': 1 } },
    ],
  },
  {
    nome: 'rascunhos',
    validador: gerarJsonSchema(RascunhoSchema),
    indices: [{ chave: { varianteId: 1, sessaoId: 1 }, unico: true }, { chave: { projetoId: 1 } }],
  },
  // §4.7: controle de versão do schema; sem validador próprio.
  { nome: 'migracoes', indices: [] },
];

export async function aplicar0001Inicial(db: Db): Promise<void> {
  for (const colecao of COLECOES) {
    await garantirColecao(db, colecao);
    for (const indice of colecao.indices) {
      await db.collection(colecao.nome).createIndex(indice.chave, indice.unico ? { unique: true } : {});
    }
  }
}

async function garantirColecao(db: Db, colecao: Colecao): Promise<void> {
  // validationLevel strict e validationAction error (DM-07): documento inválido é rejeitado.
  const regras = colecao.validador
    ? { validator: { $jsonSchema: colecao.validador }, validationLevel: 'strict', validationAction: 'error' }
    : {};

  const existe = await db.listCollections({ name: colecao.nome }, { nameOnly: true }).hasNext();
  if (!existe) {
    await db.createCollection(colecao.nome, regras);
    return;
  }
  if (colecao.validador) {
    await db.command({ collMod: colecao.nome, ...regras });
  }
}
