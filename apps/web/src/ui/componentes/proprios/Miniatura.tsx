import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6: raio 6, altura 92; selecionada = anel 2 px accent.
export function Miniatura({
  selecionada = false,
  rotulo,
  children,
  onSelecionar,
}: {
  selecionada?: boolean;
  rotulo: string;
  children?: ReactNode;
  onSelecionar?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={selecionada}
      onClick={onSelecionar}
      className={cn(
        'flex h-[92px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[6px] bg-sand',
        selecionada ? 'ring-2 ring-accent' : 'ring-1 ring-line-soft',
      )}
    >
      {children}
    </button>
  );
}
