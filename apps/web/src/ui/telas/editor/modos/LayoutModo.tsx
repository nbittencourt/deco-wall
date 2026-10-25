import type { ReactNode } from 'react';

// Casca dos modos (DS-05): a barra escura no lugar do header, o palco no meio e o painel do modo à direita.
// Perspectiva e calibração usam o fundo escuro ao redor da foto; a área útil, o fundo claro da parede.
export function LayoutModo({
  barra,
  palco,
  painel,
  fundo,
}: {
  barra: ReactNode;
  palco: ReactNode;
  painel: ReactNode;
  fundo: 'escuro' | 'claro';
}) {
  return (
    <div className="flex h-dvh min-w-[1280px] flex-col">
      {barra}
      <div className="flex min-h-0 flex-1">
        <section className={`relative min-w-0 flex-1 ${fundo === 'escuro' ? 'bg-stage-dark' : 'bg-stage'}`}>
          {palco}
        </section>
        <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line-soft bg-surface p-5">
          {painel}
        </aside>
      </div>
    </div>
  );
}
