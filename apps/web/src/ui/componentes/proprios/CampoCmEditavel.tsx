import { arredondarCm, formatarCm, lerCm } from '@deco-wall/domain';
import { useState, type KeyboardEvent } from 'react';
import { CampoCm } from './CampoCm';

// Campo em cm que aplica ao sair do campo ou em Enter (B-04, padrão do CamposAreaUtil): cada aplicação é um
// passo do desfazer. `onConfirmar` devolve a mensagem de erro (valor fora da faixa) ou null quando aplicou.
export function CampoCmEditavel({
  rotulo,
  valor,
  onConfirmar,
  prefixo,
  sufixo,
  rotuloOculto,
  className,
}: {
  rotulo: string;
  valor: number;
  onConfirmar: (valorCm: number) => string | null;
  prefixo?: string;
  sufixo?: string;
  rotuloOculto?: boolean;
  className?: string;
}) {
  const [texto, setTexto] = useState(formatarCm(valor));
  const [erro, setErro] = useState<string | undefined>();

  // O texto acompanha o valor quando ele muda por fora (desfazer, arrastar a foto, trocar de seleção).
  const [valorVisto, setValorVisto] = useState(valor);
  if (valorVisto !== valor) {
    setValorVisto(valor);
    setTexto(formatarCm(valor));
    setErro(undefined);
  }

  const aplicar = () => {
    if (texto === formatarCm(valor)) {
      setErro(undefined);
      return;
    }
    const lido = lerCm(texto);
    if (lido === null) {
      setErro('Digite um número em cm.');
      return;
    }
    const resposta = onConfirmar(lido);
    if (resposta) {
      setErro(resposta);
      return;
    }
    setErro(undefined);
    setTexto(formatarCm(arredondarCm(lido)));
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      evento.stopPropagation();
      aplicar();
    } else if (evento.key === 'Escape') {
      // Esc devolve o valor atual sem sair do modo.
      setTexto(formatarCm(valor));
      setErro(undefined);
    }
  };

  return (
    <CampoCm
      rotulo={rotulo}
      valor={texto}
      erro={erro}
      prefixo={prefixo}
      sufixo={sufixo}
      rotuloOculto={rotuloOculto}
      className={className}
      onChange={setTexto}
      onBlur={aplicar}
      onKeyDown={aoTeclar}
    />
  );
}
