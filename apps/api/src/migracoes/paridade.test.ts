import type { Db, MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ImagemSchema, ProjetoSchema, RascunhoSchema, VarianteSchema } from '@deco-wall/domain';
import { abrirBancoTesteLimpo, paraMongo } from '../../../../tests/fixtures/banco-teste';
import {
  areaUtil,
  foto,
  grid,
  id,
  imagem,
  projeto,
  rascunho,
  tamanho,
  variante,
} from '../../../../tests/fixtures/dominio';
import { executarMigracoes } from './executar';

// Paridade (DM-07, critério de aceite 5): cada caso é aceito ou rejeitado pelo Zod
// e pelo validador $jsonSchema do Mongo com o mesmo resultado.
// Regras que dependem de dois campos (ex.: dimensões batendo com sugeridoId) são só do Zod
// e ficam fora desta lista.

type Caso = {
  nome: string;
  colecao: 'imagens' | 'projetos' | 'variantes' | 'rascunhos';
  schema: { safeParse: (v: unknown) => { success: boolean } };
  doc: Record<string, unknown>;
  valido: boolean;
};

const casos: Caso[] = [
  { nome: 'variante válida', colecao: 'variantes', schema: VarianteSchema, doc: variante(), valido: true },
  {
    nome: 'variante vazia (Base)',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [] }),
    valido: true,
  },
  {
    nome: 'variante de template (só vagas)',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ templateOrigem: 'piramide', fotos: [foto({ imagemId: null, imagemAnteriorId: null })] }),
    valido: true,
  },
  {
    nome: 'placeholder com recomendação',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ imagemId: null, imagemAnteriorId: id(7) })] }),
    valido: true,
  },
  {
    nome: 'área útil ausente (null)',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ areaUtil: null }),
    valido: true,
  },
  {
    nome: 'tamanho.larguraCm 200 (exemplo do aceite 5)',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ tamanho: tamanho({ larguraCm: 200 }) })] }),
    valido: false,
  },
  {
    nome: 'tamanho personalizado de 4,9 cm',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ tamanho: { sugeridoId: null, larguraCm: 4.9, alturaCm: 30 } })] }),
    valido: false,
  },
  {
    nome: 'sugeridoId fora da lista',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ tamanho: tamanho({ sugeridoId: '99x99' }) })] }),
    valido: false,
  },
  {
    nome: 'recorte.offsetX 1,5',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ recorte: { offsetX: 1.5, offsetY: 0 } })] }),
    valido: false,
  },
  {
    nome: 'campo extra na foto',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ rotacao: 90 })] }),
    valido: false,
  },
  {
    nome: 'imagemId com formato inválido',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ imagemId: 'xyz' })] }),
    valido: false,
  },
  {
    nome: 'nome da variante vazio',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ nome: '' }),
    valido: false,
  },
  {
    nome: 'nome da variante com 61 caracteres',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ nome: 'x'.repeat(61) }),
    valido: false,
  },
  {
    nome: 'grid.passoCm zero',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ grid: grid({ passoCm: 0 }) }),
    valido: false,
  },
  {
    nome: 'borda.cor não hexadecimal',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ fotos: [foto({ borda: { larguraCm: 0, cor: 'branco' } })] }),
    valido: false,
  },
  {
    nome: 'área útil com largura zero',
    colecao: 'variantes',
    schema: VarianteSchema,
    doc: variante({ areaUtil: areaUtil({ larguraCm: 0 }) }),
    valido: false,
  },
  {
    nome: 'projeto com parede null',
    colecao: 'projetos',
    schema: ProjetoSchema,
    doc: projeto({ parede: null }),
    valido: true,
  },
  {
    nome: 'projeto com nome de 101 caracteres',
    colecao: 'projetos',
    schema: ProjetoSchema,
    doc: projeto({ nome: 'x'.repeat(101) }),
    valido: false,
  },
  { nome: 'imagem válida', colecao: 'imagens', schema: ImagemSchema, doc: imagem(), valido: true },
  {
    nome: 'imagem excluída com datas',
    colecao: 'imagens',
    schema: ImagemSchema,
    doc: imagem({ excluidaEm: new Date(), purgaEm: new Date() }),
    valido: true,
  },
  {
    nome: 'imagem com perfil desconhecido',
    colecao: 'imagens',
    schema: ImagemSchema,
    doc: imagem({ perfil: 'ultra' }),
    valido: false,
  },
  {
    nome: 'imagem com mime image/jpeg',
    colecao: 'imagens',
    schema: ImagemSchema,
    doc: imagem({ mime: 'image/jpeg' }),
    valido: false,
  },
  {
    nome: 'imagem com excluidaEm em texto',
    colecao: 'imagens',
    schema: ImagemSchema,
    doc: imagem({ excluidaEm: '2026-10-12' }),
    valido: false,
  },
  { nome: 'rascunho válido', colecao: 'rascunhos', schema: RascunhoSchema, doc: rascunho(), valido: true },
  {
    nome: 'rascunho sem revisaoBase',
    colecao: 'rascunhos',
    schema: RascunhoSchema,
    doc: (() => {
      const r = rascunho();
      delete (r as Record<string, unknown>).revisaoBase;
      return r;
    })(),
    valido: false,
  },
];

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  ({ client, db } = await abrirBancoTesteLimpo());
  await executarMigracoes(db);
});

afterAll(async () => {
  await client.close();
});

describe('paridade Zod ↔ validador do Mongo (DM-07, aceite 5)', () => {
  it.each(casos)('$nome', async (caso) => {
    expect(caso.schema.safeParse(caso.doc).success, 'Zod').toBe(caso.valido);

    let mongoAceitou = true;
    try {
      await db.collection(caso.colecao).insertOne(paraMongo(caso.doc) as Record<string, unknown>);
    } catch (erro) {
      if ((erro as { code?: number }).code !== 121) throw erro; // 121 = DocumentValidationFailure
      mongoAceitou = false;
    } finally {
      await db.collection(caso.colecao).deleteMany({});
    }
    expect(mongoAceitou, 'Mongo').toBe(caso.valido);
  });
});
