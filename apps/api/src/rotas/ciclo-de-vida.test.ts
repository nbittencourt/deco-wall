import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoComEscalaApi,
  criarVarianteApi,
  enviarImagemApi,
  salvarRascunhoApi,
  salvarVarianteApi,
  type AppTeste,
  type ImagemJson,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { areaUtil, foto, id as idFixture } from '../../../../tests/fixtures/dominio';

// Ciclo de vida das imagens: associações, remover do projeto, excluir, restaurar e listar excluídas
// (RF-28, RF-29, RF-30a, RN-24, M4-03 a M4-07, A-05, A-06, A-12; docs/specs/M4-ciclo-de-vida-e-exportacao.md §3, §5).

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

const DIA = 86_400_000;

interface Contexto {
  sala: { projeto: ProjetoJson; base: VarianteJson };
  quarto: { projeto: ProjetoJson; base: VarianteJson };
  praia: ImagemJson;
  serra: ImagemJson;
}

// Dois projetos com parede. "Sala": a Base usa a praia 2× e a serra 1×; uma segunda variante usa a praia 1×.
// "Quarto": a Base usa a praia 1× (a imagem foi carregada na Sala e associada ao Quarto pelo salvamento).
async function montar(): Promise<Contexto & { alternativa: VarianteJson }> {
  const sala = await criarProjetoComEscalaApi(t.app, 'Sala');
  const quarto = await criarProjetoComEscalaApi(t.app, 'Quarto');
  const praia = (
    await enviarImagemApi(t.app, { projetoId: sala.projeto._id, nome: 'praia.jpg' })
  ).json() as ImagemJson;
  const serra = (
    await enviarImagemApi(t.app, { projetoId: sala.projeto._id, nome: 'serra.jpg' })
  ).json() as ImagemJson;

  const baseSala = await salvar(sala.projeto, sala.base, [
    foto({ _id: idFixture(101), imagemId: praia._id, xCm: 10, yCm: 10 }),
    foto({ _id: idFixture(102), imagemId: serra._id, xCm: 60, yCm: 10 }),
    foto({ _id: idFixture(103), imagemId: praia._id, xCm: 110, yCm: 10 }),
  ]);
  const criada = await criarVarianteApi(t.app, sala.projeto._id, {
    nome: 'Alternativa',
    areaUtil: sala.base.areaUtil,
    origem: { tipo: 'copia', fotos: [foto({ _id: idFixture(111), imagemId: praia._id })] },
  });
  const alternativa = (criada.json() as { variante: VarianteJson }).variante;
  const baseQuarto = await salvar(quarto.projeto, quarto.base, [
    foto({ _id: idFixture(121), imagemId: praia._id, xCm: 20, yCm: 20 }),
  ]);
  return {
    sala: { projeto: sala.projeto, base: baseSala },
    quarto: { projeto: quarto.projeto, base: baseQuarto },
    praia,
    serra,
    alternativa,
  };
}

async function salvar(projeto: ProjetoJson, variante: VarianteJson, fotos: unknown[]): Promise<VarianteJson> {
  const res = await salvarVarianteApi(t.app, projeto._id, variante._id, {
    sessaoId: 'sessao-a',
    revisaoBase: variante.revisao,
    grid: GRID_PADRAO,
    bordaPadrao: BORDA_PADRAO,
    areaUtil: areaUtil(),
    fotos,
  });
  expect(res.statusCode).toBe(200);
  return { ...variante, revisao: (res.json() as { revisao: number }).revisao };
}

const doc = (colecao: string, id: string) => t.db.collection(colecao).findOne({ _id: new ObjectId(id) });
const fotosDe = async (varianteId: string) =>
  (
    (await doc('variantes', varianteId))!.fotos as {
      _id: ObjectId;
      imagemId: ObjectId | null;
      imagemAnteriorId: ObjectId | null;
    }[]
  ).map((f) => ({
    id: f._id.toHexString(),
    imagemId: f.imagemId?.toHexString() ?? null,
    anterior: f.imagemAnteriorId?.toHexString() ?? null,
  }));
const existe = (relativo: string) =>
  access(join(t.pasta, relativo)).then(
    () => true,
    () => false,
  );

async function rascunhar(projeto: ProjetoJson, variante: VarianteJson, fotos: unknown[]) {
  const res = await salvarRascunhoApi(t.app, projeto._id, variante._id, {
    sessaoId: 'sessao-b',
    revisaoBase: variante.revisao,
    conteudo: { grid: GRID_PADRAO, bordaPadrao: BORDA_PADRAO, areaUtil: areaUtil(), fotos },
  });
  expect(res.statusCode).toBe(200);
}

describe('GET /api/imagens/:id/associacoes (RF-29, A-06)', () => {
  it('lista os usos por projeto e variante, com a quantidade, e os projetos de origem', async () => {
    const c = await montar();
    const res = await t.app.inject({ method: 'GET', url: `/api/imagens/${c.praia._id}/associacoes` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      imagem: {
        _id: c.praia._id,
        nomeOriginal: 'praia.jpg',
        thumbUrl: `/api/imagens/${c.praia._id}/arquivo?tipo=thumb`,
      },
      usos: [
        // ordenados por projeto (nome) e, dentro dele, pela ordem da variante
        {
          projetoId: c.quarto.projeto._id,
          projetoNome: 'Quarto',
          varianteId: c.quarto.base._id,
          varianteNome: 'Base',
          vezes: 1,
        },
        {
          projetoId: c.sala.projeto._id,
          projetoNome: 'Sala',
          varianteId: c.sala.base._id,
          varianteNome: 'Base',
          vezes: 2,
        },
        {
          projetoId: c.sala.projeto._id,
          projetoNome: 'Sala',
          varianteId: c.alternativa._id,
          varianteNome: 'Alternativa',
          vezes: 1,
        },
      ],
      projetos: [
        { projetoId: c.quarto.projeto._id, projetoNome: 'Quarto' },
        { projetoId: c.sala.projeto._id, projetoNome: 'Sala' },
      ],
    });
  });

  it('imagem sem uso: usos vazio e os projetos em que foi carregada', async () => {
    const c = await montar();
    const solta = (
      await enviarImagemApi(t.app, { projetoId: c.sala.projeto._id, nome: 'solta.jpg' })
    ).json() as ImagemJson;
    const corpo = (
      await t.app.inject({ method: 'GET', url: `/api/imagens/${solta._id}/associacoes` })
    ).json() as { usos: unknown[]; projetos: unknown[] };
    expect(corpo.usos).toEqual([]);
    expect(corpo.projetos).toEqual([{ projetoId: c.sala.projeto._id, projetoNome: 'Sala' }]);
  });

  it('conta só o estado salvo: rascunho não entra', async () => {
    const c = await montar();
    await rascunhar(c.sala.projeto, c.sala.base, [foto({ imagemId: c.serra._id })]);
    const corpo = (
      await t.app.inject({ method: 'GET', url: `/api/imagens/${c.serra._id}/associacoes` })
    ).json() as { usos: { vezes: number }[] };
    expect(corpo.usos).toHaveLength(1);
    expect(corpo.usos[0]!.vezes).toBe(1);
  });

  it('404 para imagem inexistente ou id inválido', async () => {
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/imagens/${idFixture(999)}/associacoes` })).statusCode,
    ).toBe(404);
    expect((await t.app.inject({ method: 'GET', url: '/api/imagens/xyz/associacoes' })).statusCode).toBe(404);
  });
});

describe('DELETE /api/imagens/:id — excluir (RN-24, M4-05, A-05)', () => {
  it('marca excluidaEm e purgaEm = excluidaEm + 30 dias', async () => {
    const c = await montar();
    const res = await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as { imagem: { _id: string; excluidaEm: string; purgaEm: string } };
    expect(corpo.imagem._id).toBe(c.praia._id);
    expect(new Date(corpo.imagem.purgaEm).getTime() - new Date(corpo.imagem.excluidaEm).getTime()).toBe(
      30 * DIA,
    );
    const salvo = await doc('imagens', c.praia._id);
    expect(salvo!.excluidaEm).toEqual(new Date(corpo.imagem.excluidaEm));
    expect(salvo!.purgaEm).toEqual(new Date(corpo.imagem.purgaEm));
  });

  it('converte em placeholder as fotos da imagem em todos os projetos, mantendo formato e posição', async () => {
    const c = await montar();
    const res = await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const corpo = res.json() as {
      afetadas: { projetoId: string; varianteId: string; revisao: number; fotos: number }[];
      fotosConvertidas: number;
    };
    expect(corpo.fotosConvertidas).toBe(4);
    expect(await fotosDe(c.sala.base._id)).toEqual([
      { id: idFixture(101), imagemId: null, anterior: c.praia._id },
      { id: idFixture(102), imagemId: c.serra._id, anterior: null },
      { id: idFixture(103), imagemId: null, anterior: c.praia._id },
    ]);
    expect((await fotosDe(c.alternativa._id))[0]).toMatchObject({ imagemId: null, anterior: c.praia._id });
    expect((await fotosDe(c.quarto.base._id))[0]).toMatchObject({ imagemId: null, anterior: c.praia._id });
    const antes = (await doc('variantes', c.sala.base._id))!.fotos[0];
    expect(antes).toMatchObject({ xCm: 10, yCm: 10, tamanho: { larguraCm: 20, alturaCm: 30 } });
    expect(corpo.afetadas.map((a) => [a.varianteId, a.fotos]).sort()).toEqual(
      [
        [c.sala.base._id, 2],
        [c.alternativa._id, 1],
        [c.quarto.base._id, 1],
      ].sort(),
    );
  });

  it('soma 1 à revisão só das variantes afetadas e não toca salvaEm, salvaPorSessao nem o projeto', async () => {
    const c = await montar();
    const serraSo = await criarVarianteApi(t.app, c.sala.projeto._id, {
      nome: 'Só serra',
      origem: { tipo: 'copia', fotos: [foto({ _id: idFixture(131), imagemId: c.serra._id })] },
    });
    const outra = (serraSo.json() as { variante: VarianteJson }).variante;
    const antesBase = (await doc('variantes', c.sala.base._id))!;
    const antesOutra = (await doc('variantes', outra._id))!;
    const antesProjeto = (await doc('projetos', c.sala.projeto._id))!;
    const imagemAntes = (await doc('imagens', c.praia._id))!;

    const res = await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const corpo = res.json() as { afetadas: { varianteId: string; revisao: number }[] };

    const depoisBase = (await doc('variantes', c.sala.base._id))!;
    expect(depoisBase.revisao).toBe(antesBase.revisao + 1);
    expect(corpo.afetadas.find((a) => a.varianteId === c.sala.base._id)!.revisao).toBe(depoisBase.revisao);
    expect(depoisBase.salvaEm).toEqual(antesBase.salvaEm);
    expect(depoisBase.salvaPorSessao).toBe(antesBase.salvaPorSessao);
    // variante que não usava a imagem: nada muda
    expect(await doc('variantes', outra._id)).toEqual(antesOutra);
    expect(corpo.afetadas.some((a) => a.varianteId === outra._id)).toBe(false);
    // projeto e associação intactos
    expect(await doc('projetos', c.sala.projeto._id)).toEqual(antesProjeto);
    expect((await doc('imagens', c.praia._id))!.projetos).toEqual(imagemAntes.projetos);
  });

  it('converte também os rascunhos, sem mudar salvoEm nem revisaoBase', async () => {
    const c = await montar();
    await rascunhar(c.sala.projeto, c.sala.base, [
      foto({ _id: idFixture(141), imagemId: c.praia._id }),
      foto({ _id: idFixture(142), imagemId: c.serra._id }),
    ]);
    const antes = (await t.db.collection('rascunhos').findOne({}))!;
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const depois = (await t.db.collection('rascunhos').findOne({}))!;
    expect(depois.salvoEm).toEqual(antes.salvoEm);
    expect(depois.revisaoBase).toBe(antes.revisaoBase);
    expect(depois.conteudo.fotos[0]).toMatchObject({ imagemId: null });
    expect(depois.conteudo.fotos[0].imagemAnteriorId.toHexString()).toBe(c.praia._id);
    expect(depois.conteudo.fotos[1].imagemId.toHexString()).toBe(c.serra._id);
  });

  it('é idempotente: excluir de novo responde 200 sem converter nada nem mudar o prazo', async () => {
    const c = await montar();
    const primeira = (await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` })).json();
    const revisao = (await doc('variantes', c.sala.base._id))!.revisao;
    const res = await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as { afetadas: unknown[]; fotosConvertidas: number; imagem: unknown };
    expect(corpo.afetadas).toEqual([]);
    expect(corpo.fotosConvertidas).toBe(0);
    expect(corpo.imagem).toEqual((primeira as { imagem: unknown }).imagem);
    expect((await doc('variantes', c.sala.base._id))!.revisao).toBe(revisao);
  });

  it('os arquivos continuam no disco e servidos até a purga (a restauração depende deles)', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    expect(await existe(c.praia.arquivos.render)).toBe(true);
    expect(await existe(c.praia.arquivos.thumb)).toBe(true);
    for (const tipo of ['render', 'thumb']) {
      const r = await t.app.inject({
        method: 'GET',
        url: `/api/imagens/${c.praia._id}/arquivo?tipo=${tipo}`,
      });
      expect(r.statusCode).toBe(200);
    }
  });

  it('sai da biblioteca ativa', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const lista = (await t.app.inject({ method: 'GET', url: '/api/imagens' })).json() as ImagemJson[];
    expect(lista.map((i) => i._id)).toEqual([c.serra._id]);
  });

  it('404 para imagem inexistente ou id inválido', async () => {
    expect((await t.app.inject({ method: 'DELETE', url: `/api/imagens/${idFixture(999)}` })).statusCode).toBe(
      404,
    );
    expect((await t.app.inject({ method: 'DELETE', url: '/api/imagens/xyz' })).statusCode).toBe(404);
  });
});

describe('GET /api/imagens?situacao=excluidas (RF-28, M4-07, A-12)', () => {
  async function marcar(id: string, excluidaEm: string, purgaEm: string) {
    await t.db
      .collection('imagens')
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { excluidaEm: new Date(excluidaEm), purgaEm: new Date(purgaEm) } },
      );
  }

  it('lista as excluídas com prazo futuro, mais novas primeiro, com os dias restantes (para cima)', async () => {
    const c = await montar();
    const terceira = (
      await enviarImagemApi(t.app, { projetoId: c.sala.projeto._id, nome: 'rio.jpg' })
    ).json() as ImagemJson;
    // O relógio do teste começa em 24/10/2026 12:00 (Brasília) e avança 1 s por chamada.
    await marcar(c.praia._id, '2026-10-20T12:00:00-03:00', '2026-11-19T12:00:00-03:00'); // 26 dias
    await marcar(c.serra._id, '2026-10-22T12:00:00-03:00', '2026-10-27T12:00:00-03:00'); // 3 dias
    await marcar(terceira._id, '2026-09-01T12:00:00-03:00', '2026-10-01T12:00:00-03:00'); // vencida
    const res = await t.app.inject({ method: 'GET', url: '/api/imagens?situacao=excluidas' });
    expect(res.statusCode).toBe(200);
    const lista = res.json() as (ImagemJson & { diasRestantes: number })[];
    expect(lista.map((i) => i._id)).toEqual([c.serra._id, c.praia._id]);
    expect(lista.map((i) => i.diasRestantes)).toEqual([3, 26]);
    expect(lista[0]).toMatchObject({
      nomeOriginal: 'serra.jpg',
      excluidaEm: expect.any(String),
      purgaEm: expect.any(String),
    });
  });

  it('sem excluídas, lista vazia; sem o parâmetro, só as ativas; valor inválido, 400', async () => {
    const c = await montar();
    expect((await t.app.inject({ method: 'GET', url: '/api/imagens?situacao=excluidas' })).json()).toEqual(
      [],
    );
    const ativas = (await t.app.inject({ method: 'GET', url: '/api/imagens' })).json() as ImagemJson[];
    expect(ativas).toHaveLength(2);
    expect(
      ((await t.app.inject({ method: 'GET', url: '/api/imagens?situacao=ativas' })).json() as unknown[])
        .length,
    ).toBe(2);
    expect((await t.app.inject({ method: 'GET', url: '/api/imagens?situacao=outra' })).statusCode).toBe(400);
    expect(c.praia._id).toBeTruthy();
  });
});

describe('POST /api/imagens/:id/restaurar (RF-29, RF-30a, M4-07)', () => {
  it('limpa as marcas, devolve a imagem no formato da lista e volta a "Todas"', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const res = await t.app.inject({ method: 'POST', url: `/api/imagens/${c.praia._id}/restaurar` });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { imagem: ImagemJson }).imagem).toMatchObject({
      _id: c.praia._id,
      nomeOriginal: 'praia.jpg',
      excluidaEm: null,
      purgaEm: null,
    });
    const salvo = await doc('imagens', c.praia._id);
    expect(salvo).toMatchObject({ excluidaEm: null, purgaEm: null });
    const lista = (await t.app.inject({ method: 'GET', url: '/api/imagens' })).json() as ImagemJson[];
    expect(lista.map((i) => i._id).sort()).toEqual([c.praia._id, c.serra._id].sort());
  });

  it('não repõe a imagem nos placeholders nem mexe nas variantes (RF-30a)', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const antes = await doc('variantes', c.sala.base._id);
    await t.app.inject({ method: 'POST', url: `/api/imagens/${c.praia._id}/restaurar` });
    expect(await doc('variantes', c.sala.base._id)).toEqual(antes);
    expect((await fotosDe(c.sala.base._id))[0]).toMatchObject({ imagemId: null, anterior: c.praia._id });
  });

  it('410 com o prazo vencido', async () => {
    const c = await montar();
    await t.db
      .collection('imagens')
      .updateOne(
        { _id: new ObjectId(c.praia._id) },
        {
          $set: {
            excluidaEm: new Date('2026-09-01T12:00:00-03:00'),
            purgaEm: new Date('2026-10-01T12:00:00-03:00'),
          },
        },
      );
    const res = await t.app.inject({ method: 'POST', url: `/api/imagens/${c.praia._id}/restaurar` });
    expect(res.statusCode).toBe(410);
    expect((res.json() as { erro: string }).erro).toBe(
      'Esta imagem passou do prazo de 30 dias e será removida.',
    );
    expect((await doc('imagens', c.praia._id))!.excluidaEm).not.toBeNull();
  });

  it('imagem já ativa: 200, sem alterar nada', async () => {
    const c = await montar();
    const res = await t.app.inject({ method: 'POST', url: `/api/imagens/${c.serra._id}/restaurar` });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { imagem: ImagemJson }).imagem._id).toBe(c.serra._id);
  });

  it('404 para imagem inexistente (ou já purgada)', async () => {
    expect(
      (await t.app.inject({ method: 'POST', url: `/api/imagens/${idFixture(999)}/restaurar` })).statusCode,
    ).toBe(404);
    expect((await t.app.inject({ method: 'POST', url: '/api/imagens/xyz/restaurar' })).statusCode).toBe(404);
  });
});

describe('DELETE /api/projetos/:pid/imagens/:id — remover do projeto (RF-29, M4-04, A-05)', () => {
  it('tira as fotos da imagem das variantes do projeto, sem virar placeholder, e soma 1 à revisão', async () => {
    const c = await montar();
    const antesBase = (await doc('variantes', c.sala.base._id))!;
    const res = await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${c.praia._id}`,
    });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as {
      afetadas: { varianteId: string; revisao: number; fotos: number }[];
      fotosRemovidas: number;
    };
    expect(corpo.fotosRemovidas).toBe(3);
    expect(corpo.afetadas.map((a) => [a.varianteId, a.fotos]).sort()).toEqual(
      [
        [c.sala.base._id, 2],
        [c.alternativa._id, 1],
      ].sort(),
    );
    expect(await fotosDe(c.sala.base._id)).toEqual([
      { id: idFixture(102), imagemId: c.serra._id, anterior: null },
    ]);
    expect(await fotosDe(c.alternativa._id)).toEqual([]);
    const depois = (await doc('variantes', c.sala.base._id))!;
    expect(depois.revisao).toBe(antesBase.revisao + 1);
    expect(depois.salvaEm).toEqual(antesBase.salvaEm);
    expect(depois.salvaPorSessao).toBe(antesBase.salvaPorSessao);
    expect(corpo.afetadas.find((a) => a.varianteId === c.sala.base._id)!.revisao).toBe(depois.revisao);
  });

  it('sai de imagens.projetos e não mexe em outros projetos nem na imagem em si', async () => {
    const c = await montar();
    const quartoAntes = await doc('variantes', c.quarto.base._id);
    await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${c.praia._id}`,
    });
    const imagem = (await doc('imagens', c.praia._id))!;
    expect((imagem.projetos as ObjectId[]).map((p) => p.toHexString())).toEqual([c.quarto.projeto._id]);
    expect(imagem.excluidaEm).toBeNull();
    expect(await doc('variantes', c.quarto.base._id)).toEqual(quartoAntes);
  });

  it('não altera salvaEm do projeto nem a ordem da lista (atualizadoEm intacto)', async () => {
    const c = await montar();
    const antes = await doc('projetos', c.sala.projeto._id);
    await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${c.praia._id}`,
    });
    expect(await doc('projetos', c.sala.projeto._id)).toEqual(antes);
  });

  it('reescreve os rascunhos do projeto sem mudar salvoEm nem revisaoBase', async () => {
    const c = await montar();
    await rascunhar(c.sala.projeto, c.sala.base, [
      foto({ _id: idFixture(141), imagemId: c.praia._id }),
      foto({ _id: idFixture(142), imagemId: c.serra._id }),
    ]);
    const antes = (await t.db.collection('rascunhos').findOne({}))!;
    await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${c.praia._id}`,
    });
    const depois = (await t.db.collection('rascunhos').findOne({}))!;
    expect(depois.salvoEm).toEqual(antes.salvoEm);
    expect(depois.revisaoBase).toBe(antes.revisaoBase);
    expect(depois.conteudo.fotos).toHaveLength(1);
    expect(depois.conteudo.fotos[0].imagemId.toHexString()).toBe(c.serra._id);
  });

  it('placeholder que recomendava a imagem continua (só as fotos com a imagem saem)', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${c.praia._id}`,
    });
    expect((await fotosDe(c.sala.base._id)).map((f) => f.id)).toEqual([
      idFixture(101),
      idFixture(102),
      idFixture(103),
    ]);
  });

  it('sem usos: 200 vazio, e o projeto sai de imagens.projetos mesmo assim', async () => {
    const c = await montar();
    const solta = (
      await enviarImagemApi(t.app, { projetoId: c.sala.projeto._id, nome: 'solta.jpg' })
    ).json() as ImagemJson;
    const res = await t.app.inject({
      method: 'DELETE',
      url: `/api/projetos/${c.sala.projeto._id}/imagens/${solta._id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ afetadas: [], fotosRemovidas: 0 });
    expect((await doc('imagens', solta._id))!.projetos).toEqual([]);
  });

  it('404 para projeto ou imagem inexistentes', async () => {
    const c = await montar();
    expect(
      (
        await t.app.inject({
          method: 'DELETE',
          url: `/api/projetos/${idFixture(999)}/imagens/${c.praia._id}`,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await t.app.inject({
          method: 'DELETE',
          url: `/api/projetos/${c.sala.projeto._id}/imagens/${idFixture(999)}`,
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('salvar e copiar com imagem excluída (M4-06, A-11)', () => {
  it('PUT converte a foto em placeholder e devolve imagensExcluidas', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.serra._id}` });
    const variante = (await doc('variantes', c.alternativa._id))!;
    const res = await salvarVarianteApi(t.app, c.sala.projeto._id, c.alternativa._id, {
      sessaoId: 'sessao-a',
      revisaoBase: variante.revisao,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: areaUtil(),
      fotos: [
        foto({ _id: idFixture(151), imagemId: c.praia._id, xCm: 10 }),
        foto({ _id: idFixture(152), imagemId: c.serra._id, xCm: 80, yCm: 25 }),
      ],
    });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as { revisao: number; imagensExcluidas: string[] };
    expect(corpo.imagensExcluidas).toEqual([c.serra._id]);
    expect(corpo.revisao).toBe(variante.revisao + 1);
    const salvas = (await doc('variantes', c.alternativa._id))!.fotos;
    expect(salvas[0].imagemId.toHexString()).toBe(c.praia._id);
    expect(salvas[1]).toMatchObject({ imagemId: null, xCm: 80, yCm: 25, tamanho: { larguraCm: 20 } });
    expect(salvas[1].imagemAnteriorId.toHexString()).toBe(c.serra._id);
  });

  it('PUT sem imagem excluída devolve imagensExcluidas vazio', async () => {
    const c = await montar();
    const variante = (await doc('variantes', c.alternativa._id))!;
    const res = await salvarVarianteApi(t.app, c.sala.projeto._id, c.alternativa._id, {
      sessaoId: 'sessao-a',
      revisaoBase: variante.revisao,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: areaUtil(),
      fotos: [foto({ imagemId: c.praia._id })],
    });
    expect((res.json() as { imagensExcluidas: string[] }).imagensExcluidas).toEqual([]);
  });

  it('a imagem excluída não associa o projeto (a foto virou placeholder)', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.serra._id}` });
    const variante = (await doc('variantes', c.quarto.base._id))!;
    await salvarVarianteApi(t.app, c.quarto.projeto._id, c.quarto.base._id, {
      sessaoId: 'sessao-a',
      revisaoBase: variante.revisao,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: areaUtil(),
      fotos: [foto({ imagemId: c.serra._id })],
    });
    const projetos = ((await doc('imagens', c.serra._id))!.projetos as ObjectId[]).map((p) =>
      p.toHexString(),
    );
    expect(projetos).not.toContain(c.quarto.projeto._id);
  });

  it('POST com origem copia converte e devolve imagensExcluidas', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.serra._id}` });
    const res = await criarVarianteApi(t.app, c.sala.projeto._id, {
      nome: 'Cópia',
      areaUtil: c.sala.base.areaUtil,
      origem: {
        tipo: 'copia',
        fotos: [
          foto({ _id: idFixture(161), imagemId: c.serra._id }),
          foto({ _id: idFixture(162), imagemId: c.praia._id }),
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const corpo = res.json() as { variante: VarianteJson; imagensExcluidas: string[] };
    expect(corpo.imagensExcluidas).toEqual([c.serra._id]);
    expect(corpo.variante.fotos[0]).toMatchObject({ imagemId: null, imagemAnteriorId: c.serra._id });
    expect(corpo.variante.fotos[1]).toMatchObject({ imagemId: c.praia._id });
    expect((await fotosDe(corpo.variante._id))[0]).toMatchObject({ imagemId: null, anterior: c.serra._id });
  });

  it('imagem inexistente continua sendo 422', async () => {
    const c = await montar();
    const variante = (await doc('variantes', c.alternativa._id))!;
    const res = await salvarVarianteApi(t.app, c.sala.projeto._id, c.alternativa._id, {
      sessaoId: 'sessao-a',
      revisaoBase: variante.revisao,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: areaUtil(),
      fotos: [foto({ imagemId: idFixture(777) })],
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('conflito com a exclusão em outra aba (M4-05, M3-09)', () => {
  it('salvar a variante afetada com a revisão antiga dá 409', async () => {
    const c = await montar();
    await t.app.inject({ method: 'DELETE', url: `/api/imagens/${c.praia._id}` });
    const res = await salvarVarianteApi(t.app, c.sala.projeto._id, c.sala.base._id, {
      sessaoId: 'sessao-a',
      revisaoBase: c.sala.base.revisao,
      grid: GRID_PADRAO,
      bordaPadrao: BORDA_PADRAO,
      areaUtil: areaUtil(),
      fotos: [foto({ imagemId: c.praia._id })],
    });
    expect(res.statusCode).toBe(409);
  });
});
