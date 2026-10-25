import { UPLOAD_PARALELO, validarArquivoImagem, type Perfil } from '@deco-wall/domain';
import type { ImagemDto } from '../infra/dto';

// Fila de upload da biblioteca (docs/specs/M2-biblioteca-e-composicao.md §3.2; RF-20, RF-21, RF-25, DV-10,
// M2-07, B-10, B-11). Sem React: a tela só assina o estado. 1 requisição por arquivo, 3 em paralelo; a
// falha de um arquivo não interrompe o lote; o perfil é único e fica travado enquanto o lote envia.

export type StatusUpload = 'aguardando' | 'enviando' | 'concluida' | 'falhou' | 'cancelada';

export interface ItemUpload {
  id: string;
  nome: string;
  tamanhoBytes: number;
  status: StatusUpload;
  // Fração de 0 a 1 do que já subiu.
  progresso: number;
  erro?: string;
  imagem?: ImagemDto;
}

export interface EstadoLote {
  perfil: Perfil;
  itens: ItemUpload[];
  // RN-20: arquivos recusados antes de entrar na fila (formato ou tamanho).
  ignorados: { nome: string; motivo: string }[];
  // O envio começou (o perfil está travado até o lote acabar).
  iniciado: boolean;
  enviando: boolean;
  concluidas: number;
  total: number;
}

export interface OpcoesEnvioArquivo {
  onProgresso?: (fracao: number) => void;
  sinal?: AbortSignal;
}

export interface OpcoesLote {
  enviar: (arquivo: File, perfil: Perfil, opcoes: OpcoesEnvioArquivo) => Promise<ImagemDto>;
  perfil: Perfil;
  limiteMb: number;
  paralelo?: number;
  aoConcluir?: (imagem: ImagemDto) => void;
}

export interface LoteUpload {
  estado(): EstadoLote;
  adicionar(arquivos: readonly File[]): void;
  definirPerfil(perfil: Perfil): void;
  iniciar(): void;
  cancelarRestantes(): void;
  // Sem id, repete todos os que falharam ou foram cancelados.
  tentarNovamente(id?: string): void;
  assinar(ouvinte: () => void): () => void;
}

interface ItemInterno extends ItemUpload {
  arquivo: File;
  controle: AbortController | null;
}

function publico(i: ItemInterno): ItemUpload {
  return {
    id: i.id,
    nome: i.nome,
    tamanhoBytes: i.tamanhoBytes,
    status: i.status,
    progresso: i.progresso,
    erro: i.erro,
    imagem: i.imagem,
  };
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error && erro.message ? erro.message : 'Não foi possível enviar a foto.';
}

export function criarLoteUpload(opcoes: OpcoesLote): LoteUpload {
  const paralelo = opcoes.paralelo ?? UPLOAD_PARALELO;
  let perfil = opcoes.perfil;
  const itens: ItemInterno[] = [];
  const ignorados: EstadoLote['ignorados'] = [];
  let iniciado = false;
  let proximoId = 1;
  let instantaneo: EstadoLote | null = null;
  const ouvintes = new Set<() => void>();

  const emEnvio = () => itens.filter((i) => i.status === 'enviando').length;
  const pendentes = () => itens.some((i) => i.status === 'aguardando' || i.status === 'enviando');

  // O estado é um instantâneo imutável, recriado a cada mudança: serve a useSyncExternalStore.
  const notificar = () => {
    instantaneo = null;
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  const executar = async (item: ItemInterno) => {
    item.status = 'enviando';
    item.progresso = 0;
    item.erro = undefined;
    item.controle = new AbortController();
    notificar();
    try {
      const imagem = await opcoes.enviar(item.arquivo, perfil, {
        sinal: item.controle.signal,
        onProgresso: (fracao) => {
          item.progresso = Math.min(Math.max(fracao, 0), 1);
          notificar();
        },
      });
      item.status = 'concluida';
      item.progresso = 1;
      item.imagem = imagem;
      opcoes.aoConcluir?.(imagem);
    } catch (erro) {
      if (item.controle.signal.aborted) {
        item.status = 'cancelada';
      } else {
        item.status = 'falhou';
        item.erro = mensagemDe(erro);
      }
    } finally {
      item.controle = null;
      preencherVagas();
      notificar();
    }
  };

  function preencherVagas() {
    if (!iniciado) return;
    for (const item of itens) {
      if (emEnvio() >= paralelo) break;
      if (item.status === 'aguardando') void executar(item);
    }
    if (!pendentes()) iniciado = false; // lote terminou: o perfil destrava
  }

  return {
    estado() {
      instantaneo ??= {
        perfil,
        itens: itens.map(publico),
        ignorados: [...ignorados],
        iniciado,
        enviando: iniciado && pendentes(),
        concluidas: itens.filter((i) => i.status === 'concluida').length,
        total: itens.length,
      };
      return instantaneo;
    },

    adicionar(arquivos) {
      if (iniciado) return;
      for (const arquivo of arquivos) {
        const motivo = validarArquivoImagem(
          { nome: arquivo.name, tipo: arquivo.type, tamanhoBytes: arquivo.size },
          opcoes.limiteMb,
        );
        if (motivo) {
          ignorados.push({ nome: arquivo.name, motivo });
        } else {
          itens.push({
            id: `u${proximoId++}`,
            nome: arquivo.name,
            tamanhoBytes: arquivo.size,
            status: 'aguardando',
            progresso: 0,
            arquivo,
            controle: null,
          });
        }
      }
      notificar();
    },

    definirPerfil(novo) {
      if (iniciado) return;
      perfil = novo;
      notificar();
    },

    iniciar() {
      if (iniciado || !itens.some((i) => i.status === 'aguardando')) return;
      iniciado = true;
      preencherVagas();
      notificar();
    },

    cancelarRestantes() {
      for (const item of itens) {
        if (item.status === 'aguardando') item.status = 'cancelada';
        else if (item.status === 'enviando') item.controle?.abort();
      }
      notificar();
    },

    tentarNovamente(id) {
      let recolocou = false;
      for (const item of itens) {
        if (
          (id === undefined || item.id === id) &&
          (item.status === 'falhou' || item.status === 'cancelada')
        ) {
          item.status = 'aguardando';
          item.erro = undefined;
          item.progresso = 0;
          recolocou = true;
        }
      }
      if (!recolocou) return;
      iniciado = true;
      preencherVagas();
      notificar();
    },

    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}
