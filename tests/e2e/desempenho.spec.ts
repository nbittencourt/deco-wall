/// <reference lib="dom" />
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { cantosPadrao } from '../../packages/domain/src/index';
import { arrastar, criarProjeto, esperarPalco, nomeUnico } from './ajudantes';

// Desempenho (spec M1 §4.2, §7, aceite 9 e 12; ARCHITECTURE §8): retificação do perfil Alto em até 3 s
// no Chromium. O tempo é lido do User Timing `deco:retificacao`, medido no app em volta do Worker
// (warp + codificação WebP) e registrado no MEMORY.md. Se estourar, parar e escrever a ADR do plano B (WebGL).

const LARGURA = 6144;
const ALTURA = 4608; // 28 MP: o teto do perfil Alto

test('retificação no perfil Alto leva até 3 s', async ({ page, request }) => {
  test.setTimeout(120_000);
  const p = await criarProjeto(request, nomeUnico('Desempenho'));

  // Foto sintética de 6144 × 4608 (conteúdo com gradiente para o warp amostrar de verdade).
  const pasta = await mkdtemp(join(tmpdir(), 'deco-wall-desempenho-'));
  const arquivo = join(pasta, 'parede-alta.jpg');
  const bruto = Buffer.alloc(LARGURA * ALTURA * 3);
  for (let y = 0; y < ALTURA; y += 1) {
    for (let x = 0; x < LARGURA; x += 1) {
      const i = (y * LARGURA + x) * 3;
      bruto[i] = (x * 255) / LARGURA;
      bruto[i + 1] = (y * 255) / ALTURA;
      bruto[i + 2] = ((x + y) & 255) >> 1;
    }
  }
  await writeFile(
    arquivo,
    await sharp(bruto, { raw: { width: LARGURA, height: ALTURA, channels: 3 } })
      .jpeg({ quality: 70 })
      .toBuffer(),
  );

  await page.goto(`/projetos/${p.id}`);
  await page.getByRole('radiogroup', { name: 'Qualidade' }).getByRole('radio', { name: 'Alto' }).click();
  await page.getByLabel('Foto da parede').setInputFiles(arquivo);
  await expect(page.getByText('Correção de perspectiva')).toBeVisible({ timeout: 60_000 });
  await esperarPalco(page);

  // Cantos a 12% / 88% (as alças já nascem a 25% / 75%).
  const prontas = cantosPadrao(LARGURA, ALTURA);
  const alvo = [
    { x: LARGURA * 0.12, y: ALTURA * 0.12 },
    { x: LARGURA * 0.88, y: ALTURA * 0.14 },
    { x: LARGURA * 0.9, y: ALTURA * 0.88 },
    { x: LARGURA * 0.1, y: ALTURA * 0.86 },
  ];
  for (let i = 0; i < 4; i++) await arrastar(page, prontas[i]!, alvo[i]!);
  await page.getByLabel('Largura').fill('400');
  await page.getByLabel('Altura').fill('300');

  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText('Aplicando perspectiva…')).toBeHidden({ timeout: 90_000 });

  const duracaoMs = await page.evaluate(() => {
    const medidas = performance.getEntriesByName('deco:retificacao');
    return medidas.length > 0 ? medidas[medidas.length - 1]!.duration : null;
  });
  expect(duracaoMs, 'o app precisa registrar performance.measure("deco:retificacao")').not.toBeNull();
  test.info().annotations.push({ type: 'retificacao-alto-ms', description: String(Math.round(duracaoMs!)) });
  console.log(`Retificação perfil Alto (${LARGURA}×${ALTURA}): ${Math.round(duracaoMs!)} ms`);
  expect(duracaoMs!).toBeLessThanOrEqual(3000);
});
