import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ProvedorStore } from '../../../app/StoreContext';
import { abrirCenario, hex, imagem, type OpcoesCenario } from '../../../testes/cenario-m3';
import { TooltipProvider } from '../../componentes/ui/tooltip';
import { Biblioteca } from './Biblioteca';

// Coluna Biblioteca no M4 (RF-28, RF-29, M4-03, M4-07, A-01, A-07; docs/specs/M4-ciclo-de-vida-e-exportacao.md
// §3.1, §3.4): menu ⋯ da miniatura e filtro "Excluídas" com restauração.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const excluida = (n: number, diasRestantes: number) => ({
  ...imagem(n),
  excluidaEm: '2026-10-20T12:00:00.000Z',
  purgaEm: '2026-11-20T12:00:00.000Z',
  diasRestantes,
});

async function montar(opcoes: OpcoesCenario = {}) {
  const c = await abrirCenario(opcoes);
  const onRemoverOuExcluir = vi.fn();
  render(
    <ProvedorStore store={c.store}>
      <TooltipProvider>
        <Biblioteca api={c.api} temEscala onRemoverOuExcluir={onRemoverOuExcluir} />
      </TooltipProvider>
    </ProvedorStore>,
  );
  return { ...c, onRemoverOuExcluir };
}

const abrirMenu = (nome: string) =>
  fireEvent.pointerDown(screen.getByRole('button', { name: nome }), { button: 0, ctrlKey: false });

async function ativarExcluidas() {
  abrirMenu('Mais filtros');
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluídas' }));
}

describe('menu ⋯ da miniatura (M4-03, A-01)', () => {
  it('cada miniatura tem o botão "Mais ações de <nome>" com o item "Remover ou excluir…"', async () => {
    const { onRemoverOuExcluir } = await montar();
    abrirMenu('Mais ações de foto-2.jpg');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remover ou excluir…' }));
    expect(onRemoverOuExcluir).toHaveBeenCalledWith(hex(2));
  });

  it('o botão é irmão da miniatura (não botão dentro de botão) e existe para todas', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Mais ações de foto-1.jpg' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mais ações de foto-2.jpg' })).toBeTruthy();
    const miniatura = screen.getByRole('button', { name: /^foto-1\.jpg, / });
    expect(miniatura.contains(screen.getByRole('button', { name: 'Mais ações de foto-1.jpg' }))).toBe(false);
  });

  it('usar o menu não seleciona nem arrasta a imagem', async () => {
    const { estado } = await montar();
    abrirMenu('Mais ações de foto-1.jpg');
    await screen.findByRole('menuitem', { name: 'Remover ou excluir…' });
    expect(estado().ui.bibliotecaSelecaoId).toBeNull();
  });
});

describe('filtro "Excluídas" (RF-28, M4-07, A-07)', () => {
  it('o item do menu está ativo e mostra a lista com contador, aviso e dias restantes', async () => {
    await montar({ excluidas: [excluida(7, 25), excluida(8, 2), excluida(9, 1)] });
    abrirMenu('Mais filtros');
    const item = await screen.findByRole('menuitem', { name: 'Excluídas' });
    expect(item.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(item);

    expect(await screen.findByText('3 excluídas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluídas ×' })).toBeTruthy();
    expect(
      screen.getByText(
        'Removidas definitivamente após 30 dias. Restaurar não devolve a foto às composições.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('25 dias restantes')).toBeTruthy();
    expect(screen.getByText('2 dias restantes')).toBeTruthy();
    expect(screen.getByText('1 dia restante')).toBeTruthy();
  });

  it('com 3 dias ou menos, o prazo fica em danger-ink; com mais, não', async () => {
    await montar({ excluidas: [excluida(7, 25), excluida(8, 3)] });
    await ativarExcluidas();
    expect((await screen.findByText('3 dias restantes')).className).toContain('text-danger-ink');
    expect(screen.getByText('25 dias restantes').className).not.toContain('text-danger-ink');
  });

  it('as imagens excluídas não são selecionáveis nem arrastáveis e não têm o menu ⋯', async () => {
    await montar({ excluidas: [excluida(7, 25)] });
    await ativarExcluidas();
    await screen.findByText('25 dias restantes');
    expect(screen.queryByRole('button', { name: 'Mais ações de foto-7.jpg' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^foto-7\.jpg, / })).toBeNull();
    expect(document.querySelector('[draggable="true"]')).toBeNull();
  });

  it('Restaurar volta a imagem à biblioteca, avisa e a tira da lista', async () => {
    const { api, estado } = await montar({ excluidas: [excluida(7, 25), excluida(8, 4)] });
    await ativarExcluidas();
    const linha = (await screen.findByText('foto-7.jpg')).closest('li')!;
    fireEvent.click(within(linha).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(api.restaurarImagem).toHaveBeenCalledWith(hex(7)));
    await waitFor(() => expect(screen.queryByText('foto-7.jpg')).toBeNull());
    expect(screen.getByText('1 excluída')).toBeTruthy();
    expect(estado().ui.avisoCiclo).toBe('“foto-7.jpg” restaurada.');
    expect(estado().biblioteca.imagens.map((i) => i._id)).toContain(hex(7));
  });

  it('lista vazia: "Nenhuma imagem excluída."', async () => {
    await montar({ excluidas: [] });
    await ativarExcluidas();
    expect(await screen.findByText('Nenhuma imagem excluída.')).toBeTruthy();
  });

  it('o chip "Excluídas ×" volta para "Todas"', async () => {
    await montar({ excluidas: [excluida(7, 25)] });
    await ativarExcluidas();
    await screen.findByText('25 dias restantes');
    fireEvent.click(screen.getByRole('button', { name: 'Excluídas ×' }));
    expect(screen.queryByText('25 dias restantes')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('true');
  });

  it('com o filtro ativo, os outros ficam desmarcados; escolher um deles sai das excluídas', async () => {
    await montar({ excluidas: [excluida(7, 25)] });
    await ativarExcluidas();
    await screen.findByText('25 dias restantes');
    for (const nome of ['Todas', 'Projeto', 'Variante']) {
      expect(screen.getByRole('radio', { name: nome }).getAttribute('aria-checked')).toBe('false');
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Projeto' }));
    expect(screen.queryByText('25 dias restantes')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Projeto' }).getAttribute('aria-checked')).toBe('true');
  });

  it('um 410 ao restaurar mantém a lista atualizada e mostra o erro', async () => {
    const { api } = await montar({ excluidas: [excluida(7, 0)] });
    await ativarExcluidas();
    const linha = (await screen.findByText('foto-7.jpg')).closest('li')!;
    api.listarImagensExcluidas.mockResolvedValue([]);
    fireEvent.click(within(linha).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByText('Esta imagem passou do prazo de 30 dias e será removida.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('foto-7.jpg')).toBeNull());
  });
});
