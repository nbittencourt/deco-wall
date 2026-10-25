import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calcularRetificacao, ordenarCantos, PERFIS, type Pt } from '@deco-wall/domain';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Db, MongoClient } from 'mongodb';
import sharp from 'sharp';
import { criarApp } from '../../apps/api/src/app';
import { prepararPastaFotos } from '../../apps/api/src/armazenamento/pasta';
import { executarMigracoes } from '../../apps/api/src/migracoes/executar';
import { abrirBancoTesteLimpo } from './banco-teste';
import { CAMINHO_FRONTAL, CAMINHO_PERSPECTIVA, PERSPECTIVA } from './paredes';

// Infraestrutura dos testes de API do M1: app Fastify completo sobre o banco de teste limpo
// (com os validadores $jsonSchema da migração 0001) e uma PASTA_FOTOS temporária.

export interface AppTeste {
  app: FastifyInstance;
  db: Db;
  client: MongoClient;
  pasta: string;
  fechar(): Promise<void>;
}

// Relógio determinístico: cada chamada avança 1 s, para ordenar `atualizadoEm` sem empate.
export function relogio(inicio = '2026-10-24T12:00:00-03:00'): () => Date {
  let t = new Date(inicio).getTime();
  return () => {
    t += 1000;
    return new Date(t);
  };
}

export async function criarAppTeste(opcoes: { uploadMaxMb?: number } = {}): Promise<AppTeste> {
  const { client, db } = await abrirBancoTesteLimpo();
  await executarMigracoes(db);
  const pasta = await mkdtemp(join(tmpdir(), 'parede-fotos-m1-'));
  await prepararPastaFotos(pasta);
  const app = await criarApp({
    pastaFotos: pasta,
    mongo: client,
    uploadMaxMb: opcoes.uploadMaxMb ?? 50,
    agora: relogio(),
  });
  await app.ready();
  return {
    app,
    db,
    client,
    pasta,
    async fechar() {
      await app.close();
      await client.close();
      await rm(pasta, { recursive: true, force: true });
    },
  };
}

// ---- multipart sem dependência: FormData + Response do Node serializam o corpo ----

export interface ArquivoMultipart {
  campo: string;
  nome: string;
  tipo: string;
  conteudo: Buffer;
}

export async function montarMultipart(
  campos: Record<string, string>,
  arquivos: ArquivoMultipart[] = [],
): Promise<{ payload: Buffer; headers: Record<string, string> }> {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor);
  for (const a of arquivos)
    form.append(a.campo, new Blob([new Uint8Array(a.conteudo)], { type: a.tipo }), a.nome);
  const resposta = new Response(form);
  return {
    payload: Buffer.from(await resposta.arrayBuffer()),
    headers: { 'content-type': resposta.headers.get('content-type') ?? '' },
  };
}

// ---- atalhos de requisição ----

export type Resposta = LightMyRequestResponse;

export async function criarProjetoApi(app: FastifyInstance, nome?: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/projetos',
    payload: nome === undefined ? {} : { nome },
  });
  if (res.statusCode !== 201) throw new Error(`POST /api/projetos respondeu ${res.statusCode}: ${res.body}`);
  return res.json() as { projeto: ProjetoJson; variantes: VarianteJson[] };
}

export async function enviarParedeApi(
  app: FastifyInstance,
  projetoId: string,
  opcoes: {
    revisaoBase: number;
    perfil?: string;
    arquivo?: Buffer;
    nome?: string;
    tipo?: string;
  },
): Promise<Resposta> {
  const arquivo = opcoes.arquivo ?? (await readFile(CAMINHO_PERSPECTIVA));
  const { payload, headers } = await montarMultipart(
    { perfil: opcoes.perfil ?? 'leve', revisaoBase: String(opcoes.revisaoBase) },
    [
      {
        campo: 'arquivo',
        nome: opcoes.nome ?? 'parede.jpg',
        tipo: opcoes.tipo ?? 'image/jpeg',
        conteudo: arquivo,
      },
    ],
  );
  return app.inject({ method: 'PUT', url: `/api/projetos/${projetoId}/parede`, payload, headers });
}

export async function aplicarLinearApi(
  app: FastifyInstance,
  projetoId: string,
  opcoes: { revisaoBase: number; p1?: Pt; p2?: Pt; comprimentoCm?: number },
): Promise<Resposta> {
  return app.inject({
    method: 'PUT',
    url: `/api/projetos/${projetoId}/parede/escala`,
    payload: {
      revisaoBase: opcoes.revisaoBase,
      metodo: 'linear',
      linear: {
        p1: opcoes.p1 ?? { x: 100, y: 100 },
        p2: opcoes.p2 ?? { x: 700, y: 100 },
        comprimentoCm: opcoes.comprimentoCm ?? 150,
      },
    },
  });
}

// Bitmap retificado sintético com as dimensões dadas (o conteúdo não importa para a API).
export async function bitmapRetificado(larguraPx: number, alturaPx: number): Promise<Buffer> {
  return sharp({
    create: {
      width: larguraPx,
      height: alturaPx,
      channels: 4,
      background: { r: 200, g: 180, b: 160, alpha: 1 },
    },
  })
    .webp({ quality: 50 })
    .toBuffer();
}

export function dimensoesEsperadas(opcoes: {
  cantosPx?: Pt[];
  larguraCm?: number;
  alturaCm?: number;
  larguraImagemPx?: number;
  alturaImagemPx?: number;
  perfil?: keyof typeof PERFIS;
}) {
  return calcularRetificacao({
    cantosPx: opcoes.cantosPx ?? PERSPECTIVA.cantosPx,
    larguraCm: opcoes.larguraCm ?? PERSPECTIVA.larguraCm,
    alturaCm: opcoes.alturaCm ?? PERSPECTIVA.alturaCm,
    larguraImagemPx: opcoes.larguraImagemPx ?? PERSPECTIVA.larguraImagemPx,
    alturaImagemPx: opcoes.alturaImagemPx ?? PERSPECTIVA.alturaImagemPx,
    ladoMaxPx: PERFIS[opcoes.perfil ?? 'leve'].ladoParedePx,
  });
}

export async function aplicarPerspectivaApi(
  app: FastifyInstance,
  projetoId: string,
  opcoes: {
    revisaoBase: number;
    cantosPx?: Pt[];
    larguraCm?: number;
    alturaCm?: number;
    bitmap?: Buffer;
    // Soma ao tamanho esperado do bitmap, para testar a conferência de dimensões (±1 px).
    desvioPx?: number;
    larguraImagemPx?: number;
    alturaImagemPx?: number;
  },
): Promise<Resposta> {
  const perspectiva = {
    cantosPx: opcoes.cantosPx ?? PERSPECTIVA.cantosPx,
    larguraCm: opcoes.larguraCm ?? PERSPECTIVA.larguraCm,
    alturaCm: opcoes.alturaCm ?? PERSPECTIVA.alturaCm,
  };
  let bitmap = opcoes.bitmap;
  if (!bitmap) {
    // O servidor ordena os cantos antes de calcular; o bitmap de teste segue a mesma ordem.
    const esperado = dimensoesEsperadas({
      ...perspectiva,
      cantosPx: ordenarCantos(perspectiva.cantosPx),
      larguraImagemPx: opcoes.larguraImagemPx,
      alturaImagemPx: opcoes.alturaImagemPx,
    });
    bitmap = await bitmapRetificado(esperado.larguraPx + (opcoes.desvioPx ?? 0), esperado.alturaPx);
  }
  const { payload, headers } = await montarMultipart(
    { dados: JSON.stringify({ revisaoBase: opcoes.revisaoBase, metodo: 'perspectiva', perspectiva }) },
    [{ campo: 'retificada', nome: 'retificada.webp', tipo: 'image/webp', conteudo: bitmap }],
  );
  return app.inject({
    method: 'PUT',
    url: `/api/projetos/${projetoId}/parede/escala`,
    payload,
    headers,
  });
}

export async function salvarVarianteApi(
  app: FastifyInstance,
  projetoId: string,
  varianteId: string,
  corpo: Record<string, unknown>,
): Promise<Resposta> {
  return app.inject({
    method: 'PUT',
    url: `/api/projetos/${projetoId}/variantes/${varianteId}`,
    payload: corpo,
  });
}

export const FRONTAL_JPG = CAMINHO_FRONTAL;

// ---- formatos de resposta (datas viram texto no JSON) ----

export interface ProjetoJson {
  _id: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
  revisao: number;
  ultimaVarianteId?: string;
  parede: null | {
    perfil: string;
    arquivo: string;
    thumb: string;
    larguraPx: number;
    alturaPx: number;
    escala: Record<string, unknown> & { metodo: string | null };
    retificada?: Record<string, unknown>;
  };
  schemaVersion: number;
}

export interface VarianteJson {
  _id: string;
  projetoId: string;
  nome: string;
  ordem: number;
  revisao: number;
  salvaEm: string;
  salvaPorSessao: string;
  grid: Record<string, unknown>;
  bordaPadrao: Record<string, unknown>;
  areaUtil: null | { xCm: number; yCm: number; larguraCm: number; alturaCm: number };
  fotos: Record<string, unknown>[];
}
