import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Db, MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FotoNaParedeSchema,
  ImagemSchema,
  ParedeSchema,
  ProjetoSchema,
  RascunhoSchema,
  VarianteSchema,
} from '@deco-wall/domain';
import { abrirBancoTesteLimpo, paraDominio } from '../fixtures/banco-teste';
import { executarMigracoes } from '../../apps/api/src/migracoes/executar';
import { semear } from './semear';

// Seed do banco de teste (docs/specs/M0-setup.md §5.5, critério de aceite 6).

let client: MongoClient;
let db: Db;
let pastaFotos: string;

beforeAll(async () => {
  ({ client, db } = await abrirBancoTesteLimpo());
  await executarMigracoes(db);
  pastaFotos = await mkdtemp(join(tmpdir(), 'parede-fotos-seed-'));
  await semear(db, pastaFotos);
});

afterAll(async () => {
  await client.close();
  await rm(pastaFotos, { recursive: true, force: true });
});

const agora = () => new Date();
const todos = (colecao: string) => db.collection(colecao).find({}).toArray();

describe('seed — imagens e ciclo de vida (§4.10, §5.5)', () => {
  it('tem imagens ativas', async () => {
    expect(await db.collection('imagens').countDocuments({ excluidaEm: null })).toBeGreaterThanOrEqual(3);
  });

  it('tem imagem excluída com purga vencida e outra com purga não vencida', async () => {
    const colecao = db.collection('imagens');
    expect(
      await colecao.countDocuments({ excluidaEm: { $ne: null }, purgaEm: { $lt: agora() } }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await colecao.countDocuments({ excluidaEm: { $ne: null }, purgaEm: { $gt: agora() } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it('tem 1 imagem restaurada: ativa, mas ainda recomendada num placeholder', async () => {
    const variantes = await todos('variantes');
    const anteriores = variantes
      .flatMap((v) => v.fotos as { imagemId: unknown; imagemAnteriorId: unknown }[])
      .filter((f) => f.imagemId === null && f.imagemAnteriorId !== null)
      .map((f) => f.imagemAnteriorId);
    const ativas = await db
      .collection('imagens')
      .find({ _id: { $in: anteriores as never[] }, excluidaEm: null })
      .toArray();
    expect(ativas.length).toBeGreaterThanOrEqual(1);
  });

  it('imagens ativas têm arquivos em PASTA_FOTOS (registro com arquivo, §4.8)', async () => {
    const ativas = await db.collection('imagens').find({ excluidaEm: null }).toArray();
    for (const img of ativas) {
      const arquivo = join(pastaFotos, (img.arquivos as { render: string }).render);
      await expect(stat(arquivo), arquivo).resolves.toBeTruthy();
    }
  });
});

describe('seed — projetos e variantes (§5.5)', () => {
  it('tem projeto com parede calibrada por perspectiva e imagem retificada', async () => {
    const projetos = await todos('projetos');
    const calibrado = projetos.find(
      (p) => (p.parede as { escala?: { metodo?: string } } | null)?.escala?.metodo === 'perspectiva',
    );
    expect(calibrado?.parede).toMatchObject({ retificada: expect.any(Object) });
  });

  it('o projeto calibrado tem as variantes "Base" e "Alternativa"', async () => {
    const projetos = await todos('projetos');
    const calibrado = projetos.find(
      (p) => (p.parede as { escala?: { metodo?: string } } | null)?.escala?.metodo === 'perspectiva',
    );
    const nomes = (await db.collection('variantes').find({ projetoId: calibrado?._id }).toArray()).map(
      (v) => v.nome,
    );
    expect(nomes).toEqual(expect.arrayContaining(['Base', 'Alternativa']));
  });

  it('variantes do mesmo projeto compartilham uma imagem', async () => {
    const variantes = await todos('variantes');
    const porVariante = variantes.map(
      (v) => new Set((v.fotos as { imagemId: unknown }[]).map((f) => String(f.imagemId))),
    );
    const compartilhada = porVariante.some((a, i) =>
      porVariante.some((b, j) => i !== j && [...a].some((x) => x !== 'null' && b.has(x))),
    );
    expect(compartilhada).toBe(true);
  });

  it('há variante com placeholder com recomendação e outra com placeholder sem recomendação', async () => {
    const fotos = (await todos('variantes')).flatMap(
      (v) => v.fotos as { imagemId: unknown; imagemAnteriorId: unknown }[],
    );
    const vazios = fotos.filter((f) => f.imagemId === null);
    expect(vazios.some((f) => f.imagemAnteriorId !== null)).toBe(true);
    expect(vazios.some((f) => f.imagemAnteriorId === null && f.imagemId === null)).toBe(true);
  });

  it('há variante criada de template ("piramide") só com vagas', async () => {
    const template = await db.collection('variantes').findOne({ templateOrigem: 'piramide' });
    expect(template).not.toBeNull();
    const fotos = template?.fotos as { imagemId: unknown }[];
    expect(fotos.length).toBeGreaterThan(0);
    expect(fotos.every((f) => f.imagemId === null)).toBe(true);
  });

  it('áreas úteis das variantes do mesmo projeto são diferentes', async () => {
    const projetos = await todos('projetos');
    const calibrado = projetos.find(
      (p) => (p.parede as { escala?: { metodo?: string } } | null)?.escala?.metodo === 'perspectiva',
    );
    const areas = (await db.collection('variantes').find({ projetoId: calibrado?._id }).toArray()).map((v) =>
      JSON.stringify(v.areaUtil),
    );
    expect(new Set(areas).size).toBeGreaterThanOrEqual(2);
  });

  it('há foto com tamanho personalizado (sugeridoId null)', async () => {
    const fotos = (await todos('variantes')).flatMap(
      (v) => v.fotos as { tamanho: { sugeridoId: unknown } }[],
    );
    expect(fotos.some((f) => f.tamanho.sugeridoId === null)).toBe(true);
  });
});

describe('seed — rascunho em conflito (SV-04)', () => {
  it('tem rascunho com revisaoBase menor que a revisão oficial da variante', async () => {
    const rascunhos = await todos('rascunhos');
    let encontrado = false;
    for (const r of rascunhos) {
      const oficial = await db.collection('variantes').findOne({ _id: r.varianteId });
      if (oficial && (r.revisaoBase as number) < (oficial.revisao as number)) encontrado = true;
    }
    expect(encontrado).toBe(true);
  });
});

describe('seed — validade dos dados (DM-07)', () => {
  it('todos os documentos passam nos schemas Zod do domínio', async () => {
    const regras: [string, { safeParse: (v: unknown) => { success: boolean } }][] = [
      ['imagens', ImagemSchema],
      ['projetos', ProjetoSchema],
      ['variantes', VarianteSchema],
      ['rascunhos', RascunhoSchema],
    ];
    for (const [colecao, schema] of regras) {
      for (const doc of await todos(colecao)) {
        const resultado = schema.safeParse(paraDominio(doc));
        expect(resultado.success, `${colecao} ${String(doc._id)}`).toBe(true);
      }
    }
  });

  it('paredes e fotos do seed também são válidas', async () => {
    for (const p of await todos('projetos')) {
      if (p.parede) expect(ParedeSchema.safeParse(paraDominio(p.parede)).success).toBe(true);
    }
    for (const v of await todos('variantes')) {
      for (const f of v.fotos as unknown[]) {
        expect(FotoNaParedeSchema.safeParse(paraDominio(f)).success).toBe(true);
      }
    }
  });
});
