import { ImageOff, MoreHorizontal, Search } from 'lucide-react';
import { BotaoEmBreve, CampoEmBreve } from '../componentes/proprios/BotaoEmBreve';
import { StatusApi } from '../componentes/proprios/StatusApi';
import { Button } from '../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../componentes/ui/dropdown-menu';

// DESIGN §7 / protótipo 01: casca estática, sem dados reais. Ações ainda não implementadas ficam inativas (§7.1).
const PROJETOS_EXEMPLO = [
  { nome: 'Sala de estar', meta: '3 variantes · editado hoje, 14:35' },
  { nome: 'Corredor', meta: '1 variante · editado em 12/10' },
  { nome: 'Quarto', meta: '2 variantes · editado em 02/10' },
];

// Função prevista e não implementada (DESIGN §7.1): o item fica aberto e não faz nada.
const semEfeito = (evento: Event) => evento.preventDefault();

export function Projetos() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between gap-6 border-b border-line-soft bg-surface px-6">
        <span className="text-display-sm text-ink">Simulador de Parede de Fotos</span>
        <StatusApi />
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display-xl text-ink">Projetos</h1>
            <p className="text-body-sm text-ink-2">
              Uma parede por projeto. As fotos da biblioteca valem para todos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <CampoEmBreve rotulo="Buscar projeto" placeholder="Buscar projeto" className="h-10 pl-9" />
            </div>
            <BotaoEmBreve variant="default" size="lista">
              Novo projeto
            </BotaoEmBreve>
          </div>
        </div>

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {PROJETOS_EXEMPLO.map((projeto) => (
            <li
              key={projeto.nome}
              className="flex flex-col overflow-hidden rounded-lg border border-line-soft bg-surface transition-shadow hover:shadow-md"
            >
              <div className="flex h-40 flex-col items-center justify-center gap-2 bg-paper text-ink-3">
                <ImageOff className="size-6" aria-hidden="true" />
                <span className="text-body-sm">Sem foto da parede</span>
              </div>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="text-display-sm truncate text-ink">{projeto.nome}</h2>
                  <p className="text-body-sm text-ink-3">{projeto.meta}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Mais ações de ${projeto.nome}`}>
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem aria-disabled="true" onSelect={semEfeito} className="text-ink-disabled">
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem aria-disabled="true" onSelect={semEfeito} className="text-ink-disabled">
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
