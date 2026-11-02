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

  it('obterConfig faz GET /api/config e devolve o limite de upload e o intervalo do rascunho (A-28, M3-07)', async () => {
    const fetcher = fetcherCom(resposta({ uploadMaxMb: 12, autosaveMinutos: 3 }));
    const api = criarClienteHttp(fetcher);
    await expect(api.obterConfig()).resolves.toEqual({ uploadMaxMb: 12, autosaveMinutos: 3 });
    expect(fetcher.mock.calls[0]![0]).toBe('/api/config');
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

describe('criarClienteHttp — variantes e rascunhos (M3, §5)', () => {
  const base = '/api/projetos/p1/variantes';

  it('obterVariante faz GET e devolve a variante', async () => {
    const fetcher = fetcherCom(resposta({ _id: 'v1', nome: 'Base' }));
    const api = criarClienteHttp(fetcher);
    await expect(api.obterVariante('p1', 'v1')).resolves.toEqual({ _id: 'v1', nome: 'Base' });
    expect(fetcher.mock.calls[0]![0]).toBe(`${base}/v1`);
  });

  it('criarVariante faz POST com o corpo e devolve a variante de dentro de { variante }', async () => {
    const fetcher = fetcherCom(resposta({ variante: { _id: 'v2', nome: 'Pirâmide' } }, 201));
    const api = criarClienteHttp(fetcher);
    const corpo = {
      sessaoId: 's1',
      nome: 'Pirâmide',
      grid: {},
      bordaPadrao: {},
      areaUtil: null,
      origem: { tipo: 'vazia' as const },
    };
    await expect(api.criarVariante('p1', corpo as never)).resolves.toEqual({ _id: 'v2', nome: 'Pirâmide' });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(base);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(corpo);
  });

  it('renomearVariante faz PATCH com o nome; excluirVariante faz DELETE', async () => {
    const fetcher = fetcherCom(resposta({ _id: 'v1', nome: 'Nova' }), new Response(null, { status: 204 }));
    const api = criarClienteHttp(fetcher);
    await api.renomearVariante('p1', 'v1', 'Nova');
    await expect(api.excluirVariante('p1', 'v1')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]![0]).toBe(`${base}/v1`);
    expect(fetcher.mock.calls[0]![1]?.method).toBe('PATCH');
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ nome: 'Nova' });
    expect(fetcher.mock.calls[1]![1]?.method).toBe('DELETE');
  });

  it('salvarRascunho faz PUT em /rascunho', async () => {
    const fetcher = fetcherCom(resposta({ salvoEm: '2026-11-02T13:00:00.000Z' }));
    const api = criarClienteHttp(fetcher);
    const corpo = { sessaoId: 's1', revisaoBase: 2, conteudo: {} };
    await expect(api.salvarRascunho('p1', 'v1', corpo as never)).resolves.toEqual({
      salvoEm: '2026-11-02T13:00:00.000Z',
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${base}/v1/rascunho`);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(corpo);
  });

  it('obterRascunho faz GET, com ou sem sessaoId', async () => {
    const fetcher = fetcherCom(resposta({ sessaoId: 'a' }), resposta({ sessaoId: 'b' }));
    const api = criarClienteHttp(fetcher);
    await api.obterRascunho('p1', 'v1', 'a b');
    await api.obterRascunho('p1', 'v1');
    expect(fetcher.mock.calls[0]![0]).toBe(`${base}/v1/rascunho?sessaoId=a%20b`);
    expect(fetcher.mock.calls[1]![0]).toBe(`${base}/v1/rascunho`);
  });

  it('apagarRascunho faz DELETE com o sessaoId', async () => {
    const fetcher = fetcherCom(new Response(null, { status: 204 }));
    const api = criarClienteHttp(fetcher);
    await expect(api.apagarRascunho('p1', 'v1', 's1')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]![0]).toBe(`${base}/v1/rascunho?sessaoId=s1`);
    expect(fetcher.mock.calls[0]![1]?.method).toBe('DELETE');
  });

  it('definirUltimaVariante faz PATCH no projeto com ultimaVarianteId', async () => {
    const fetcher = fetcherCom(resposta({ _id: 'p1', ultimaVarianteId: 'v2' }));
    const api = criarClienteHttp(fetcher);
    await api.definirUltimaVariante('p1', 'v2');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos/p1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ ultimaVarianteId: 'v2' });
  });

  it('o 409 do rascunho vira ErroApi com o corpo da API', async () => {
    const corpo = {
      erro: 'Esta variante foi salva em outra aba.',
      revisao: 3,
      salvaEm: 'x',
      salvaPorSessao: 'b',
    };
    const api = criarClienteHttp(fetcherCom(resposta(corpo, 409)));
    const erro = await api.salvarRascunho('p1', 'v1', {} as never).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(409);
    expect((erro as ErroApi).corpo).toEqual(corpo);
  });
});

describe('criarClienteHttp — ciclo de vida das imagens (M4, §5)', () => {
  it('listarImagensExcluidas faz GET /api/imagens?situacao=excluidas', async () => {
    const lista = [{ _id: 'i1', diasRestantes: 3 }];
    const fetcher = fetcherCom(resposta(lista));
    const api = criarClienteHttp(fetcher);
    await expect(api.listarImagensExcluidas()).resolves.toEqual(lista);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/imagens?situacao=excluidas');
  });

  it('associacoesDaImagem faz GET /api/imagens/:id/associacoes', async () => {
    const corpo = { imagem: { _id: 'i1' }, usos: [], projetos: [] };
    const fetcher = fetcherCom(resposta(corpo));
    const api = criarClienteHttp(fetcher);
    await expect(api.associacoesDaImagem('i1')).resolves.toEqual(corpo);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/imagens/i1/associacoes');
  });

  it('excluirImagem faz DELETE /api/imagens/:id e devolve as variantes afetadas', async () => {
    const corpo = {
      imagem: { _id: 'i1' },
      afetadas: [{ varianteId: 'v1', revisao: 3, fotos: 2 }],
      fotosConvertidas: 2,
    };
    const fetcher = fetcherCom(resposta(corpo));
    const api = criarClienteHttp(fetcher);
    await expect(api.excluirImagem('i1')).resolves.toEqual(corpo);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/imagens/i1');
    expect(init?.method).toBe('DELETE');
  });

  it('restaurarImagem faz POST /restaurar e devolve a imagem de dentro de { imagem }', async () => {
    const fetcher = fetcherCom(resposta({ imagem: { _id: 'i1', excluidaEm: null } }));
    const api = criarClienteHttp(fetcher);
    await expect(api.restaurarImagem('i1')).resolves.toEqual({ _id: 'i1', excluidaEm: null });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/imagens/i1/restaurar');
    expect(init?.method).toBe('POST');
  });

  it('o 410 do prazo vencido vira ErroApi com a mensagem da API', async () => {
    const fetcher = fetcherCom(
      resposta({ erro: 'Esta imagem passou do prazo de 30 dias e será removida.' }, 410),
    );
    const api = criarClienteHttp(fetcher);
    await expect(api.restaurarImagem('i1')).rejects.toMatchObject({
      status: 410,
      message: 'Esta imagem passou do prazo de 30 dias e será removida.',
    });
  });

  it('removerImagemDoProjeto faz DELETE /api/projetos/:pid/imagens/:id', async () => {
    const corpo = { afetadas: [], fotosRemovidas: 0 };
    const fetcher = fetcherCom(resposta(corpo));
    const api = criarClienteHttp(fetcher);
    await expect(api.removerImagemDoProjeto('p1', 'i1')).resolves.toEqual(corpo);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/projetos/p1/imagens/i1');
    expect(init?.method).toBe('DELETE');
  });

  it('salvarVariante repassa imagensExcluidas da resposta (A-11)', async () => {
    const fetcher = fetcherCom(resposta({ revisao: 2, salvaEm: 'x', imagensExcluidas: ['i9'] }));
    const api = criarClienteHttp(fetcher);
    const r = await api.salvarVariante('p1', 'v1', {
      sessaoId: 's',
      revisaoBase: 1,
      grid: {} as never,
      bordaPadrao: {} as never,
      areaUtil: null,
      fotos: [],
    });
    expect(r.imagensExcluidas).toEqual(['i9']);
  });
});
