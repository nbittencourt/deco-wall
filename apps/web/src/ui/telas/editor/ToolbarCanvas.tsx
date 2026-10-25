import { BringToFront, Copy, Maximize, Plus, SendToBack, ZoomIn, ZoomOut } from 'lucide-react';
import { BotaoEmBreve } from '../../componentes/proprios/BotaoEmBreve';
import { ComDica } from '../../componentes/proprios/ComDica';
import { Button } from '../../componentes/ui/button';
import type { PalcoApi } from '../../canvas/cena';

// Toolbar do canvas (DESIGN §7): ações da composição ficam inativas até o M2; o zoom já funciona.
function AcaoIcone({ rotulo, icone: Icone }: { rotulo: string; icone: typeof Copy }) {
  return (
    <BotaoEmBreve size="icon" variant="ghost" rotuloIcone={rotulo}>
      <Icone aria-hidden="true" />
    </BotaoEmBreve>
  );
}

export function ToolbarCanvas({
  zoomPercentual,
  palco,
  comPalco,
}: {
  zoomPercentual: number;
  palco: React.RefObject<PalcoApi | null>;
  // Sem parede não há o que enquadrar: os controles de zoom ficam sem efeito.
  comPalco: boolean;
}) {
  return (
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
      <ComDica texto="Diminuir zoom">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Diminuir zoom"
          disabled={!comPalco}
          onClick={() => palco.current?.zoomMenos()}
        >
          <ZoomOut aria-hidden="true" />
        </Button>
      </ComDica>
      <span data-testid="zoom-percentual" className="min-w-12 text-center font-mono text-medida text-ink-2">
        {comPalco ? `${zoomPercentual}%` : '—'}
      </span>
      <ComDica texto="Aumentar zoom">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Aumentar zoom"
          disabled={!comPalco}
          onClick={() => palco.current?.zoomMais()}
        >
          <ZoomIn aria-hidden="true" />
        </Button>
      </ComDica>
      <Button variant="ghost" className="px-2" disabled={!comPalco} onClick={() => palco.current?.ajustar()}>
        <Maximize aria-hidden="true" />
        Ajustar à tela
      </Button>
    </div>
  );
}
