import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6 (seletor de tamanho): gatilho 36 px; lista raio 10 com sombra lg; cabeçalho de grupo em label ink-3.
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'inline-flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 text-sm text-ink',
        'data-[placeholder]:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          'z-50 max-h-[220px] min-w-[200px] overflow-hidden rounded-[10px] border border-line-soft bg-surface p-1 shadow-lg',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectGroup({ className, ...props }: ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group className={cn('py-1', className)} {...props} />;
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label className={cn('px-2 pt-2 pb-1 text-label text-ink-3', className)} {...props} />
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-ink outline-none',
        'data-[highlighted]:bg-sand data-[state=checked]:bg-accent-tint data-[state=checked]:text-accent-ink',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="size-4 text-accent" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
