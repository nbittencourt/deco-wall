import { Check, ChevronDown, Copy, LayoutTemplate, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ResumoVariante } from '../../../app/store';
import { cn } from '../../../lib/utils';
import { Badge } from '../../componentes/ui/badge';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../../componentes/ui/popover';

// Seletor de variante do header (A-01, M3-02; DESIGN §6, §7; docs/specs/M3-variantes-templates-e-salvamento.md
// §3.1): gatilho com o nome da ativa (Newsreader), o selo "N sem foto" e o ponto âmbar das alterações não salvas;
// lista com nome, "N fotos", selo e check na ativa, menu ⋯ por item e atalhos de criação no rodapé.

export const MOTIVO_ULTIMA_VARIANTE = 'Todo projeto precisa de ao menos uma variante.';

const textoFotos = (n: number) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

export function SeloSemFoto({ quantidade, className }: { quantidade: number; className?: string }) {
  if (quantidade <= 0) return null;
  return (
    <Badge variant="alerta" className={className}>
      {quantidade} sem foto
    </Badge>
  );
}

interface PropsSeletor {
  itens: ResumoVariante[];
  onAlternar: (id: string) => void;
  onNova: () => void;
  onDuplicar: (id: string) => void;
  onTemplate: () => void;
  onRenomear: (id: string) => void;
  onExcluir: (id: string) => void;
}

export function SeletorVariante({
  itens,
  onAlternar,
  onNova,
  onDuplicar,
  onTemplate,
  onRenomear,
  onExcluir,
}: PropsSeletor) {
  const [aberto, setAberto] = useState(false);
  const ativa = itens.find((i) => i.ativa);
  if (!ativa) return null;
  const ultima = itens.length <= 1;

  // Toda ação fecha a lista antes de abrir o diálogo ou trocar de variante.
  const agir = (acao: () => void) => () => {
    setAberto(false);
    acao();
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Variante: ${ativa.nome}`}
          className="h-9 max-w-[220px] gap-2 px-2.5"
        >
          <span className="truncate font-serif text-[17px] text-ink">{ativa.nome}</span>
          {ativa.naoSalva && (
            <span
              role="img"
              aria-label="Alterações não salvas"
              className="size-[7px] shrink-0 rounded-full bg-warning-dot"
            />
          )}
          <SeloSemFoto quantidade={ativa.semFoto} className="shrink-0" />
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-1.5">
        <ul className="flex flex-col gap-0.5">
          {itens.map((item) => (
            <li key={item._id} className="flex items-center gap-1">
              <button
                type="button"
                aria-current={item.ativa ? 'true' : undefined}
                onClick={agir(() => onAlternar(item._id))}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sand',
                  item.ativa && 'bg-accent-wash',
                )}
              >
                <Check
                  className={cn('size-4 shrink-0 text-accent', !item.ativa && 'invisible')}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-serif text-[16px] text-ink">{item.nome}</span>
                {item.naoSalva && (
                  <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full bg-warning-dot" />
                )}
                <span className="shrink-0 text-xs text-ink-3">{textoFotos(item.qtdFotos)}</span>
                <SeloSemFoto quantidade={item.semFoto} className="shrink-0" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Ações de ${item.nome}`}>
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={agir(() => onRenomear(item._id))}>Renomear</DropdownMenuItem>
                  <DropdownMenuItem onSelect={agir(() => onDuplicar(item._id))}>Duplicar</DropdownMenuItem>
                  <DropdownMenuItem
                    destrutivo={!ultima}
                    aria-disabled={ultima ? true : undefined}
                    title={ultima ? MOTIVO_ULTIMA_VARIANTE : undefined}
                    className={ultima ? 'text-ink-disabled' : undefined}
                    onSelect={(evento) => {
                      if (ultima) evento.preventDefault();
                      else agir(() => onExcluir(item._id))();
                    }}
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex flex-col gap-0.5 border-t border-line-soft pt-1.5">
          <Button variant="ghost" className="justify-start" onClick={agir(onNova)}>
            <Plus aria-hidden="true" />
            Nova variante em branco…
          </Button>
          <Button variant="ghost" className="justify-start" onClick={agir(() => onDuplicar(ativa._id))}>
            <Copy aria-hidden="true" />
            Duplicar “{ativa.nome}”…
          </Button>
          <Button variant="ghost" className="justify-start" onClick={agir(onTemplate)}>
            <LayoutTemplate aria-hidden="true" />
            Novo a partir de template…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
