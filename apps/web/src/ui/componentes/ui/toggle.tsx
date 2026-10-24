import { Toggle as TogglePrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6 (Grid/Snap no header): ligado = fundo sand.
export function Toggle({ className, ...props }: ComponentProps<typeof TogglePrimitive.Root>) {
  return (
    <TogglePrimitive.Root
      className={cn(
        'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-sand',
        'data-[state=on]:bg-sand data-[state=on]:text-ink [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}
