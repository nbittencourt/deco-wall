import {
  calcularPrevia,
  calcularRetificacao,
  homografiaBitmapParaImagem,
  multiplicarHomografias,
  retificarPixels,
  type EntradaRetificacao,
  type Pt,
} from '@deco-wall/domain';

// Worker da retificação (ADR-04, P6; docs/specs/M1-parede-e-escala.md §4.2): decodifica a foto da parede,
// faz o warp bilinear e codifica em WebP, fora da thread da interface. O mesmo código do domínio roda
// no servidor, que recalcula a geometria e confere as dimensões do bitmap recebido.

export type PedidoRetificacao =
  | {
      tipo: 'completa';
      id: number;
      urlImagem: string;
      entrada: EntradaRetificacao;
      qualidadeWebp: number;
    }
  | {
      tipo: 'previa';
      id: number;
      urlImagem: string;
      cantosPx: Pt[];
      larguraCm: number;
      alturaCm: number;
    };

export type RespostaRetificacao =
  | { id: number; ok: true; blob: Blob; larguraPx: number; alturaPx: number; tempos?: TemposRetificacao }
  | { id: number; ok: false; erro: string };

// A prévia parte da foto reduzida: 320 px de saída não precisam dos 24 MP de origem.
const LADO_MAX_ORIGEM_PREVIA_PX = 1600;

export interface TemposRetificacao {
  buscarMs: number;
  decodificarMs: number;
  lerPixelsMs: number;
  warpMs: number;
  codificarMs: number;
}

async function carregarImagem(
  url: string,
): Promise<{ bitmap: ImageBitmap; buscarMs: number; decodificarMs: number }> {
  const t0 = performance.now();
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Não foi possível carregar a foto da parede (${resposta.status}).`);
  const blob = await resposta.blob();
  const t1 = performance.now();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, buscarMs: t1 - t0, decodificarMs: performance.now() - t1 };
}

function lerPixels(bitmap: ImageBitmap, largura: number, altura: number): ImageData {
  const canvas = new OffscreenCanvas(largura, altura);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  return ctx.getImageData(0, 0, largura, altura);
}

async function paraBlob(
  pixels: Uint8ClampedArray,
  largura: number,
  altura: number,
  tipo: string,
  qualidade?: number,
) {
  const canvas = new OffscreenCanvas(largura, altura);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, largura, altura), 0, 0);
  return canvas.convertToBlob({ type: tipo, quality: qualidade });
}

async function completa(
  pedido: Extract<PedidoRetificacao, { tipo: 'completa' }>,
): Promise<RespostaRetificacao> {
  const r = calcularRetificacao(pedido.entrada);
  const { bitmap, buscarMs, decodificarMs } = await carregarImagem(pedido.urlImagem);
  const t0 = performance.now();
  const origem = lerPixels(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const t1 = performance.now();
  const pixels = retificarPixels(
    { dados: origem.data, largura: origem.width, altura: origem.height },
    homografiaBitmapParaImagem(r),
    r.larguraPx,
    r.alturaPx,
  );
  const t2 = performance.now();
  const blob = await paraBlob(pixels, r.larguraPx, r.alturaPx, 'image/webp', pedido.qualidadeWebp);
  const t3 = performance.now();
  const tempos: TemposRetificacao = {
    buscarMs,
    decodificarMs,
    lerPixelsMs: t1 - t0,
    warpMs: t2 - t1,
    codificarMs: t3 - t2,
  };
  return { id: pedido.id, ok: true, blob, larguraPx: r.larguraPx, alturaPx: r.alturaPx, tempos };
}

async function previa(pedido: Extract<PedidoRetificacao, { tipo: 'previa' }>): Promise<RespostaRetificacao> {
  const p = calcularPrevia({
    cantosPx: pedido.cantosPx,
    larguraCm: pedido.larguraCm,
    alturaCm: pedido.alturaCm,
  });
  const { bitmap } = await carregarImagem(pedido.urlImagem);
  const { width: larguraOriginal, height: alturaOriginal } = bitmap;
  const fator = Math.min(1, LADO_MAX_ORIGEM_PREVIA_PX / Math.max(larguraOriginal, alturaOriginal));
  const largura = Math.max(1, Math.round(larguraOriginal * fator));
  const altura = Math.max(1, Math.round(alturaOriginal * fator));
  const origem = lerPixels(bitmap, largura, altura);
  bitmap.close();
  // Os cantos vêm em px da foto inteira; a origem reduzida muda a escala (fator horizontal e vertical).
  const reducao = [largura / larguraOriginal, 0, 0, 0, altura / alturaOriginal, 0, 0, 0, 1];
  const pixels = retificarPixels(
    { dados: origem.data, largura, altura },
    multiplicarHomografias(reducao, p.homografiaBitmapParaImagem),
    p.larguraPx,
    p.alturaPx,
  );
  const blob = await paraBlob(pixels, p.larguraPx, p.alturaPx, 'image/png');
  return { id: pedido.id, ok: true, blob, larguraPx: p.larguraPx, alturaPx: p.alturaPx };
}

// O tsconfig da web usa a lib DOM; a lib "webworker" conflitaria com ela, então o escopo do Worker é tipado à mão.
const escopo = self as unknown as {
  onmessage: ((evento: MessageEvent<PedidoRetificacao>) => void) | null;
  postMessage(mensagem: RespostaRetificacao): void;
};

escopo.onmessage = async (evento: MessageEvent<PedidoRetificacao>) => {
  const pedido = evento.data;
  try {
    const resposta = pedido.tipo === 'completa' ? await completa(pedido) : await previa(pedido);
    escopo.postMessage(resposta);
  } catch (erro) {
    const resposta: RespostaRetificacao = {
      id: pedido.id,
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    };
    escopo.postMessage(resposta);
  }
};
