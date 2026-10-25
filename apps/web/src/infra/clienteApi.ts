import {
  ErroApi,
  type ClienteApi,
  type CorpoSalvarVariante,
  type DadosPerspectiva,
  type OpcoesEnvio,
  type ProjetoDto,
  type RespostaParede,
  type ResumoProjeto,
  type SegmentoLinear,
  type VarianteDto,
} from './dto';

// Cliente HTTP da API local (docs/specs/M1-parede-e-escala.md §5). Mesma origem: o Vite (dev) e a própria
// API (start) servem /api. Respostas de erro viram ErroApi, com o corpo da API.

async function lerCorpo(resposta: Response): Promise<Record<string, unknown>> {
  try {
    const corpo: unknown = await resposta.json();
    return corpo !== null && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' };

export function criarClienteHttp(
  fetcher: typeof fetch = (...args) => fetch(...args),
  criarXhr: () => XMLHttpRequest = () => new XMLHttpRequest(),
): ClienteApi {
  async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
    const resposta = await fetcher(url, { headers: { accept: 'application/json' }, ...init });
    if (!resposta.ok) throw new ErroApi(resposta.status, await lerCorpo(resposta));
    if (resposta.status === 204) return undefined as T;
    return (await resposta.json()) as T;
  }

  const json = (metodo: string, corpo: unknown): RequestInit => ({
    method: metodo,
    headers: JSON_HEADERS,
    body: JSON.stringify(corpo),
  });

  // Upload com barra de progresso: fetch ainda não informa o progresso do envio, então usa XMLHttpRequest.
  function enviarMultipart(url: string, form: FormData, opcoes: OpcoesEnvio = {}): Promise<RespostaParede> {
    return new Promise((resolve, reject) => {
      const xhr = criarXhr();
      xhr.open('PUT', url);
      xhr.responseType = 'text';
      xhr.setRequestHeader('accept', 'application/json');
      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable) opcoes.onProgresso?.(evento.loaded / evento.total);
      };
      xhr.onload = () => {
        let corpo: Record<string, unknown> = {};
        try {
          corpo = JSON.parse(xhr.responseText) as Record<string, unknown>;
        } catch {
          // corpo vazio ou que não é JSON
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(corpo as unknown as RespostaParede);
        else reject(new ErroApi(xhr.status, corpo));
      };
      xhr.onerror = () => reject(new ErroApi(0, { erro: 'Servidor local indisponível.' }));
      xhr.onabort = () => reject(new DOMException('Envio cancelado.', 'AbortError'));
      opcoes.sinal?.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(form);
    });
  }

  return {
    listarProjetos: () => pedir<ResumoProjeto[]>('/api/projetos'),

    criarProjeto: (nome) =>
      pedir<{ projeto: ProjetoDto; variantes: VarianteDto[] }>(
        '/api/projetos',
        json('POST', nome === undefined ? {} : { nome }),
      ),

    obterProjeto: (id) => pedir<{ projeto: ProjetoDto; variantes: VarianteDto[] }>(`/api/projetos/${id}`),

    renomearProjeto: (id, nome) => pedir<ProjetoDto>(`/api/projetos/${id}`, json('PATCH', { nome })),

    excluirProjeto: (id) => pedir<void>(`/api/projetos/${id}`, { method: 'DELETE' }),

    enviarParede: (id, { arquivo, perfil, revisaoBase }, opcoes) => {
      const form = new FormData();
      form.append('perfil', perfil);
      form.append('revisaoBase', String(revisaoBase));
      form.append('arquivo', arquivo, arquivo.name);
      return enviarMultipart(`/api/projetos/${id}/parede`, form, opcoes);
    },

    aplicarCalibracao: (id, { revisaoBase, linear }: { revisaoBase: number; linear: SegmentoLinear }) =>
      pedir<RespostaParede>(
        `/api/projetos/${id}/parede/escala`,
        json('PUT', { revisaoBase, metodo: 'linear', linear }),
      ),

    aplicarPerspectiva: (
      id,
      { revisaoBase, perspectiva }: { revisaoBase: number; perspectiva: DadosPerspectiva },
      retificada,
      opcoes,
    ) => {
      const form = new FormData();
      form.append('dados', JSON.stringify({ revisaoBase, metodo: 'perspectiva', perspectiva }));
      form.append('retificada', retificada, 'retificada.webp');
      return pedir<RespostaParede>(`/api/projetos/${id}/parede/escala`, {
        method: 'PUT',
        body: form,
        signal: opcoes?.sinal,
      });
    },

    salvarVariante: (projetoId, varianteId, corpo: CorpoSalvarVariante) =>
      pedir<{ revisao: number; salvaEm: string }>(
        `/api/projetos/${projetoId}/variantes/${varianteId}`,
        json('PUT', corpo),
      ),
  };
}

// Instância usada pelo app; os testes injetam a sua.
export const clienteHttp: ClienteApi = criarClienteHttp();

// URL do arquivo da parede. O nome do arquivo não muda na troca nem ao refazer a perspectiva, então a
// revisão do projeto entra na URL para o navegador não reaproveitar a imagem anterior.
export function urlArquivoParede(
  projetoId: string,
  tipo: 'original' | 'retificada' | 'thumb',
  revisao: number,
): string {
  return `/api/projetos/${projetoId}/parede/arquivo?tipo=${tipo}&v=${revisao}`;
}
