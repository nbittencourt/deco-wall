import { expect, test } from '@playwright/test';

// Spike react-konva (docs/specs/M0-setup.md §5.6): um Stage com um retângulo arrastável renderiza e reage ao arraste.
test('Stage renderiza e o retângulo arrastável muda de posição', async ({ page }) => {
  await page.goto('/dev/spike-konva');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const posicao = page.getByTestId('posicao');
  const antes = await posicao.textContent();

  const caixa = await canvas.boundingBox();
  if (!caixa) throw new Error('canvas sem caixa');
  // O retângulo começa em (100, 80) e tem 150 × 100: o centro fica em (175, 130).
  const origemX = caixa.x + 175;
  const origemY = caixa.y + 130;
  await page.mouse.move(origemX, origemY);
  await page.mouse.down();
  await page.mouse.move(origemX + 60, origemY + 40, { steps: 8 });
  await page.mouse.up();

  await expect(posicao).not.toHaveText(antes ?? '');
});
