import {
  formatarDimensao,
  formatarHora,
  MENSAGEM_QUADRILATERO_INVALIDO,
  referenciaPequena,
  validarMedidaReferencia,
  type MotivoQuadrilateroInvalido,
  type Pt,
} from '@deco-wall/domain';
import { Loader2 } from 'lucide-react';
import { CampoCm } from '../componentes/proprios/CampoCm';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';

// Painel do modo Perspectiva (spec M1 §3.4; protótipos 04 e 04a): cantos, medidas reais e prévia frontal.

export type EstadoPrevia =
  | { tipo: 'vazia' }
  | { tipo: 'gerando' }
  | { tipo: 'pronta'; url: string; geradaEm: Date; larguraCm: number; alturaCm: number }
  | { tipo: 'desatualizada'; url: string };

export interface PropsPainelPerspectiva {
  // Os quatro cantos já em ordem (superior esq. → superior dir. → inferior dir. → inferior esq.).
  cantos: Pt[];
  motivoInvalido: MotivoQuadrilateroInvalido | null;
  medidas: { larguraCm: string; alturaCm: string };
  onMedidasChange: (medidas: { larguraCm: string; alturaCm: string }) => void;
  previa: EstadoPrevia;
  onGerarPrevia: () => void;
  // Só aparece enquanto a escala atual não é de perspectiva (M1-02).
  permitirPular: boolean;
  onPular: () => void;
  // Erro da última tentativa de aplicar (ex.: 409 ou falha do servidor).
  erro?: string | null;
}

const NOMES_CANTOS = ['Superior esq.', 'Superior dir.', 'Inferior dir.', 'Inferior esq.'];

function erroDaMedida(texto: string): string | undefined {
  if (texto.trim() === '') return undefined;
  const resultado = validarMedidaReferencia(texto);
  return resultado.ok ? undefined : resultado.erro;
}

export function PainelPerspectiva({
  cantos,
  motivoInvalido,
  medidas,
  onMedidasChange,
  previa,
  onGerarPrevia,
  permitirPular,
  onPular,
  erro,
}: PropsPainelPerspectiva) {
  const largura = validarMedidaReferencia(medidas.larguraCm);
  const altura = validarMedidaReferencia(medidas.alturaCm);
  const pequena = largura.ok && altura.ok && referenciaPequena(largura.valor, altura.valor);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-display-sm text-[18px] text-ink">Cantos {cantos.length} de 4</h3>
        <ol className="flex flex-col gap-1">
          {cantos.map((canto, i) => (
            <li key={NOMES_CANTOS[i]} className="flex items-center gap-2 text-body-sm text-ink">
              <span className="flex size-5 items-center justify-center rounded-full bg-accent font-mono text-[11px] text-white">
                {i + 1}
              </span>
              <span>{NOMES_CANTOS[i]}</span>
              <span className="ml-auto font-mono text-medida text-ink-3">
                {Math.round(canto.x)}, {Math.round(canto.y)} px
              </span>
            </li>
          ))}
        </ol>
        <p className="text-body-sm text-ink-3">
          Arraste as alças para ajustar. Use a roda do mouse para zoom.
        </p>
        {motivoInvalido && <Alert variant="alerta">{MENSAGEM_QUADRILATERO_INVALIDO}</Alert>}
      </section>

      <section className="flex flex-col gap-3 border-t border-line-faint pt-[18px]">
        <h3 className="text-display-sm text-[18px] text-ink">Medidas reais</h3>
        <div className="grid grid-cols-2 gap-2">
          <CampoCm
            rotulo="Largura"
            valor={medidas.larguraCm}
            erro={erroDaMedida(medidas.larguraCm)}
            onChange={(larguraCm) => onMedidasChange({ ...medidas, larguraCm })}
          />
          <CampoCm
            rotulo="Altura"
            valor={medidas.alturaCm}
            erro={erroDaMedida(medidas.alturaCm)}
            onChange={(alturaCm) => onMedidasChange({ ...medidas, alturaCm })}
          />
        </div>
        <Alert>Medidas assumem parede plana. Prefira referências com 1 m ou mais.</Alert>
        {pequena && <Alert>Referência menor que 1 m: a precisão diminui.</Alert>}
        <p className="text-body-sm text-ink-3">
          A origem das medidas é o canto superior esquerdo do retângulo marcado.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-line-faint pt-[18px]">
        <h3 className="text-display-sm text-[18px] text-ink">Prévia frontal</h3>
        <Previa previa={previa} onGerarPrevia={onGerarPrevia} />
      </section>

      {erro && <Alert variant="alerta">{erro}</Alert>}

      {permitirPular && (
        <button
          type="button"
          onClick={onPular}
          className="w-fit cursor-pointer text-left text-body-sm text-accent-hover underline underline-offset-2"
        >
          Pular e usar calibração linear
        </button>
      )}
    </div>
  );
}

function Previa({ previa, onGerarPrevia }: { previa: EstadoPrevia; onGerarPrevia: () => void }) {
  if (previa.tipo === 'vazia') {
    return (
      <>
        <p className="text-body-sm text-ink-3">Gere uma prévia para conferir a vista frontal da parede.</p>
        <Button variant="outline" onClick={onGerarPrevia}>
          Gerar prévia
        </Button>
      </>
    );
  }
  if (previa.tipo === 'gerando') {
    return (
      <p role="status" className="flex items-center gap-2 text-body-sm text-ink-2">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Gerando prévia…
      </p>
    );
  }
  return (
    <>
      <img
        src={previa.url}
        alt="Prévia frontal"
        data-estado={previa.tipo}
        className={`w-full rounded-md border border-line-soft bg-sand ${previa.tipo === 'desatualizada' ? 'opacity-40' : ''}`}
      />
      {previa.tipo === 'pronta' ? (
        <p className="font-mono text-medida text-ink-2">
          {`Gerada ${formatarHora(previa.geradaEm)} · ${formatarDimensao(previa.larguraCm, previa.alturaCm)}`}
        </p>
      ) : (
        <>
          <p className="text-body-sm text-warning-ink">Os cantos mudaram</p>
          <Button variant="outline" onClick={onGerarPrevia}>
            Gerar prévia
          </Button>
        </>
      )}
    </>
  );
}
