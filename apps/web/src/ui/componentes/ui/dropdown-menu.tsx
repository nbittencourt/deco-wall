import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §4/§6: menu com sombra lg, itens de 14 px e destrutivo em danger-ink.
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[180px] overflow-hidden rounded-lg border border-line-soft bg-surface p-1 text-body shadow-lg',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destrutivo,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { destrutivo?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none',
        'data-[highlighted]:bg-sand',
        destrutivo ? 'text-danger-ink' : 'text-ink',
        className,
      )}
      {...props}
    />
  );
}
