import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6: primário accent (um por tela), secundário outline, fantasma, destrutivo e ícone 36×36.
const botaoVariantes = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover',
        outline: 'border border-line bg-surface text-ink hover:bg-sand',
        ghost: 'text-ink hover:bg-sand',
        destructive: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        default: 'h-9 px-4 text-sm',
        lista: 'h-10 px-4 text-sm',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type BotaoProps = ComponentProps<'button'> &
  VariantProps<typeof botaoVariantes> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: BotaoProps) {
  const Componente = asChild ? Slot.Root : 'button';
  return <Componente className={cn(botaoVariantes({ variant, size }), className)} {...props} />;
}
