import {
  CORES_GRID,
  formatarCm,
  lerCm,
  LIMITE_PASSO_GRID_CM,
  PASSOS_GRID_CM,
  type AreaUtil,
  type Grid,
} from '@deco-wall/domain';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BotaoInativo, CampoEmBreve } from '../componentes/proprios/BotaoEmBreve';
import { CampoCm } from '../componentes/proprios/CampoCm';
import { ChipEscala } from '../componentes/proprios/ChipEscala';
import { SeletorCor } from '../componentes/proprios/SeletorCor';
import { Button } from '../componentes/ui/button';
import { Switch } from '../componentes/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../componentes/ui/toggle-group';
import { CamposAreaUtil } from './CamposAreaUtil';

// Painel direito sem seleção, no que o M1 entrega (spec M1 §3.7; protótipo 11).

export interface PropsPainelComposicao {
  escala: { metodo: 'perspectiva' | 'linear' | null; pxPorCm: number | null };
  // null enquanto a escala não foi definida.
  areaUtil: AreaUtil | null;
  paredeInteira: AreaUtil | null;
  grid: Grid;
  onRecalibrar: () => void;
  onAjustarAreaUtil: () => void;
  onAlterarAreaUtil: (area: AreaUtil) => void;
  onAlterarGrid: (parcial: Partial<Grid>) => void;
}

// Título de seção do painel: serif 18 px, com divisória acima (protótipo 11, DESIGN §3).
function Secao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line-faint pt-[18px]">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-display-sm text-[18px] text-ink">
          {titulo}
        </h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

const METODO: Record<'perspectiva' | 'linear', string> = { perspectiva: 'Perspectiva', linear: 'Linear' };

export function PainelComposicao({
  escala,
  areaUtil,
  paredeInteira,
  grid,
  onRecalibrar,
  onAjustarAreaUtil,
  onAlterarAreaUtil,
  onAlterarGrid,
}: PropsPainelComposicao) {
  return (
    <div className="flex flex-col gap-[18px]">
      <h2 className="text-display-md text-ink">Composição</h2>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm">
        <dt className="text-ink-2">Fotos</dt>
        <dd className="text-right font-mono text-medida text-ink">0</dd>
        <dt className="text-ink-2">Área total</dt>
        <dd className="text-right font-mono text-medida text-ink">—</dd>
      </dl>

      <Secao titulo="Escala">
        {escala.metodo ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-ink">{METODO[escala.metodo]}</span>
            {escala.pxPorCm !== null && <ChipEscala pxPorCm={escala.pxPorCm} />}
            <Button variant="outline" className="ml-auto h-8 px-3 text-sm" onClick={onRecalibrar}>
              Recalibrar
            </Button>
          </div>
        ) : (
          <span className="text-body-sm text-ink-3">Não definida</span>
        )}
      </Secao>

      <Secao
        titulo="Área útil desta variante"
        acao={
          areaUtil ? (
            <Button variant="outline" className="h-8 px-3 text-sm" onClick={onAjustarAreaUtil}>
              Ajustar
            </Button>
          ) : (
            <BotaoInativo variant="outline" className="h-8 px-3 text-sm" motivo="Defina a escala primeiro.">
              Ajustar
            </BotaoInativo>
          )
        }
      >
        <CamposAreaUtil area={areaUtil} paredeInteira={paredeInteira} onChange={onAlterarAreaUtil} />
      </Secao>

      <Secao titulo="Borda padrão">
        <div className="flex items-end gap-2">
          <CampoCm rotulo="Largura" valor="0,0" inativo className="flex-1" />
          <SeletorCor valor="#FFFFFF" inativo />
        </div>
      </Secao>

      <SecaoGrid grid={grid} onAlterarGrid={onAlterarGrid} />
    </div>
  );
}

function SecaoGrid({ grid, onAlterarGrid }: { grid: Grid; onAlterarGrid: (parcial: Partial<Grid>) => void }) {
  const ehPronto = (PASSOS_GRID_CM as readonly number[]).includes(grid.passoCm);
  // "Outro" abre o campo de passo personalizado mesmo quando o passo atual é um dos prontos.
  const [outroAberto, setOutroAberto] = useState(!ehPronto);
  const emOutro = outroAberto || !ehPronto;
  const [texto, setTexto] = useState(formatarCm(grid.passoCm));
  const [erro, setErro] = useState<string | undefined>();

  // O campo acompanha o passo quando ele muda por fora (padrão "estado derivado durante o render").
  const [passoVisto, setPassoVisto] = useState(grid.passoCm);
  if (passoVisto !== grid.passoCm) {
    setPassoVisto(grid.passoCm);
    setTexto(formatarCm(grid.passoCm));
    setErro(undefined);
  }

  const aplicarPasso = () => {
    const valor = lerCm(texto);
    const { min, max } = LIMITE_PASSO_GRID_CM;
    if (valor === null) {
      setErro('Digite um número em cm.');
      return;
    }
    if (valor < min || valor > max) {
      setErro(`Faixa válida: ${formatarCm(min)} a ${formatarCm(max)} cm.`);
      return;
    }
    setErro(undefined);
    onAlterarGrid({ passoCm: Math.round(valor * 10) / 10 });
  };

  const aoTeclarPasso = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    evento.stopPropagation();
    aplicarPasso();
  };

  return (
    <Secao titulo="Grid">
      <label className="flex items-center justify-between gap-3 text-sm text-ink">
        Mostrar grid
        <Switch
          checked={grid.visivel}
          onCheckedChange={(visivel) => onAlterarGrid({ visivel })}
          aria-label="Mostrar grid"
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-ink">
        Encaixar no grid
        <Switch
          checked={grid.snap}
          onCheckedChange={(snap) => onAlterarGrid({ snap })}
          aria-label="Encaixar no grid"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Passo (cm)</span>
        <ToggleGroup
          type="single"
          aria-label="Passo do grid"
          value={emOutro ? 'outro' : String(grid.passoCm)}
          onValueChange={(valor) => {
            if (!valor) return;
            if (valor === 'outro') {
              setOutroAberto(true);
              return;
            }
            setOutroAberto(false);
            onAlterarGrid({ passoCm: Number(valor) });
          }}
        >
          {PASSOS_GRID_CM.map((passo) => (
            <ToggleGroupItem key={passo} value={String(passo)}>
              {passo}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value="outro">Outro</ToggleGroupItem>
        </ToggleGroup>
        {emOutro && (
          <CampoCm
            rotulo="Passo personalizado"
            valor={texto}
            erro={erro}
            onChange={setTexto}
            onBlur={() => {
              if (texto !== formatarCm(grid.passoCm)) aplicarPasso();
            }}
            onKeyDown={aoTeclarPasso}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-label">Linha forte a cada</span>
        <CampoEmBreve rotulo="Linha forte a cada" placeholder="5" className="text-medida" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="grid-opacidade" className="text-label">
            Opacidade
          </label>
          <span className="font-mono text-medida text-ink-2">{Math.round(grid.opacidade * 100)}%</span>
        </div>
        <input
          id="grid-opacidade"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(grid.opacidade * 100)}
          onChange={(evento) => onAlterarGrid({ opacidade: Number(evento.target.value) / 100 })}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Cor das linhas</span>
        <SeletorCor
          valor={grid.cor}
          cores={CORES_GRID}
          titulo="Cor das linhas"
          rotulo="Cor das linhas"
          onChange={(cor) => onAlterarGrid({ cor })}
        />
      </div>
    </Secao>
  );
}
