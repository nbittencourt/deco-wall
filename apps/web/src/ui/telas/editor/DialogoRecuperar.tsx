import { EsbocoVariante } from '../../componentes/proprios/EsbocoVariante';
import { Button } from '../../componentes/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../componentes/ui/dialog';
import { textoFotos, type VistaDaVersao } from './DialogoConflito';

// Recuperação de rascunho (RF-71, SV-03, SV-07, M3-08, A-09; docs/specs/M3-variantes-templates-e-salvamento.md §3.4).
// Fechar (× ou Esc) abre a versão salva e mantém o rascunho; a pergunta volta na próxima abertura do projeto.

export function DialogoRecuperar({
  aberto,
  hora,
  desatualizado,
  revisaoRascunho,
  revisaoSalva,
  salva,
  rascunho,
  onRecuperar,
  onDescartar,
  onNovaVariante,
  onFechar,
}: {
  aberto: boolean;
  // "14:30"
  hora: string;
  // Base antiga (SV-07): a revisão oficial passou da que o rascunho conhecia.
  desatualizado: boolean;
  revisaoRascunho: number;
  revisaoSalva: number;
  salva: VistaDaVersao;
  // O conteúdo do rascunho, quando já veio do servidor (só com base antiga).
  rascunho: VistaDaVersao | null;
  onRecuperar: () => void;
  onDescartar: () => void;
  onNovaVariante: () => void;
  onFechar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className={desatualizado ? 'w-[min(720px,calc(100vw-32px))]' : undefined}>
        <DialogHeader>
          <DialogTitle>Recuperar alterações não salvas de {hora}?</DialogTitle>
          <DialogDescription>
            {desatualizado
              ? `Estas alterações foram feitas sobre a revisão ${revisaoRascunho}; a versão salva já está na revisão ${revisaoSalva}.`
              : 'O editor foi fechado antes de você salvar. Dá para continuar de onde parou.'}
          </DialogDescription>
        </DialogHeader>
        {desatualizado && (
          <div className="flex gap-3 px-6 pb-4">
            {rascunho && (
              <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border-2 border-accent bg-surface p-3">
                <EsbocoVariante fotos={rascunho.fotos} caixaCm={rascunho.caixa} rotulo="Esboço do rascunho" />
                <div>
                  <p className="font-serif text-[17px] text-ink">O rascunho</p>
                  <p className="text-xs text-ink-3">
                    {textoFotos(rascunho.qtdFotos)} · baseado na revisão {rascunho.revisao}
                  </p>
                </div>
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-line bg-surface p-3">
              <EsbocoVariante fotos={salva.fotos} caixaCm={salva.caixa} rotulo="Esboço da versão salva" />
              <div>
                <p className="font-serif text-[17px] text-ink">A salva</p>
                <p className="text-xs text-ink-3">
                  {textoFotos(salva.qtdFotos)} · revisão {salva.revisao}
                </p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onDescartar}>
            Descartar
          </Button>
          {desatualizado && (
            <Button variant="outline" onClick={onNovaVariante}>
              Salvar como nova variante
            </Button>
          )}
          <Button onClick={onRecuperar}>Recuperar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
