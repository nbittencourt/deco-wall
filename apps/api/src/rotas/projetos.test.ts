import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gravarAtomico } from '../armazenamento/pasta';
import { paraMongo } from '../../../../tests/fixtures/banco-teste';
import {
  criarAppTeste,
  criarProjetoApi,
  enviarParedeApi,
  type AppTeste,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { imagem, id as idFixture } from '../../../../tests/fixtures/dominio';

// Projetos (docs/specs/M1-parede-e-escala.md §3.1, §5, A-02, A-05, A-18, RN-17, RN-23, DM-12).

let t: AppTeste;

beforeAll(async () => {
  t = await criarAppTeste();
});

afterAll(async () => {
  await t.fechar();
});

beforeEach(async () => {
  await Promise.all(
    ['projetos', 'variantes', 'rascunhos', 'imagens'].map((c) => t.db.collection(c).deleteMany({})),
  );
});

const HEX = /^[0-9a-f]{24}$/;

async function existe(caminhoRelativo: string): Promise<boolean> {
  try {
    await access(join(t.pasta, caminhoRelativo));
    return true;
  } catch {
    return false;
  }
}

describe('POST /api/projetos (A-02, A-18, RN-23)', () => {
  it('cria "Projeto sem nome" já com a variante "Base" vazia', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/projetos', payload: {} });
    expect(res.statusCode).toBe(201);
    const { projeto, variantes } = res.json() as { projeto: ProjetoJson; variantes: VarianteJson[] };

    expect(projeto._id).toMatch(HEX);
    expect(projeto).toMatchObject({ nome: 'Projeto sem nome', revisao: 1, parede: null, schemaVersion: 1 });
    expect(variantes).toHaveLength(1);
    expect(variantes[0]).toMatchObject({
      nome: 'Base',
      ordem: 0,
      revisao: 1,
      projetoId: projeto._id,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: null,
      fotos: [],
    });
    expect(projeto.ultimaVarianteId).toBe(variantes[0]!._id);
  });

  it('grava projeto e variante no banco (passando pelos validadores $jsonSchema)', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    expect(await t.db.collection('projetos').countDocuments({ _id: new ObjectId(projeto._id) })).toBe(1);
    expect(await t.db.collection('variantes').countDocuments({ projetoId: new ObjectId(projeto._id) })).toBe(
      1,
    );
  });

  it('usa o nome recebido, sem os espaços das pontas', async () => {
    const { projeto } = await criarProjetoApi(t.app, '  Corredor  ');
    expect(projeto.nome).toBe('Corredor');
  });

  it('aceita nome repetido', async () => {
    await criarProjetoApi(t.app, 'Sala');
    const segundo = await criarProjetoApi(t.app, 'Sala');
    expect(segundo.projeto.nome).toBe('Sala');
    expect(await t.db.collection('projetos').countDocuments()).toBe(2);
  });

  it.each([[''], ['    '], ['a'.repeat(101)], [42]])('recusa nome inválido %j com 400', async (nome) => {
    const res = await t.app.inject({ method: 'POST', url: '/api/projetos', payload: { nome } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ erro: expect.any(String) });
    expect(await t.db.collection('projetos').countDocuments()).toBe(0);
  });
});

describe('GET /api/projetos', () => {
  it('lista por atualizadoEm decrescente, com os campos do card (A-04)', async () => {
    const a = await criarProjetoApi(t.app, 'A');
    const b = await criarProjetoApi(t.app, 'B');
    // Renomear A atualiza atualizadoEm: A passa à frente de B.
    await t.app.inject({ method: 'PATCH', url: `/api/projetos/${a.projeto._id}`, payload: { nome: 'A2' } });

    const res = await t.app.inject({ method: 'GET', url: '/api/projetos' });
    expect(res.statusCode).toBe(200);
    const lista = res.json() as Record<string, unknown>[];
    expect(lista.map((p) => p.nome)).toEqual(['A2', 'B']);
    expect(lista[0]).toEqual({
      _id: a.projeto._id,
      nome: 'A2',
      atualizadoEm: expect.any(String),
      qtdVariantes: 1,
      temParede: false,
      thumbUrl: null,
    });
    expect(lista[1]!._id).toBe(b.projeto._id);
  });

  it('com parede, aponta a miniatura da foto original (A-17)', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Com parede');
    const upload = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    expect(upload.statusCode).toBe(200);

    const lista = (await t.app.inject({ method: 'GET', url: '/api/projetos' })).json() as Record<
      string,
      unknown
    >[];
    expect(lista[0]).toMatchObject({
      temParede: true,
      thumbUrl: `/api/projetos/${projeto._id}/parede/arquivo?tipo=thumb`,
    });
  });

  it('lista vazia quando não há projetos', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/projetos' });
    expect(res.json()).toEqual([]);
  });
});

describe('GET /api/projetos/:id', () => {
  it('devolve o projeto e as variantes completas', async () => {
    const criado = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({ method: 'GET', url: `/api/projetos/${criado.projeto._id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(JSON.parse(JSON.stringify(criado)));
  });

  it('404 para id inexistente ou mal formado', async () => {
    const inexistente = await t.app.inject({ method: 'GET', url: `/api/projetos/${idFixture(999)}` });
    expect(inexistente.statusCode).toBe(404);
    expect(inexistente.json()).toEqual({ erro: 'Projeto não encontrado.' });
    const malformado = await t.app.inject({ method: 'GET', url: '/api/projetos/abc' });
    expect(malformado.statusCode).toBe(404);
  });
});

describe('PATCH /api/projetos/:id (A-05)', () => {
  it('renomeia, atualiza atualizadoEm e não mexe na revisão', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Antigo');
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}`,
      payload: { nome: '  Novo nome ' },
    });
    expect(res.statusCode).toBe(200);
    const atualizado = res.json() as ProjetoJson;
    expect(atualizado).toMatchObject({ _id: projeto._id, nome: 'Novo nome', revisao: projeto.revisao });
    expect(new Date(atualizado.atualizadoEm).getTime()).toBeGreaterThan(
      new Date(projeto.atualizadoEm).getTime(),
    );
  });

  it.each([[''], ['a'.repeat(101)], [null]])('recusa nome inválido %j com 400', async (nome) => {
    const { projeto } = await criarProjetoApi(t.app, 'Antigo');
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}`,
      payload: { nome },
    });
    expect(res.statusCode).toBe(400);
    const salvo = await t.db.collection('projetos').findOne({ _id: new ObjectId(projeto._id) });
    expect(salvo?.nome).toBe('Antigo');
  });

  it('404 para projeto inexistente', async () => {
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${idFixture(999)}`,
      payload: { nome: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/projetos/:id (RN-17, DM-12)', () => {
  it('apaga em cascata: projeto, variantes, rascunhos e arquivos da parede', async () => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Para excluir');
    const outro = await criarProjetoApi(t.app, 'Fica');
    await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    await t.db.collection('rascunhos').insertOne(
      paraMongo({
        _id: idFixture(401),
        varianteId: variantes[0]!._id,
        projetoId: projeto._id,
        sessaoId: 'sessao-a',
        revisaoBase: 1,
        conteudo: { grid: GRID_PADRAO, bordaPadrao: BORDA_PADRAO, areaUtil: null, fotos: [] },
        salvoEm: new Date(),
      }) as never,
    );
    expect(await existe(`paredes/${projeto._id}.webp`)).toBe(true);
    expect(await existe(`paredes/${projeto._id}.thumb.webp`)).toBe(true);

    const res = await t.app.inject({ method: 'DELETE', url: `/api/projetos/${projeto._id}` });
    expect(res.statusCode).toBe(204);

    const oid = new ObjectId(projeto._id);
    expect(await t.db.collection('projetos').countDocuments({ _id: oid })).toBe(0);
    expect(await t.db.collection('variantes').countDocuments({ projetoId: oid })).toBe(0);
    expect(await t.db.collection('rascunhos').countDocuments({ projetoId: oid })).toBe(0);
    expect(await existe(`paredes/${projeto._id}.webp`)).toBe(false);
    expect(await existe(`paredes/${projeto._id}.thumb.webp`)).toBe(false);

    // O outro projeto continua intacto.
    expect(await t.db.collection('projetos').countDocuments({ _id: new ObjectId(outro.projeto._id) })).toBe(
      1,
    );
    expect(
      await t.db.collection('variantes').countDocuments({ projetoId: new ObjectId(outro.projeto._id) }),
    ).toBe(1);
  });

  it('apaga também a parede retificada', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Com retificada');
    // Arquivo solto no lugar da retificada: a exclusão não pode deixá-lo para trás.
    await gravarAtomico(
      t.pasta,
      join(t.pasta, 'paredes', `${projeto._id}.retificada.webp`),
      Buffer.from('x'),
    );

    const res = await t.app.inject({ method: 'DELETE', url: `/api/projetos/${projeto._id}` });
    expect(res.statusCode).toBe(204);
    expect(await existe(`paredes/${projeto._id}.retificada.webp`)).toBe(false);
  });

  it('não afeta a biblioteca: a imagem fica e só perde a associação ao projeto', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Com imagem');
    const outro = await criarProjetoApi(t.app, 'Outro');
    await t.db
      .collection('imagens')
      .insertOne(paraMongo(imagem({ projetos: [projeto._id, outro.projeto._id] })) as never);

    await t.app.inject({ method: 'DELETE', url: `/api/projetos/${projeto._id}` });

    const doc = await t.db.collection('imagens').findOne({});
    expect(doc).not.toBeNull();
    expect((doc!.projetos as ObjectId[]).map((p) => p.toHexString())).toEqual([outro.projeto._id]);
  });

  it('404 para projeto inexistente', async () => {
    const res = await t.app.inject({ method: 'DELETE', url: `/api/projetos/${idFixture(999)}` });
    expect(res.statusCode).toBe(404);
  });
});
