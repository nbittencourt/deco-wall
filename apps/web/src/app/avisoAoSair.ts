import { useEffect } from 'react';

// SV-08: o navegador pergunta antes de fechar ou recarregar a aba com alterações sem hard save.
export function useAvisoAoSair(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return undefined;
    const aoSair = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      // Navegadores antigos exigem returnValue para mostrar a pergunta.
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [ativo]);
}
