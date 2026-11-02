import {
  aplicarTemplate,
  arredondarCm,
  BORDA_MAX_CM,
  formatarDimensao,
  maiorQueAreaUtil,
  nomeDoTemplateUnico,
  TEMPLATES,
  totalDoTemplate,
  type AreaUtil,
  type Borda,
  type Template,
} from '@deco-wall/domain';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BotaoInativo } from '../../componentes/proprios/BotaoEmBreve';
import { CampoCmEditavel } from '../../componentes/proprios/CampoCmEditavel';
import { EsbocoVariante } from '../../componentes/proprios/EsbocoVariante';
import { SeletorCor } from '../../componentes/proprios/SeletorCor';
import { Button } from '../../componentes/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../componentes/ui/dialog';
import { RadioCard, RadioGroup } from '../../componentes/ui/radio-group';

// Galeria de templates (RF-93, RN-29, RN-30, TPL-01 a TPL-08, A-18, A-19; protótipo 14; DESIGN §6, §7.3;
// docs/specs/M3-variantes-templates-e-salvamento.md §3.6): 12 modelos, borda única e o nome da variante nova.

export const MOTIVO_SEM_ESCALA_TEMPLATE = 'Defina a escala primeiro.';
const TEMPLATE_PADRAO = 'piramide';

const sequencia = () => {
  let n = 0;
  return () => `esboco-${(n += 1)}`;
};

// Esboço e total de cada modelo (borda 0, como no catálogo): calculados uma vez.
const CARTOES = TEMPLATES.map((template) => {
  const { fotos, conjunto } = aplicarTemplate({
    template,
    posicaoCm: { xCm: 0, yCm: 0 },
    borda: { larguraCm: 0, cor: '#FFFFFF' },
    novoId: sequencia(),
  });
  return { template, fotos, conjunto, total: totalDoTemplate(template) };
});

export interface EscolhaDeTemplate {
  templateId: string;
  borda: Borda;
}

export function DialogoTemplates({
  aberto,
  areaUtil,
  bordaPadrao,
  temEscala,
  nomesExistentes,
  onCancelar,
  onPosicionar,
}: {
  aberto: boolean;
  areaUtil: AreaUtil | null;
  bordaPadrao: Borda;
  temEscala: boolean;
  nomesExistentes: readonly string[];
  onCancelar: () => void;
  onPosicionar: (escolha: EscolhaDeTemplate) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent className="max-h-[calc(100vh-32px)] w-[min(960px,calc(100vw-32px))]">
        {/* A escolha e a borda nascem da borda padrão a cada abertura. */}
        <Galeria
          areaUtil={areaUtil}
          bordaPadrao={bordaPadrao}
          temEscala={temEscala}
          nomesExistentes={nomesExistentes}
          onCancelar={onCancelar}
          onPosicionar={onPosicionar}
        />
      </DialogContent>
    </Dialog>
  );
}

function Galeria({
  areaUtil,
  bordaPadrao,
  temEscala,
  nomesExistentes,
  onCancelar,
  onPosicionar,
}: {
  areaUtil: AreaUtil | null;
  bordaPadrao: Borda;
  temEscala: boolean;
  nomesExistentes: readonly string[];
  onCancelar: () => void;
  onPosicionar: (escolha: EscolhaDeTemplate) => void;
}) {
  const [escolhido, setEscolhido] = useState(TEMPLATE_PADRAO);
  const [borda, setBorda] = useState<Borda>({ larguraCm: bordaPadrao.larguraCm, cor: bordaPadrao.cor });

  const template: Template = TEMPLATES.find((t) => t.id === escolhido)!;
  const nomeNovo = nomeDoTemplateUnico(template.nome, nomesExistentes);

  // A-19: com esta borda, quantas vagas não cabem na célula do modelo escolhido.
  const vagasMaiores = useMemo(
    () =>
      aplicarTemplate({ template, posicaoCm: { xCm: 0, yCm: 0 }, borda, novoId: sequencia() }).vagasMaiores,
    [template, borda],
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Escolher template</DialogTitle>
        <DialogDescription>
          {areaUtil
            ? `Área útil da variante: ${formatarDimensao(areaUtil.larguraCm, areaUtil.alturaCm)}`
            : 'Defina a escala para usar um template.'}
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={escolhido}
        onValueChange={setEscolhido}
        aria-label="Modelos de template"
        className="grid max-h-[52vh] grid-cols-4 gap-3 overflow-y-auto px-6 pb-4"
      >
        {CARTOES.map(({ template: modelo, fotos, conjunto, total }) => {
          const maior = areaUtil !== null && maiorQueAreaUtil(total, areaUtil);
          return (
            <RadioCard key={modelo.id} value={modelo.id} className="flex flex-col gap-2 rounded-xl p-3">
              {/* DESIGN §6: o esboço cabe numa caixa `paper` de 116 px, qualquer que seja a proporção do modelo. */}
              <span className="flex h-[116px] items-center justify-center rounded-md bg-paper">
                <EsbocoVariante
                  fotos={fotos}
                  caixaCm={conjunto}
                  rotulo={`Esboço de ${modelo.nome}`}
                  decorativo
                  className="h-full w-auto max-w-full"
                />
              </span>
              <span className="font-serif text-[17px] text-ink">{modelo.nome}</span>
              <span className="flex items-center justify-between gap-2 text-xs text-ink-3">
                <span className="font-mono">{formatarDimensao(total.larguraCm, total.alturaCm)}</span>
                <span>{modelo.celulas.length} fotos</span>
              </span>
              {maior && (
                <span className="flex items-center gap-1 text-xs text-warning-ink">
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                  Maior que a área útil
                </span>
              )}
            </RadioCard>
          );
        })}
      </RadioGroup>

      <div className="flex flex-wrap items-end gap-4 border-t border-line-soft px-6 py-4">
        <CampoCmEditavel
          rotulo="Borda das fotos"
          valor={borda.larguraCm}
          sufixo="cm"
          className="w-36"
          onConfirmar={(cm) => {
            setBorda((atual) => ({
              ...atual,
              larguraCm: arredondarCm(Math.min(Math.max(cm, 0), BORDA_MAX_CM)),
            }));
            return null;
          }}
        />
        <div className="flex flex-col gap-1">
          <span className="text-label">Cor da borda</span>
          <SeletorCor valor={borda.cor} onChange={(cor) => setBorda((atual) => ({ ...atual, cor }))} />
        </div>
        <p className="min-w-0 flex-1 text-body-sm text-ink-2">Será criada a variante “{nomeNovo}”.</p>
      </div>
      {vagasMaiores > 0 && (
        <p className="px-6 pb-3 text-body-sm text-warning-ink">
          {vagasMaiores === 1
            ? 'Com esta borda, 1 vaga fica maior que o espaço do modelo e as vizinhas serão afastadas.'
            : `Com esta borda, ${vagasMaiores} vagas ficam maiores que o espaço do modelo e as vizinhas serão afastadas.`}
        </p>
      )}

      <DialogFooter>
        {!temEscala && (
          <span className="mr-auto self-center text-body-sm text-ink-3">{MOTIVO_SEM_ESCALA_TEMPLATE}</span>
        )}
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        {temEscala ? (
          <Button onClick={() => onPosicionar({ templateId: escolhido, borda })}>Posicionar na parede</Button>
        ) : (
          <BotaoInativo variant="default" motivo={MOTIVO_SEM_ESCALA_TEMPLATE}>
            Posicionar na parede
          </BotaoInativo>
        )}
      </DialogFooter>
    </>
  );
}
