/// <reference lib="dom" />
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Divisão do pacote JS (M4-15, A-24; docs/specs/M4-ciclo-de-vida-e-exportacao.md §7, E2E 10): nenhum chunk acima
// de 500 kB (o aviso do Vite some) e a tela Projetos não baixa o Konva.

const PASTA_ASSETS = fileURLToPath(new URL('../../apps/web/dist/assets/', import.meta.url));
const LIMITE_BYTES = 500 * 1000;

test.describe('pacote JS', () => {
  test('nenhum chunk .js passa de 500 kB', () => {
    const grandes = readdirSync(PASTA_ASSETS)
      .filter((nome) => nome.endsWith('.js'))
      .map((nome) => ({ nome, bytes: statSync(join(PASTA_ASSETS, nome)).size }))
      .filter((arquivo) => arquivo.bytes > LIMITE_BYTES);
    expect(grandes).toEqual([]);
  });

  test('a tela Projetos não baixa o chunk do Konva', async ({ page }) => {
    const baixados: string[] = [];
    page.on('request', (requisicao) => baixados.push(requisicao.url()));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Projetos', level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const scripts = baixados.filter((url) => /\.js(\?|$)/.test(new URL(url).pathname + new URL(url).search));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((url) => /konva/i.test(url))).toEqual([]);
  });

  test('o editor baixa o Konva só ao abrir um projeto', async ({ page, request }) => {
    const resposta = await request.post('/api/projetos', { data: { nome: `Pacote ${Date.now()}` } });
    const { projeto } = (await resposta.json()) as { projeto: { _id: string } };
    const baixados: string[] = [];
    page.on('request', (requisicao) => baixados.push(requisicao.url()));
    await page.goto(`/projetos/${projeto._id}`);
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
    expect(baixados.some((url) => /konva/i.test(url))).toBe(true);
  });
});
