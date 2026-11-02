import { formatarCm, formatarDimensao, type AreaUtil, type Borda } from '@deco-wall/domain';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';
import { CampoCmEditavel } from '../componentes/proprios/CampoCmEditavel';

// Painel do modo Posicionar template (A-22, DESIGN §7.3; spec M3 §3.7): modelo, borda (só leitura), posição do
// conjunto e os avisos. O protótipo 15 não desenha o painel; vale a DESIGN §7 (painel nos modos).

export interface PropsPainelTemplate {
  nome: string;
  vagas: number;
  conjunto: AreaUtil;
  borda: Borda;
  areaUtil: AreaUtil | null;
  maiorQueAreaUtil: boolean;
  vagasMaiores: number;
  erro: string | null;
  // Mesmas regras do arraste: snap e 1 cm dentro da parede inteira; devolve a mensagem de erro ou null.
  onMover: (xCm: number, yCm: number) => string | null;
  onCentralizar: () => void;
}

export function PainelTemplate({
  nome,
  vagas,
  conjunto,
  borda,
  areaUtil,
  maiorQueAreaUtil,
  vagasMaiores,
  erro,
  onMover,
  onCentralizar,
}: PropsPainelTemplate) {
  const total = formatarDimensao(conjunto.larguraCm, conjunto.alturaCm);
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1.5">
        <h3 className="text-display-sm text-[18px] text-ink">Modelo</h3>
        <p className="font-serif text-[20px] text-ink">{nome}</p>
        <p className="text-body-sm text-ink-2">
          {vagas} vagas · <span className="font-mono text-medida">{total}</span>
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-display-sm text-[18px] text-ink">Borda das fotos</h3>
        <p className="flex items-center gap-2 text-body-sm text-ink-2">
          <span
            aria-hidden="true"
            className="size-4 rounded-xs ring-1 ring-line"
            style={{ backgroundColor: borda.cor }}
          />
          <span className="font-mono text-medida">{formatarCm(borda.larguraCm)} cm</span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-display-sm text-[18px] text-ink">Posição do conjunto</h3>
        <div className="grid grid-cols-2 gap-2">
          <CampoCmEditavel
            rotulo="X"
            prefixo="X"
            rotuloOculto
            valor={conjunto.xCm}
            onConfirmar={(x) => onMover(x, conjunto.yCm)}
          />
          <CampoCmEditavel
            rotulo="Y"
            prefixo="Y"
            rotuloOculto
            valor={conjunto.yCm}
            onConfirmar={(y) => onMover(conjunto.xCm, y)}
          />
        </div>
        <Button variant="outline" onClick={onCentralizar}>
          Centralizar na área útil
        </Button>
      </section>

      {maiorQueAreaUtil && areaUtil && (
        <Alert variant="alerta">
          O template é maior que a área útil. {total} não cabe em{' '}
          {formatarDimensao(areaUtil.larguraCm, areaUtil.alturaCm)}. Você pode confirmar assim mesmo e ajustar
          as fotos depois.
        </Alert>
      )}
      {vagasMaiores > 0 && (
        <Alert>
          {vagasMaiores === 1
            ? '1 vaga ficou maior que o espaço do modelo; as vizinhas foram afastadas.'
            : `${vagasMaiores} vagas ficaram maiores que o espaço do modelo; as vizinhas foram afastadas.`}
        </Alert>
      )}
      {erro && <Alert variant="alerta">{erro}</Alert>}
    </div>
  );
}
