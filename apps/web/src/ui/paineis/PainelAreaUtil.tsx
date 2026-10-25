import type { AreaUtil } from '@deco-wall/domain';
import { Button } from '../componentes/ui/button';
import { CamposAreaUtil } from './CamposAreaUtil';

// Painel do modo Área útil (spec M1 §3.6; protótipo 13): campos, "Usar a parede inteira" e notas.

export interface PropsPainelAreaUtil {
  area: AreaUtil;
  paredeInteira: AreaUtil;
  onAreaChange: (area: AreaUtil) => void;
  onUsarParedeInteira: () => void;
  // Onde ficam as origens 0,0: o canto do retângulo de referência (perspectiva) ou da foto (linear).
  origem?: 'retificada' | 'foto';
}

export function PainelAreaUtil({
  area,
  paredeInteira,
  onAreaChange,
  onUsarParedeInteira,
  origem = 'retificada',
}: PropsPainelAreaUtil) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-display-sm text-[18px] text-ink">Medidas da área</h3>
        <CamposAreaUtil area={area} paredeInteira={paredeInteira} onChange={onAreaChange} />
        <Button variant="outline" onClick={onUsarParedeInteira}>
          Usar a parede inteira
        </Button>
        <p className="text-body-sm text-ink-3">
          {origem === 'foto'
            ? 'Medido a partir da origem 0,0 (canto superior esquerdo da foto).'
            : 'Medido a partir da origem 0,0 (canto do retângulo de referência).'}
        </p>
        <p className="text-body-sm text-ink-3">Cada variante tem a sua área útil.</p>
      </section>
      <p className="text-body-sm text-ink-2">Arraste os cantos ou os lados · Enter confirma · Esc cancela</p>
    </div>
  );
}
