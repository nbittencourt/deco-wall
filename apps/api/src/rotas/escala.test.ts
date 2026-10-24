import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  aplicarHomografia,
  calcularHomografia,
  homografiaLinear,
  paredeInteira,
  ParedeSchema,
  pxPorCmLinear,
} from '@deco-wall/domain';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  aplicarLinearApi,
  aplicarPerspectivaApi,
  bitmapRetificado,
  criarAppTeste,
  criarProjetoApi,
  dimensoesEsperadas,
  enviarParedeApi,
  montarMultipart,
  type AppTeste,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { id as idFixture } from '../../../../tests/fixtures/dominio';
import { CAMINHO_FRONTAL, PERSPECTIVA } from '../../../../tests/fixtures/paredes';

// Escala: calibração linear e perspectiva (docs/specs/M1-parede-e-escala.md §3.4 a §3.6, §4.2, §5;
// M1-02, M1-08, RN-08, RN-10, RN-33, RN-35, PRD aceite 6).

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

type RespostaEscala = {
  projeto: ProjetoJson;
  variantesAlteradas: { _id: string; revisao: number; areaUtil: VarianteJson['areaUtil'] }[];
};

// Projeto com variante Base e parede carregada (perspectiva.jpg 1600 × 1200 ou frontal.jpg 1200 × 900).
async function projetoComParede(foto: 'perspectiva' | 'frontal' = 'perspectiva') {
  const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
  const arquivo = foto === 'frontal' ? await readFile(CAMINHO_FRONTAL) : undefined;
  const up = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao, arquivo });
  expect(up.statusCode).toBe(200);
  return {
    id: projeto._id,
    base: variantes[0]!,
    revisao: (up.json() as { projeto: ProjetoJson }).projeto.revisao,
  };
}

async function obter(id: string) {
  const res = await t.app.inject({ method: 'GET', url: `/api/projetos/${id}` });
  return res.json() as { projeto: ProjetoJson; variantes: VarianteJson[] };
}

async function existe(relativo: string): Promise<boolean> {
  try {
    await access(join(t.pasta, relativo));
    return true;
  } catch {
    return false;
  }
}

describe('PUT /api/projetos/:id/parede/escala — linear (RF-10, RF-12)', () => {
  it('grava o método, o segmento e a homografia H = escala(1/pxPorCm)', async () => {
    const p = await projetoComParede('frontal');
    // 600 px para 150 cm = 4 px/cm.
    const res = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao });
    expect(res.statusCode).toBe(200);

    const { projeto } = res.json() as RespostaEscala;
    expect(projeto.revisao).toBe(p.revisao + 1);
    expect(projeto.parede!.escala).toEqual({
      metodo: 'linear',
      linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
      homografia: homografiaLinear(pxPorCmLinear({ x: 100, y: 100 }, { x: 700, y: 100 }, 150)),
    });
    expect(projeto.parede!.retificada).toBeUndefined();
  });

  it('primeira escala: grava a área útil = parede inteira nas variantes e devolve as novas revisões (M1-08)', async () => {
    const p = await projetoComParede('frontal');
    const res = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao });
    const corpo = res.json() as RespostaEscala;

    // 1200 × 900 px a 4 px/cm = 300 × 225 cm, origem no canto da foto (RN-07).
    const area = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
    expect(corpo.variantesAlteradas).toEqual([
      { _id: p.base._id, revisao: p.base.revisao + 1, areaUtil: area },
    ]);

    const base = (await obter(p.id)).variantes[0]!;
    expect(base).toMatchObject({ areaUtil: area, revisao: p.base.revisao + 1 });
    // E é exatamente o que o cliente deriva da parede gravada (sem avisos "fora da parede" falsos).
    expect(paredeInteira(ParedeSchema.parse(corpo.projeto.parede))).toEqual(area);
  });

  it('recalibrar preserva a área útil já ajustada (RN-10, RN-35) e não mexe nas variantes', async () => {
    const p = await projetoComParede('frontal');
    const primeira = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao });
    const revisao = (primeira.json() as RespostaEscala).projeto.revisao;
    // O usuário ajusta a área útil e salva a variante.
    const ajustada = { xCm: 10, yCm: 10, larguraCm: 100, alturaCm: 80 };
    await t.db.collection('variantes').updateOne({}, { $set: { areaUtil: ajustada } });

    const res = await aplicarLinearApi(t.app, p.id, {
      revisaoBase: revisao,
      p2: { x: 1000, y: 100 },
      comprimentoCm: 150,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as RespostaEscala).variantesAlteradas).toEqual([]);
    expect((await obter(p.id)).variantes[0]!.areaUtil).toEqual(ajustada);
    // 900 px / 150 cm = 6 px/cm.
    const escala = (res.json() as RespostaEscala).projeto.parede!.escala as unknown as {
      homografia: number[];
    };
    expect(escala.homografia[0]).toBeCloseTo(1 / 6, 9);
  });

  it('422 com comprimento fora de 10 a 2000 cm (A-09)', async () => {
    const p = await projetoComParede('frontal');
    for (const comprimentoCm of [0, -5, 9.9, 2000.1]) {
      const res = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao, comprimentoCm });
      expect(res.statusCode, `comprimento ${comprimentoCm}`).toBe(422);
      expect(res.json()).toMatchObject({ erro: expect.any(String) });
    }
    expect((await obter(p.id)).projeto.parede!.escala).toEqual({ metodo: null });
  });

  it('422 com segmento de comprimento zero ou com pontos fora da foto', async () => {
    const p = await projetoComParede('frontal');
    const nulo = await aplicarLinearApi(t.app, p.id, {
      revisaoBase: p.revisao,
      p1: { x: 50, y: 50 },
      p2: { x: 50, y: 50 },
    });
    expect(nulo.statusCode).toBe(422);
    const fora = await aplicarLinearApi(t.app, p.id, {
      revisaoBase: p.revisao,
      p1: { x: -10, y: 100 },
      p2: { x: 700, y: 100 },
    });
    expect(fora.statusCode).toBe(422);
    const alemDaBorda = await aplicarLinearApi(t.app, p.id, {
      revisaoBase: p.revisao,
      p1: { x: 100, y: 100 },
      p2: { x: 1201, y: 100 },
    });
    expect(alemDaBorda.statusCode).toBe(422);
  });

  it('422 com a perspectiva aplicada (M1-02)', async () => {
    const p = await projetoComParede();
    const persp = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao });
    const revisao = (persp.json() as RespostaEscala).projeto.revisao;

    const res = await aplicarLinearApi(t.app, p.id, { revisaoBase: revisao });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      erro: 'Com a perspectiva aplicada, use Perspectiva para refazer a escala.',
    });
  });

  it('422 sem foto da parede e 404 com projeto inexistente', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sem parede');
    const sem = await aplicarLinearApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    expect(sem.statusCode).toBe(422);
    expect(sem.json()).toEqual({ erro: 'Carregue a foto da parede primeiro.' });
    const nenhum = await aplicarLinearApi(t.app, idFixture(999), { revisaoBase: 1 });
    expect(nenhum.statusCode).toBe(404);
  });

  it('409 quando a revisão do projeto mudou em outra aba', async () => {
    const p = await projetoComParede('frontal');
    const res = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao + 3 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'Este projeto foi alterado em outra aba.' });
    expect((await obter(p.id)).projeto.parede!.escala).toEqual({ metodo: null });
  });
});

describe('PUT /api/projetos/:id/parede/escala — perspectiva (RF-05, ADR-04)', () => {
  it('recalcula H no servidor, grava o bitmap retificado e a geometria (PRD aceite 6)', async () => {
    const p = await projetoComParede();
    const esperado = dimensoesEsperadas({});
    const res = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao });
    expect(res.statusCode).toBe(200);

    const { projeto } = res.json() as RespostaEscala;
    expect(projeto.revisao).toBe(p.revisao + 1);
    const escala = projeto.parede!.escala as {
      metodo: string;
      perspectiva: unknown;
      homografia: number[];
    };
    expect(escala.metodo).toBe('perspectiva');
    expect(escala.perspectiva).toEqual({
      cantosPx: PERSPECTIVA.cantosPx,
      larguraCm: 300,
      alturaCm: 200,
    });
    // A homografia gravada leva os cantos marcados ao retângulo 300 × 200 cm (±1%).
    const retangulo = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 0, y: 200 },
    ];
    PERSPECTIVA.cantosPx.forEach((c, i) => {
      const r = aplicarHomografia(escala.homografia, c);
      expect(Math.abs(r.x - retangulo[i]!.x)).toBeLessThan(3);
      expect(Math.abs(r.y - retangulo[i]!.y)).toBeLessThan(2);
    });
    // A mesma H que o domínio calcula (fonte da verdade).
    const h = calcularHomografia(PERSPECTIVA.cantosPx, retangulo);
    expect(escala.homografia[0]! / escala.homografia[8]!).toBeCloseTo(h[0]! / h[8]!, 6);

    expect(projeto.parede!.retificada).toEqual({
      arquivo: `paredes/${p.id}.retificada.webp`,
      larguraPx: esperado.larguraPx,
      alturaPx: esperado.alturaPx,
      pxPorCm: esperado.pxPorCm,
      origemCm: esperado.origemCm,
    });
    const arquivo = await sharp(join(t.pasta, `paredes/${p.id}.retificada.webp`)).metadata();
    expect([arquivo.width, arquivo.height]).toEqual([esperado.larguraPx, esperado.alturaPx]);
  });

  it('primeira escala: área útil = parede inteira, idêntica à derivada da parede gravada', async () => {
    const p = await projetoComParede();
    const res = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao });
    const corpo = res.json() as RespostaEscala;

    const derivada = paredeInteira(ParedeSchema.parse(corpo.projeto.parede));
    expect(corpo.variantesAlteradas).toEqual([
      { _id: p.base._id, revisao: p.base.revisao + 1, areaUtil: derivada },
    ]);
    expect((await obter(p.id)).variantes[0]!.areaUtil).toEqual(derivada);
    expect(derivada).toEqual(dimensoesEsperadas({}).paredeInteiraCm);
  });

  it('aceita bitmap com 1 px de diferença e recusa com 2 px (±1 px, §4.2 item 7)', async () => {
    const p = await projetoComParede();
    const fora = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao, desvioPx: 2 });
    expect(fora.statusCode).toBe(422);
    expect(fora.json()).toMatchObject({ erro: expect.stringContaining('dimensões') });

    // Recusado: nada muda e nenhum arquivo fica.
    const depois = await obter(p.id);
    expect(depois.projeto.parede!.escala).toEqual({ metodo: null });
    expect(depois.projeto.revisao).toBe(p.revisao);
    expect(await existe(`paredes/${p.id}.retificada.webp`)).toBe(false);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);

    const quase = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao, desvioPx: 1 });
    expect(quase.statusCode).toBe(200);
  });

  it('o servidor ordena os cantos recebidos (alças cruzadas)', async () => {
    const p = await projetoComParede();
    const [tl, tr, br, bl] = PERSPECTIVA.cantosPx;
    const res = await aplicarPerspectivaApi(t.app, p.id, {
      revisaoBase: p.revisao,
      cantosPx: [br!, tl!, bl!, tr!],
    });
    expect(res.statusCode).toBe(200);
    const escala = (res.json() as RespostaEscala).projeto.parede!.escala as unknown as {
      perspectiva: { cantosPx: unknown };
    };
    expect(escala.perspectiva.cantosPx).toEqual([tl, tr, br, bl]);
  });

  it('422 para quadrilátero inválido, medidas fora de 10 a 2000 cm e bitmap que não é imagem', async () => {
    const p = await projetoComParede();
    const concavo = await aplicarPerspectivaApi(t.app, p.id, {
      revisaoBase: p.revisao,
      cantosPx: [
        { x: 0, y: 0 },
        { x: 800, y: 0 },
        { x: 400, y: 200 },
        { x: 0, y: 800 },
      ],
      bitmap: await bitmapRetificado(10, 10),
    });
    expect(concavo.statusCode).toBe(422);
    expect(concavo.json()).toEqual({ erro: 'Os cantos precisam formar um quadrilátero.' });

    for (const medidas of [{ larguraCm: 9 }, { alturaCm: 2001 }]) {
      const res = await aplicarPerspectivaApi(t.app, p.id, {
        revisaoBase: p.revisao,
        bitmap: await bitmapRetificado(10, 10),
        ...medidas,
      });
      expect(res.statusCode).toBe(422);
    }

    const { payload, headers } = await montarMultipart(
      {
        dados: JSON.stringify({
          revisaoBase: p.revisao,
          metodo: 'perspectiva',
          perspectiva: { cantosPx: PERSPECTIVA.cantosPx, larguraCm: 300, alturaCm: 200 },
        }),
      },
      [{ campo: 'retificada', nome: 'x.webp', tipo: 'image/webp', conteudo: Buffer.from('não sou imagem') }],
    );
    const lixo = await t.app.inject({
      method: 'PUT',
      url: `/api/projetos/${p.id}/parede/escala`,
      payload,
      headers,
    });
    expect(lixo.statusCode).toBe(422);
    expect((await obter(p.id)).projeto.parede!.escala).toEqual({ metodo: null });
  });

  it('422 sem o arquivo da retificada', async () => {
    const p = await projetoComParede();
    const { payload, headers } = await montarMultipart({
      dados: JSON.stringify({
        revisaoBase: p.revisao,
        metodo: 'perspectiva',
        perspectiva: { cantosPx: PERSPECTIVA.cantosPx, larguraCm: 300, alturaCm: 200 },
      }),
    });
    const res = await t.app.inject({
      method: 'PUT',
      url: `/api/projetos/${p.id}/parede/escala`,
      payload,
      headers,
    });
    expect(res.statusCode).toBe(422);
  });

  it('409 por revisão apaga o temporário e não deixa a retificada', async () => {
    const p = await projetoComParede();
    const res = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao + 2 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'Este projeto foi alterado em outra aba.' });
    expect(await existe(`paredes/${p.id}.retificada.webp`)).toBe(false);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
  });

  it('de linear para perspectiva: a perspectiva substitui e a área útil mantém os valores em cm (M1-02, RN-10)', async () => {
    const p = await projetoComParede();
    const linear = await aplicarLinearApi(t.app, p.id, { revisaoBase: p.revisao });
    expect(linear.statusCode).toBe(200);
    const ajustada = { xCm: 10, yCm: 20, larguraCm: 120, alturaCm: 90 };
    await t.db.collection('variantes').updateOne({}, { $set: { areaUtil: ajustada } });
    const revisao = (linear.json() as RespostaEscala).projeto.revisao;

    const res = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: revisao });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as RespostaEscala;
    expect((corpo.projeto.parede!.escala as { metodo: string }).metodo).toBe('perspectiva');
    expect((corpo.projeto.parede!.escala as { linear?: unknown }).linear).toBeUndefined();
    expect(corpo.variantesAlteradas).toEqual([]);
    expect((await obter(p.id)).variantes[0]!.areaUtil).toEqual(ajustada);
  });

  it('refazer a perspectiva troca o bitmap e preserva a área útil', async () => {
    const p = await projetoComParede();
    const primeira = await aplicarPerspectivaApi(t.app, p.id, { revisaoBase: p.revisao });
    const revisao = (primeira.json() as RespostaEscala).projeto.revisao;
    const ajustada = { xCm: 30, yCm: 30, larguraCm: 100, alturaCm: 100 };
    await t.db.collection('variantes').updateOne({}, { $set: { areaUtil: ajustada } });
    const antes = await readFile(join(t.pasta, `paredes/${p.id}.retificada.webp`));

    const [tl, tr, br, bl] = PERSPECTIVA.cantosPx;
    const novos = [tl!, { x: tr!.x - 20, y: tr!.y }, { x: br!.x - 20, y: br!.y }, bl!];
    const res = await aplicarPerspectivaApi(t.app, p.id, {
      revisaoBase: revisao,
      cantosPx: novos,
      bitmap: await bitmapRetificado(
        dimensoesEsperadas({ cantosPx: novos }).larguraPx,
        dimensoesEsperadas({ cantosPx: novos }).alturaPx,
      ),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as RespostaEscala).variantesAlteradas).toEqual([]);
    expect((await obter(p.id)).variantes[0]!.areaUtil).toEqual(ajustada);
    const depois = await readFile(join(t.pasta, `paredes/${p.id}.retificada.webp`));
    expect(depois.equals(antes)).toBe(false);
  });

  it('422 sem foto da parede', async () => {
    const { projeto } = await criarProjetoApi(t.app, 'Sem parede');
    const res = await aplicarPerspectivaApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ erro: 'Carregue a foto da parede primeiro.' });
  });
});
