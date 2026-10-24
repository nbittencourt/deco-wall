/// <reference lib="dom" />
import { readFile } from 'node:fs/promises';
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
