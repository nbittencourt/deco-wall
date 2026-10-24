import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} />;
}

// DESIGN §6 (radio card): borda line; selecionado = borda 2 px accent + accent-wash.
export function RadioCard({
  className,
  children,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item> & { children: ReactNode }) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'rounded-lg border border-line bg-surface p-3 text-left transition-colors',
        'data-[state=checked]:border-2 data-[state=checked]:border-accent data-[state=checked]:bg-accent-wash',
        className,
      )}
      {...props}
    >
      {children}
    </RadioGroupPrimitive.Item>
  );
}
