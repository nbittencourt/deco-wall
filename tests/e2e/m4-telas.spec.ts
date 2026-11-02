/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { criarProjetoComEscalaLinear, esperarPalco, lerProjeto, nomeUnico } from './ajudantes';

// Telas do M4 que não são o ciclo de vida nem a exportação (spec M4 §7, E2E 9 e 11; RN-36, M4-16).

const GRID = { visivel: true, snap: true, passoCm: 5, principalACada: 5, cor: '#1F1B16', opacidade: 0.08 };

test.describe('comparação sem troca de lados (RN-36, M4-02, A-21)', () => {
  test('a mesma variante nos dois painéis; escolher outra num lado não mexe no outro', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('RN-36'));
    const base = (await lerProjeto(request, p.id)).variantes[0]!;
    await request.post(`/api/projetos/${p.id}/variantes`, {
      data: {
        sessaoId: 'e2e-api',
        nome: 'Variante 2',
        grid: GRID,
        bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
        areaUtil: base.areaUtil,
        origem: { tipo: 'vazia' },
      },
    });
    await page.goto(`/projetos/${p.id}/comparar`);
    await expect(page.getByText('Somente visualização')).toBeVisible();
    const esquerdo = page.getByRole('region', { name: 'Painel esquerdo' }).getByRole('combobox');
    const direito = page.getByRole('region', { name: 'Painel direito' }).getByRole('combobox');
    // Criar a Variante 2 a tornou a última aberta: ela é a ativa (esquerda) e a Base, a anterior (direita).
    await expect(esquerdo).toContainText('Variante 2');
    await expect(direito).toContainText('Base');

    // Escolher no direito a variante do esquerdo: os dois ficam iguais, sem trocar os lados.
    await direito.click();
    await page.getByRole('option', { name: /^Variante 2/ }).click();
    await expect(direito).toContainText('Variante 2');
    await expect(esquerdo).toContainText('Variante 2');

    // Depois, escolher outra no esquerdo não altera o direito.
    await esquerdo.click();
    await page.getByRole('option', { name: /^Base/ }).click();
    await expect(esquerdo).toContainText('Base');
    await expect(direito).toContainText('Variante 2');

    // Zoom e pan seguem sincronizados: o zoom dos dois palcos é um só.
    const percentual = page.locator('header').getByText(/^\d+%$/);
    const antes = await percentual.textContent();
    await page.getByRole('button', { name: 'Mais zoom' }).click();
    await expect(percentual).not.toHaveText(antes!);
  });
});

test.describe('títulos dos diálogos em Newsreader (M4-16)', () => {
  test('o título de um diálogo usa a fonte serifada do tema', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Fonte'));
    await page.goto(`/projetos/${p.id}`);
    await esperarPalco(page);
    await page.getByRole('button', { name: /^Variante: / }).click();
    await page.getByRole('button', { name: 'Nova variante em branco…' }).click();
    const titulo = page
      .getByRole('dialog', { name: 'Nova variante' })
      .getByText('Nova variante', { exact: true });
    await expect(titulo).toBeVisible();
    const familia = await titulo.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(familia).toContain('Newsreader');
  });
});
