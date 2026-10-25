import type { EntradaRetificacao, Pt } from '@deco-wall/domain';
import type { PedidoRetificacao, RespostaRetificacao, TemposRetificacao } from './workers/retificar.worker';

// Cliente do Worker de retificação (ADR-04). Um Worker por operação; cancelar o encerra (terminate).
// A retificação completa é medida com User Timing (`deco:retificacao`): o E2E de desempenho lê esse
// tempo (orçamento: perfil Alto em até 3 s — ARCHITECTURE §8).

export interface ResultadoRetificacao {
  blob: Blob;
  larguraPx: number;
  alturaPx: number;
  tempos?: TemposRetificacao;
}

function absoluta(url: string): string {
  return new URL(url, window.location.origin).toString();
}

type SemId<T> = T extends unknown ? Omit<T, 'id'> : never;

function executar(pedido: SemId<PedidoRetificacao>, sinal?: AbortSignal): Promise<ResultadoRetificacao> {
  return new Promise((resolve, reject) => {
    if (sinal?.aborted) {
      reject(new DOMException('Operação cancelada.', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./workers/retificar.worker.ts', import.meta.url), { type: 'module' });
    const encerrar = () => worker.terminate();
    sinal?.addEventListener(
      'abort',
      () => {
        encerrar();
        reject(new DOMException('Operação cancelada.', 'AbortError'));
      },
      { once: true },
    );
    worker.onmessage = (evento: MessageEvent<RespostaRetificacao>) => {
      encerrar();
      const resposta = evento.data;
      if (resposta.ok)
        resolve({
          blob: resposta.blob,
          larguraPx: resposta.larguraPx,
          alturaPx: resposta.alturaPx,
          tempos: resposta.tempos,
        });
      else reject(new Error(resposta.erro));
    };
    worker.onerror = (evento) => {
      encerrar();
      reject(new Error(evento.message || 'Falha ao processar a imagem.'));
    };
    worker.postMessage({ ...pedido, id: 1 } as PedidoRetificacao);
  });
}

export function gerarPrevia(
  args: { urlImagem: string; cantosPx: Pt[]; larguraCm: number; alturaCm: number },
  sinal?: AbortSignal,
): Promise<ResultadoRetificacao> {
  return executar({ tipo: 'previa', ...args, urlImagem: absoluta(args.urlImagem) }, sinal);
}

export async function retificarParede(
  args: { urlImagem: string; entrada: EntradaRetificacao; qualidadeWebp: number },
  sinal?: AbortSignal,
): Promise<ResultadoRetificacao> {
  performance.clearMarks('deco:retificacao:inicio');
  performance.mark('deco:retificacao:inicio');
  const resultado = await executar({ tipo: 'completa', ...args, urlImagem: absoluta(args.urlImagem) }, sinal);
  performance.measure('deco:retificacao', 'deco:retificacao:inicio');
  // Tempo de cada etapa do Worker, para acompanhar o orçamento de 3 s (ARCHITECTURE §8).
  if (resultado.tempos) console.info('[retificacao]', JSON.stringify(resultado.tempos));
  return resultado;
}
