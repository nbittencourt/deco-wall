import { formatarCmCurto, type Grid } from '@deco-wall/domain';
import { ArrowLeft, ChevronDown, EyeOff, Grid3x3, Magnet, Redo2, Undo2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { BotaoEmBreve, BotaoInativo, TEXTO_EM_BREVE } from '../../componentes/proprios/BotaoEmBreve';
import { ChipEscala } from '../../componentes/proprios/ChipEscala';
import { ComDica } from '../../componentes/proprios/ComDica';
import { NomeProjeto } from '../../componentes/proprios/NomeProjeto';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../componentes/ui/select';
import { Toggle } from '../../componentes/ui/toggle';

// Header do editor (DESIGN §7, protótipo 03a). No M1 funcionam: voltar, nome, Área útil, Perspectiva, Calibrar,
// chip de escala, Parede, Grid, Snap e Salvar. O status de salvamento fica só na barra de status.

export const MOTIVO_SEM_PAREDE = 'Carregue a foto da parede primeiro.';
export const MOTIVO_SEM_ESCALA = 'Defina a escala primeiro.';
export const MOTIVO_COM_PERSPECTIVA = 'Com a perspectiva aplicada, use Perspectiva para refazer a escala.';

export interface PropsHeaderEditor {
  nome: string;
  onRenomear: (nome: string) => Promise<void>;
  nomeVariante: string;
  temParede: boolean;
  metodo: 'perspectiva' | 'linear' | null;
  pxPorCm: number | null;
  temFotos: boolean;
  grid: Grid;
  // O grid está ligado, mas o passo na tela ficou abaixo de 4 px (A-07).
  gridOculto: boolean;
  salvando: boolean;
  onVoltar: () => void;
  onAlterarGrid: (parcial: Partial<Grid>) => void;
  onSalvar: () => void;
  onAreaUtil: () => void;
  onPerspectiva: () => void;
  onCalibrar: () => void;
  onTrocarParede: () => void;
}

interface ItemParede {
  rotulo: string;
  // Por que o item está inativo; undefined = ativo.
  motivo?: string;
  onAtivar: () => void;
}

function BotaoParede({ item }: { item: ItemParede }) {
  if (item.motivo) {
    return (
      <BotaoInativo variant="ghost" className="px-[9px]" motivo={item.motivo}>
        {item.rotulo}
      </BotaoInativo>
    );
  }
  return (
    <Button variant="ghost" className="px-[9px]" onClick={item.onAtivar}>
      {item.rotulo}
    </Button>
  );
}

function AcaoIcone({ rotulo, icone: Icone }: { rotulo: string; icone: typeof Undo2 }) {
  return (
    <BotaoEmBreve size="icon" variant="ghost" rotuloIcone={rotulo}>
      <Icone aria-hidden="true" />
    </BotaoEmBreve>
  );
}

function Divisor() {
  return <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-line" />;
}

export function HeaderEditor(props: PropsHeaderEditor) {
  const { temParede, metodo, temFotos, grid } = props;

  // Perspectiva e Calibrar pedem a foto; Calibrar não existe com a perspectiva aplicada (M1-02, RN-08).
  const itens: ItemParede[] = [
    {
      rotulo: 'Área útil',
      motivo: metodo === null ? MOTIVO_SEM_ESCALA : undefined,
      onAtivar: props.onAreaUtil,
    },
    {
      rotulo: 'Perspectiva',
      motivo: temParede ? undefined : MOTIVO_SEM_PAREDE,
      onAtivar: props.onPerspectiva,
    },
    {
      rotulo: 'Calibrar',
      motivo: !temParede ? MOTIVO_SEM_PAREDE : metodo === 'perspectiva' ? MOTIVO_COM_PERSPECTIVA : undefined,
      onAtivar: props.onCalibrar,
    },
    {
      rotulo: 'Parede',
      // Com fotos, trocar a parede mantendo-as é a RF-04 (ideia futura); sem fotos, troca com confirmação.
      motivo: !temParede ? MOTIVO_SEM_PAREDE : temFotos ? TEXTO_EM_BREVE : undefined,
      onAtivar: props.onTrocarParede,
    },
  ];

  const aoVoltar = (evento: MouseEvent) => {
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    props.onVoltar();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line-soft bg-surface px-3 whitespace-nowrap">
      <ComDica texto="Voltar aos projetos">
        <a
          href="/"
          aria-label="Voltar aos projetos"
          onClick={aoVoltar}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink hover:bg-sand"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </a>
      </ComDica>
      <span className="shrink-0 text-body-sm font-semibold text-ink">Parede</span>
      <NomeProjeto nome={props.nome} onRenomear={props.onRenomear} />

      <Select value={props.nomeVariante}>
        <SelectTrigger aria-label="Variante" className="w-auto gap-2 px-2.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={props.nomeVariante}>{props.nomeVariante}</SelectItem>
        </SelectContent>
      </Select>

      <Divisor />

      {/* DESIGN §7: abaixo de 1440 px só Área útil, Perspectiva, Calibrar e Parede vão para o menu. */}
      <BotaoEmBreve variant="ghost" className="px-[9px]">
        Comparar
      </BotaoEmBreve>
      <BotaoEmBreve variant="ghost" className="px-[9px]">
        Templates
      </BotaoEmBreve>
      <div className="hidden items-center gap-1 min-[1440px]:flex">
        {itens.map((item) => (
          <BotaoParede key={item.rotulo} item={item} />
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Menu Parede" className="min-[1440px]:hidden">
            Parede <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {itens.map((item) => (
            <DropdownMenuItem
              key={item.rotulo}
              aria-disabled={item.motivo ? true : undefined}
              title={item.motivo}
              onSelect={(evento) => {
                if (item.motivo) evento.preventDefault();
                else item.onAtivar();
              }}
              className={item.motivo ? 'text-ink-disabled' : undefined}
            >
              {item.rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {props.pxPorCm !== null && <ChipEscala pxPorCm={props.pxPorCm} />}

      <Divisor />

      <ComDica texto={props.gridOculto ? 'Grid oculto neste zoom, aproxime para ver' : 'Mostrar grid'}>
        <Toggle
          pressed={grid.visivel}
          onPressedChange={(visivel) => props.onAlterarGrid({ visivel })}
          aria-label={`Grid ${formatarCmCurto(grid.passoCm)} cm`}
        >
          {props.gridOculto ? <EyeOff aria-hidden="true" /> : <Grid3x3 aria-hidden="true" />}
          {formatarCmCurto(grid.passoCm)} cm
        </Toggle>
      </ComDica>
      <ComDica texto="Snap ao grid">
        <Toggle
          pressed={grid.snap}
          onPressedChange={(snap) => props.onAlterarGrid({ snap })}
          aria-label="Snap ao grid"
        >
          <Magnet aria-hidden="true" />
        </Toggle>
      </ComDica>

      <Divisor />

      <AcaoIcone rotulo="Desfazer" icone={Undo2} />
      <AcaoIcone rotulo="Refazer" icone={Redo2} />

      <div className="flex-1" />

      <ComDica texto="Salvar (Ctrl+S)">
        <Button variant="outline" aria-disabled={props.salvando || undefined} onClick={props.onSalvar}>
          Salvar
        </Button>
      </ComDica>
      <BotaoEmBreve variant="default">Exportar</BotaoEmBreve>
    </header>
  );
}
