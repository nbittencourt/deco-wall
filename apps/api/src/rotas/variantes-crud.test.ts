import { aplicarTemplate, GRID_PADRAO, templatePorId } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoApi,
  criarProjetoComEscalaApi,
  criarVarianteApi,
  enviarImagemApi,
  salvarVarianteApi,
  type AppTeste,
  type ImagemJson,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { paraMongo } from '../../../../tests/fixtures/banco-teste';
import { areaUtil, foto, id as idFixture, rascunho } from '../../../../tests/fixtures/dominio';

// CRUD de variantes, criação a partir de template e campos novos de projeto (M3-04, M3-02, M3-05, M3-06, RN-23;
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

async function obter(projetoId: string) {
  const res = await t.app.inject({ method: 'GET', url: `/api/projetos/${projetoId}` });
  return res.json() as {
    projeto: ProjetoJson;
    variantes: VarianteJson[];
    rascunhos: Record<string, unknown>[];
  };
}

const criada = (res: { json(): unknown }) => (res.json() as { variante: VarianteJson }).variante;

describe('POST /api/projetos/:pid/variantes — em branco', () => {
  it('201 com a variante nascida salva (revisão 1), vazia, no fim da ordem', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const res = await criarVarianteApi(t.app, projeto._id, {
      nome: 'Sala escura',
      sessaoId: 'sessao-x',
      grid: { ...GRID_PADRAO, passoCm: 10 },
      bordaPadrao: { larguraCm: 2, cor: '#F5F1E8' },
      areaUtil: base.areaUtil,
    });
    expect(res.statusCode).toBe(201);
    const v = criada(res);
    expect(v).toMatchObject({
      projetoId: projeto._id,
      nome: 'Sala escura',
      ordem: 1,
      revisao: 1,
      salvaPorSessao: 'sessao-x',
      grid: { ...GRID_PADRAO, passoCm: 10 },
      bordaPadrao: { larguraCm: 2, cor: '#F5F1E8' },
      areaUtil: base.areaUtil,
      fotos: [],
    });
    expect(v.templateOrigem ?? null).toBeNull();
    expect(await t.db.collection('variantes').countDocuments({ projetoId: new ObjectId(projeto._id) })).toBe(
      2,
    );
  });

  it('ordem = maior existente + 1', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const a = criada(await criarVarianteApi(t.app, projeto._id, { nome: 'A' }));
    const b = criada(await criarVarianteApi(t.app, projeto._id, { nome: 'B' }));
    expect([a.ordem, b.ordem]).toEqual([1, 2]);
  });

  it('o projeto passa a abrir nela (ultimaVarianteId) e atualizadoEm avança', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const v = criada(await criarVarianteApi(t.app, projeto._id));
    const { projeto: atual } = await obter(projeto._id);
    expect(atual.ultimaVarianteId).toBe(v._id);
    expect(new Date(atual.atualizadoEm).getTime()).toBeGreaterThan(new Date(projeto.atualizadoEm).getTime());
  });

  it('nome repetido é permitido (M3-04)', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const res = await criarVarianteApi(t.app, projeto._id, { nome: 'Base' });
    expect(res.statusCode).toBe(201);
  });

  it.each([
    ['nome vazio', { nome: '' }],
    ['nome com 61 caracteres', { nome: 'a'.repeat(61) }],
    ['sessaoId vazio', { sessaoId: '' }],
    ['origem desconhecida', { origem: { tipo: 'outra' } }],
    ['grid inválido', { grid: { ...GRID_PADRAO, opacidade: 5 } }],
    ['campo fora do modelo', { extra: true }],
  ])('400 com %s e nada é criado', async (_nome, sobrescrita) => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/projetos/${projeto._id}/variantes`,
      payload: {
        sessaoId: 'sessao-a',
        nome: 'Nova',
        grid: GRID_PADRAO,
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: null,
        origem: { tipo: 'vazia' },
        ...sobrescrita,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ erro: expect.any(String) });
    expect(await t.db.collection('variantes').countDocuments()).toBe(1);
  });

  it('404 para projeto inexistente', async () => {
    const res = await criarVarianteApi(t.app, idFixture(999));
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/projetos/:pid/variantes — cópia (M3-04)', () => {
  it('copia as fotos com ids novos e preserva o resto', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const fotos = [
      foto({ _id: idFixture(11), imagemId: imagem._id, xCm: 40, yCm: 30 }),
      foto({ _id: idFixture(12), imagemId: null, xCm: 80, yCm: 20 }),
    ];
    const res = await criarVarianteApi(t.app, projeto._id, {
      nome: 'Base (cópia)',
      areaUtil: base.areaUtil,
      origem: { tipo: 'copia', fotos },
    });
    expect(res.statusCode).toBe(201);
    const v = criada(res);
    expect(v.fotos).toHaveLength(2);
    expect(v.fotos.map((f) => f._id)).not.toContain(idFixture(11));
    expect(v.fotos.map((f) => f._id)).not.toContain(idFixture(12));
    expect(new Set(v.fotos.map((f) => f._id)).size).toBe(2);
    expect(v.fotos.map(({ _id, ...resto }) => resto)).toEqual(fotos.map(({ _id, ...resto }) => resto));
  });

  it('associa o projeto às imagens usadas (M2-05)', async () => {
    const a = await criarProjetoComEscalaApi(t.app, 'A');
    const b = await criarProjetoComEscalaApi(t.app, 'B');
    const imagem = (await enviarImagemApi(t.app, { projetoId: a.projeto._id })).json() as ImagemJson;
    await criarVarianteApi(t.app, b.projeto._id, {
      areaUtil: b.base.areaUtil,
      origem: { tipo: 'copia', fotos: [foto({ imagemId: imagem._id })] },
    });
    const doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(imagem._id) });
    expect(doc!.projetos.map((p: ObjectId) => p.toHexString()).sort()).toEqual(
      [a.projeto._id, b.projeto._id].sort(),
    );
  });

  it('422 com a lista quando uma foto usa imagem inexistente', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const res = await criarVarianteApi(t.app, projeto._id, {
      areaUtil: base.areaUtil,
      origem: { tipo: 'copia', fotos: [foto({ imagemId: idFixture(998) })] },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ detalhes: { imagensInexistentes: [idFixture(998)] } });
    expect(await t.db.collection('variantes').countDocuments()).toBe(1);
  });
});

describe('POST /api/projetos/:pid/variantes — template (RN-29 a RN-31, M3-06)', () => {
  const borda = { larguraCm: 2, cor: '#F5F1E8' };

  it('o servidor aplica o template: vagas iguais às do domínio, templateOrigem e borda padrão da escolha', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const posicao = { xCm: 12.5, yCm: 30 };
    const res = await criarVarianteApi(t.app, projeto._id, {
      nome: 'Pirâmide',
      areaUtil: base.areaUtil,
      origem: { tipo: 'template', templateId: 'piramide', posicaoCm: posicao, borda },
    });
    expect(res.statusCode).toBe(201);
    const v = criada(res);
    expect(v).toMatchObject({ nome: 'Pirâmide', templateOrigem: 'piramide', bordaPadrao: borda, revisao: 1 });

    const esperado = aplicarTemplate({
      template: templatePorId('piramide')!,
      posicaoCm: posicao,
      borda,
      novoId: () => idFixture(1),
    });
    expect(v.fotos).toHaveLength(6);
    v.fotos.forEach((f, i) => {
      const e = esperado.fotos[i]!;
      expect(f).toMatchObject({
        imagemId: null,
        imagemAnteriorId: null,
        tamanho: e.tamanho,
        xCm: e.xCm,
        yCm: e.yCm,
        recorte: { offsetX: 0, offsetY: 0 },
        borda,
      });
    });
    expect(new Set(v.fotos.map((f) => f._id)).size).toBe(6);
  });

  it('a variante de template é lida de volta pelo GET do projeto', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    await criarVarianteApi(t.app, projeto._id, {
      nome: 'Trio',
      areaUtil: base.areaUtil,
      origem: { tipo: 'template', templateId: 'trio', posicaoCm: { xCm: 0, yCm: 0 }, borda },
    });
    const { variantes } = await obter(projeto._id);
    expect(variantes.map((v) => v.nome)).toEqual(['Base', 'Trio']);
    expect(variantes[1]!.fotos).toHaveLength(3);
  });

  it('422 "A parede está sem escala." quando o projeto não tem escala', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sem escala');
    const res = await criarVarianteApi(t.app, projeto._id, {
      origem: { tipo: 'template', templateId: 'piramide', posicaoCm: { xCm: 0, yCm: 0 }, borda },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ erro: 'A parede está sem escala.' });
  });

  it('404 para template desconhecido', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const res = await criarVarianteApi(t.app, projeto._id, {
      areaUtil: base.areaUtil,
      origem: { tipo: 'template', templateId: 'nao-existe', posicaoCm: { xCm: 0, yCm: 0 }, borda },
    });
    expect(res.statusCode).toBe(404);
  });

  it('400 com borda fora de 0 a 20 cm', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const res = await criarVarianteApi(t.app, projeto._id, {
      areaUtil: base.areaUtil,
      origem: {
        tipo: 'template',
        templateId: 'trio',
        posicaoCm: { xCm: 0, yCm: 0 },
        borda: { larguraCm: 25, cor: '#FFFFFF' },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('selo "N sem foto" (M3-02, A-24)', () => {
  it('GET /api/projetos soma os placeholders das variantes salvas', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    await criarVarianteApi(t.app, projeto._id, {
      nome: 'Pirâmide',
      areaUtil: base.areaUtil,
      origem: {
        tipo: 'template',
        templateId: 'piramide',
        posicaoCm: { xCm: 0, yCm: 0 },
        borda: { larguraCm: 0, cor: '#FFFFFF' },
      },
    });
    await criarVarianteApi(t.app, projeto._id, {
      nome: 'Trio',
      areaUtil: base.areaUtil,
      origem: {
        tipo: 'template',
        templateId: 'trio',
        posicaoCm: { xCm: 0, yCm: 0 },
        borda: { larguraCm: 0, cor: '#FFFFFF' },
      },
    });
    const lista = (await t.app.inject({ method: 'GET', url: '/api/projetos' })).json() as Record<
      string,
      unknown
    >[];
    expect(lista[0]).toMatchObject({ qtdVariantes: 3, semFoto: 9 });
  });

  it('projeto sem placeholders: semFoto 0', async () => {
    await criarProjetoApi(t.app, 'Vazio');
    const lista = (await t.app.inject({ method: 'GET', url: '/api/projetos' })).json() as Record<
      string,
      unknown
    >[];
    expect(lista[0]).toMatchObject({ semFoto: 0 });
  });

  it('preencher uma vaga e salvar reduz o total', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const v = criada(
      await criarVarianteApi(t.app, projeto._id, {
        nome: 'Trio',
        areaUtil: base.areaUtil,
        origem: {
          tipo: 'template',
          templateId: 'trio',
          posicaoCm: { xCm: 0, yCm: 0 },
          borda: { larguraCm: 0, cor: '#FFFFFF' },
        },
      }),
    );
    const fotos = v.fotos.map((f, i) => (i === 0 ? { ...f, imagemId: imagem._id } : f));
    const salvo = await salvarVarianteApi(t.app, projeto._id, v._id, {
      sessaoId: 'sessao-a',
      revisaoBase: v.revisao,
      grid: v.grid,
      bordaPadrao: v.bordaPadrao,
      areaUtil: v.areaUtil,
      fotos,
    });
    expect(salvo.statusCode).toBe(200);
    const lista = (await t.app.inject({ method: 'GET', url: '/api/projetos' })).json() as Record<
      string,
      unknown
    >[];
    expect(lista[0]).toMatchObject({ semFoto: 2 });
  });
});

describe('GET /api/projetos/:pid/variantes/:id', () => {
  it('200 com a variante completa', async () => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({
      method: 'GET',
      url: `/api/projetos/${projeto._id}/variantes/${variantes[0]!._id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(JSON.parse(JSON.stringify(variantes[0])));
  });

  it('404 para variante inexistente, malformada ou de outro projeto', async () => {
    const a = await criarProjetoApi(t.app, 'A');
    const b = await criarProjetoApi(t.app, 'B');
    const url = (p: string, v: string) => `/api/projetos/${p}/variantes/${v}`;
    expect((await t.app.inject({ method: 'GET', url: url(a.projeto._id, idFixture(999)) })).statusCode).toBe(
      404,
    );
    expect((await t.app.inject({ method: 'GET', url: url(a.projeto._id, 'abc') })).statusCode).toBe(404);
    expect(
      (await t.app.inject({ method: 'GET', url: url(a.projeto._id, b.variantes[0]!._id) })).statusCode,
    ).toBe(404);
  });
});

describe('PATCH /api/projetos/:pid/variantes/:id — renomear (M3-04)', () => {
  it('troca o nome sem mudar a revisão', async () => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const base = variantes[0]!;
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}/variantes/${base._id}`,
      payload: { nome: '  Sala nova ' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ _id: base._id, nome: 'Sala nova' });
    const doc = await t.db.collection('variantes').findOne({ _id: new ObjectId(base._id) });
    expect(doc).toMatchObject({ nome: 'Sala nova', revisao: base.revisao });
  });

  it.each([[''], ['   '], ['a'.repeat(61)], [null]])('400 com nome %j', async (nome) => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}/variantes/${variantes[0]!._id}`,
      payload: { nome },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404 para variante inexistente', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}/variantes/${idFixture(999)}`,
      payload: { nome: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/projetos/:pid/variantes/:id (M3-04, RN-23)', () => {
  async function comTres() {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const base = variantes[0]!;
    const v2 = criada(await criarVarianteApi(t.app, projeto._id, { nome: 'V2' }));
    const v3 = criada(await criarVarianteApi(t.app, projeto._id, { nome: 'V3' }));
    return { projeto, base, v2, v3 };
  }
  const apagar = (projetoId: string, id: string) =>
    t.app.inject({ method: 'DELETE', url: `/api/projetos/${projetoId}/variantes/${id}` });

  it('204 e remove a variante; apaga os rascunhos dela e preserva os das outras', async () => {
    const { projeto, base, v2, v3 } = await comTres();
    await t.db
      .collection('rascunhos')
      .insertMany([
        paraMongo(rascunho({ _id: idFixture(501), varianteId: v2._id, projetoId: projeto._id })) as never,
        paraMongo(
          rascunho({ _id: idFixture(502), varianteId: v2._id, projetoId: projeto._id, sessaoId: 'sessao-b' }),
        ) as never,
        paraMongo(rascunho({ _id: idFixture(503), varianteId: v3._id, projetoId: projeto._id })) as never,
      ]);
    const res = await apagar(projeto._id, v2._id);
    expect(res.statusCode).toBe(204);
    expect((await obter(projeto._id)).variantes.map((v) => v._id)).toEqual([base._id, v3._id]);
    const restantes = await t.db.collection('rascunhos').find({}).toArray();
    expect(restantes.map((r) => r.varianteId.toHexString())).toEqual([v3._id]);
  });

  it('se era a aberta por último, ultimaVarianteId passa à anterior na ordem', async () => {
    const { projeto, v2, v3 } = await comTres();
    expect((await obter(projeto._id)).projeto.ultimaVarianteId).toBe(v3._id);
    await apagar(projeto._id, v3._id);
    expect((await obter(projeto._id)).projeto.ultimaVarianteId).toBe(v2._id);
  });

  it('se era a primeira, ultimaVarianteId passa à seguinte', async () => {
    const { projeto, base, v2 } = await comTres();
    await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}`,
      payload: { ultimaVarianteId: base._id },
    });
    await apagar(projeto._id, base._id);
    expect((await obter(projeto._id)).projeto.ultimaVarianteId).toBe(v2._id);
  });

  it('apagar outra variante não muda ultimaVarianteId', async () => {
    const { projeto, v2, v3 } = await comTres();
    await apagar(projeto._id, v2._id);
    expect((await obter(projeto._id)).projeto.ultimaVarianteId).toBe(v3._id);
  });

  it('409 na última variante: nada é apagado (RN-23)', async () => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const res = await apagar(projeto._id, variantes[0]!._id);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ erro: expect.any(String) });
    expect((await obter(projeto._id)).variantes).toHaveLength(1);
  });

  it('não mexe em imagens.projetos', async () => {
    const { projeto, base } = await criarProjetoComEscalaApi(t.app);
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const v = criada(
      await criarVarianteApi(t.app, projeto._id, {
        areaUtil: base.areaUtil,
        origem: { tipo: 'copia', fotos: [foto({ imagemId: imagem._id })] },
      }),
    );
    await apagar(projeto._id, v._id);
    const doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(imagem._id) });
    expect(doc!.projetos.map((p: ObjectId) => p.toHexString())).toContain(projeto._id);
  });

  it('404 para variante inexistente ou de outro projeto', async () => {
    const a = await criarProjetoApi(t.app, 'A');
    const b = await criarProjetoApi(t.app, 'B');
    expect((await apagar(a.projeto._id, idFixture(999))).statusCode).toBe(404);
    expect((await apagar(a.projeto._id, b.variantes[0]!._id)).statusCode).toBe(404);
  });
});

describe('PATCH /api/projetos/:id — ultimaVarianteId (M3-04)', () => {
  it('troca a variante aberta por último sem mudar atualizadoEm', async () => {
    const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
    const v2 = criada(await criarVarianteApi(t.app, projeto._id, { nome: 'V2' }));
    const antes = (await obter(projeto._id)).projeto;
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}`,
      payload: { ultimaVarianteId: variantes[0]!._id },
    });
    expect(res.statusCode).toBe(200);
    const depois = res.json() as ProjetoJson;
    expect(depois.ultimaVarianteId).toBe(variantes[0]!._id);
    expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
    expect(depois.nome).toBe('Sala');
    expect(v2._id).not.toBe(variantes[0]!._id);
  });

  it('404 quando a variante não existe ou é de outro projeto', async () => {
    const a = await criarProjetoApi(t.app, 'A');
    const b = await criarProjetoApi(t.app, 'B');
    for (const ultimaVarianteId of [idFixture(999), b.variantes[0]!._id]) {
      const res = await t.app.inject({
        method: 'PATCH',
        url: `/api/projetos/${a.projeto._id}`,
        payload: { ultimaVarianteId },
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('renomear continua atualizando atualizadoEm', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sala');
    const res = await t.app.inject({
      method: 'PATCH',
      url: `/api/projetos/${projeto._id}`,
      payload: { nome: 'Outra' },
    });
    expect(new Date((res.json() as ProjetoJson).atualizadoEm).getTime()).toBeGreaterThan(
      new Date(projeto.atualizadoEm).getTime(),
    );
  });
});
