import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6: pill. "alerta" = badge "sem foto" (danger-tint, texto danger-ink 12 px).
const badgeVariantes = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutro: 'bg-sand text-ink-2',
      alerta: 'bg-danger-tint text-danger-ink',
      acento: 'bg-accent-tint text-accent-ink',
    },
  },
  defaultVariants: { variant: 'neutro' },
});

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariantes>) {
  return <span className={cn(badgeVariantes({ variant }), className)} {...props} />;
}
