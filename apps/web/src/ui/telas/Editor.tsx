import {
  ArrowLeft,
  BringToFront,
  ChevronDown,
  Copy,
  Ellipsis,
  Grid3x3,
  ImagePlus,
  Magnet,
  Maximize,
  Plus,
  Redo2,
  SendToBack,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState } from 'react';
import { BotaoEmBreve, CampoEmBreve } from '../componentes/proprios/BotaoEmBreve';
import { CampoCm } from '../componentes/proprios/CampoCm';
import { ChipEscala } from '../componentes/proprios/ChipEscala';
import { SeletorCor } from '../componentes/proprios/SeletorCor';
import { StatusSalvamento } from '../componentes/proprios/StatusSalvamento';
import { Badge } from '../componentes/ui/badge';
import { Button } from '../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../componentes/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../componentes/ui/select';
import { Switch } from '../componentes/ui/switch';
import { Toggle } from '../componentes/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '../componentes/ui/toggle-group';

// DESIGN §7 / protótipo 03: casca estática do editor, sem canvas nem dados reais.
// Ações ainda não implementadas (M1 a M4) ficam visíveis e inativas (§7.1).
const semEfeito = (evento: Event) => evento.preventDefault();

function AcaoIcone({ rotulo, icone: Icone }: { rotulo: string; icone: typeof Undo2 }) {
  return (
    <BotaoEmBreve size="icon" variant="ghost" rotuloIcone={rotulo}>
      <Icone aria-hidden="true" />
    </BotaoEmBreve>
  );
}

// Entradas do header que, abaixo de 1440 px, vão para o menu "Parede ▾" (DESIGN §7).
function ItensParede() {
  return (
    <>
      <BotaoEmBreve variant="ghost" className="px-2">
        Área útil
      </BotaoEmBreve>
      <BotaoEmBreve variant="ghost" className="px-2">
        Perspectiva
      </BotaoEmBreve>
      <BotaoEmBreve variant="ghost" className="px-2">
        Calibrar
      </BotaoEmBreve>
      <BotaoEmBreve variant="ghost" className="px-2">
        Parede
      </BotaoEmBreve>
    </>
  );
}

export function Editor() {
  const [grade, setGrade] = useState(true);
  const [snap, setSnap] = useState(true);
  const [corBorda, setCorBorda] = useState('#FFFFFF');
  const [filtro, setFiltro] = useState('todas');

  return (
    <div className="flex h-dvh min-w-[1280px] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line-soft bg-surface px-3 whitespace-nowrap">
        <a
          href="/"
          aria-label="Voltar aos projetos"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink hover:bg-sand"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </a>
        <span className="shrink-0 text-body-sm font-semibold text-ink">Parede</span>
        <h1 className="max-w-[120px] truncate text-display-sm text-ink">Sala de estar</h1>

        <Select defaultValue="base">
          <SelectTrigger aria-label="Variante" className="w-auto gap-2 px-2.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="alternativa">Alternativa</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="alerta">1 sem foto</Badge>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />

        <div className="hidden items-center gap-1 min-[1440px]:flex">
          <BotaoEmBreve variant="ghost" className="px-2">
            Comparar
          </BotaoEmBreve>
          <BotaoEmBreve variant="ghost" className="px-2">
            Templates
          </BotaoEmBreve>
          <ItensParede />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" aria-label="Menu Parede" className="min-[1440px]:hidden">
              Parede <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {['Área útil', 'Perspectiva', 'Calibrar', 'Parede'].map((item) => (
              <DropdownMenuItem
                key={item}
                aria-disabled="true"
                onSelect={semEfeito}
                className="text-ink-disabled"
              >
                {item}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ChipEscala pxPorCm={4} />

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />

        <Toggle pressed={grade} onPressedChange={setGrade} aria-label="Grid 5 cm">
          <Grid3x3 aria-hidden="true" />5 cm
        </Toggle>
        <Toggle pressed={snap} onPressedChange={setSnap} aria-label="Snap ao grid">
          <Magnet aria-hidden="true" />
        </Toggle>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />

        <AcaoIcone rotulo="Desfazer" icone={Undo2} />
        <AcaoIcone rotulo="Refazer" icone={Redo2} />

        <div className="flex-1" />

        <StatusSalvamento estado={{ tipo: 'salvo' }} className="hidden min-[1440px]:inline-flex" />
        <BotaoEmBreve variant="outline">Salvar</BotaoEmBreve>
        <BotaoEmBreve variant="default">Exportar</BotaoEmBreve>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-soft bg-surface p-4">
          <h2 className="text-display-sm text-ink">Biblioteca</h2>
          <CampoEmBreve rotulo="Buscar por nome" placeholder="Buscar por nome" />
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(valor) => valor && setFiltro(valor)}
              aria-label="Filtro da biblioteca"
              className="w-[210px]"
            >
              <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
              <ToggleGroupItem value="projeto">Projeto</ToggleGroupItem>
              <ToggleGroupItem value="variante">Variante</ToggleGroupItem>
            </ToggleGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais filtros">
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem aria-disabled="true" onSelect={semEfeito} className="text-ink-disabled">
                  Excluídas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
            <p className="text-body-sm text-ink-2">Nenhuma foto na biblioteca ainda.</p>
            <BotaoEmBreve variant="outline">
              <ImagePlus aria-hidden="true" />
              Carregar fotos
            </BotaoEmBreve>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line-soft bg-surface-muted px-3">
            <BotaoEmBreve variant="ghost" className="px-2">
              <Plus aria-hidden="true" />
              Adicionar
            </BotaoEmBreve>
            <BotaoEmBreve variant="ghost" className="px-2">
              <Copy aria-hidden="true" />
              Duplicar
            </BotaoEmBreve>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
            <AcaoIcone rotulo="Trazer para frente" icone={BringToFront} />
            <AcaoIcone rotulo="Enviar para trás" icone={SendToBack} />
            <div className="flex-1" />
            <AcaoIcone rotulo="Diminuir zoom" icone={ZoomOut} />
            <span className="min-w-12 text-center text-medida text-ink-2">100%</span>
            <AcaoIcone rotulo="Aumentar zoom" icone={ZoomIn} />
            <BotaoEmBreve variant="ghost" className="px-2">
              <Maximize aria-hidden="true" />
              Ajustar à tela
            </BotaoEmBreve>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-stage">
            <p className="rounded-lg bg-surface/80 px-4 py-3 text-body-sm text-ink-2">
              Carregue a foto da parede para começar.
            </p>
          </div>
        </section>

        <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-line-soft bg-surface p-5">
          <h2 className="text-display-md text-ink">Composição</h2>

          <section className="flex flex-col gap-2">
            <h3 className="text-label">Escala</h3>
            <div className="flex items-center gap-3">
              <ChipEscala pxPorCm={4} />
              <span className="text-body-sm text-ink-3">Calibrada pela perspectiva</span>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-label">Área útil desta variante</h3>
              <BotaoEmBreve size="default" variant="outline" className="h-8 px-3 text-sm">
                Ajustar
              </BotaoEmBreve>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CampoCm rotulo="Largura" valor="180,0" inativo />
              <CampoCm rotulo="Altura" valor="110,0" inativo />
              <CampoCm rotulo="X" prefixo="X" valor="0,0" inativo />
              <CampoCm rotulo="Y" prefixo="Y" valor="0,0" inativo />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-label">Borda padrão</h3>
            <div className="flex items-end gap-2">
              <CampoCm rotulo="Largura" valor="0,0" inativo className="flex-1" />
              <SeletorCor valor={corBorda} onChange={setCorBorda} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-label">Grid</h3>
            <label className="flex items-center justify-between gap-3 text-sm text-ink">
              Visível
              <Switch checked={grade} onCheckedChange={setGrade} aria-label="Grid visível" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink">
              Snap ao grid
              <Switch checked={snap} onCheckedChange={setSnap} aria-label="Snap ao grid" />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-label">Linha forte a cada</span>
              <CampoEmBreve rotulo="Linha forte a cada" placeholder="5" className="text-medida" />
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-line-soft bg-surface px-4">
        <span className="text-body-sm text-ink-2">Nenhuma foto selecionada</span>
        <StatusSalvamento estado={{ tipo: 'salvo' }} />
      </footer>
    </div>
  );
}
