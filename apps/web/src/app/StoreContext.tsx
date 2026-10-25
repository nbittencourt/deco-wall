import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EstadoEditor, StoreEditor } from './store';

// Entrega a store do editor aos componentes (uma por aba/projeto aberto).
const Contexto = createContext<StoreEditor | null>(null);

export function ProvedorStore({ store, children }: { store: StoreEditor; children: ReactNode }) {
  return <Contexto.Provider value={store}>{children}</Contexto.Provider>;
}

export function useEditor<T>(seletor: (estado: EstadoEditor) => T): T {
  const store = useContext(Contexto);
  if (!store) throw new Error('useEditor precisa estar dentro de ProvedorStore.');
  return useStore(store, seletor);
}

export function useStoreEditor(): StoreEditor {
  const store = useContext(Contexto);
  if (!store) throw new Error('useStoreEditor precisa estar dentro de ProvedorStore.');
  return store;
}
