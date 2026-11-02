import {
  ErroApi,
  type ClienteApi,
  type CorpoCriarVariante,
  type CorpoRascunho,
  type CorpoSalvarVariante,
  type DadosPerspectiva,
  type ImagemDto,
  type OpcoesEnvio,
  type ProjetoCompletoDto,
  type ProjetoDto,
  type RascunhoDto,
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
  function enviarMultipart<T>(
    metodo: 'PUT' | 'POST',
    url: string,
    form: FormData,
    opcoes: OpcoesEnvio = {},
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = criarXhr();
      xhr.open(metodo, url);
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
        if (xhr.status >= 200 && xhr.status < 300) resolve(corpo as unknown as T);
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

    obterProjeto: (id) => pedir<ProjetoCompletoDto>(`/api/projetos/${id}`),

    renomearProjeto: (id, nome) => pedir<ProjetoDto>(`/api/projetos/${id}`, json('PATCH', { nome })),

    excluirProjeto: (id) => pedir<void>(`/api/projetos/${id}`, { method: 'DELETE' }),

    enviarParede: (id, { arquivo, perfil, revisaoBase }, opcoes) => {
      const form = new FormData();
      form.append('perfil', perfil);
      form.append('revisaoBase', String(revisaoBase));
      form.append('arquivo', arquivo, arquivo.name);
      return enviarMultipart<RespostaParede>('PUT', `/api/projetos/${id}/parede`, form, opcoes);
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

    obterConfig: () => pedir<{ uploadMaxMb: number; autosaveMinutos: number }>('/api/config'),

    listarImagens: () => pedir<ImagemDto[]>('/api/imagens'),

    enviarImagem: ({ arquivo, perfil, projetoId }, opcoes) => {
      const form = new FormData();
      form.append('perfil', perfil);
      form.append('projetoId', projetoId);
      form.append('arquivo', arquivo, arquivo.name);
      return enviarMultipart<ImagemDto>('POST', '/api/imagens', form, opcoes);
    },

    salvarVariante: (projetoId, varianteId, corpo: CorpoSalvarVariante) =>
      pedir<{ revisao: number; salvaEm: string }>(
        `/api/projetos/${projetoId}/variantes/${varianteId}`,
        json('PUT', corpo),
      ),

    obterVariante: (projetoId, varianteId) =>
      pedir<VarianteDto>(`/api/projetos/${projetoId}/variantes/${varianteId}`),

    criarVariante: async (projetoId, corpo: CorpoCriarVariante) =>
      (await pedir<{ variante: VarianteDto }>(`/api/projetos/${projetoId}/variantes`, json('POST', corpo)))
        .variante,

    renomearVariante: (projetoId, varianteId, nome) =>
      pedir<{ _id: string; nome: string }>(
        `/api/projetos/${projetoId}/variantes/${varianteId}`,
        json('PATCH', { nome }),
      ),

    excluirVariante: (projetoId, varianteId) =>
      pedir<void>(`/api/projetos/${projetoId}/variantes/${varianteId}`, { method: 'DELETE' }),

    definirUltimaVariante: (projetoId, varianteId) =>
      pedir<ProjetoDto>(`/api/projetos/${projetoId}`, json('PATCH', { ultimaVarianteId: varianteId })),

    salvarRascunho: (projetoId, varianteId, corpo: CorpoRascunho) =>
      pedir<{ salvoEm: string }>(
        `/api/projetos/${projetoId}/variantes/${varianteId}/rascunho`,
        json('PUT', corpo),
      ),

    obterRascunho: (projetoId, varianteId, sessaoId) =>
      pedir<RascunhoDto>(
        `/api/projetos/${projetoId}/variantes/${varianteId}/rascunho${
          sessaoId === undefined ? '' : `?sessaoId=${encodeURIComponent(sessaoId)}`
        }`,
      ),

    apagarRascunho: (projetoId, varianteId, sessaoId) =>
      pedir<void>(
        `/api/projetos/${projetoId}/variantes/${varianteId}/rascunho?sessaoId=${encodeURIComponent(sessaoId)}`,
        { method: 'DELETE' },
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

// Arquivos das imagens da biblioteca: o id está no nome e o conteúdo nunca muda (cache imutável na API).
export function urlArquivoImagem(imagemId: string, tipo: 'render' | 'thumb'): string {
  return `/api/imagens/${imagemId}/arquivo?tipo=${tipo}`;
}
