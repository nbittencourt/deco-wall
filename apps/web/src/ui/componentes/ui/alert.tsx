import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6: "aviso" = warning-tint com triângulo; "alerta" = danger-tint com círculo.
const alertaVariantes = cva('flex items-start gap-2 rounded-lg px-3 py-2.5 text-body-sm', {
  variants: {
    variant: {
      aviso: 'bg-warning-tint text-warning-ink',
      alerta: 'bg-danger-tint text-danger-ink-strong',
    },
  },
  defaultVariants: { variant: 'aviso' },
});

export function Alert({
  className,
  variant,
  children,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertaVariantes>) {
  const Icone = variant === 'alerta' ? CircleAlert : TriangleAlert;
  return (
    <div
      role={variant === 'alerta' ? 'alert' : 'status'}
      className={cn(alertaVariantes({ variant }), className)}
      {...props}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
