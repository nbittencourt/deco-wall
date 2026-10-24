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
  if (!resposta.ok) throw new Error(`/api/saude respondeu ${resposta.status}`);
  return (await resposta.json()) as Saude;
}
