import { MENSAGEM_FORMATO_NAO_SUPORTADO, PERFIS, THUMB_PAREDE_PX, type Perfil } from '@deco-wall/domain';
import sharp, { type Metadata } from 'sharp';
import { ErroHttp } from '../erros';

// Processamento de imagens com sharp (ADR-05, RF-02, RF-25). O original não é guardado (RN-21).

const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp']);

// O formato é decidido pelo conteúdo, não pela extensão nem pelo tipo MIME informado.
export async function lerMetadados(buffer: Buffer): Promise<Metadata> {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.format || !FORMATOS_ACEITOS.has(meta.format)) {
      throw new ErroHttp(415, MENSAGEM_FORMATO_NAO_SUPORTADO);
    }
    return meta;
  } catch (erro) {
    if (erro instanceof ErroHttp) throw erro;
    throw new ErroHttp(415, MENSAGEM_FORMATO_NAO_SUPORTADO);
  }
}

export interface ParedeProcessada {
  principal: Buffer;
  thumb: Buffer;
  larguraPx: number;
  alturaPx: number;
}

// Aplica a orientação EXIF (RF-02), reduz ao lado maior do perfil sem ampliar e converte para WebP.
// As dimensões vêm do resultado depois da rotação (metadata() informa as de antes dela).
export async function processarParede(buffer: Buffer, perfil: Perfil): Promise<ParedeProcessada> {
  await lerMetadados(buffer);
  const { ladoParedePx, qualidadeWebp } = PERFIS[perfil];
  try {
    const principal = await sharp(buffer)
      .rotate()
      .resize({ width: ladoParedePx, height: ladoParedePx, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: Math.round(qualidadeWebp * 100) })
      .toBuffer({ resolveWithObject: true });
    // A-17: a miniatura do card sai da foto original (já com EXIF), não da retificada.
    const thumb = await sharp(buffer)
      .rotate()
      .resize({ width: THUMB_PAREDE_PX, height: THUMB_PAREDE_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      principal: principal.data,
      thumb,
      larguraPx: principal.info.width,
      alturaPx: principal.info.height,
    };
  } catch {
    // Cabeçalho válido mas pixels corrompidos.
    throw new ErroHttp(415, MENSAGEM_FORMATO_NAO_SUPORTADO);
  }
}
