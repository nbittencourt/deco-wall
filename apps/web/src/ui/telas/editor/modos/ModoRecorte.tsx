import { Crop } from 'lucide-react';
import { useEditor, useStoreEditor, useVistaDaVariante } from '../../../../app/StoreContext';
import { Palco } from '../../../canvas/Palco';
import { PainelRecorte } from '../../../paineis/PainelRecorte';
import { cenaDaParede, cenaDoRecorte } from '../cenas';
import { LayoutModo } from './LayoutModo';
import { useAtalhosDoModo } from './atalhos';

// Modo de recorte (RN-14, RN-28; DESIGN §7.0; protótipo 16). A barra só identifica o modo; as ações ficam
// no painel. O tamanho e o recorte são um rascunho até "Concluir" (1 passo do desfazer).
export function ModoRecorte() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const variante = useVistaDaVariante();
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const rascunho = useEditor((s) => s.ui.recorte);

  const concluir = () => store.getState().concluirRecorte();
  const cancelar = () => store.getState().cancelarRecorte();
  useAtalhosDoModo({ podeConfirmar: rascunho !== null, onConfirmar: concluir, onCancelar: cancelar });

  const base = cenaDaParede(projeto, variante, imagens);
  const foto = base.fotos.find((f) => f.id === rascunho?.fotoId);
  const original = variante.fotos.find((f) => f._id === rascunho?.fotoId);
  if (!rascunho || !foto || !original) return null;

  const cena = cenaDoRecorte(base, {
    foto,
    tamanho: rascunho.tamanho,
    offset: rascunho.offset,
    onOffsetChange: (offset) => store.getState().atualizarRecorte({ offset }),
  });

  return (
    <LayoutModo
      fundo="claro"
      barra={
        <header className="flex h-14 shrink-0 items-center gap-3 bg-ink px-4 text-white">
          <Crop className="size-5 text-accent-on-dark" aria-hidden="true" />
          <span className="min-w-0 truncate text-display-sm whitespace-nowrap">
            Ajustar recorte · {foto.nome}
          </span>
          <span className="truncate text-body-sm text-white/70">
            O restante da parede fica bloqueado até concluir
          </span>
        </header>
      }
      palco={<Palco cena={cena} />}
      painel={
        <PainelRecorte
          tamanho={rascunho.tamanho}
          borda={original.borda}
          personalizado={rascunho.personalizado}
          onTamanho={(tamanho) => store.getState().atualizarRecorte({ tamanho })}
          onPersonalizado={() => store.getState().atualizarRecorte({ personalizado: true })}
          onConcluir={concluir}
          onCancelar={cancelar}
        />
      }
    />
  );
}
