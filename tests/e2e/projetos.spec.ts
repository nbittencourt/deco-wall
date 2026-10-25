/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { criarProjeto, nomeUnico } from './ajudantes';

// Projetos: criar, renomear, excluir (spec M1 §3.1, A-02, aceite 1 e fluxo E2E 5).

test.describe('projetos', () => {
  test('"Novo projeto" cria "Projeto sem nome" na hora e abre o editor vazio (A-02)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Novo projeto' }).first().click();

    await expect(page).toHaveURL(/\/projetos\/[0-9a-f]{24}$/);
    await expect(page.getByRole('heading', { name: 'Projeto sem nome', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comece pela parede' })).toBeVisible();
    await expect(page.getByText('Arraste a foto da parede aqui · JPG, PNG ou WEBP')).toBeVisible();
    // Nasceu com a variante "Base".
    await expect(page.getByRole('combobox', { name: 'Variante' })).toContainText('Base');
  });

  test('renomeia pelo nome no header (Enter grava) e o nome persiste', async ({ page, request }) => {
    const p = await criarProjeto(request, nomeUnico('Antes'));
    const novo = nomeUnico('Depois');
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('heading', { level: 1 }).getByRole('button').click();
    const campo = page.getByRole('textbox', { name: 'Nome do projeto' });
    await campo.fill(novo);
    await campo.press('Enter');
    await expect(page.getByRole('heading', { name: novo, level: 1 })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: novo, level: 1 })).toBeVisible();
  });

  test('Esc no nome do header cancela a edição', async ({ page, request }) => {
    const nome = nomeUnico('Fica');
    const p = await criarProjeto(request, nome);
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('heading', { level: 1 }).getByRole('button').click();
    const campo = page.getByRole('textbox', { name: 'Nome do projeto' });
    await campo.fill('Não grava');
    await campo.press('Escape');
    await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible();
  });

  test('renomeia pelo menu ⋯ da lista', async ({ page, request }) => {
    const antes = nomeUnico('Lista antes');
    const depois = nomeUnico('Lista depois');
    await criarProjeto(request, antes);

    await page.goto('/');
    await page.getByRole('button', { name: `Mais ações de ${antes}` }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByRole('textbox', { name: 'Nome do projeto' }).fill(depois);
    await dialogo.getByRole('button', { name: 'Renomear' }).click();

    await expect(page.getByRole('heading', { name: depois, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: antes, level: 2 })).toHaveCount(0);
  });

  test('exclui com confirmação e o projeto some da lista e da API (fluxo E2E 5, RN-17)', async ({
    page,
    request,
  }) => {
    const nome = nomeUnico('Excluir');
    const p = await criarProjeto(request, nome);

    await page.goto('/');
    await page.getByRole('button', { name: `Mais ações de ${nome}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();

    const dialogo = page.getByRole('dialog', { name: `Excluir “${nome}”?` });
    await expect(dialogo).toContainText(
      'As variantes e a foto da parede deste projeto serão apagadas. As fotos da biblioteca continuam disponíveis.',
    );
    await dialogo.getByRole('button', { name: 'Excluir projeto' }).click();

    await expect(page.getByRole('heading', { name: nome, level: 2 })).toHaveCount(0);
    expect((await request.get(`/api/projetos/${p.id}`)).status()).toBe(404);
  });

  test('cancelar a exclusão mantém o projeto', async ({ page, request }) => {
    const nome = nomeUnico('Manter');
    const p = await criarProjeto(request, nome);

    await page.goto('/');
    await page.getByRole('button', { name: `Mais ações de ${nome}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('heading', { name: nome, level: 2 })).toBeVisible();
    expect((await request.get(`/api/projetos/${p.id}`)).status()).toBe(200);
  });
});
