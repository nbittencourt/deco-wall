import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BotaoEmBreve, TEXTO_EM_BREVE } from './BotaoEmBreve';
import { StatusApi } from './StatusApi';
import { textoSalvamento } from './StatusSalvamento';
import { TooltipProvider } from '../ui/tooltip';

// Radix Popper usa ResizeObserver, que o jsdom não traz.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('controle inativo (DESIGN §7.1, aceite 12)', () => {
  it('usa aria-disabled, sem o atributo disabled, e continua focável', () => {
    render(
      <TooltipProvider>
        <BotaoEmBreve>Parede</BotaoEmBreve>
      </TooltipProvider>,
    );
    const botao = screen.getByRole('button', { name: 'Parede' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.hasAttribute('disabled')).toBe(false);
    botao.focus();
    expect(document.activeElement).toBe(botao);
  });

  it('mostra o tooltip padrão ao receber foco', async () => {
    render(
      <TooltipProvider>
        <BotaoEmBreve>Parede</BotaoEmBreve>
      </TooltipProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Parede' }).focus());
    expect((await screen.findAllByText(TEXTO_EM_BREVE)).length).toBeGreaterThan(0);
  });

  it('o clique não tem efeito', () => {
    const aoClicar = vi.fn();
    render(
      <TooltipProvider>
        <BotaoEmBreve {...({ onClick: aoClicar } as object)}>Parede</BotaoEmBreve>
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Parede' }));
    expect(aoClicar).not.toHaveBeenCalled();
  });
});

describe('StatusApi (consome /api/saude)', () => {
  it('mostra API, MongoDB e pasta com o resultado de /api/saude', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ api: 'ok', mongo: 'ok', pasta: 'ok', versao: '0.0.0' })),
      ),
    );
    render(<StatusApi />);
    expect(await screen.findByText(/API:/)).toBeTruthy();
    expect(screen.getByText(/MongoDB:/).textContent).toContain('ok');
    expect(screen.getByText(/Pasta de fotos:/).textContent).toContain('ok');
  });

  it('mostra erro quando a API não responde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    render(<StatusApi />);
    await waitFor(() => expect(screen.getByText('Servidor local indisponível')).toBeTruthy());
  });
});

describe('textoSalvamento (SV-08, M1-01)', () => {
  it('"salvo" traz a hora do hard save quando conhecida; "salvando" aparece durante a gravação', () => {
    expect(textoSalvamento({ tipo: 'salvo', em: new Date('2026-10-12T17:35:00Z') })).toBe('Salvo às 14:35');
    expect(textoSalvamento({ tipo: 'salvando' })).toBe('Salvando…');
  });

  it('descreve os quatro estados', () => {
    expect(textoSalvamento({ tipo: 'salvo' })).toBe('Salvo');
    expect(textoSalvamento({ tipo: 'alteracoes' })).toBe('Alterações não salvas');
    expect(textoSalvamento({ tipo: 'rascunho', em: new Date('2026-10-12T17:35:00Z') })).toBe(
      'Rascunho salvo às 14:35',
    );
    expect(textoSalvamento({ tipo: 'conflito' })).toBe('Conflito');
  });
});
