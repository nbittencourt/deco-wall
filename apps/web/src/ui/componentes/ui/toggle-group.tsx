import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6: trilho sand com padding 3 e gap 2; colunas de largura igual (auto-cols-fr).
// A largura fixa de cada uso (152 px, 160 px, 240 px) vem por className.
export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn('grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-sand p-[3px]', className)}
      {...props}
    />
  );
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'inline-flex h-7 items-center justify-center rounded-sm px-2 text-[13px] text-ink-2 transition-colors',
        'data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-xs',
        className,
      )}
      {...props}
    />
  );
}
