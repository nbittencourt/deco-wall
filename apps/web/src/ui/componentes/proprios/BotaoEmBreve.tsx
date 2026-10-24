import { Info } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { Button, type BotaoProps } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../../lib/utils';

// DESIGN §7.1: função prevista e ainda não implementada. Fica visível e inativa:
// aria-disabled (não disabled, para manter foco e tooltip), sem efeito no clique.
export const TEXTO_EM_BREVE = 'Disponível em uma próxima versão';

function Dica({ children }: { children: ReactNode }) {
  return (
    <TooltipContent>
      <span className="inline-flex items-center gap-1.5">
        <Info className="size-3.5" aria-hidden="true" />
        {children}
      </span>
    </TooltipContent>
  );
}

type BotaoEmBrevProps = Omit<BotaoProps, 'onClick'> & {
  children?: ReactNode;
  // Obrigatório quando o botão só tem ícone (acessibilidade).
  rotuloIcone?: string;
};

// Nenhum clique chega ao botão inativo, mesmo que alguém passe onClick por fora.
const semEfeito = (evento: MouseEvent) => evento.preventDefault();

export function BotaoEmBreve({
  className,
  children,
  rotuloIcone,
  variant = 'ghost',
  ...props
}: BotaoEmBrevProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          variant={variant}
          aria-disabled="true"
          aria-label={rotuloIcone}
          onClick={semEfeito}
          className={cn('text-ink-disabled hover:bg-transparent', className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <Dica>{TEXTO_EM_BREVE}</Dica>
    </Tooltip>
  );
}

// Campo de texto inativo (busca, "Linha forte a cada"): aceita foco, não aceita digitação.
export function CampoEmBreve({
  rotulo,
  placeholder,
  className,
}: {
  rotulo: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Input
          aria-label={rotulo}
          placeholder={placeholder}
          aria-disabled="true"
          readOnly
          className={cn('text-ink-disabled placeholder:text-ink-disabled', className)}
        />
      </TooltipTrigger>
      <Dica>{TEXTO_EM_BREVE}</Dica>
    </Tooltip>
  );
}
