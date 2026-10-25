import { formatarEscala, referenciaPequena, validarMedidaReferencia } from '@deco-wall/domain';
import { CampoCm } from '../componentes/proprios/CampoCm';
import { Alert } from '../componentes/ui/alert';

// Painel do modo Calibração linear (spec M1 §3.5; protótipo 05): segmento, comprimento real e escala ao vivo.

export interface PropsPainelCalibracao {
  comprimentoCm: string;
  onComprimentoChange: (texto: string) => void;
  // Comprimento do segmento traçado, em px da foto.
  segmentoPx: number;
  onUsarPerspectiva: () => void;
  erro?: string | null;
}

export function PainelCalibracao({
  comprimentoCm,
  onComprimentoChange,
  segmentoPx,
  onUsarPerspectiva,
  erro,
}: PropsPainelCalibracao) {
  const medida = validarMedidaReferencia(comprimentoCm);
  const erroCampo = comprimentoCm.trim() !== '' && !medida.ok ? medida.erro : undefined;
  const pxPorCm = medida.ok && segmentoPx > 0 ? segmentoPx / medida.valor : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-display-sm text-[18px] text-ink">Segmento</h3>
        <div className="flex items-center justify-between text-body-sm text-ink-2">
          <span>Comprimento na foto</span>
          <span className="font-mono text-medida text-ink">{`${Math.round(segmentoPx)} px`}</span>
        </div>
        <p className="text-body-sm text-ink-3">
          Arraste as pontas até os extremos de algo de comprimento conhecido.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-line-faint pt-[18px]">
        <h3 className="text-display-sm text-[18px] text-ink">Comprimento real</h3>
        <CampoCm
          rotulo="Comprimento real"
          valor={comprimentoCm}
          erro={erroCampo}
          onChange={onComprimentoChange}
        />
        {pxPorCm !== null && (
          <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
            <span className="text-body-sm text-ink-2">Escala resultante</span>
            <span className="font-mono text-medida text-ink">{formatarEscala(pxPorCm)}</span>
          </div>
        )}
        <Alert>Sem correção de perspectiva, a escala só é precisa no plano do segmento.</Alert>
        <Alert>Medidas assumem parede plana. Prefira referências com 1 m ou mais.</Alert>
        {medida.ok && referenciaPequena(medida.valor, medida.valor) && (
          <Alert>Referência menor que 1 m: a precisão diminui.</Alert>
        )}
        <p className="text-body-sm text-ink-3">
          Recalibrar mantém posição e tamanho das fotos em centímetros.
        </p>
      </section>

      {erro && <Alert variant="alerta">{erro}</Alert>}

      <button
        type="button"
        onClick={onUsarPerspectiva}
        className="w-fit cursor-pointer text-left text-body-sm text-accent-hover underline underline-offset-2"
      >
        Usar correção de perspectiva
      </button>
    </div>
  );
}
