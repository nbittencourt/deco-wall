import { useSyncExternalStore } from 'react';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { DevUi } from './DevUi';
import { Editor } from './Editor';
import { Projetos } from './Projetos';
import { SpikeKonva } from './SpikeKonva';

// Roteamento mínimo do M0: três caminhos, sem biblioteca de rotas.
function caminhoAtual(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function inscrever(aoMudar: () => void): () => void {
  window.addEventListener('popstate', aoMudar);
  return () => window.removeEventListener('popstate', aoMudar);
}

export function App() {
  const caminho = useSyncExternalStore(inscrever, caminhoAtual, () => '/');

  let tela = <Projetos />;
  if (caminho === '/editor') tela = <Editor />;
  if (caminho === '/dev/ui') tela = <DevUi />;
  if (caminho === '/dev/spike-konva') tela = <SpikeKonva />;

  return <TooltipProvider delayDuration={200}>{tela}</TooltipProvider>;
}
