/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

const TEXTO_INATIVO = 'Disponível em uma próxima versão';

test.describe('smoke do M0', () => {
  test('a página inicial mostra API, MongoDB e pasta como ok (aceite 2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Projetos', level: 1 })).toBeVisible();
    const servicos = page.getByRole('list', { name: 'Estado dos serviços locais' });
    await expect(servicos).toContainText('API: ok');
    await expect(servicos).toContainText('MongoDB: ok');
    await expect(servicos).toContainText('Pasta de fotos: ok');
  });

  test('/dev/ui reproduz as pranchas 00 e 17 (aceite 10)', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { name: 'Identidade visual' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Componentes' })).toBeVisible();
    await expect(page.getByText('Projetos', { exact: true }).first()).toBeVisible();
  });

  test('as cascas 01 Projetos e 03 Editor renderizam (aceite 11)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Sem foto da parede').first()).toBeVisible();

    await page.goto('/editor');
    await expect(page.getByRole('heading', { name: 'Sala de estar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Composição' })).toBeVisible();
  });
});

test.describe('header do editor', () => {
  test('em 1440 px mostra as ações no header e não o menu Parede', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/editor');
    await expect(page.getByRole('button', { name: 'Comparar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parede', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu Parede' })).toBeHidden();
  });

  test('em 1280 px usa o menu "Parede ▾" e não quebra linha (aceite 11)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/editor');
    await expect(page.getByRole('button', { name: 'Menu Parede' })).toBeVisible();
    // Só os 4 itens da parede vão para o menu; Comparar e Templates ficam (DESIGN §7).
    await expect(page.getByRole('button', { name: 'Comparar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Perspectiva' })).toBeHidden();
    // O status de salvamento fica só na barra de status.
    await expect(page.locator('header').getByRole('status')).toHaveCount(0);

    // Uma linha só: o centro vertical de todos os filhos visíveis fica na mesma faixa, e nada transborda.
    const medidas = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return null;
      const centros = [...header.children]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => {
          const caixa = el.getBoundingClientRect();
          return caixa.top + caixa.height / 2;
        });
      return { centros, transborda: header.scrollWidth > header.clientWidth };
    });
    expect(medidas).not.toBeNull();
    const { centros, transborda } = medidas!;
    expect(Math.max(...centros) - Math.min(...centros)).toBeLessThanOrEqual(2);
    expect(transborda).toBe(false);
  });
});

test.describe('controles inativos (aceite 12)', () => {
  test('aria-disabled, foco e tooltip padrão', async ({ page }) => {
    await page.goto('/editor');
    const exportar = page.getByRole('button', { name: 'Exportar' });
    await expect(exportar).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, não o atributo disabled: o botão continua focável.
    expect(await exportar.evaluate((el) => el.hasAttribute('disabled'))).toBe(false);

    await exportar.focus();
    await expect(page.getByRole('tooltip').filter({ hasText: TEXTO_INATIVO }).first()).toBeVisible();
  });
});

// DESIGN §6: todo botão só de ícone tem tooltip com o nome, no hover (mouse real) e no foco.
test.describe('dicas dos botões só de ícone', () => {
  const ICONES = [
    'Voltar aos projetos',
    'Snap ao grid',
    'Desfazer',
    'Refazer',
    'Mais filtros',
    'Trazer para frente',
    'Enviar para trás',
    'Diminuir zoom',
    'Aumentar zoom',
  ];

  test('hover mostra o nome do botão', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/editor');
    for (const nome of ICONES) {
      // Sai para uma área neutra antes: o Radix só troca de tooltip depois que o ponteiro deixa o anterior.
      await page.mouse.move(720, 500, { steps: 4 });
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.locator(`[aria-label="${nome}"]`).first().hover();
      await expect(page.getByRole('tooltip').filter({ hasText: nome })).toBeVisible();
    }
  });

  test('foco pelo teclado também mostra a dica (ComDica)', async ({ page }) => {
    await page.goto('/editor');
    await page.locator('[aria-label="Snap ao grid"]').first().focus();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Snap ao grid' })).toBeVisible();
  });
});

test.describe('rede (aceite 13, RNF-01)', () => {
  test('nenhuma requisição fora de localhost durante a navegação', async ({ page }) => {
    const externas: string[] = [];
    page.on('request', (requisicao) => {
      const url = new URL(requisicao.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !url.protocol.startsWith('data')) {
        externas.push(requisicao.url());
      }
    });

    for (const caminho of ['/', '/editor', '/dev/ui']) {
      await page.goto(caminho);
      await page.waitForLoadState('networkidle');
    }

    expect(externas).toEqual([]);
  });
});
