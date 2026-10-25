import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, type ClienteApi, type ResumoProjeto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Projetos } from './Projetos';

// Tela Projetos com dados reais (spec M1 §3.1, A-02 a A-05; protótipo 01).

const AGORA = new Date('2026-10-24T15:00:00-03:00');

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  // StatusApi consulta /api/saude.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ api: 'ok', mongo: 'ok', pasta: 'ok', versao: '0.0.0' }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const SALA: ResumoProjeto = {
  _id: 'a'.repeat(24),
  nome: 'Sala de estar',
  atualizadoEm: '2026-10-24T14:35:00-03:00',
  qtdVariantes: 3,
  temParede: true,
  thumbUrl: `/api/projetos/${'a'.repeat(24)}/parede/arquivo?tipo=thumb`,
};
const CORREDOR: ResumoProjeto = {
  _id: 'b'.repeat(24),
  nome: 'Corredor',
  atualizadoEm: '2026-10-12T14:35:00-03:00',
  qtdVariantes: 1,
  temParede: false,
  thumbUrl: null,
};

function apiCom(lista: ResumoProjeto[], sobrescrita: Partial<ClienteApi> = {}): ClienteApi {
  return {
    listarProjetos: vi.fn(async () => lista),
    criarProjeto: vi.fn(async () => ({
      projeto: { _id: 'c'.repeat(24) },
      variantes: [],
    })),
    renomearProjeto: vi.fn(async (_id: string, nome: string) => ({ nome })),
    excluirProjeto: vi.fn(async () => undefined),
    ...sobrescrita,
  } as unknown as ClienteApi;
}

function montar(api: ClienteApi, navegar = vi.fn()) {
  render(
    <TooltipProvider>
      <Projetos api={api} navegar={navegar} agora={() => AGORA} />
    </TooltipProvider>,
  );
  return navegar;
}

function abrirMenu(nome: string) {
  const gatilho = screen.getByRole('button', { name: `Mais ações de ${nome}` });
  fireEvent.keyDown(gatilho, { key: 'Enter' });
}

describe('lista', () => {
  it('mostra os projetos com a meta de cada um (A-04)', async () => {
    montar(apiCom([SALA, CORREDOR]));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sala de estar' })).toBeTruthy();
    expect(screen.getByText('3 variantes · editado hoje, 14:35')).toBeTruthy();
    expect(screen.getByText('1 variante · parede não definida')).toBeTruthy();
  });

  it('card com parede mostra a miniatura; sem parede, "Sem foto da parede"', async () => {
    montar(apiCom([SALA, CORREDOR]));
    await screen.findByText('Sala de estar');
    const miniatura = screen.getByRole('img', { name: 'Parede de Sala de estar' });
    expect(miniatura.getAttribute('src')).toBe(SALA.thumbUrl);
    expect(screen.getAllByText('Sem foto da parede')).toHaveLength(1);
  });

  it('cada card leva para /projetos/<id>', async () => {
    montar(apiCom([SALA]));
    const link = await screen.findByRole('link', { name: 'Abrir Sala de estar' });
    expect(link.getAttribute('href')).toBe(`/projetos/${SALA._id}`);
  });

  it('sem projetos: estado vazio com o botão primário "Novo projeto" (A-03)', async () => {
    montar(apiCom([]));
    expect(await screen.findByText('Nenhum projeto ainda')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Novo projeto' }).length).toBeGreaterThan(0);
  });

  it('falha ao carregar mostra um alerta', async () => {
    montar(
      apiCom([], {
        listarProjetos: vi.fn(async () => {
          throw new ErroApi(500, { erro: 'Falha' });
        }),
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível carregar os projetos.',
    );
  });

  it('a busca fica inativa (DV-03)', async () => {
    montar(apiCom([SALA]));
    await screen.findByText('Sala de estar');
    expect(screen.getByLabelText('Buscar projeto').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Novo projeto (A-02)', () => {
  it('cria "Projeto sem nome" na hora e abre o editor', async () => {
    const api = apiCom([SALA]);
    const navegar = montar(api);
    await screen.findByText('Sala de estar');

    fireEvent.click(screen.getByRole('button', { name: 'Novo projeto' }));

    await waitFor(() => expect(navegar).toHaveBeenCalledWith(`/projetos/${'c'.repeat(24)}`));
    expect(api.criarProjeto).toHaveBeenCalledWith();
  });
});

describe('Renomear (menu ⋯)', () => {
  it('abre o diálogo com o nome atual, grava e atualiza o card', async () => {
    const api = apiCom([SALA]);
    montar(api);
    await screen.findByText('Sala de estar');

    abrirMenu('Sala de estar');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Renomear' }));
    const dialogo = await screen.findByRole('dialog');
    const campo = within(dialogo).getByRole('textbox', { name: 'Nome do projeto' }) as HTMLInputElement;
    expect(campo.value).toBe('Sala de estar');

    fireEvent.change(campo, { target: { value: 'Sala nova' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Renomear' }));

    await waitFor(() => expect(api.renomearProjeto).toHaveBeenCalledWith(SALA._id, 'Sala nova'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sala nova' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Excluir (menu ⋯, RN-17)', () => {
  it('pede confirmação, exclui e remove o card', async () => {
    const api = apiCom([SALA, CORREDOR]);
    montar(api);
    await screen.findByText('Sala de estar');

    abrirMenu('Sala de estar');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Excluir “Sala de estar”?' });
    expect(api.excluirProjeto).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir projeto' }));

    await waitFor(() => expect(api.excluirProjeto).toHaveBeenCalledWith(SALA._id));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sala de estar' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Corredor' })).toBeTruthy();
  });

  it('Cancelar mantém o projeto', async () => {
    const api = apiCom([SALA]);
    montar(api);
    await screen.findByText('Sala de estar');

    abrirMenu('Sala de estar');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(api.excluirProjeto).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sala de estar' })).toBeTruthy();
  });
});
