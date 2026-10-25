import { Info } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { Button, type BotaoProps } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../../lib/utils';

// DESIGN §7.1: função prevista e ainda não implementada. Fica visível e inativa:
// aria-disabled (não disabled, para manter foco e tooltip), sem efeito no clique.
export const TEXTO_EM_BREVE = 'Disponível em uma próxima versão';

// Em botão só de ícone, a dica diz também o que o botão faz ("Desfazer").
function Dica({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <TooltipContent>
      {titulo && <span className="block font-medium">{titulo}</span>}
      <span className="inline-flex items-center gap-1.5">
        <Info className="size-3.5" aria-hidden="true" />
        {children}
      </span>
    </TooltipContent>
  );
}

// Primário inativo: sem o fundo accent (o cinza sobre terracota não tinha contraste), texto ink-3 sobre sand.
const ESTILO_INATIVO = {
  default: 'bg-sand text-ink-3 hover:bg-sand',
  outro: 'text-ink-disabled hover:bg-transparent',
} as const;

type BotaoInativoProps = Omit<BotaoProps, 'onClick'> & {
  children?: ReactNode;
  // Obrigatório quando o botão só tem ícone (acessibilidade).
  rotuloIcone?: string;
  // Por que o botão está inativo. Padrão: função de uma próxima versão (§7.1); por estado, a dica diz o que falta.
  motivo?: string;
};

// Nenhum clique chega ao botão inativo, mesmo que alguém passe onClick por fora.
const semEfeito = (evento: MouseEvent) => evento.preventDefault();

// Controle indisponível: aria-disabled, foco e tooltip com o motivo (DESIGN §7.1).
export function BotaoInativo({
  className,
  children,
  rotuloIcone,
  motivo = TEXTO_EM_BREVE,
  variant = 'ghost',
  ...props
}: BotaoInativoProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          variant={variant}
          aria-disabled="true"
          aria-label={rotuloIcone}
          onClick={semEfeito}
          className={cn(variant === 'default' ? ESTILO_INATIVO.default : ESTILO_INATIVO.outro, className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <Dica titulo={rotuloIcone}>{motivo}</Dica>
    </Tooltip>
  );
}

// Função prevista e ainda não implementada.
export function BotaoEmBreve(props: Omit<BotaoInativoProps, 'motivo'>) {
  return <BotaoInativo {...props} />;
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
