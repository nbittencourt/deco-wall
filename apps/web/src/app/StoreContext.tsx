import type { AreaUtil, FotoNaParede, Grid } from '@deco-wall/domain';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
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

// A variante aberta como as telas a veem: o grid (da variante) e o conteúdo desfazível (fotos, área útil).
// Só existe com um projeto aberto.
export function useVistaDaVariante(): { grid: Grid; fotos: FotoNaParede[]; areaUtil: AreaUtil | null } {
  const grid = useEditor((s) => s.documento.variante!.grid);
  const conteudo = useEditor((s) => s.conteudo!);
  return useMemo(() => ({ grid, fotos: conteudo.fotos, areaUtil: conteudo.areaUtil }), [grid, conteudo]);
}

export function useStoreEditor(): StoreEditor {
  const store = useContext(Contexto);
  if (!store) throw new Error('useStoreEditor precisa estar dentro de ProvedorStore.');
  return store;
}
