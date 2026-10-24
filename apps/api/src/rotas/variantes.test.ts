import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoApi,
  salvarVarianteApi,
  type AppTeste,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { paraMongo } from '../../../../tests/fixtures/banco-teste';
import { areaUtil, foto, id as idFixture, rascunho } from '../../../../tests/fixtures/dominio';

// Salvamento manual da variante — hard save (M1-01, SV-02, SV-04, SV-08; docs/specs/M1-parede-e-escala.md §3.8, §5).

let t: AppTeste;

beforeAll(async () => {
  t = await criarAppTeste();
});

afterAll(async () => {
  await t.fechar();
});

beforeEach(async () => {
  await Promise.all(['projetos', 'variantes', 'rascunhos'].map((c) => t.db.collection(c).deleteMany({})));
});

async function novo() {
  const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
  return { projeto, base: variantes[0]! };
}

function corpo(base: VarianteJson, sobrescrita: Record<string, unknown> = {}) {
  return {
    sessaoId: 'sessao-a',
    revisaoBase: base.revisao,
    grid: { ...GRID_PADRAO, passoCm: 10, opacidade: 0.2 },
    bordaPadrao: BORDA_PADRAO,
    areaUtil: areaUtil(),
    fotos: [],
    ...sobrescrita,
  };
}

describe('PUT /api/projetos/:pid/variantes/:id — sucesso', () => {
  it('grava grid e área útil, sobe a revisão e responde com a hora do salvamento', async () => {
    const { projeto, base } = await novo();
    const res = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ revisao: base.revisao + 1, salvaEm: expect.any(String) });

    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva).toMatchObject({
      revisao: base.revisao + 1,
      salvaPorSessao: 'sessao-a',
      grid: { ...GRID_PADRAO, passoCm: 10, opacidade: 0.2 },
      areaUtil: areaUtil(),
    });
    expect(salva!.salvaEm.toISOString()).toBe((res.json() as { salvaEm: string }).salvaEm);
  });

  it('também atualiza atualizadoEm e ultimaVarianteId do projeto, sem mexer na revisão do projeto', async () => {
    const { projeto, base } = await novo();
    await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base));
    const atual = (
      (await t.app.inject({ method: 'GET', url: `/api/projetos/${projeto._id}` })).json() as {
        projeto: ProjetoJson;
      }
    ).projeto;
    expect(new Date(atual.atualizadoEm).getTime()).toBeGreaterThan(new Date(projeto.atualizadoEm).getTime());
    expect(atual.ultimaVarianteId).toBe(base._id);
    expect(atual.revisao).toBe(projeto.revisao);
  });

  it('grava as fotos posicionadas', async () => {
    const { projeto, base } = await novo();
    const res = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, { fotos: [foto()] }));
    expect(res.statusCode).toBe(200);
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva!.fotos).toHaveLength(1);
  });

  it('salvamentos em sequência, cada um com a revisão devolvida pelo anterior', async () => {
    const { projeto, base } = await novo();
    let revisao = base.revisao;
    for (let i = 0; i < 3; i++) {
      const res = await salvarVarianteApi(
        t.app,
        projeto._id,
        base._id,
        corpo(base, { revisaoBase: revisao }),
      );
      expect(res.statusCode).toBe(200);
      revisao = (res.json() as { revisao: number }).revisao;
    }
    expect(revisao).toBe(base.revisao + 3);
  });

  it('apaga o rascunho da própria sessão e preserva o das outras (SV-02)', async () => {
    const { projeto, base } = await novo();
    const rascunhos = [
      rascunho({ _id: idFixture(401), varianteId: base._id, projetoId: projeto._id, sessaoId: 'sessao-a' }),
      rascunho({ _id: idFixture(402), varianteId: base._id, projetoId: projeto._id, sessaoId: 'sessao-b' }),
    ];
    await t.db.collection('rascunhos').insertMany(rascunhos.map((r) => paraMongo(r) as never));

    await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base));

    const restantes = await t.db.collection('rascunhos').find({}).toArray();
    expect(restantes.map((r) => r.sessaoId)).toEqual(['sessao-b']);
  });
});

describe('PUT /api/projetos/:pid/variantes/:id — conflito (SV-04, 409)', () => {
  it('outra aba salvou antes: 409 com a revisão, a hora e a sessão que gravou', async () => {
    const { projeto, base } = await novo();
    const abaB = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, { sessaoId: 'sessao-b' }));
    expect(abaB.statusCode).toBe(200);

    // A aba A ainda acredita na revisão 1.
    const abaA = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { sessaoId: 'sessao-a', grid: { ...GRID_PADRAO, passoCm: 2 } }),
    );
    expect(abaA.statusCode).toBe(409);
    expect(abaA.json()).toEqual({
      revisao: base.revisao + 1,
      salvaEm: expect.any(String),
      salvaPorSessao: 'sessao-b',
    });

    // A versão da aba B continua a oficial.
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva).toMatchObject({ revisao: base.revisao + 1, salvaPorSessao: 'sessao-b' });
    expect((salva!.grid as { passoCm: number }).passoCm).toBe(10);
  });

  it('dois salvamentos simultâneos com a mesma revisão base: exatamente um vence', async () => {
    const { projeto, base } = await novo();
    const [a, b] = await Promise.all([
      salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, { sessaoId: 'sessao-a' })),
      salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, { sessaoId: 'sessao-b' })),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });
});

describe('PUT /api/projetos/:pid/variantes/:id — validação (400/404)', () => {
  it.each([
    ['opacidade acima de 1', { grid: { ...GRID_PADRAO, opacidade: 2 } }],
    ['área útil com largura negativa', { areaUtil: { xCm: 0, yCm: 0, larguraCm: -1, alturaCm: 10 } }],
    ['campo fora do modelo', { extra: true }],
    ['revisaoBase não inteira', { revisaoBase: 1.5 }],
    ['sessaoId vazio', { sessaoId: '' }],
    ['foto inválida', { fotos: [{ ...foto(), xCm: 'a' }] }],
  ])('400 com %s e nada é gravado', async (_nome, sobrescrita) => {
    const { projeto, base } = await novo();
    const res = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, sobrescrita));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ erro: expect.any(String) });
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva!.revisao).toBe(base.revisao);
  });

  it('404 para variante ou projeto inexistente', async () => {
    const { projeto, base } = await novo();
    const semVariante = await salvarVarianteApi(t.app, projeto._id, idFixture(999), corpo(base));
    expect(semVariante.statusCode).toBe(404);
    const semProjeto = await salvarVarianteApi(t.app, idFixture(999), base._id, corpo(base));
    expect(semProjeto.statusCode).toBe(404);
  });

  it('404 quando a variante pertence a outro projeto', async () => {
    const a = await novo();
    const b = await criarProjetoApi(t.app, 'Outro');
    const res = await salvarVarianteApi(t.app, b.projeto._id, a.base._id, corpo(a.base));
    expect(res.statusCode).toBe(404);
  });
});
