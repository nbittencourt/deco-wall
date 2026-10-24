// Roteamento mínimo por caminho (M0/M1, A-01): sem biblioteca de rotas. `navegar` troca o caminho sem
// recarregar a página e avisa o App (que escuta `popstate`).
export function navegarPadrao(caminho: string): void {
  window.history.pushState({}, '', caminho);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export const caminhoDoProjeto = (id: string) => `/projetos/${id}`;
