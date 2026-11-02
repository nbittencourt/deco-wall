import { NOME_VARIANTE_MAX } from '@deco-wall/domain';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../componentes/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../componentes/ui/dialog';
import { Input } from '../../componentes/ui/input';

// Diálogos de variante (A-02, A-12; docs/specs/M3-variantes-templates-e-salvamento.md §3.1, §3.2). 640 px,
// rodapé fantasma → secundário → primário (DESIGN §6), como os de projeto (M1 §3.1).

function validarNome(texto: string): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = texto.trim();
  if (nome === '') return { ok: false, erro: 'Informe um nome para a variante.' };
  if (nome.length > NOME_VARIANTE_MAX) {
    return { ok: false, erro: `O nome pode ter até ${NOME_VARIANTE_MAX} caracteres.` };
  }
  return { ok: true, nome };
}

interface PropsNome {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  rotuloConfirmar: string;
  nomeInicial: string;
  onConfirmar: (nome: string) => void | Promise<void>;
  onCancelar: () => void;
}

// Nova variante, Duplicar e Renomear: o mesmo diálogo, com o nome sugerido já selecionado.
export function DialogoNomeVariante({ aberto, onCancelar, ...resto }: PropsNome) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        {/* O conteúdo só existe com o diálogo aberto: o formulário nasce limpo a cada abertura. */}
        <FormularioNome onCancelar={onCancelar} {...resto} />
      </DialogContent>
    </Dialog>
  );
}

function FormularioNome({
  titulo,
  descricao = 'Os nomes podem se repetir.',
  rotuloConfirmar,
  nomeInicial,
  onConfirmar,
  onCancelar,
}: Omit<PropsNome, 'aberto'>) {
  const [texto, setTexto] = useState(nomeInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campo.current?.focus();
    campo.current?.select();
  }, []);

  const confirmar = async () => {
    const resultado = validarNome(texto);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setOcupado(true);
    try {
      await onConfirmar(resultado.nome);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5 px-6 pb-6">
        <label htmlFor="nome-variante-dialogo" className="text-label">
          Nome da variante
        </label>
        <Input
          ref={campo}
          id="nome-variante-dialogo"
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
          {rotuloConfirmar}
        </Button>
      </DialogFooter>
    </>
  );
}

// A exclusão é física e sem desfazer (A-02): o texto diz o que se perde e que a biblioteca continua.
export function DialogoExcluirVariante({
  aberto,
  nome,
  naoSalva,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  nome: string;
  naoSalva: boolean;
  onConfirmar: () => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível excluir.');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir variante</DialogTitle>
          <DialogDescription>
            A variante “{nome}” e as fotos posicionadas nela serão apagadas. As imagens da biblioteca
            continuam disponíveis.
          </DialogDescription>
          {naoSalva && <p className="text-body-sm text-ink-2">Ela tem alterações não salvas.</p>}
          {erro && <p className="text-xs text-danger-ink">{erro}</p>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={ocupado}>
            Excluir variante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A-12: antes de deixar a ativa com alterações não salvas (trocar, criar, duplicar, iniciar um template).
export function DialogoDecisao({
  aberto,
  nome,
  ocupado = false,
  onSalvar,
  onDescartar,
  onCancelar,
}: {
  aberto: boolean;
  nome: string;
  ocupado?: boolean;
  onSalvar: () => void;
  onDescartar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onCancelar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar as alterações de “{nome}”?</DialogTitle>
          <DialogDescription>
            Há alterações não salvas. Salve para guardá-las ou descarte para voltar à versão salva.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant="ghost" className="text-danger-ink" onClick={onDescartar} disabled={ocupado}>
            Descartar alterações
          </Button>
          <Button onClick={onSalvar} disabled={ocupado}>
            Salvar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
