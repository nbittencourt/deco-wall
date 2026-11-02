import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ResumoVariante } from '../../../app/store';
import { TooltipProvider } from '../../componentes/ui/tooltip';
import { SeletorVariante } from './SeletorVariante';

// Seletor de variante (A-01, M3-02; DESIGN §6; docs/specs/M3-variantes-templates-e-salvamento.md §3.1).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const item = (n: number, extra: Partial<ResumoVariante> = {}): ResumoVariante => ({
  _id: `v${n}`,
  nome: n === 1 ? 'Base' : `Variante ${n}`,
  ordem: n - 1,
  qtdFotos: 3,
  semFoto: 0,
  ativa: n === 1,
  naoSalva: false,
  ...extra,
});

function montar(itens: ResumoVariante[] = [item(1), item(2, { qtdFotos: 1, semFoto: 1 })]) {
  const acoes = {
    onAlternar: vi.fn(),
    onNova: vi.fn(),
    onDuplicar: vi.fn(),
    onTemplate: vi.fn(),
    onRenomear: vi.fn(),
    onExcluir: vi.fn(),
  };
  render(
    <TooltipProvider>
      <SeletorVariante itens={itens} {...acoes} />
    </TooltipProvider>,
  );
  return acoes;
}

const abrir = () => fireEvent.click(screen.getByRole('button', { name: /^Variante: / }));

describe('gatilho', () => {
  it('mostra o nome da ativa', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Variante: Base' })).toBeTruthy();
  });

  it('mostra o selo "N sem foto" da ativa só com N > 0', () => {
    montar([item(1, { semFoto: 2 })]);
    expect(screen.getByText('2 sem foto')).toBeTruthy();
    cleanup();
    montar([item(1, { semFoto: 0 })]);
    expect(screen.queryByText(/sem foto/)).toBeNull();
  });

  it('mostra o ponto âmbar quando a ativa tem alterações não salvas', () => {
    montar([item(1, { naoSalva: true })]);
    expect(screen.getByRole('img', { name: 'Alterações não salvas' })).toBeTruthy();
    cleanup();
    montar([item(1, { naoSalva: false })]);
    expect(screen.queryByRole('img', { name: 'Alterações não salvas' })).toBeNull();
  });
});

describe('lista', () => {
  it('traz nome, "N fotos", selo e a ativa marcada', () => {
    montar();
    abrir();
    const lista = screen.getByRole('dialog');
    const base = within(lista).getByRole('button', { name: /^Base/ });
    expect(base.getAttribute('aria-current')).toBe('true');
    expect(within(lista).getByText('3 fotos')).toBeTruthy();
    const v2 = within(lista).getByRole('button', { name: /^Variante 2/ });
    expect(within(v2).getByText('1 foto')).toBeTruthy();
    expect(within(v2).getByText('1 sem foto')).toBeTruthy();
    expect(v2.getAttribute('aria-current')).toBeNull();
  });

  it('escolher outra variante chama onAlternar com o id', () => {
    const acoes = montar();
    abrir();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Variante 2/ }));
    expect(acoes.onAlternar).toHaveBeenCalledWith('v2');
  });

  it('o rodapé traz os três atalhos de criação', () => {
    const acoes = montar();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Nova variante em branco…' }));
    expect(acoes.onNova).toHaveBeenCalled();
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar “Base”…' }));
    expect(acoes.onDuplicar).toHaveBeenCalledWith('v1');
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Novo a partir de template…' }));
    expect(acoes.onTemplate).toHaveBeenCalled();
  });
});

describe('menu ⋯ de cada variante', () => {
  const abrirMenu = (nome: string) => {
    abrir();
    fireEvent.pointerDown(screen.getByRole('button', { name: `Ações de ${nome}` }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole('button', { name: `Ações de ${nome}` }));
  };

  it('Renomear, Duplicar e Excluir chamam as ações com o id da variante', async () => {
    const acoes = montar();
    abrirMenu('Variante 2');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Renomear' }));
    expect(acoes.onRenomear).toHaveBeenCalledWith('v2');
    abrirMenu('Variante 2');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicar' }));
    expect(acoes.onDuplicar).toHaveBeenCalledWith('v2');
    abrirMenu('Variante 2');
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    expect(acoes.onExcluir).toHaveBeenCalledWith('v2');
  });

  it('Excluir é inativo na última variante (RN-23)', async () => {
    const acoes = montar([item(1)]);
    abrirMenu('Base');
    const excluir = await screen.findByRole('menuitem', { name: 'Excluir' });
    expect(excluir.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(excluir);
    expect(acoes.onExcluir).not.toHaveBeenCalled();
  });
});
