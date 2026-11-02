import { useState } from 'react';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { urlArquivoImagem } from '../../../infra/clienteApi';
import { Alert } from '../../componentes/ui/alert';
import { Button } from '../../componentes/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../componentes/ui/dialog';
import { RadioCard, RadioGroup } from '../../componentes/ui/radio-group';
import { cn } from '../../../lib/utils';

// Diálogo "Remover ou excluir" (RF-29, RN-24, M4-03 a M4-05, A-02, A-04, A-06; protótipo 08;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §3.1). Lê tudo da store; abre com as associações já carregadas.

type Acao = 'remover' | 'excluir';

export function DialogoImagem() {
  const dialogo = useEditor((s) => s.ui.dialogoImagem);
  if (!dialogo) return null;
  // O conteúdo só existe com o diálogo aberto: a opção escolhida nasce limpa a cada abertura.
  return <DialogoImagemAberto key={dialogo.imagemId} />;
}

function DialogoImagemAberto() {
  const store = useStoreEditor();
  const dialogo = useEditor((s) => s.ui.dialogoImagem)!;
  const projeto = useEditor((s) => s.documento.projeto)!;
  const associacoes = dialogo.associacoes;
  const nome = associacoes?.imagem.nomeOriginal ?? 'Imagem';

  // A-02: "Remover" fica inativo se o projeto aberto não tem a imagem; então a opção que vale é a outra.
  const noProjeto = associacoes === null || associacoes.projetos.some((p) => p.projetoId === projeto._id);
  const [escolha, setEscolha] = useState<Acao>('remover');
  const acao: Acao = noProjeto ? escolha : 'excluir';
  const [ocupado, setOcupado] = useState(false);

  const usos = associacoes?.usos ?? [];
  const total = usos.reduce((soma, u) => soma + u.vezes, 0);

  const confirmar = async () => {
    setOcupado(true);
    try {
      if (acao === 'remover') await store.getState().removerImagemDoProjeto(dialogo.imagemId);
      else await store.getState().excluirImagem(dialogo.imagemId);
    } catch {
      // A mensagem fica na store (`dialogoImagem.erro`) e aparece aqui; o diálogo continua aberto.
    } finally {
      setOcupado(false);
    }
  };
  const fechar = () => store.getState().fecharDialogoImagem();

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && fechar()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <img
              src={urlArquivoImagem(dialogo.imagemId, 'thumb')}
              alt=""
              draggable={false}
              className="size-[52px] shrink-0 rounded-[6px] bg-sand object-cover ring-1 ring-line-soft"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="truncate">{nome}</DialogTitle>
              <DialogDescription>O que deseja fazer com esta imagem?</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <RadioGroup value={acao} onValueChange={(valor) => setEscolha(valor as Acao)}>
            <RadioCard value="remover" disabled={!noProjeto} className={cn(!noProjeto && 'opacity-60')}>
              <span className="block text-sm font-medium text-ink">Remover deste projeto</span>
              <span className="block text-body-sm text-ink-2">
                Sai das variantes de {projeto.nome}. Continua na biblioteca.
              </span>
              {!noProjeto && (
                <span className="block text-body-sm text-ink-3">Esta imagem não está neste projeto.</span>
              )}
            </RadioCard>
            <RadioCard
              value="excluir"
              className={cn(
                acao === 'excluir' &&
                  'border-danger bg-danger-wash data-[state=checked]:border-danger data-[state=checked]:bg-danger-wash',
              )}
            >
              <span className="block text-sm font-medium text-ink">Excluir da biblioteca</span>
              <span className="block text-body-sm text-ink-2">
                Fica em Excluídas por 30 dias e pode ser restaurada. Nas composições, o espaço da foto é
                mantido sem imagem.
              </span>
            </RadioCard>
          </RadioGroup>

          {associacoes && (
            <div className="flex flex-col gap-2">
              {usos.length > 0 ? (
                <>
                  <span className="text-label">Usada em {total === 1 ? '1 lugar' : `${total} lugares`}</span>
                  <div
                    className={cn(
                      'rounded-lg border border-line-soft',
                      usos.length > 5 && 'max-h-[216px] overflow-y-auto',
                    )}
                  >
                    <table className="w-full text-body-sm">
                      <thead>
                        <tr className="text-left text-ink-3">
                          <th className="px-3 py-2 font-medium">Projeto</th>
                          <th className="px-3 py-2 font-medium">Variante</th>
                          <th className="px-3 py-2 text-right font-medium">Vezes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usos.map((uso) => (
                          <tr key={uso.varianteId} className="border-t border-line-soft">
                            <td className="px-3 py-2 text-ink">{uso.projetoNome}</td>
                            <td className="px-3 py-2 text-ink">{uso.varianteNome}</td>
                            <td className="px-3 py-2 text-right font-mono text-medida text-ink">
                              {uso.vezes}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-body-sm text-ink-2">
                    O histórico de desfazer das variantes afetadas será zerado.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-body-sm text-ink-2">Não está em nenhuma variante.</p>
                  {associacoes.projetos.length > 0 && (
                    <p className="text-body-sm text-ink-3">
                      Carregada em: {associacoes.projetos.map((p) => p.projetoNome).join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {dialogo.erro && <Alert variant="alerta">{dialogo.erro}</Alert>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            variant={acao === 'excluir' ? 'destructive' : 'default'}
            disabled={ocupado}
            onClick={() => void confirmar()}
          >
            {acao === 'excluir' ? 'Excluir imagem' : 'Remover do projeto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
