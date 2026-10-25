import { useEffect, useRef } from 'react';

// Enter confirma e Esc cancela o modo (spec M1 §3.4 a §3.6). Enter dentro de um campo é do campo.
export function useAtalhosDoModo(opcoes: {
  podeConfirmar: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const atual = useRef(opcoes);
  useEffect(() => {
    atual.current = opcoes;
  });

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        atual.current.onCancelar();
        return;
      }
      if (evento.key !== 'Enter') return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(alvo.tagName)) return;
      if (!atual.current.podeConfirmar) return;
      evento.preventDefault();
      atual.current.onConfirmar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
}
