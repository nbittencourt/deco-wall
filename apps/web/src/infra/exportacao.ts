import type { ComandoExportacao, FormatoExportacao, ResolucaoExportacao } from '@deco-wall/domain';
import { chaveDaOrigem, type OrigemImagem } from './exportacao-compositor';
import type { PedidoExportacaoWorker, RespostaExportacaoWorker } from './workers/exportar.worker';

// Cliente do Worker de exportação (ADR-08, A-17). Um Worker por operação; cancelar o encerra (terminate), e o
// diálogo cancela ao fechar. A exportação completa é medida com User Timing (`deco:exportacao`): o E2E de
// desempenho lê esse tempo (A-20).

export interface PedidoComposicao {
  comandos: ComandoExportacao[];
  resolucao: ResolucaoExportacao;
  // Onde buscar cada imagem (a parede e as fotos), na mesma origem.
  urlDe: (origem: OrigemImagem) => string;
  sinal?: AbortSignal;
}

export interface PedidoExportacao extends PedidoComposicao {
  formato: FormatoExportacao;
}

export interface ResultadoExportacao {
  blob: Blob;
  // Fotos cuja imagem não carregou e saíram como retângulo cinza (A-16).
  imagensIndisponiveis: number;
}

// A porta que o diálogo usa; os testes injetam uma falsa.
export interface Exportador {
  previa(pedido: PedidoComposicao): Promise<ResultadoExportacao>;
  exportar(pedido: PedidoExportacao): Promise<ResultadoExportacao>;
}

const absoluta = (url: string) => new URL(url, window.location.origin).toString();

function executar(pedido: PedidoExportacao, medir: boolean): Promise<ResultadoExportacao> {
  return new Promise((resolve, reject) => {
    if (pedido.sinal?.aborted) {
      reject(new DOMException('Operação cancelada.', 'AbortError'));
      return;
    }
    const urls: Record<string, string> = {};
    for (const comando of pedido.comandos) {
      const origem: OrigemImagem | null =
        comando.tipo === 'parede'
          ? { tipo: 'parede', arquivo: comando.arquivo }
          : comando.tipo === 'foto'
            ? { tipo: 'foto', imagemId: comando.imagemId }
            : null;
      if (origem) urls[chaveDaOrigem(origem)] = absoluta(pedido.urlDe(origem));
    }
    const worker = new Worker(new URL('./workers/exportar.worker.ts', import.meta.url), { type: 'module' });
    const encerrar = () => worker.terminate();
    pedido.sinal?.addEventListener(
      'abort',
      () => {
        encerrar();
        reject(new DOMException('Operação cancelada.', 'AbortError'));
      },
      { once: true },
    );
    if (medir) {
      performance.clearMarks('deco:exportacao:inicio');
      performance.mark('deco:exportacao:inicio');
    }
    worker.onmessage = (evento: MessageEvent<RespostaExportacaoWorker>) => {
      encerrar();
      const resposta = evento.data;
      if (!resposta.ok) {
        reject(new Error(resposta.erro));
        return;
      }
      if (medir) performance.measure('deco:exportacao', 'deco:exportacao:inicio');
      resolve({ blob: resposta.blob, imagensIndisponiveis: resposta.imagensIndisponiveis });
    };
    worker.onerror = (evento) => {
      encerrar();
      reject(new Error(evento.message || 'Falha ao compor a imagem.'));
    };
    const mensagem: PedidoExportacaoWorker = {
      comandos: pedido.comandos,
      resolucao: pedido.resolucao,
      formato: pedido.formato,
      urls,
    };
    worker.postMessage(mensagem);
  });
}

export const exportadorWorker: Exportador = {
  // A prévia usa o mesmo compositor, em PNG e na resolução reduzida que o diálogo pede.
  previa: (pedido) => executar({ ...pedido, formato: 'png' }, false),
  exportar: (pedido) => executar(pedido, true),
};

// Baixa o arquivo pelo navegador (A-19): <a download> com a URL do Blob, liberada depois do clique.
export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
