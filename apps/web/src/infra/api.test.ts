import { describe, expect, it, vi } from 'vitest';
import { buscarSaude } from './api';

// Indicador de saúde (M4-14, A-23): com mongo ou pasta em erro a API responde 503 com o mesmo corpo, e o
// indicador precisa mostrar o componente em erro, não "servidor indisponível".

const resposta = (corpo: unknown, status: number) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });

describe('buscarSaude', () => {
  it('200: devolve o corpo', async () => {
    const corpo = { api: 'ok', mongo: 'ok', pasta: 'ok', versao: '0.0.0' };
    const fetcher = vi.fn(async () => resposta(corpo, 200));
    await expect(buscarSaude(fetcher as unknown as typeof fetch)).resolves.toEqual(corpo);
  });

  it('503: devolve o corpo com o componente em erro (não lança)', async () => {
    const corpo = { api: 'ok', mongo: 'erro', pasta: 'ok', versao: '0.0.0' };
    const fetcher = vi.fn(async () => resposta(corpo, 503));
    await expect(buscarSaude(fetcher as unknown as typeof fetch)).resolves.toEqual(corpo);
  });

  it('500 ou corpo que não é a saúde: lança', async () => {
    await expect(
      buscarSaude((async () =>
        resposta({ erro: 'Erro interno do servidor.' }, 500)) as unknown as typeof fetch),
    ).rejects.toThrow();
    await expect(
      buscarSaude((async () => resposta('<html>', 503)) as unknown as typeof fetch),
    ).rejects.toThrow();
  });
});
