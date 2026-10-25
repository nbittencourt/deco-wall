import { useSyncExternalStore } from 'react';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { DevUi } from './DevUi';
import { Editor } from './Editor';
import { Projetos } from './Projetos';

// Roteamento mínimo por caminho (A-01), sem biblioteca de rotas: `/` = Projetos, `/projetos/<id>` = Editor.
// `/dev/ui` continua (referência visual do M0). `/editor` e o spike do Konva saíram.
function caminhoAtual(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function inscrever(aoMudar: () => void): () => void {
  window.addEventListener('popstate', aoMudar);
  return () => window.removeEventListener('popstate', aoMudar);
}

const ROTA_PROJETO = /^\/projetos\/([0-9a-f]{24})$/;

export function App() {
  const caminho = useSyncExternalStore(inscrever, caminhoAtual, () => '/');

  let tela = <Projetos />;
  const projeto = ROTA_PROJETO.exec(caminho);
  if (projeto) tela = <Editor key={projeto[1]} projetoId={projeto[1]!} />;
  if (caminho === '/dev/ui') tela = <DevUi />;

  return <TooltipProvider delayDuration={200}>{tela}</TooltipProvider>;
}
