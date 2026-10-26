import {
  formatarCm,
  formatarDimensao,
  formatarTamanho,
  LIMITE_PERSONALIZADO_CM,
  orientacaoDe,
  tamanhoExterno,
  tamanhoPersonalizado,
  tamanhoSugerido,
  validarLadoPersonalizado,
  type Borda,
  type Tamanho,
} from '@deco-wall/domain';
import { CampoCmEditavel } from '../componentes/proprios/CampoCmEditavel';
import { SeletorTamanho, VALOR_PERSONALIZADO } from '../componentes/proprios/SeletorTamanho';
import { Button } from '../componentes/ui/button';

// Painel do modo de recorte (RN-14, RN-28; DESIGN §7.0, protótipo 16). Tudo é rascunho até "Concluir".

export interface PropsPainelRecorte {
  tamanho: Tamanho;
  borda: Borda;
  // Mostra os campos Largura × Altura (tamanho personalizado — RN-28).
  personalizado: boolean;
  onTamanho: (tamanho: Tamanho) => void;
  onPersonalizado: () => void;
  onConcluir: () => void;
  onCancelar: () => void;
}

export function PainelRecorte({
  tamanho,
  borda,
  personalizado,
  onTamanho,
  onPersonalizado,
  onConcluir,
  onCancelar,
}: PropsPainelRecorte) {
  const externo = tamanhoExterno(tamanho, borda);
  const orientacao = orientacaoDe(tamanho);
  const { min, max } = LIMITE_PERSONALIZADO_CM;

  // Largura e altura mudam uma de cada vez; a outra mantém o valor atual (RN-28).
  const aplicarLado = (lado: 'larguraCm' | 'alturaCm', cm: number): string | null => {
    const erro = validarLadoPersonalizado(cm);
    if (erro) return erro;
    const novo = tamanhoPersonalizado(
      lado === 'larguraCm' ? cm : tamanho.larguraCm,
      lado === 'alturaCm' ? cm : tamanho.alturaCm,
    );
    if (!novo.ok) return novo.erro;
    onTamanho(novo.tamanho);
    return null;
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <h2 className="text-display-md text-ink">Ajustar recorte</h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Tamanho</span>
        <SeletorTamanho
          valor={personalizado ? VALOR_PERSONALIZADO : (tamanho.sugeridoId ?? VALOR_PERSONALIZADO)}
          texto={personalizado ? 'Personalizado' : `${formatarTamanho(tamanho)} cm`}
          onEscolherSugerido={(id) => {
            onTamanho(tamanhoSugerido(id, orientacao === 'paisagem' ? 'paisagem' : 'retrato'));
          }}
          onPersonalizado={onPersonalizado}
        />
      </div>

      {personalizado && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <CampoCmEditavel
              rotulo="Largura"
              valor={tamanho.larguraCm}
              onConfirmar={(cm) => aplicarLado('larguraCm', cm)}
            />
            <span className="pb-2 font-mono text-medida text-ink-3">×</span>
            <CampoCmEditavel
              rotulo="Altura"
              valor={tamanho.alturaCm}
              onConfirmar={(cm) => aplicarLado('alturaCm', cm)}
            />
          </div>
          <span className="text-xs text-ink-3">
            Entre <span className="font-mono">{formatarCm(min)}</span> e{' '}
            <span className="font-mono">{formatarCm(max)}</span> cm em cada lado.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg bg-paper p-3">
        <span className="text-body-sm text-ink-2">Tamanho externo</span>
        <span className="font-mono text-medida font-medium text-ink">
          {formatarDimensao(externo.larguraCm, externo.alturaCm)}
        </span>
      </div>

      <p className="text-body-sm text-ink-2">
        A foto sempre preenche o quadro. Arraste a imagem para escolher a parte que aparece.
      </p>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={onConcluir}>
          Concluir
        </Button>
      </div>
    </div>
  );
}
