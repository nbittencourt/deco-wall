import { lazy, Suspense, useSyncExternalStore } from 'react';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Projetos } from './Projetos';

// M4-15, A-24: o editor (Konva, bson) e a referência visual são chunks próprios, baixados só nas rotas deles.
const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })));
const DevUi = lazy(() => import('./DevUi').then((m) => ({ default: m.DevUi })));

// Esqueleto de página enquanto o chunk da rota chega (localhost: alguns milissegundos).
function CarregandoPagina() {
  return (
    <div role="status" className="flex h-dvh items-center justify-center text-body-sm text-ink-3">
      Carregando…
    </div>
  );
}

// Roteamento mínimo por caminho (A-01), sem biblioteca de rotas: `/` = Projetos, `/projetos/<id>` = Editor e
// `/projetos/<id>/comparar` = Comparação.
// `/dev/ui` continua (referência visual do M0). `/editor` e o spike do Konva saíram.
function caminhoAtual(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function inscrever(aoMudar: () => void): () => void {
  window.addEventListener('popstate', aoMudar);
  return () => window.removeEventListener('popstate', aoMudar);
}

// `/projetos/<id>/comparar` usa a mesma store do editor (M3, A-26): a chave é só o id do projeto.
const ROTA_PROJETO = /^\/projetos\/([0-9a-f]{24})(\/comparar)?$/;

export function App() {
  const caminho = useSyncExternalStore(inscrever, caminhoAtual, () => '/');

  let tela = <Projetos />;
  const projeto = ROTA_PROJETO.exec(caminho);
  if (projeto) {
    tela = <Editor key={projeto[1]} projetoId={projeto[1]!} tela={projeto[2] ? 'comparar' : 'editor'} />;
  }
  if (caminho === '/dev/ui') tela = <DevUi />;

  return (
    <TooltipProvider delayDuration={200}>
      <Suspense fallback={<CarregandoPagina />}>{tela}</Suspense>
    </TooltipProvider>
  );
}
