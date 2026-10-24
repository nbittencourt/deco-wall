import { validarNomeProjeto } from '@deco-wall/domain';
import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/input';

// A-02: o nome do projeto no header é editável no lugar: clicar abre o campo, Enter grava, Esc cancela.
export function NomeProjeto({
  nome,
  onRenomear,
}: {
  nome: string;
  onRenomear: (nome: string) => void | Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nome);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  // O navegador pode disparar blur ao remover o campo: depois de Enter/Esc, o blur não grava de novo.
  const encerrado = useRef(false);

  useEffect(() => {
    if (editando) campo.current?.select();
  }, [editando]);

  const abrir = () => {
    encerrado.current = false;
    setTexto(nome);
    setErro(null);
    setEditando(true);
  };

  const cancelar = () => {
    encerrado.current = true;
    setEditando(false);
    setErro(null);
  };

  const gravar = async () => {
    if (encerrado.current) return;
    const resultado = validarNomeProjeto(texto);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    if (resultado.nome === nome) {
      cancelar();
      return;
    }
    try {
      encerrado.current = true;
      await onRenomear(resultado.nome);
      cancelar();
    } catch (falha) {
      encerrado.current = false;
      setErro(falha instanceof Error ? falha.message : 'Não foi possível renomear.');
    }
  };

  return (
    <h1 className="relative flex min-w-0 flex-col text-display-sm text-ink">
      {editando ? (
        <>
          <Input
            ref={campo}
            aria-label="Nome do projeto"
            aria-invalid={erro ? true : undefined}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                void gravar();
              } else if (evento.key === 'Escape') {
                evento.preventDefault();
                evento.stopPropagation();
                cancelar();
              }
            }}
            onBlur={() => void gravar()}
            className="h-8 w-[200px] font-display text-[18px]"
          />
          {erro && (
            <span
              role="alert"
              className="absolute top-full mt-1 rounded-sm bg-danger-tint px-2 py-1 font-sans text-xs text-danger-ink-strong"
            >
              {erro}
            </span>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={abrir}
          title="Renomear projeto"
          className="max-w-[120px] cursor-pointer truncate rounded-sm px-1 text-left hover:bg-sand"
        >
          {nome}
        </button>
      )}
    </h1>
  );
}
