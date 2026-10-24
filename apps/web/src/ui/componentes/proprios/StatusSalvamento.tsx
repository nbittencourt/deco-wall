import { formatarHora } from '@deco-wall/domain';
import { cn } from '../../../lib/utils';

// DESIGN §6 / SV-08: quatro estados do salvamento. Cor nunca é o único sinal: o texto diz o estado.
export type EstadoSalvamento =
  { tipo: 'salvo' } | { tipo: 'alteracoes' } | { tipo: 'rascunho'; em: Date } | { tipo: 'conflito' };

const PONTO: Record<EstadoSalvamento['tipo'], string> = {
  salvo: 'bg-success',
  alteracoes: 'bg-warning-dot',
  rascunho: 'bg-success',
  conflito: 'bg-danger',
};

export function textoSalvamento(estado: EstadoSalvamento): string {
  switch (estado.tipo) {
    case 'salvo':
      return 'Salvo';
    case 'alteracoes':
      return 'Alterações não salvas';
    case 'rascunho':
      return `Rascunho salvo ${formatarHora(estado.em)}`;
    case 'conflito':
      return 'Conflito';
  }
}

export function StatusSalvamento({ estado, className }: { estado: EstadoSalvamento; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-body-sm text-ink-2', className)}>
      <span className={cn('size-[7px] rounded-full', PONTO[estado.tipo])} aria-hidden="true" />
      {textoSalvamento(estado)}
    </span>
  );
}
