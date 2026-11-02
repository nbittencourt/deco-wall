import type { AreaUtil, FotoNaParede } from '@deco-wall/domain';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';
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
import { Input } from '../../componentes/ui/input';

// Diálogo de conflito de versão (RF-73, RN-26, SV-04 a SV-06, M3-09, A-14; protótipo 09; DESIGN §8;
// docs/specs/M3-variantes-templates-e-salvamento.md §3.5) e o de variante excluída em outra aba.

// Uma das duas versões, como o cartão a mostra.
export interface VistaDaVersao {
  // "às 14:35"
  rotuloHora: string;
  qtdFotos: number;
  revisao: number;
  fotos: FotoNaParede[];
  caixa: AreaUtil;
}

export const textoFotos = (n: number) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

function Cartao({
  titulo,
  destaque,
  hora,
  detalhe,
  vista,
  rotuloEsboco,
}: {
  titulo: string;
  destaque?: boolean;
  hora: string;
  detalhe: string;
  vista: VistaDaVersao;
  rotuloEsboco: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-surface p-3',
        destaque ? 'border-2 border-accent' : 'border-line',
      )}
    >
      <EsbocoVariante fotos={vista.fotos} caixaCm={vista.caixa} rotulo={rotuloEsboco} />
      <div>
        <p className="font-serif text-[17px] text-ink">{titulo}</p>
        <p className="text-xs text-ink-2">{hora}</p>
        <p className="text-xs text-ink-3">{detalhe}</p>
      </div>
    </div>
  );
}

// A-14: cada saída só é acionada depois de digitar a palavra dela e clicar no botão.
const PALAVRAS = { manter: 'minha', usar: 'salva', nova: 'nova' } as const;
type Saida = keyof typeof PALAVRAS;

export function DialogoConflito({
  aberto,
  nome,
  minha,
  salva,
  onManter,
  onUsarSalva,
  onNovaVariante,
  onFechar,
}: {
  aberto: boolean;
  nome: string;
  minha: VistaDaVersao;
  salva: VistaDaVersao | null;
  onManter: () => void;
  onUsarSalva: () => void;
  onNovaVariante: () => void;
  onFechar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="w-[min(720px,calc(100vw-32px))]">
        {/* O estado da palavra digitada nasce limpo a cada abertura. */}
        <Conteudo
          nome={nome}
          minha={minha}
          salva={salva}
          onManter={onManter}
          onUsarSalva={onUsarSalva}
          onNovaVariante={onNovaVariante}
        />
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  nome,
  minha,
  salva,
  onManter,
  onUsarSalva,
  onNovaVariante,
}: {
  nome: string;
  minha: VistaDaVersao;
  salva: VistaDaVersao | null;
  onManter: () => void;
  onUsarSalva: () => void;
  onNovaVariante: () => void;
}) {
  const [texto, setTexto] = useState('');
  const palavra = texto.trim().toLowerCase();
  const escolhida: Saida | null =
    salva === null ? null : ((Object.keys(PALAVRAS) as Saida[]).find((s) => PALAVRAS[s] === palavra) ?? null);

  const acionar = (saida: Saida) => {
    if (escolhida !== saida) return;
    if (saida === 'manter') onManter();
    else if (saida === 'usar') onUsarSalva();
    else onNovaVariante();
  };

  const botao = (saida: Saida, rotulo: string, variant: 'default' | 'outline' | 'ghost') => (
    <Button
      variant={variant}
      aria-disabled={escolhida === saida ? undefined : true}
      className={escolhida === saida ? undefined : 'opacity-50'}
      onClick={() => acionar(saida)}
    >
      {rotulo}
    </Button>
  );

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 shrink-0 text-warning-ink" aria-hidden="true" />
          <DialogTitle>Esta variante foi salva em outra aba</DialogTitle>
        </div>
        <DialogDescription>
          “{nome}” mudou desde que você a abriu. Escolha qual versão manter. O salvamento automático está
          pausado.
        </DialogDescription>
      </DialogHeader>
      <div className="flex gap-3 px-6 pb-4">
        <Cartao
          titulo="A minha"
          destaque
          hora={`${minha.rotuloHora} · esta aba`}
          detalhe={`${textoFotos(minha.qtdFotos)} · baseada na revisão ${minha.revisao}`}
          vista={minha}
          rotuloEsboco="Esboço da minha versão"
        />
        {salva ? (
          <Cartao
            titulo="A salva"
            hora={`${salva.rotuloHora} · outra aba`}
            detalhe={`${textoFotos(salva.qtdFotos)} · revisão ${salva.revisao}`}
            vista={salva}
            rotuloEsboco="Esboço da versão salva"
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-line bg-surface-muted p-3">
            <p className="text-body-sm text-ink-3">Carregando a versão salva…</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-6 pb-5">
        <label htmlFor="palavra-conflito" className="text-label">
          Para confirmar, digite a palavra da opção
        </label>
        <Input
          id="palavra-conflito"
          value={texto}
          autoComplete="off"
          placeholder="minha · salva · nova"
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            if (escolhida) acionar(escolhida);
          }}
        />
        <p className="text-xs text-ink-3">
          “minha” mantém a sua versão, “salva” usa a que está salva e “nova” guarda a sua como nova variante.
        </p>
      </div>
      <DialogFooter>
        {botao('usar', 'Usar a salva', 'ghost')}
        {botao('nova', 'Salvar a minha como nova variante', 'outline')}
        {botao('manter', 'Manter a minha', 'default')}
      </DialogFooter>
    </>
  );
}

// M3-09: 404 ao salvar. Não sobrescreve nenhuma versão salva, então não pede a palavra.
export function DialogoVarianteExcluida({
  aberto,
  nome,
  onNova,
  onDescartar,
}: {
  aberto: boolean;
  nome: string;
  onNova: () => void;
  onDescartar: () => void;
}) {
  return (
    <Dialog open={aberto}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Esta variante foi excluída em outra aba.</DialogTitle>
          <DialogDescription>
            “{nome}” não existe mais. Guarde o que você fez como nova variante ou descarte as alterações.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onDescartar}>
            Descartar
          </Button>
          <Button onClick={onNova}>Salvar como nova variante</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
