import { formatarHora, formatarHoraMinuto, type AreaUtil, type FotoNaParede } from '@deco-wall/domain';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { dadosDaParede } from './cenas';
import { DialogoConflito, DialogoVarianteExcluida, type VistaDaVersao } from './DialogoConflito';
import { DialogoRecuperar } from './DialogoRecuperar';

// Diálogos que podem aparecer em qualquer modo do editor (spec M3 §3.4, §3.5): conflito de versão, variante excluída
// em outra aba e recuperação de rascunho. Leem tudo da store.

const CAIXA_PADRAO: AreaUtil = { xCm: 0, yCm: 0, larguraCm: 100, alturaCm: 100 };

export function DialogosGlobais() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto);
  const variante = useEditor((s) => s.documento.variante);
  const conteudo = useEditor((s) => s.conteudo);
  const salvo = useEditor((s) => s.documento.salvo);
  const revisaoBase = useEditor((s) => s.documento.revisaoBase);
  const alteradoEm = useEditor((s) => s.documento.alteradoEm);
  const conflito = useEditor((s) => s.documento.conflito);
  const dialogoConflito = useEditor((s) => s.ui.dialogoConflito);
  const recuperacao = useEditor((s) => s.ui.recuperacao);
  if (!projeto || !variante || !conteudo) return null;

  const caixa = dadosDaParede(projeto).interior ?? CAIXA_PADRAO;
  const vista = (fotos: FotoNaParede[], revisao: number, rotuloHora: string): VistaDaVersao => ({
    rotuloHora,
    qtdFotos: fotos.length,
    revisao,
    fotos,
    caixa,
  });

  const conflitoDaVariante = conflito?.origem === 'variante' ? conflito : null;

  return (
    <>
      {conflitoDaVariante && !conflitoDaVariante.excluida && (
        <DialogoConflito
          aberto={dialogoConflito}
          nome={variante.nome}
          minha={vista(conteudo.fotos, revisaoBase, formatarHora(alteradoEm ?? new Date()))}
          salva={
            conflitoDaVariante.salva
              ? vista(
                  conflitoDaVariante.salva.fotos,
                  conflitoDaVariante.salva.revisao,
                  formatarHora(new Date(conflitoDaVariante.salva.salvaEm)),
                )
              : null
          }
          onManter={() =>
            void store
              .getState()
              .resolverConflito('manter')
              .catch(() => undefined)
          }
          onUsarSalva={() => void store.getState().resolverConflito('usar-salva')}
          onNovaVariante={() => void store.getState().resolverConflito('nova-variante')}
          onFechar={() => store.getState().fecharDialogoConflito()}
        />
      )}
      {conflitoDaVariante?.excluida && (
        <DialogoVarianteExcluida
          aberto={dialogoConflito}
          nome={variante.nome}
          onNova={() => void store.getState().resolverVarianteExcluida('nova')}
          onDescartar={() => void store.getState().resolverVarianteExcluida('descartar')}
        />
      )}
      {recuperacao && salvo && (
        <DialogoRecuperar
          aberto
          hora={formatarHoraMinuto(recuperacao.salvoEm)}
          desatualizado={recuperacao.desatualizado}
          revisaoRascunho={recuperacao.revisaoBase}
          revisaoSalva={variante.revisao}
          salva={vista(salvo.conteudo.fotos, variante.revisao, '')}
          rascunho={
            recuperacao.previa
              ? vista(recuperacao.previa.fotos, recuperacao.revisaoBase, formatarHora(recuperacao.salvoEm))
              : null
          }
          onRecuperar={() => void store.getState().recuperarRascunho()}
          onDescartar={() => void store.getState().descartarRascunhoOferecido()}
          onNovaVariante={() => void store.getState().recuperarComoNovaVariante()}
          onFechar={() => store.getState().fecharRecuperacao()}
        />
      )}
    </>
  );
}
