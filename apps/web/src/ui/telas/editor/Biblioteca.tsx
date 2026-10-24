import { Ellipsis, ImagePlus, X } from 'lucide-react';
import { useState } from 'react';
import { BotaoEmBreve, CampoEmBreve } from '../../componentes/proprios/BotaoEmBreve';
import { ComDica } from '../../componentes/proprios/ComDica';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '../../componentes/ui/toggle-group';

// Coluna Biblioteca no M1: título, busca e filtros inativos (A-15), "Carregar fotos" inativo e o aviso de
// que as fotos esperam a escala (RF-13). A biblioteca de verdade chega no M2.
type Filtro = 'todas' | 'projeto' | 'variante' | 'excluidas';

export function Biblioteca({ temEscala }: { temEscala: boolean }) {
  // RF-28: "Excluídas" fica no menu ⋯ e exclui os demais filtros (DESIGN §6).
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const excluidas = filtro === 'excluidas';

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-soft bg-surface p-4">
      <h2 className="text-display-sm text-ink">Biblioteca</h2>
      <CampoEmBreve rotulo="Buscar por nome" placeholder="Buscar por nome" />
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={excluidas ? '' : filtro}
          onValueChange={(valor) => valor && setFiltro(valor as Filtro)}
          aria-label="Filtro da biblioteca"
          className="w-[210px]"
        >
          <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
          <ToggleGroupItem value="projeto">Projeto</ToggleGroupItem>
          <ToggleGroupItem value="variante">Variante</ToggleGroupItem>
        </ToggleGroup>
        <DropdownMenu>
          <ComDica texto="Mais filtros">
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Mais filtros"
                className={
                  excluidas
                    ? 'border-accent-tint bg-accent-tint text-accent-ink hover:bg-accent-tint'
                    : undefined
                }
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </ComDica>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setFiltro('excluidas')}>Excluídas</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {excluidas && (
        <button
          type="button"
          onClick={() => setFiltro('todas')}
          aria-label="Remover o filtro Excluídas"
          className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-ink"
        >
          Excluídas
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
        <p className="text-body-sm text-ink-2">
          {temEscala
            ? 'Nenhuma foto na biblioteca ainda.'
            : 'As fotos ficam disponíveis depois que a escala da parede for definida.'}
        </p>
        <BotaoEmBreve variant="outline">
          <ImagePlus aria-hidden="true" />
          Carregar fotos
        </BotaoEmBreve>
      </div>
    </aside>
  );
}
