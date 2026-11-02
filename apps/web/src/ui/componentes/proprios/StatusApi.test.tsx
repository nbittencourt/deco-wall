import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusApi } from './StatusApi';

// Indicador de saúde (M0 §5.4; M4-14, A-23): no 503 mostra o componente em erro, não "indisponível".

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const responde = (corpo: unknown, status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(corpo), { status })),
  );

describe('StatusApi', () => {
  it('200: os três componentes como ok', async () => {
    responde({ api: 'ok', mongo: 'ok', pasta: 'ok', versao: '0.0.0' }, 200);
    render(<StatusApi />);
    expect(await screen.findByText(/MongoDB:/)).toBeTruthy();
    expect(screen.queryByText('erro')).toBeNull();
  });

  it('503 com mongo em erro: mostra "MongoDB: erro" e não o aviso de servidor indisponível', async () => {
    responde({ api: 'ok', mongo: 'erro', pasta: 'ok', versao: '0.0.0' }, 503);
    render(<StatusApi />);
    expect(await screen.findByText('erro')).toBeTruthy();
    expect(screen.getByText(/MongoDB:/)).toBeTruthy();
    expect(screen.queryByText('Servidor local indisponível')).toBeNull();
  });

  it('500: servidor local indisponível', async () => {
    responde({ erro: 'Erro interno do servidor.' }, 500);
    render(<StatusApi />);
    expect(await screen.findByText('Servidor local indisponível')).toBeTruthy();
  });
});
