import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoApi,
  criarProjetoComEscalaApi,
  criarVarianteApi,
  enviarParedeApi,
  salvarRascunhoApi,
  salvarVarianteApi,
  type AppTeste,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { paraMongo } from '../../../../tests/fixtures/banco-teste';
import { areaUtil, foto, id as idFixture, rascunho } from '../../../../tests/fixtures/dominio';

// Rascunhos — soft save (RF-71, SV-01, SV-03, SV-04, SV-06, SV-07, M3-07, M3-08, A-10;
// docs/specs/M3-variantes-templates-e-salvamento.md §5).

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

async function novo() {
  const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
  return { projeto, base: variantes[0]! };
}

function conteudo(sobrescrita: Record<string, unknown> = {}) {
  return {
    grid: { ...GRID_PADRAO, passoCm: 10 },
    bordaPadrao: BORDA_PADRAO,
    areaUtil: areaUtil(),
    fotos: [],
    ...sobrescrita,
  };
}

const corpoRascunho = (base: VarianteJson, sobrescrita: Record<string, unknown> = {}) => ({
  sessaoId: 'sessao-a',
  revisaoBase: base.revisao,
  conteudo: conteudo(),
  ...sobrescrita,
});

const url = (projetoId: string, varianteId: string, consulta = '') =>
  `/api/projetos/${projetoId}/variantes/${varianteId}/rascunho${consulta}`;

describe('PUT …/rascunho — sucesso', () => {
  it('200 com a hora; grava só em rascunhos e nunca toca a versão oficial (SV-01)', async () => {
    const { projeto, base } = await novo();
    const res = await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ salvoEm: expect.any(String) });

    const doc = await t.db.collection('rascunhos').findOne({ varianteId: new ObjectId(base._id) });
    expect(doc).toMatchObject({
      projetoId: new ObjectId(projeto._id),
      sessaoId: 'sessao-a',
      revisaoBase: base.revisao,
      conteudo: { grid: { ...GRID_PADRAO, passoCm: 10 }, fotos: [] },
    });
    expect(doc!.salvoEm.toISOString()).toBe((res.json() as { salvoEm: string }).salvoEm);

    const oficial = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(oficial).toMatchObject({ revisao: base.revisao });
    expect((oficial!.grid as { passoCm: number }).passoCm).toBe(5);
    expect(oficial!.salvaEm.toISOString()).toBe(base.salvaEm);
  });

  it('upsert por (variante, sessão): o segundo PUT substitui o primeiro', async () => {
    const { projeto, base } = await novo();
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base));
    const res = await salvarRascunhoApi(
      t.app,
      projeto._id,
      base._id,
      corpoRascunho(base, { conteudo: conteudo({ grid: { ...GRID_PADRAO, passoCm: 2 } }) }),
    );
    expect(res.statusCode).toBe(200);
    const docs = await t.db.collection('rascunhos').find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.conteudo.grid.passoCm).toBe(2);
  });

  it('sessões diferentes têm rascunhos separados', async () => {
    const { projeto, base } = await novo();
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-a' }));
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-b' }));
    expect(await t.db.collection('rascunhos').countDocuments()).toBe(2);
  });

  it('não confere imagens: só o hard save faz isso (A-07)', async () => {
    const { projeto, base } = await novo();
    const res = await salvarRascunhoApi(
      t.app,
      projeto._id,
      base._id,
      corpoRascunho(base, { conteudo: conteudo({ fotos: [foto({ imagemId: idFixture(998) })] }) }),
    );
    expect(res.statusCode).toBe(200);
  });
});

describe('PUT …/rascunho — conflito (SV-04, SV-06, M3-07)', () => {
  it('409 sem gravar quando a revisão oficial mudou depois da revisaoBase', async () => {
    const { projeto, base } = await novo();
    // Outra aba salvou a variante: revisão 2.
    const outra = await salvarVarianteApi(t.app, projeto._id, base._id, {
      sessaoId: 'sessao-b',
      revisaoBase: base.revisao,
      grid: base.grid,
      bordaPadrao: base.bordaPadrao,
      areaUtil: base.areaUtil,
      fotos: [],
    });
    expect(outra.statusCode).toBe(200);

    const res = await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      revisao: base.revisao + 1,
      salvaEm: expect.any(String),
      salvaPorSessao: 'sessao-b',
    });
    expect(await t.db.collection('rascunhos').countDocuments()).toBe(0);
  });
});

describe('PUT …/rascunho — validação (400/404)', () => {
  it.each([
    ['sessaoId vazio', { sessaoId: '' }],
    ['revisaoBase zero', { revisaoBase: 0 }],
    ['conteúdo sem fotos', { conteudo: { grid: GRID_PADRAO, bordaPadrao: BORDA_PADRAO, areaUtil: null } }],
    ['grid inválido', { conteudo: conteudo({ grid: { ...GRID_PADRAO, opacidade: 2 } }) }],
    ['campo fora do modelo', { extra: 1 }],
  ])('400 com %s', async (_nome, sobrescrita) => {
    const { projeto, base } = await novo();
    const res = await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, sobrescrita));
    expect(res.statusCode).toBe(400);
    expect(await t.db.collection('rascunhos').countDocuments()).toBe(0);
  });

  it('404 para variante inexistente ou de outro projeto', async () => {
    const { projeto, base } = await novo();
    const outro = await criarProjetoApi(t.app, 'Outro');
    expect(
      (await salvarRascunhoApi(t.app, projeto._id, idFixture(999), corpoRascunho(base))).statusCode,
    ).toBe(404);
    expect(
      (await salvarRascunhoApi(t.app, outro.projeto._id, base._id, corpoRascunho(base))).statusCode,
    ).toBe(404);
  });
});

describe('GET …/rascunho', () => {
  it('com sessaoId: o rascunho daquela sessão', async () => {
    const { projeto, base } = await novo();
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-a' }));
    const res = await t.app.inject({ method: 'GET', url: url(projeto._id, base._id, '?sessaoId=sessao-a') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      sessaoId: 'sessao-a',
      revisaoBase: base.revisao,
      conteudo: JSON.parse(JSON.stringify(conteudo())),
      salvoEm: expect.any(String),
    });
  });

  it('sem sessaoId: o mais recente elegível, de qualquer sessão (M3-08)', async () => {
    const { projeto, base } = await novo();
    const doc = (n: number, sessao: string, salvoEm: string) =>
      paraMongo(
        rascunho({
          _id: idFixture(n),
          varianteId: base._id,
          projetoId: projeto._id,
          sessaoId: sessao,
          salvoEm: new Date(salvoEm),
        }),
      ) as never;
    await t.db
      .collection('rascunhos')
      .insertMany([
        doc(601, 'velha', '2100-01-01T10:00:00Z'),
        doc(602, 'nova', '2100-01-01T12:00:00Z'),
        doc(603, 'obsoleta', '2000-01-01T00:00:00Z'),
      ]);
    const res = await t.app.inject({ method: 'GET', url: url(projeto._id, base._id) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ sessaoId: 'nova' });
  });

  it('404 quando não há rascunho (ou nenhum elegível)', async () => {
    const { projeto, base } = await novo();
    expect(
      (await t.app.inject({ method: 'GET', url: url(projeto._id, base._id, '?sessaoId=nenhuma') }))
        .statusCode,
    ).toBe(404);
    expect((await t.app.inject({ method: 'GET', url: url(projeto._id, base._id) })).statusCode).toBe(404);
    await t.db
      .collection('rascunhos')
      .insertOne(
        paraMongo(
          rascunho({
            varianteId: base._id,
            projetoId: projeto._id,
            salvoEm: new Date('2000-01-01T00:00:00Z'),
          }),
        ) as never,
      );
    expect((await t.app.inject({ method: 'GET', url: url(projeto._id, base._id) })).statusCode).toBe(404);
  });
});

describe('DELETE …/rascunho?sessaoId=', () => {
  it('204 e apaga só o rascunho da sessão', async () => {
    const { projeto, base } = await novo();
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-a' }));
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-b' }));
    const res = await t.app.inject({
      method: 'DELETE',
      url: url(projeto._id, base._id, '?sessaoId=sessao-a'),
    });
    expect(res.statusCode).toBe(204);
    const restantes = await t.db.collection('rascunhos').find({}).toArray();
    expect(restantes.map((r) => r.sessaoId)).toEqual(['sessao-b']);
  });

  it('idempotente: apagar de novo (ou sem rascunho) também responde 204', async () => {
    const { projeto, base } = await novo();
    for (let i = 0; i < 2; i += 1) {
      const res = await t.app.inject({
        method: 'DELETE',
        url: url(projeto._id, base._id, '?sessaoId=sessao-a'),
      });
      expect(res.statusCode).toBe(204);
    }
  });
});

describe('GET /api/projetos/:id — resumo dos rascunhos elegíveis (M3-08)', () => {
  it('um por variante: o mais novo que a versão oficial; obsoletos ficam de fora', async () => {
    const { projeto, base } = await novo();
    const v2 = (
      (await criarVarianteApi(t.app, projeto._id, { nome: 'V2' })).json() as { variante: VarianteJson }
    ).variante;
    const doc = (n: number, varianteId: string, sessaoId: string, salvoEm: string, fotos = 0) =>
      paraMongo(
        rascunho({
          _id: idFixture(n),
          varianteId,
          projetoId: projeto._id,
          sessaoId,
          revisaoBase: 1,
          salvoEm: new Date(salvoEm),
          conteudo: {
            grid: { ...GRID_PADRAO },
            bordaPadrao: BORDA_PADRAO,
            areaUtil: null,
            fotos: Array.from({ length: fotos }, (_, i) => foto({ _id: idFixture(700 + n * 10 + i) })),
          },
        }),
      ) as never;
    await t.db
      .collection('rascunhos')
      .insertMany([
        doc(611, base._id, 'a', '2100-01-01T10:00:00Z', 1),
        doc(612, base._id, 'b', '2100-01-01T11:00:00Z', 3),
        doc(613, v2._id, 'a', '2000-01-01T00:00:00Z', 1),
      ]);
    const res = await t.app.inject({ method: 'GET', url: `/api/projetos/${projeto._id}` });
    const corpo = res.json() as { rascunhos: Record<string, unknown>[] };
    expect(corpo.rascunhos).toEqual([
      {
        varianteId: base._id,
        sessaoId: 'b',
        salvoEm: '2100-01-01T11:00:00.000Z',
        revisaoBase: 1,
        qtdFotos: 3,
      },
    ]);
  });
});

describe('hard save × rascunhos (SV-02, SV-03, A-10)', () => {
  it('o hard save apaga o rascunho da sessão e os obsoletos; o mais novo que a versão oficial fica', async () => {
    const { projeto, base } = await novo();
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-a' }));
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base, { sessaoId: 'sessao-b' }));
    await t.db.collection('rascunhos').insertOne(
      paraMongo(
        rascunho({
          _id: idFixture(620),
          varianteId: base._id,
          projetoId: projeto._id,
          sessaoId: 'sessao-futura',
          salvoEm: new Date('2100-01-01T00:00:00Z'),
        }),
      ) as never,
    );

    const res = await salvarVarianteApi(t.app, projeto._id, base._id, {
      sessaoId: 'sessao-a',
      revisaoBase: base.revisao,
      grid: base.grid,
      bordaPadrao: base.bordaPadrao,
      areaUtil: base.areaUtil,
      fotos: [],
    });
    expect(res.statusCode).toBe(200);
    const restantes = await t.db.collection('rascunhos').find({}).toArray();
    expect(restantes.map((r) => r.sessaoId)).toEqual(['sessao-futura']);
  });
});

describe('trocar a parede apaga os rascunhos do projeto (A-10)', () => {
  it('PUT /api/projetos/:id/parede', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app, 'Sala');
    const outro = await criarProjetoApi(t.app, 'Outro');
    await salvarRascunhoApi(t.app, projeto._id, base._id, corpoRascunho(base));
    await salvarRascunhoApi(
      t.app,
      outro.projeto._id,
      outro.variantes[0]!._id,
      corpoRascunho(outro.variantes[0]!),
    );
    expect(await t.db.collection('rascunhos').countDocuments()).toBe(2);

    const res = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    expect(res.statusCode).toBe(200);

    const restantes = await t.db.collection('rascunhos').find({}).toArray();
    expect(restantes.map((r) => r.projetoId.toHexString())).toEqual([outro.projeto._id]);
  });
});
