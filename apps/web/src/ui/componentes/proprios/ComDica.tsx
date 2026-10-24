import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

// DESIGN §6: tooltip obrigatório em botões só com ícone.
// O gatilho é um span em volta do controle: assim o tooltip não disputa o `data-state` de Toggle
// e DropdownMenuTrigger. Foco e hover do botão sobem até o span (focusin), então o teclado também abre a dica.
export function ComDica({
  texto,
  lado,
  children,
}: {
  texto: ReactNode;
  lado?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={lado}>{texto}</TooltipContent>
    </Tooltip>
  );
}
