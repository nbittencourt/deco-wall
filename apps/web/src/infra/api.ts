// Cliente HTTP da API local. Mesma origem: o Vite (dev) e a própria API (start) servem /api.

export type ResultadoComponente = 'ok' | 'erro';

export interface Saude {
  api: ResultadoComponente;
  mongo: ResultadoComponente;
  pasta: ResultadoComponente;
  versao: string;
}

export async function buscarSaude(fetcher: typeof fetch = fetch): Promise<Saude> {
  const resposta = await fetcher('/api/saude', { headers: { accept: 'application/json' } });
  // M4-14: com mongo ou pasta em erro a API responde 503 com o mesmo corpo; o indicador precisa dele.
  if (resposta.ok || resposta.status === 503) {
    const corpo = (await resposta.json().catch(() => null)) as Partial<Saude> | null;
    if (corpo && corpo.api && corpo.mongo && corpo.pasta) return corpo as Saude;
  }
  throw new Error(`/api/saude respondeu ${resposta.status}`);
}
