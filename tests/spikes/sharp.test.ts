import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PERFIS } from '@deco-wall/domain';

// Spike sharp (docs/specs/M0-setup.md §5.6): JPEG com EXIF rotacionado vira WebP no perfil Leve,
// com a orientação já aplicada (retrato, não o 800 × 600 bruto).
const ORIGEM = fileURLToPath(new URL('../fixtures/imagens/exif-rotacionado.jpg', import.meta.url));

describe('spike sharp: EXIF → WebP Leve', () => {
  it('o original está rotacionado por EXIF (orientação ≠ 1, 800 × 600 bruto)', async () => {
    const meta = await sharp(ORIGEM).metadata();
    expect(meta.orientation).not.toBe(1);
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it('converte para WebP com lado maior de 1024 px, orientação aplicada e qualidade do perfil Leve', async () => {
    const { data, info } = await sharp(ORIGEM)
      .rotate()
      .resize({
        width: PERFIS.leve.ladoFotoPx,
        height: PERFIS.leve.ladoFotoPx,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(PERFIS.leve.qualidadeWebp * 100) })
      .toBuffer({ resolveWithObject: true });

    expect(info.format).toBe('webp');
    expect(info.height).toBeGreaterThan(info.width); // retrato: EXIF aplicado
    expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(PERFIS.leve.ladoFotoPx);
    expect(data.length).toBeGreaterThan(0);

    const reabre = await sharp(data).metadata();
    expect(reabre.format).toBe('webp');
  });
});
