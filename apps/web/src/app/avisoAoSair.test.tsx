import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAvisoAoSair } from './avisoAoSair';

// SV-08: aviso do browser ao fechar a aba com alterações sem hard save.

function tentarSair(): Event {
  const evento = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

describe('useAvisoAoSair', () => {
  it('com alterações não salvas, pede confirmação ao fechar', () => {
    const { unmount } = renderHook(() => useAvisoAoSair(true));
    expect(tentarSair().defaultPrevented).toBe(true);
    unmount();
  });

  it('sem alterações, deixa fechar sem perguntar', () => {
    const { unmount } = renderHook(() => useAvisoAoSair(false));
    expect(tentarSair().defaultPrevented).toBe(false);
    unmount();
  });

  it('acompanha a mudança do estado', () => {
    const { rerender, unmount } = renderHook(({ sujo }) => useAvisoAoSair(sujo), {
      initialProps: { sujo: true },
    });
    expect(tentarSair().defaultPrevented).toBe(true);
    rerender({ sujo: false });
    expect(tentarSair().defaultPrevented).toBe(false);
    unmount();
  });

  it('ao desmontar, remove o aviso', () => {
    const { unmount } = renderHook(() => useAvisoAoSair(true));
    unmount();
    expect(tentarSair().defaultPrevented).toBe(false);
  });
});
