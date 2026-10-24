import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6 (campo numérico base): 36 px, raio 8, borda line. Prefixo/sufixo ficam em CampoCm.
export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-ink placeholder:text-ink-3',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
