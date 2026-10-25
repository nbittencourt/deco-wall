/// <reference lib="dom" />
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { cantosPadrao } from '../../packages/domain/src/index';
import { arrastar, criarProjeto, esperarPalco, nomeUnico } from './ajudantes';

// Desempenho da retificação (spec M1 §4.2, §7, aceites 9 e 12; ARCHITECTURE §8 e ADR-16). O tempo é lido do
// User Timing `deco:retificacao`, medido no app em volta do Worker (warp + codificação WebP), e registrado
// no MEMORY.md. Perfil Leve (o padrão): meta de 3 s. Perfil Alto: a meta de 3 s não é atingida em 28 MP
// (ADR-16); o teste guarda contra regressões com o teto da ADR e imprime o tempo medido.

const META_MS = 3000;
const TETO_ALTO_MS = 4500; // ADR-16

async function fotoSintetica(largura: number, altura: number): Promise<string> {
  const bruto = Buffer.alloc(largura * altura * 3);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * 3;
      bruto[i] = (x * 255) / largura;
      bruto[i + 1] = (y * 255) / altura;
      bruto[i + 2] = ((x + y) & 255) >> 1;
    }
  }
  const pasta = await mkdtemp(join(tmpdir(), 'deco-wall-desempenho-'));
  const arquivo = join(pasta, `parede-${largura}x${altura}.jpg`);
  await writeFile(
    arquivo,
    await sharp(bruto, { raw: { width: largura, height: altura, channels: 3 } })
      .jpeg({ quality: 70 })
      .toBuffer(),
  );
  return arquivo;
}

async function medirRetificacao(
  page: Page,
  request: Parameters<typeof criarProjeto>[0],
  perfil: 'Leve' | 'Alto',
  largura: number,
  altura: number,
): Promise<number> {
  const p = await criarProjeto(request, nomeUnico(`Desempenho ${perfil}`));
  const arquivo = await fotoSintetica(largura, altura);

  page.on('console', (mensagem) => {
    if (mensagem.text().startsWith('[retificacao]')) console.log(mensagem.text());
  });

  await page.goto(`/projetos/${p.id}`);
  await page.getByRole('radiogroup', { name: 'Qualidade' }).getByRole('radio', { name: perfil }).click();
  await page.getByLabel('Foto da parede').setInputFiles(arquivo);
  await expect(page.getByText('Correção de perspectiva')).toBeVisible({ timeout: 60_000 });
  await esperarPalco(page);

  // Cantos a 12% / 88% (as alças já nascem a 25% / 75%). O servidor limita o perfil Leve a 3072 px.
  const reducao = perfil === 'Leve' ? Math.min(1, 3072 / Math.max(largura, altura)) : 1;
  const L = largura * reducao;
  const A = altura * reducao;
  const prontas = cantosPadrao(L, A);
  const alvo = [
    { x: L * 0.12, y: A * 0.12 },
    { x: L * 0.88, y: A * 0.14 },
    { x: L * 0.9, y: A * 0.88 },
    { x: L * 0.1, y: A * 0.86 },
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
  test
    .info()
    .annotations.push({ type: `retificacao-${perfil}-ms`, description: String(Math.round(duracaoMs!)) });
  console.log(`Retificação perfil ${perfil} (${largura}×${altura}): ${Math.round(duracaoMs!)} ms`);
  return duracaoMs!;
}

test('retificação no perfil Leve (padrão) leva até 3 s', async ({ page, request }) => {
  test.setTimeout(120_000);
  expect(await medirRetificacao(page, request, 'Leve', 4000, 3000)).toBeLessThanOrEqual(META_MS);
});

test('retificação no perfil Alto (28 MP) fica dentro do teto da ADR-16', async ({ page, request }) => {
  test.setTimeout(120_000);
  const duracao = await medirRetificacao(page, request, 'Alto', 6144, 4608);
  // Meta de 3 s (ARCHITECTURE §8) não atingida em 28 MP: ver ADR-16.
  expect(duracao).toBeLessThanOrEqual(TETO_ALTO_MS);
});
