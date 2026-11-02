import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoComEscalaApi,
  enviarImagemApi,
  salvarRascunhoApi,
  salvarVarianteApi,
  type AppTeste,
  type ImagemJson,
} from '../../../../tests/fixtures/api';
import { areaUtil, foto, id as idFixture } from '../../../../tests/fixtures/dominio';
import type { ContextoApi } from '../contexto';
import { iniciarPurga, purgarImagens } from './purga';

// Purga das imagens excluídas (RN-24, M4-09, A-10; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.4).
// Ordem por imagem: zera imagemAnteriorId nas variantes e rascunhos, apaga os arquivos, apaga o documento.

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

const AGORA = new Date('2026-11-02T12:00:00-03:00');
const DIA = 86_400_000;

function contexto(agora: Date = AGORA): ContextoApi {
  return { db: t.db, pastaFotos: t.pasta, uploadMaxMb: 50, agora: () => agora, log: t.app.log };
}

const existe = (relativo: string) =>
  access(join(t.pasta, relativo)).then(
    () => true,
    () => false,
  );

async function imagemNova(projetoId: string, nome = 'foto.jpg'): Promise<ImagemJson> {
  return (await enviarImagemApi(t.app, { projetoId, nome })).json() as ImagemJson;
}

async function excluir(id: string, purgaEm: Date) {
  await t.db
    .collection('imagens')
    .updateOne(
      { _id: new ObjectId(id) },
      { $set: { excluidaEm: new Date(purgaEm.getTime() - 30 * DIA), purgaEm } },
    );
}

async function cenario() {
  const { projeto, base } = await criarProjetoComEscalaApi(t.app, 'Sala');
  const vencida = await imagemNova(projeto._id, 'vencida.jpg');
  const futura = await imagemNova(projeto._id, 'futura.jpg');
  const viva = await imagemNova(projeto._id, 'viva.jpg');
  // A Base tem 3 placeholders que recomendam (vencida, futura e viva) — o estado depois de excluir as imagens.
  const res = await salvarVarianteApi(t.app, projeto._id, base._id, {
    sessaoId: 'sessao-a',
    revisaoBase: base.revisao,
    grid: GRID_PADRAO,
    bordaPadrao: BORDA_PADRAO,
    areaUtil: areaUtil(),
    fotos: [
      foto({ _id: idFixture(101), imagemId: null, imagemAnteriorId: vencida._id }),
      foto({ _id: idFixture(102), imagemId: null, imagemAnteriorId: futura._id }),
      foto({ _id: idFixture(103), imagemId: viva._id }),
    ],
  });
  expect(res.statusCode).toBe(200);
  await excluir(vencida._id, new Date(AGORA.getTime() - DIA));
  await excluir(futura._id, new Date(AGORA.getTime() + 10 * DIA));
  return { projeto, baseId: base._id, vencida, futura, viva };
}

describe('purgarImagens (M4-09)', () => {
  it('apaga o documento e os dois arquivos da imagem vencida', async () => {
    const c = await cenario();
    expect(await existe(c.vencida.arquivos.render)).toBe(true);
    const resumo = await purgarImagens(contexto());
    expect(resumo).toMatchObject({ removidas: 1, falhas: 0 });
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(c.vencida._id) })).toBeNull();
    expect(await existe(c.vencida.arquivos.render)).toBe(false);
    expect(await existe(c.vencida.arquivos.thumb)).toBe(false);
  });

  it('preserva a imagem ainda dentro do prazo e a ativa, com os arquivos', async () => {
    const c = await cenario();
    await purgarImagens(contexto());
    for (const imagem of [c.futura, c.viva]) {
      expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(imagem._id) })).not.toBeNull();
      expect(await existe(imagem.arquivos.render)).toBe(true);
    }
  });

  it('zera imagemAnteriorId nas variantes e nos rascunhos sem mudar revisão nem datas', async () => {
    const c = await cenario();
    const rascunho = await salvarRascunhoApi(t.app, c.projeto._id, c.baseId, {
      sessaoId: 'sessao-b',
      revisaoBase: (await t.db.collection('variantes').findOne({ _id: new ObjectId(c.baseId) }))!.revisao,
      conteudo: {
        grid: GRID_PADRAO,
        bordaPadrao: BORDA_PADRAO,
        areaUtil: areaUtil(),
        fotos: [foto({ _id: idFixture(101), imagemId: null, imagemAnteriorId: c.vencida._id })],
      },
    });
    expect(rascunho.statusCode).toBe(200);
    const variantesAntes = (await t.db.collection('variantes').findOne({ _id: new ObjectId(c.baseId) }))!;
    const rascunhoAntes = (await t.db.collection('rascunhos').findOne({}))!;

    await purgarImagens(contexto());

    const depois = (await t.db.collection('variantes').findOne({ _id: new ObjectId(c.baseId) }))!;
    expect(depois.revisao).toBe(variantesAntes.revisao);
    expect(depois.salvaEm).toEqual(variantesAntes.salvaEm);
    expect(depois.fotos[0].imagemAnteriorId).toBeNull();
    // a recomendação da imagem que ainda está no prazo continua
    expect(depois.fotos[1].imagemAnteriorId.toHexString()).toBe(c.futura._id);
    const rDepois = (await t.db.collection('rascunhos').findOne({}))!;
    expect(rDepois.conteudo.fotos[0].imagemAnteriorId).toBeNull();
    expect(rDepois.salvoEm).toEqual(rascunhoAntes.salvoEm);
    expect(rDepois.revisaoBase).toBe(rascunhoAntes.revisaoBase);
  });

  it('arquivo ausente conta como apagado', async () => {
    const c = await cenario();
    const { rm } = await import('node:fs/promises');
    await rm(join(t.pasta, c.vencida.arquivos.render));
    const resumo = await purgarImagens(contexto());
    expect(resumo).toMatchObject({ removidas: 1, falhas: 0 });
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(c.vencida._id) })).toBeNull();
  });

  it('falha em uma imagem mantém o documento dela e não interrompe as outras', async () => {
    const c = await cenario();
    // A mais antiga não consegue apagar o arquivo (o caminho é uma pasta com conteúdo).
    const preso = await imagemNova(c.projeto._id, 'presa.jpg');
    await mkdir(join(t.pasta, 'imagens', 'pasta-presa'), { recursive: true });
    await writeFile(join(t.pasta, 'imagens', 'pasta-presa', 'x'), 'x');
    await t.db
      .collection('imagens')
      .updateOne({ _id: new ObjectId(preso._id) }, { $set: { 'arquivos.render': 'imagens/pasta-presa' } });
    await excluir(preso._id, new Date(AGORA.getTime() - 5 * DIA));

    const resumo = await purgarImagens(contexto());
    expect(resumo).toMatchObject({ removidas: 1, falhas: 1 });
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(preso._id) })).not.toBeNull();
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(c.vencida._id) })).toBeNull();
  });

  it('usa o relógio injetado: antes do prazo nada é removido', async () => {
    const c = await cenario();
    const resumo = await purgarImagens(contexto(new Date(AGORA.getTime() - 3 * DIA)));
    expect(resumo).toMatchObject({ removidas: 0, falhas: 0 });
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(c.vencida._id) })).not.toBeNull();
  });

  it('é idempotente: uma segunda rodada não encontra mais nada', async () => {
    await cenario();
    await purgarImagens(contexto());
    expect(await purgarImagens(contexto())).toMatchObject({ removidas: 0, falhas: 0 });
  });

  it('não deixa duas rodadas sobrepostas: a segunda é ignorada', async () => {
    await cenario();
    const [a, b] = await Promise.all([purgarImagens(contexto()), purgarImagens(contexto())]);
    expect(a.removidas + b.removidas).toBe(1);
    expect([a.ignorada, b.ignorada].filter(Boolean)).toHaveLength(1);
  });
});

describe('iniciarPurga — inicialização e agendamento a cada 24 h (A-10)', () => {
  it('roda uma rodada ao iniciar e agenda a próxima em 24 h', async () => {
    const c = await cenario();
    const agendados: { tarefa: () => Promise<unknown> | void; ms: number }[] = [];
    let cancelado = false;
    const purga = await iniciarPurga(contexto(), {
      agendador: (tarefa, ms) => {
        agendados.push({ tarefa, ms });
        return () => {
          cancelado = true;
        };
      },
    });
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(c.vencida._id) })).toBeNull();
    expect(agendados).toHaveLength(1);
    expect(agendados[0]!.ms).toBe(24 * 60 * 60 * 1000);

    // A tarefa agendada executa uma nova rodada.
    const outra = await imagemNova(c.projeto._id, 'outra.jpg');
    await excluir(outra._id, new Date(AGORA.getTime() - DIA));
    await agendados[0]!.tarefa();
    expect(await t.db.collection('imagens').findOne({ _id: new ObjectId(outra._id) })).toBeNull();

    purga.parar();
    expect(cancelado).toBe(true);
  });
});

describe('desempenho da purga (A-20)', () => {
  it('purga 200 imagens vencidas em menos de 5 s', async () => {
    const { projeto } = await criarProjetoComEscalaApi(t.app, 'Perf');
    const modelo = await imagemNova(projeto._id, 'modelo.jpg');
    const { copyFile } = await import('node:fs/promises');
    const base = (await t.db.collection('imagens').findOne({ _id: new ObjectId(modelo._id) }))!;
    const docs = [];
    for (let i = 0; i < 200; i += 1) {
      const _id = new ObjectId();
      const hex = _id.toHexString();
      const arquivos = { render: `imagens/${hex}.webp`, thumb: `imagens/${hex}.thumb.webp` };
      await copyFile(join(t.pasta, modelo.arquivos.render), join(t.pasta, arquivos.render));
      await copyFile(join(t.pasta, modelo.arquivos.thumb), join(t.pasta, arquivos.thumb));
      docs.push({
        ...base,
        _id,
        arquivos,
        excluidaEm: new Date(AGORA.getTime() - 40 * DIA),
        purgaEm: new Date(AGORA.getTime() - DIA),
      });
    }
    await t.db.collection('imagens').insertMany(docs);

    const inicio = performance.now();
    const resumo = await purgarImagens(contexto());
    const duracao = performance.now() - inicio;
    console.log(`[purga] 200 imagens em ${Math.round(duracao)} ms`);
    expect(resumo).toMatchObject({ removidas: 200, falhas: 0 });
    expect(duracao).toBeLessThan(5000);
    expect(await existe(`imagens/${docs[0]!._id.toHexString()}.webp`)).toBe(false);
  });
});
