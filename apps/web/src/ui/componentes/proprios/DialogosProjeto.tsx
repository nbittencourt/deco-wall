import { validarNomeProjeto } from '@deco-wall/domain';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';

// Diálogos do M1: renomear e excluir projeto (§3.1), sair sem salvar (A-20), trocar a parede (M1-05).
// Tamanho 640 px, rodapé com ações à direita: fantasma → secundário → primário (DESIGN §6).

interface PropsBase {
  aberto: boolean;
  onCancelar: () => void;
}

export function DialogoRenomearProjeto({
  aberto,
  nomeAtual,
  onConfirmar,
  onCancelar,
}: PropsBase & { nomeAtual: string; onConfirmar: (nome: string) => void | Promise<void> }) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        {/* O conteúdo só existe com o diálogo aberto: o estado do formulário nasce limpo a cada abertura. */}
        <FormularioRenomear nomeAtual={nomeAtual} onConfirmar={onConfirmar} onCancelar={onCancelar} />
      </DialogContent>
    </Dialog>
  );
}

function FormularioRenomear({
  nomeAtual,
  onConfirmar,
  onCancelar,
}: {
  nomeAtual: string;
  onConfirmar: (nome: string) => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(nomeAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);

  const confirmar = async () => {
    const resultado = validarNomeProjeto(texto);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setOcupado(true);
    try {
      await onConfirmar(resultado.nome);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível renomear.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Renomear projeto</DialogTitle>
        <DialogDescription>Os nomes podem se repetir.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5 px-6 pb-6">
        <label htmlFor="nome-projeto-dialogo" className="text-label">
          Nome do projeto
        </label>
        <Input
          ref={campo}
          id="nome-projeto-dialogo"
          value={texto}
          aria-invalid={erro ? true : undefined}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              void confirmar();
            }
          }}
        />
        {erro && <p className="text-xs text-danger-ink">{erro}</p>}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={() => void confirmar()} disabled={ocupado}>
          Renomear
        </Button>
      </DialogFooter>
    </>
  );
}

export function DialogoExcluirProjeto({
  aberto,
  nome,
  onConfirmar,
  onCancelar,
}: PropsBase & { nome: string; onConfirmar: () => void | Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  const confirmar = async () => {
    setOcupado(true);
    try {
      await onConfirmar();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Excluir “${nome}”?`}</DialogTitle>
          <DialogDescription>
            As variantes e a foto da parede deste projeto serão apagadas. As fotos da biblioteca continuam
            disponíveis.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={ocupado}>
            Excluir projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogoSairSemSalvar({
  aberto,
  onSalvarESair,
  onSairSemSalvar,
  onCancelar,
}: PropsBase & { onSalvarESair: () => void; onSairSemSalvar: () => void }) {
  const primario = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          primario.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Sair sem salvar?</DialogTitle>
          <DialogDescription>Há alterações da variante que ainda não foram salvas.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={onSairSemSalvar}>
            Sair sem salvar
          </Button>
          <Button ref={primario} onClick={onSalvarESair}>
            Salvar e sair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DialogoTrocarParede({
  aberto,
  onConfirmar,
  onCancelar,
}: PropsBase & { onConfirmar: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar a foto da parede?</DialogTitle>
          <DialogDescription>A escala e a área útil serão descartadas.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar}>Trocar parede</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
