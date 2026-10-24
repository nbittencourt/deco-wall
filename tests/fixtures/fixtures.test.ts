import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

// Fixtures de imagem do M0 (docs/specs/M0-setup.md §5.5): 6 fotos válidas,
// 1 texto renomeado para .jpg (RN-20) e 1 .heic (RF-15, não suportado na v1).
const IMAGENS = fileURLToPath(new URL('./imagens', import.meta.url));
const PAREDES = fileURLToPath(new URL('./paredes', import.meta.url));

async function decodifica(caminho: string): Promise<boolean> {
  try {
    await sharp(caminho).metadata();
    return true;
  } catch {
    return false;
  }
}

describe('fixtures de imagem (§5.5)', () => {
  it('tem 8 arquivos: 6 fotos e 2 inválidos', async () => {
    expect(await readdir(IMAGENS)).toHaveLength(8);
  });

  it('tem exatamente um .heic, que não é suportado na v1 (RF-15)', async () => {
    const heic = (await readdir(IMAGENS)).filter((f) => f.toLowerCase().endsWith('.heic'));
    expect(heic).toHaveLength(1);
  });

  it('entre os demais, 6 decodificam e 1 falha (texto renomeado para .jpg, RN-20)', async () => {
    const outros = (await readdir(IMAGENS)).filter((f) => !f.toLowerCase().endsWith('.heic'));
    const resultados = await Promise.all(outros.map((f) => decodifica(join(IMAGENS, f))));
    expect(resultados.filter(Boolean)).toHaveLength(6);
    expect(resultados.filter((ok) => !ok)).toHaveLength(1);
  });

  it('o .jpg inválido é texto puro, sem assinatura JPEG', async () => {
    const outros = (await readdir(IMAGENS)).filter((f) => !f.toLowerCase().endsWith('.heic'));
    let achou = false;
    for (const f of outros) {
      if (await decodifica(join(IMAGENS, f))) continue;
      const bytes = await readFile(join(IMAGENS, f));
      expect(bytes[0] === 0xff && bytes[1] === 0xd8).toBe(false);
      achou = true;
    }
    expect(achou).toBe(true);
  });

  it('cobre retrato, paisagem, quadrada, JPEG com EXIF rotacionado, PNG e WEBP', async () => {
    const validos = (await readdir(IMAGENS)).filter((f) => !f.toLowerCase().endsWith('.heic'));
    const metas = [];
    for (const f of validos) {
      if (!(await decodifica(join(IMAGENS, f)))) continue;
      metas.push(await sharp(join(IMAGENS, f)).metadata());
    }
    expect(metas.some((m) => m.format === 'png')).toBe(true);
    expect(metas.some((m) => m.format === 'webp')).toBe(true);
    expect(metas.filter((m) => m.format === 'jpeg').length).toBeGreaterThanOrEqual(4);
    expect(metas.some((m) => (m.width ?? 0) > (m.height ?? 0))).toBe(true);
    expect(metas.some((m) => (m.height ?? 0) > (m.width ?? 0))).toBe(true);
    expect(metas.some((m) => m.width !== undefined && m.width === m.height)).toBe(true);
    expect(metas.some((m) => m.orientation !== undefined && m.orientation !== 1)).toBe(true);
  });
});

describe('fixtures de parede (§5.5, critério de aceite 6 do PRD)', () => {
  it('tem 2 paredes decodificáveis: frontal e em perspectiva', async () => {
    const arquivos = await readdir(PAREDES);
    const decodificadas = await Promise.all(arquivos.map((f) => decodifica(join(PAREDES, f))));
    expect(decodificadas.filter(Boolean)).toHaveLength(2);
  });
});
