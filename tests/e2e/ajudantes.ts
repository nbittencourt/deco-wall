/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularRetificacao, PERFIS, type Pt } from '../../packages/domain/src/index';
import type { APIRequestContext, Page } from '@playwright/test';
import sharp from 'sharp';
import { CAMINHO_FRONTAL, CAMINHO_PERSPECTIVA, PERSPECTIVA } from '../fixtures/paredes';

// Apoio dos E2E do M1. Cada teste cria o próprio projeto (o banco de teste é compartilhado com o Vitest
// da API: os testes nunca assumem lista vazia) e prepara o estado pela API, quando isso não é o que se testa.

// Contrato de teste do palco (spec M1 §3.9): o Palco publica `window.__deco.paraTela(x, y)`, que converte um
// ponto do conteúdo atual (px da foto nos modos Perspectiva e Calibração; cm no editor e na Área útil) em
// coordenadas da página, para o mouse real do Playwright arrastar alças que não existem no DOM.
interface PalcoTeste {
  paraTela(x: number, y: number): { x: number; y: number };
}
export async function esperarPalco(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { __deco?: unknown }).__deco));
}

export async function paraTela(page: Page, ponto: Pt): Promise<Pt> {
  await esperarPalco(page);
  return page.evaluate(
    ([x, y]) => {
      const p = (window as unknown as { __deco: PalcoTeste }).__deco.paraTela(x!, y!);
      return { x: p.x, y: p.y };
    },
    [ponto.x, ponto.y],
  );
}

// Arrasta com o mouse real de um ponto do conteúdo até outro.
export async function arrastar(page: Page, de: Pt, para: Pt): Promise<void> {
  const a = await paraTela(page, de);
  const b = await paraTela(page, para);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
}

export function nomeUnico(prefixo: string): string {
  return `${prefixo} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ProjetoE2E {
  id: string;
  varianteId: string;
  revisao: number;
}

export async function criarProjeto(request: APIRequestContext, nome = nomeUnico('E2E')): Promise<ProjetoE2E> {
  const res = await request.post('/api/projetos', { data: { nome } });
  const corpo = (await res.json()) as {
    projeto: { _id: string; revisao: number };
    variantes: { _id: string }[];
  };
  return { id: corpo.projeto._id, varianteId: corpo.variantes[0]!._id, revisao: corpo.projeto.revisao };
}

async function enviarParede(request: APIRequestContext, p: ProjetoE2E, arquivo: string): Promise<number> {
  const res = await request.put(`/api/projetos/${p.id}/parede`, {
    multipart: {
      perfil: 'leve',
      revisaoBase: String(p.revisao),
      arquivo: { name: 'parede.jpg', mimeType: 'image/jpeg', buffer: await readFile(arquivo) },
    },
  });
  return ((await res.json()) as { projeto: { revisao: number } }).projeto.revisao;
}

// Projeto com parede frontal.jpg e calibração linear 4 px/cm (600 px = 150 cm): parede inteira 300 × 225 cm.
export async function criarProjetoComEscalaLinear(
  request: APIRequestContext,
  nome?: string,
): Promise<ProjetoE2E> {
  const p = await criarProjeto(request, nome);
  const revisao = await enviarParede(request, p, CAMINHO_FRONTAL);
  const res = await request.put(`/api/projetos/${p.id}/parede/escala`, {
    data: {
      revisaoBase: revisao,
      metodo: 'linear',
      linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
    },
  });
  const novo = ((await res.json()) as { projeto: { revisao: number } }).projeto.revisao;
  return { ...p, revisao: novo };
}

// Projeto com parede em perspectiva (perspectiva.jpg, 300 × 200 cm) já aplicada.
export async function criarProjetoComPerspectiva(
  request: APIRequestContext,
  nome?: string,
): Promise<ProjetoE2E> {
  const p = await criarProjeto(request, nome);
  const revisao = await enviarParede(request, p, CAMINHO_PERSPECTIVA);
  const r = calcularRetificacao({
    cantosPx: PERSPECTIVA.cantosPx,
    larguraCm: PERSPECTIVA.larguraCm,
    alturaCm: PERSPECTIVA.alturaCm,
    larguraImagemPx: PERSPECTIVA.larguraImagemPx,
    alturaImagemPx: PERSPECTIVA.alturaImagemPx,
    ladoMaxPx: PERFIS.leve.ladoParedePx,
  });
  const bitmap = await sharp({
    create: {
      width: r.larguraPx,
      height: r.alturaPx,
      channels: 4,
      background: { r: 200, g: 190, b: 170, alpha: 1 },
    },
  })
    .webp({ quality: 40 })
    .toBuffer();
  const res = await request.put(`/api/projetos/${p.id}/parede/escala`, {
    multipart: {
      dados: JSON.stringify({
        revisaoBase: revisao,
        metodo: 'perspectiva',
        perspectiva: {
          cantosPx: PERSPECTIVA.cantosPx,
          larguraCm: PERSPECTIVA.larguraCm,
          alturaCm: PERSPECTIVA.alturaCm,
        },
      }),
      retificada: { name: 'retificada.webp', mimeType: 'image/webp', buffer: bitmap },
    },
  });
  const novo = ((await res.json()) as { projeto: { revisao: number } }).projeto.revisao;
  return { ...p, revisao: novo };
}

export async function lerProjeto(request: APIRequestContext, id: string) {
  const res = await request.get(`/api/projetos/${id}`);
  return (await res.json()) as {
    projeto: {
      nome: string;
      revisao: number;
      parede: null | {
        larguraPx: number;
        alturaPx: number;
        escala: { metodo: string | null; homografia?: number[]; linear?: unknown; perspectiva?: unknown };
        retificada?: { larguraPx: number; alturaPx: number; pxPorCm: number; origemCm: Pt };
      };
    };
    variantes: {
      _id: string;
      revisao: number;
      grid: { visivel: boolean; passoCm: number; snap: boolean };
      areaUtil: null | { xCm: number; yCm: number; larguraCm: number; alturaCm: number };
      fotos: unknown[];
    }[];
  };
}

// ---- M2: biblioteca e composição ----

const PASTA_IMAGENS = fileURLToPath(new URL('../fixtures/imagens/', import.meta.url));
export const caminhoImagem = (nome: string) => join(PASTA_IMAGENS, nome);

export interface ImagemE2E {
  _id: string;
  nomeOriginal: string;
  perfil: string;
  projetos: string[];
}

// Envia uma imagem da fixture para a biblioteca pela API (quando o upload em si não é o que se testa).
export async function enviarImagem(
  request: APIRequestContext,
  projetoId: string,
  nome = 'retrato.jpg',
  perfil = 'leve',
): Promise<ImagemE2E> {
  const res = await request.post('/api/imagens', {
    multipart: {
      perfil,
      projetoId,
      arquivo: { name: nome, mimeType: 'image/jpeg', buffer: await readFile(caminhoImagem(nome)) },
    },
  });
  return (await res.json()) as ImagemE2E;
}

interface PalcoFotos {
  idsDasFotos(): string[];
  retanguloDaFoto(id: string): { x: number; y: number; largura: number; altura: number } | null;
}

export async function idsDasFotos(page: Page): Promise<string[]> {
  await esperarPalco(page);
  return page.evaluate(() => (window as unknown as { __deco: PalcoFotos }).__deco.idsDasFotos());
}

// Tamanho externo da foto na página (px).
export async function retanguloDaFoto(page: Page, id: string) {
  await esperarPalco(page);
  return page.evaluate(
    (alvo) => (window as unknown as { __deco: PalcoFotos }).__deco.retanguloDaFoto(alvo),
    id,
  );
}

// px de tela por cm de conteúdo no zoom atual.
export async function pxPorCmNaTela(page: Page): Promise<number> {
  const a = await paraTela(page, { x: 0, y: 0 });
  const b = await paraTela(page, { x: 100, y: 0 });
  return (b.x - a.x) / 100;
}

// Centro da foto na página.
export async function centroDaFoto(page: Page, id: string): Promise<Pt> {
  const r = await retanguloDaFoto(page, id);
  if (!r) throw new Error(`Foto ${id} não está na cena.`);
  return { x: r.x + r.largura / 2, y: r.y + r.altura / 2 };
}

export async function lerCampo(page: Page, rotulo: string): Promise<number> {
  const texto = await page.getByLabel(rotulo, { exact: true }).inputValue();
  return Number(texto.replace(',', '.'));
}

// Contrato de teste da cena (T14, spec M2 §3.7, A-12, A-13, A-16, M2-06): o Palco publica as anotações
// desenhadas por cima das fotos (pills, bounding box, textos de imagem indisponível) e a opacidade de cada foto.
export interface AnotacaoCena {
  tipo:
    | 'sobreposicao'
    | 'fora-da-parede'
    | 'fora-da-area-util'
    | 'area-total'
    | 'selecao'
    | 'imagem-indisponivel'
    | 'placeholder';
  fotoId: string | null;
  texto: string;
}

interface PalcoAnotacoes {
  anotacoesDaCena(): AnotacaoCena[];
  opacidadeDaFoto(id: string): number | null;
}

export async function anotacoesDaCena(page: Page): Promise<AnotacaoCena[]> {
  await esperarPalco(page);
  return page.evaluate(() => (window as unknown as { __deco: PalcoAnotacoes }).__deco.anotacoesDaCena());
}

export async function opacidadeDaFoto(page: Page, id: string): Promise<number | null> {
  await esperarPalco(page);
  return page.evaluate(
    (alvo) => (window as unknown as { __deco: PalcoAnotacoes }).__deco.opacidadeDaFoto(alvo),
    id,
  );
}

// Salva a variante pela API (fotos prontas), para cenários que não passam pela tela.
export async function salvarVarianteApi(
  request: APIRequestContext,
  projeto: ProjetoE2E,
  fotos: unknown[],
  areaUtil: { xCm: number; yCm: number; larguraCm: number; alturaCm: number } | null = null,
) {
  const atual = (await lerProjeto(request, projeto.id)).variantes[0]!;
  const res = await request.put(`/api/projetos/${projeto.id}/variantes/${projeto.varianteId}`, {
    data: {
      sessaoId: 'e2e',
      revisaoBase: atual.revisao,
      grid: { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 },
      bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
      areaUtil: areaUtil ?? atual.areaUtil,
      fotos,
    },
  });
  return res;
}

export const fotoDaApi = (n: number, imagemId: string | null, sobrescrita: Record<string, unknown> = {}) => ({
  _id: n.toString(16).padStart(24, '0'),
  imagemId,
  imagemAnteriorId: null,
  tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
  xCm: 50,
  yCm: 50,
  recorte: { offsetX: 0, offsetY: 0 },
  borda: { larguraCm: 0, cor: '#FFFFFF' },
  ...sobrescrita,
});
