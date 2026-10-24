import { useId } from 'react';
import { Input } from '../ui/input';
import { cn } from '../../../lib/utils';

// DESIGN §6 (campo numérico): mono 36 px; prefixo (X/Y) ou sufixo (cm) em ink-3 dentro do campo.
// Vírgula decimal: teclado numérico com inputMode decimal.
export function CampoCm({
  rotulo,
  valor,
  onChange,
  prefixo,
  sufixo = 'cm',
  inativo = false,
  className,
}: {
  rotulo: string;
  valor: string;
  onChange?: (valor: string) => void;
  prefixo?: string;
  sufixo?: string;
  // Função prevista e não implementada (DESIGN §7.1): aria-disabled, sem digitação.
  inativo?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-label">
        {rotulo}
      </label>
      <div className="relative">
        {prefixo && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-medida text-ink-3">
            {prefixo}
          </span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          value={valor}
          aria-disabled={inativo || undefined}
          readOnly={inativo}
          onChange={(evento) => onChange?.(evento.target.value)}
          className={cn(
            'h-9 font-mono text-medida tabular-nums',
            prefixo ? 'pl-8' : '',
            sufixo ? 'pr-9' : '',
            inativo ? 'text-ink-disabled' : '',
          )}
        />
        {sufixo && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-medida text-ink-3">
            {sufixo}
          </span>
        )}
      </div>
    </div>
  );
}
