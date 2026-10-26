import {
  MENSAGEM_FORMATO_NAO_SUPORTADO,
  MENSAGEM_IMAGEM_ILEGIVEL,
  PERFIS,
  THUMB_FOTO_PX,
  THUMB_PAREDE_PX,
  type Perfil,
} from '@deco-wall/domain';
import sharp, { type Metadata } from 'sharp';
import { ErroHttp } from '../erros';

// Processamento de imagens com sharp (ADR-05, RF-02, RF-25). O original não é guardado (RN-21).

const FORMATOS_ACEITOS = new Set(['jpeg', 'png', 'webp']);

// O formato é decidido pelo conteúdo, não pela extensão nem pelo tipo MIME informado. `ilegivel` é a mensagem
// para o que o sharp nem consegue abrir: a parede mantém a do M1; as fotos da biblioteca usam a do §5.
export async function lerMetadados(
  buffer: Buffer,
  ilegivel: string = MENSAGEM_FORMATO_NAO_SUPORTADO,
): Promise<Metadata> {
  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ErroHttp(415, ilegivel);
  }
  if (!meta.format || !FORMATOS_ACEITOS.has(meta.format)) {
    throw new ErroHttp(415, MENSAGEM_FORMATO_NAO_SUPORTADO);
  }
  return meta;
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

export interface FotoProcessada {
  principal: Buffer;
  thumb: Buffer;
  larguraPx: number;
  alturaPx: number;
  orientacaoNatural: 'retrato' | 'paisagem';
}

// Foto da biblioteca (RF-25, ADR-05): EXIF aplicado, lado maior do perfil sem ampliar, WebP; miniatura de 256 px.
// RN-04: largura maior que a altura é paisagem; senão, retrato (a quadrada vale retrato).
export async function processarFoto(buffer: Buffer, perfil: Perfil): Promise<FotoProcessada> {
  await lerMetadados(buffer, MENSAGEM_IMAGEM_ILEGIVEL);
  const { ladoFotoPx, qualidadeWebp } = PERFIS[perfil];
  try {
    const principal = await sharp(buffer)
      .rotate()
      .resize({ width: ladoFotoPx, height: ladoFotoPx, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: Math.round(qualidadeWebp * 100) })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(buffer)
      .rotate()
      .resize({ width: THUMB_FOTO_PX, height: THUMB_FOTO_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const { width, height } = principal.info;
    return {
      principal: principal.data,
      thumb,
      larguraPx: width,
      alturaPx: height,
      orientacaoNatural: width > height ? 'paisagem' : 'retrato',
    };
  } catch {
    // Cabeçalho válido mas pixels corrompidos.
    throw new ErroHttp(415, MENSAGEM_IMAGEM_ILEGIVEL);
  }
}
