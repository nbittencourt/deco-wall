import { describe, expect, it, vi } from 'vitest';
import { criarClienteHttp } from './clienteApi';
import { ErroApi } from './dto';

// Cliente HTTP (spec M1 §5, §6). Mesma origem: caminhos relativos a /api.

function resposta(corpo: unknown, status = 200): Response {
  return new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fetcherCom(...respostas: Response[]) {
  const fila = [...respostas];
  return vi.fn(async (...args: Parameters<typeof fetch>) => {
    void args;
    return fila.shift() ?? resposta({});
  });
}

describe('criarClienteHttp — JSON', () => {
  it('listarProjetos faz GET /api/projetos', async () => {
    const lista = [{ _id: 'a', nome: 'Sala' }];
    const fetcher = fetcherCom(resposta(lista));
    const api = criarClienteHttp(fetcher);
    await expect(api.listarProjetos()).resolves.toEqual(lista);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/projetos');
  });

  it('criarProjeto faz POST com o nome (ou corpo vazio)', async () => {
    const fetcher = fetcherCom(resposta({ projeto: {}, variantes: [] }, 201), resposta({}, 201));
    const api = criarClienteHttp(fetcher);
    await api.criarProjeto('Sala');
    await api.criarProjeto();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ nome: 'Sala' });
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({});
  });

  it('obterProjeto, renomearProjeto e excluirProjeto usam GET, PATCH e DELETE', async () => {
    const fetcher = fetcherCom(
      resposta({ projeto: {}, variantes: [] }),
      resposta({ nome: 'Novo' }),
      new Response(null, { status: 204 }),
    );
    const api = criarClienteHttp(fetcher);
    await api.obterProjeto('p1');
    await api.renomearProjeto('p1', 'Novo');
    await expect(api.excluirProjeto('p1')).resolves.toBeUndefined();

    expect(fetcher.mock.calls[0]![0]).toBe('/api/projetos/p1');
    expect(fetcher.mock.calls[1]![0]).toBe('/api/projetos/p1');
    expect(fetcher.mock.calls[1]![1]?.method).toBe('PATCH');
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]?.body))).toEqual({ nome: 'Novo' });
    expect(fetcher.mock.calls[2]![1]?.method).toBe('DELETE');
  });

  it('aplicarCalibracao faz PUT em /parede/escala com o método linear', async () => {
    const fetcher = fetcherCom(resposta({ projeto: {}, variantesAlteradas: [] }));
    const api = criarClienteHttp(fetcher);
    const linear = { p1: { x: 1, y: 2 }, p2: { x: 3, y: 4 }, comprimentoCm: 150 };
    await api.aplicarCalibracao('p1', { revisaoBase: 5, linear });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos/p1/parede/escala');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ revisaoBase: 5, metodo: 'linear', linear });
  });

  it('aplicarPerspectiva envia multipart: "dados" (JSON) e "retificada" (arquivo)', async () => {
    const fetcher = fetcherCom(resposta({ projeto: {}, variantesAlteradas: [] }));
    const api = criarClienteHttp(fetcher);
    const perspectiva = {
      cantosPx: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      larguraCm: 300,
      alturaCm: 200,
    };
    await api.aplicarPerspectiva(
      'p1',
      { revisaoBase: 7, perspectiva },
      new Blob(['b'], { type: 'image/webp' }),
      {},
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos/p1/parede/escala');
    expect(init?.method).toBe('PUT');
    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(JSON.parse(String(form.get('dados')))).toEqual({
      revisaoBase: 7,
      metodo: 'perspectiva',
      perspectiva,
    });
    expect(form.get('retificada')).toBeInstanceOf(Blob);
  });

  it('salvarVariante faz PUT em /variantes/:id com o corpo recebido', async () => {
    const fetcher = fetcherCom(resposta({ revisao: 2, salvaEm: '2026-10-24T17:35:00.000Z' }));
    const api = criarClienteHttp(fetcher);
    const corpo = {
      sessaoId: 's',
      revisaoBase: 1,
      grid: {} as never,
      bordaPadrao: {} as never,
      areaUtil: null,
      fotos: [],
    };
    await expect(api.salvarVariante('p1', 'v1', corpo)).resolves.toEqual({
      revisao: 2,
      salvaEm: '2026-10-24T17:35:00.000Z',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos/p1/variantes/v1');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(corpo);
  });
});

describe('ErroApi', () => {
  it('resposta de erro vira ErroApi com status, corpo e a mensagem em pt-BR da API', async () => {
    const api = criarClienteHttp(fetcherCom(resposta({ erro: 'Projeto não encontrado.' }, 404)));
    const erro = await api.obterProjeto('x').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(404);
    expect((erro as ErroApi).message).toBe('Projeto não encontrado.');
    expect((erro as ErroApi).corpo).toEqual({ erro: 'Projeto não encontrado.' });
  });

  it('409 do salvamento preserva o corpo com os dados de quem salvou', async () => {
    const corpo = { revisao: 3, salvaEm: '2026-10-24T17:35:00.000Z', salvaPorSessao: 'b' };
    const api = criarClienteHttp(fetcherCom(resposta(corpo, 409)));
    const erro = (await api.salvarVariante('p', 'v', {} as never).catch((e: unknown) => e)) as ErroApi;
    expect(erro.status).toBe(409);
    expect(erro.corpo).toEqual(corpo);
  });

  it('sem corpo JSON, a mensagem informa o status', async () => {
    const api = criarClienteHttp(fetcherCom(new Response('boom', { status: 500 })));
    const erro = (await api.listarProjetos().catch((e: unknown) => e)) as ErroApi;
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro.status).toBe(500);
    expect(erro.message).toContain('500');
  });
});
