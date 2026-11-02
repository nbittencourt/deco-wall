import { QUALIDADE_JPG, type ComandoExportacao, type ResolucaoExportacao } from '@deco-wall/domain';
import {
  chaveDaOrigem,
  comporExportacao,
  type Contexto2DExportacao,
  type ImagemDesenhavel,
} from '../exportacao-compositor';

// Worker da exportação (ADR-08, P6; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.5, A-17): compõe a imagem num
// OffscreenCanvas, uma imagem por vez, fora da thread da interface, e devolve o Blob já codificado em PNG ou JPG.
// A prévia do diálogo passa pelo mesmo caminho, só com a resolução reduzida.

export interface PedidoExportacaoWorker {
  comandos: ComandoExportacao[];
  resolucao: ResolucaoExportacao;
  // `png` ou `jpg` (nunca WebP: o WebP é só o formato interno de armazenamento).
  formato: 'png' | 'jpg';
  // URL absoluta de cada imagem, pela chave de `chaveDaOrigem`.
  urls: Record<string, string>;
}

export type RespostaExportacaoWorker =
  { ok: true; blob: Blob; imagensIndisponiveis: number; tempoMs: number } | { ok: false; erro: string };

async function carregarBitmap(url: string | undefined): Promise<ImagemDesenhavel | null> {
  if (!url) return null;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return await createImageBitmap(await resposta.blob());
  } catch {
    return null;
  }
}

self.onmessage = async (evento: MessageEvent<PedidoExportacaoWorker>) => {
  const { comandos, resolucao, formato, urls } = evento.data;
  const inicio = performance.now();
  try {
    const canvas = new OffscreenCanvas(resolucao.larguraPx, resolucao.alturaPx);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('O navegador não conseguiu criar a imagem.');
    ctx.imageSmoothingQuality = 'high';
    const { imagensIndisponiveis } = await comporExportacao({
      ctx: ctx as unknown as Contexto2DExportacao,
      comandos,
      resolucao,
      fundoBranco: formato === 'jpg',
      carregar: (origem) => carregarBitmap(urls[chaveDaOrigem(origem)]),
    });
    const blob = await canvas.convertToBlob(
      formato === 'png' ? { type: 'image/png' } : { type: 'image/jpeg', quality: QUALIDADE_JPG },
    );
    const resposta: RespostaExportacaoWorker = {
      ok: true,
      blob,
      imagensIndisponiveis,
      tempoMs: performance.now() - inicio,
    };
    self.postMessage(resposta);
  } catch (erro) {
    const resposta: RespostaExportacaoWorker = {
      ok: false,
      erro: erro instanceof Error ? erro.message : 'Falha ao compor a imagem.',
    };
    self.postMessage(resposta);
  }
};
