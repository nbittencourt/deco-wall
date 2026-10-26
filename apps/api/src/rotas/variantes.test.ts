import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { Collection, ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aplicarLinearApi,
  criarAppTeste,
  criarProjetoApi,
  criarProjetoComEscalaApi,
  enviarImagemApi,
  salvarVarianteApi,
  type AppTeste,
  type ImagemJson,
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
  await Promise.all(
    ['projetos', 'variantes', 'rascunhos', 'imagens'].map((c) => t.db.collection(c).deleteMany({})),
  );
});

async function novo() {
  const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
  return { projeto, base: variantes[0]! };
}

async function comEscalaEImagem() {
  const { projeto, base } = await criarProjetoComEscalaApi(t.app, 'Sala');
  const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
  return { projeto, base, imagem };
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

  it('grava as fotos posicionadas (projeto com escala e imagem existente)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: [foto({ imagemId: imagem._id })] }),
    );
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

describe('PUT /api/projetos/:pid/variantes/:id — fotos (M2-06, M2-14, RN-13, DM-05)', () => {
  it('salva fotos mesmo sem escala definida: o servidor não recusa (M2-14)', async () => {
    const { projeto, base } = await novo();
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: [foto({ imagemId: imagem._id })] }),
    );
    expect(res.statusCode).toBe(200);
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva!.revisao).toBe(base.revisao + 1);
    expect(salva!.fotos).toHaveLength(1);
  });

  it('sem fotos, salvar continua valendo sem escala (grid e área útil do M1)', async () => {
    const { projeto, base } = await novo();
    const res = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base));
    expect(res.statusCode).toBe(200);
  });

  it('422 para imagem inexistente, com a lista em detalhes.imagensInexistentes (§5)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, {
        fotos: [
          foto({ _id: idFixture(101), imagemId: imagem._id }),
          foto({ _id: idFixture(102), imagemId: idFixture(777) }),
          foto({ _id: idFixture(103), imagemId: idFixture(777) }),
        ],
      }),
    );
    expect(res.statusCode).toBe(422);
    const json = res.json() as { erro: string; detalhes: { imagensInexistentes: string[] } };
    expect(typeof json.erro).toBe('string');
    expect(json.detalhes).toEqual({ imagensInexistentes: [idFixture(777)] });
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva!.revisao).toBe(base.revisao);
  });

  it('imagem excluída conta como existente: a foto é salva (a exclusão é do M4)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    await t.db
      .collection('imagens')
      .updateOne(
        { _id: new ObjectId(imagem._id) },
        { $set: { excluidaEm: new Date(), purgaEm: new Date() } },
      );
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: [foto({ imagemId: imagem._id })] }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('_id de foto repetido não é recusado pelo servidor (M2-14)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: [foto({ imagemId: imagem._id }), foto({ imagemId: imagem._id })] }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('placeholder (imagemId nulo) é aceito, sem imagem associada (M2-06)', async () => {
    const { projeto, base } = await comEscalaEImagem();
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: [foto({ imagemId: null })] }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('preserva a ordem das fotos (ordem = z-index, DM-04)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const ids = [idFixture(103), idFixture(101), idFixture(102)];
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, { fotos: ids.map((_id) => foto({ _id, imagemId: imagem._id })) }),
    );
    expect(res.statusCode).toBe(200);
    const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(salva!.fotos.map((f: { _id: ObjectId }) => f._id.toHexString())).toEqual(ids);
  });

  it('falha ao associar o projeto às imagens não desfaz o salvamento; o próximo salvamento repete (§5)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const outro = await criarProjetoApi(t.app, 'Outro');
    const deOutro = (await enviarImagemApi(t.app, { projetoId: outro.projeto._id })).json() as ImagemJson;
    const espiao = vi.spyOn(Collection.prototype, 'updateMany').mockRejectedValueOnce(new Error('falha'));
    try {
      const primeiro = await salvarVarianteApi(
        t.app,
        projeto._id,
        base._id,
        corpo(base, { fotos: [foto({ imagemId: deOutro._id })] }),
      );
      expect(primeiro.statusCode).toBe(200);
      expect(espiao).toHaveBeenCalled();
      const salva = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
      expect(salva!.revisao).toBe(base.revisao + 1);
      let doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(deOutro._id) });
      expect(doc!.projetos).toHaveLength(1);

      const segundo = await salvarVarianteApi(
        t.app,
        projeto._id,
        base._id,
        corpo(base, {
          revisaoBase: base.revisao + 1,
          fotos: [foto({ imagemId: deOutro._id })],
        }),
      );
      expect(segundo.statusCode).toBe(200);
      doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(deOutro._id) });
      expect(doc!.projetos).toHaveLength(2);
    } finally {
      espiao.mockRestore();
    }
    expect(imagem._id).toBeTruthy();
  });

  it('a mesma imagem pode aparecer várias vezes (RN-13)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const res = await salvarVarianteApi(
      t.app,
      projeto._id,
      base._id,
      corpo(base, {
        fotos: [
          foto({ _id: idFixture(101), imagemId: imagem._id }),
          foto({ _id: idFixture(102), imagemId: imagem._id, xCm: 90 }),
        ],
      }),
    );
    expect(res.statusCode).toBe(200);
  });

  it('o projeto entra em imagens.projetos das imagens usadas, sem duplicar (DM-05)', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const outroProjeto = await criarProjetoApi(t.app, 'Outro');
    const deOutro = (
      await enviarImagemApi(t.app, { projetoId: outroProjeto.projeto._id })
    ).json() as ImagemJson;

    const salvar = (revisaoBase: number) =>
      salvarVarianteApi(
        t.app,
        projeto._id,
        base._id,
        corpo(base, {
          revisaoBase,
          fotos: [foto({ imagemId: deOutro._id })],
        }),
      );
    const primeiro = await salvar(base.revisao);
    expect(primeiro.statusCode).toBe(200);
    const segundo = await salvar((primeiro.json() as { revisao: number }).revisao);
    expect(segundo.statusCode).toBe(200);

    const doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(deOutro._id) });
    expect(doc!.projetos.map((p: ObjectId) => p.toHexString()).sort()).toEqual(
      [outroProjeto.projeto._id, projeto._id].sort(),
    );
    // A imagem não usada não ganhou o projeto.
    const parada = await t.db.collection('imagens').findOne({ _id: new ObjectId(imagem._id) });
    expect(parada!.projetos).toHaveLength(1);
  });
});

describe('recalibrar mantém as fotos (PRD aceite 5, RN-10, RN-35)', () => {
  it('refazer a escala linear não muda posição, tamanho, borda nem recorte das fotos, nem a área útil', async () => {
    const { projeto, base, imagem } = await comEscalaEImagem();
    const fotos = [
      foto({ imagemId: imagem._id, xCm: 40, yCm: 30 }),
      foto({
        _id: idFixture(102),
        imagemId: imagem._id,
        xCm: 90.5,
        yCm: 12.3,
        tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 },
        borda: { larguraCm: 1.5, cor: '#5C3A21' },
        recorte: { offsetX: -0.4, offsetY: 0 },
      }),
    ];
    const salvo = await salvarVarianteApi(t.app, projeto._id, base._id, corpo(base, { fotos }));
    expect(salvo.statusCode).toBe(200);

    // Outra medida de referência: a escala (px/cm) muda, os valores em cm das fotos não.
    const re = await aplicarLinearApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      comprimentoCm: 100,
    });
    expect(re.statusCode).toBe(200);

    const depois = (await t.app.inject({ method: 'GET', url: `/api/projetos/${projeto._id}` })).json() as {
      variantes: VarianteJson[];
    };
    expect(depois.variantes[0]!.fotos).toEqual(fotos);
    expect(depois.variantes[0]!.areaUtil).toEqual(areaUtil());
  });
});
