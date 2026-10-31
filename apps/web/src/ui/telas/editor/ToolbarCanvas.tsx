import { BringToFront, Copy, Maximize, Plus, SendToBack, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { BotaoInativo } from '../../componentes/proprios/BotaoEmBreve';
import { ComDica } from '../../componentes/proprios/ComDica';
import { Button } from '../../componentes/ui/button';
import type { PalcoApi } from '../../canvas/cena';

// Toolbar do canvas (DESIGN §7): ações da composição (M2) e zoom. Sem o que a ação precisa, o botão fica
// inativo e a dica diz o que falta (DESIGN §7.1).

interface AcaoProps {
  rotulo: string;
  icone: typeof Copy;
  // Por que está inativa; undefined = ativa.
  motivo?: string;
  onAtivar: () => void;
  somenteIcone?: boolean;
}

function Acao({ rotulo, icone: Icone, motivo, onAtivar, somenteIcone = false }: AcaoProps) {
  const conteudo: ReactNode = (
    <>
      <Icone aria-hidden="true" />
      {!somenteIcone && rotulo}
    </>
  );
  const rotuloIcone = somenteIcone ? rotulo : undefined;
  if (motivo) {
    return (
      <BotaoInativo
        variant="ghost"
        size={somenteIcone ? 'icon' : 'default'}
        className={somenteIcone ? undefined : 'px-2'}
        rotuloIcone={rotuloIcone}
        motivo={motivo}
      >
        {conteudo}
      </BotaoInativo>
    );
  }
  const botao = (
    <Button
      variant="ghost"
      size={somenteIcone ? 'icon' : 'default'}
      className={somenteIcone ? undefined : 'px-2'}
      aria-label={rotuloIcone}
      onClick={onAtivar}
    >
      {conteudo}
    </Button>
  );
  return somenteIcone ? <ComDica texto={rotulo}>{botao}</ComDica> : botao;
}

export interface PropsToolbarCanvas {
  zoomPercentual: number;
  palco: React.RefObject<PalcoApi | null>;
  // Sem parede não há o que enquadrar: os controles de zoom ficam sem efeito.
  comPalco: boolean;
  // "Adicionar" precisa de escala e de uma foto escolhida na biblioteca (M2-01, M2-04).
  motivoAdicionar?: string;
  // Duplicar e ordem precisam de uma foto selecionada na parede.
  temSelecao: boolean;
  // M2-08: a ordem anda uma posição; no topo (ou no fundo) o botão fica inativo.
  noTopo: boolean;
  noFundo: boolean;
  onAdicionar: () => void;
  onDuplicar: () => void;
  onTrazerParaFrente: () => void;
  onEnviarParaTras: () => void;
}

const MOTIVO_SEM_SELECAO = 'Selecione uma foto na parede.';

export function ToolbarCanvas({
  zoomPercentual,
  palco,
  comPalco,
  motivoAdicionar,
  temSelecao,
  noTopo,
  noFundo,
  onAdicionar,
  onDuplicar,
  onTrazerParaFrente,
  onEnviarParaTras,
}: PropsToolbarCanvas) {
  const motivoSelecao = temSelecao ? undefined : MOTIVO_SEM_SELECAO;
  const motivoFrente = motivoSelecao ?? (noTopo ? 'Esta foto já está no topo.' : undefined);
  const motivoTras = motivoSelecao ?? (noFundo ? 'Esta foto já está no fundo.' : undefined);
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line-soft bg-surface-muted px-3">
      <Acao rotulo="Adicionar" icone={Plus} motivo={motivoAdicionar} onAtivar={onAdicionar} />
      <Acao rotulo="Duplicar" icone={Copy} motivo={motivoSelecao} onAtivar={onDuplicar} />
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
      <Acao
        somenteIcone
        rotulo="Trazer para frente"
        icone={BringToFront}
        motivo={motivoFrente}
        onAtivar={onTrazerParaFrente}
      />
      <Acao
        somenteIcone
        rotulo="Enviar para trás"
        icone={SendToBack}
        motivo={motivoTras}
        onAtivar={onEnviarParaTras}
      />
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
