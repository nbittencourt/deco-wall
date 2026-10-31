import {
  formatarBytes,
  MENSAGEM_FORMATO_NAO_SUPORTADO,
  PERFIL_PADRAO,
  PERFIS,
  type Perfil,
} from '@deco-wall/domain';
import { FolderOpen, ImagePlus } from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type ChangeEvent, type DragEvent } from 'react';
import { arrastandoArquivos, lerArquivosSoltos } from '../../../app/arquivosSoltos';
import { useStoreEditor } from '../../../app/StoreContext';
import { criarLoteUpload, type ItemUpload } from '../../../app/uploadLote';
import { urlArquivoImagem } from '../../../infra/clienteApi';
import type { ClienteApi } from '../../../infra/dto';
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

// Diálogo "Carregar fotos" (protótipo 07; spec M2 §3.2; RF-20, RF-21, RF-25, DV-10, A-17, A-18). Selecionar
// arquivos, selecionar pasta ou arrastar para o diálogo inicia o envio na hora, com a qualidade já escolhida.
// Só os arquivos soltos sobre a Biblioteca abrem o diálogo "Aguardando", com o botão Enviar.

const PERFIS_NA_TELA: { perfil: Perfil; nome: string }[] = [
  { perfil: 'leve', nome: 'Leve' },
  { perfil: 'medio', nome: 'Médio' },
  { perfil: 'alto', nome: 'Alto' },
];

export interface PropsDialogoUpload {
  aberto: boolean;
  onFechar: () => void;
  projetoId: string;
  api: ClienteApi;
  arquivosIniciais?: File[];
}

export function DialogoUpload({ aberto, ...resto }: PropsDialogoUpload) {
  // O conteúdo só existe com o diálogo aberto: cada abertura começa com um lote novo.
  return aberto ? <ConteudoUpload {...resto} /> : null;
}

function ConteudoUpload({
  onFechar,
  projetoId,
  api,
  arquivosIniciais = [],
}: Omit<PropsDialogoUpload, 'aberto'>) {
  const store = useStoreEditor();
  const [lote] = useState(() => {
    const novo = criarLoteUpload({
      perfil: PERFIL_PADRAO,
      // A-28: o limite vem do servidor e pode chegar depois de o editor abrir.
      limiteMb: () => store.getState().config.uploadMaxMb,
      iniciarNaHora: true,
      enviar: (arquivo, perfil, opcoes) => api.enviarImagem({ arquivo, perfil, projetoId }, opcoes),
      aoConcluir: (imagem) => store.getState().adotarImagem(imagem),
    });
    // Arquivos soltos sobre a Biblioteca esperam o "Enviar" (A-17).
    if (arquivosIniciais.length > 0) novo.adicionar(arquivosIniciais, { iniciar: false });
    return novo;
  });
  const estado = useSyncExternalStore(lote.assinar, lote.estado);
  const [confirmando, setConfirmando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const entradaArquivos = useRef<HTMLInputElement>(null);
  const entradaPasta = useRef<HTMLInputElement>(null);

  const aguardando = estado.itens.filter((i) => i.status === 'aguardando').length;
  const podeEnviar = !estado.iniciado && aguardando > 0;
  const fracao =
    estado.total === 0
      ? 0
      : estado.itens.reduce((soma, i) => soma + (i.status === 'concluida' ? 1 : i.progresso), 0) /
        estado.total;

  const aoEscolher = (evento: ChangeEvent<HTMLInputElement>) => {
    lote.adicionar(Array.from(evento.target.files ?? []), { iniciar: true });
    evento.target.value = ''; // permite escolher os mesmos arquivos de novo
  };

  const aoSoltar = (evento: DragEvent) => {
    if (!arrastandoArquivos(evento.dataTransfer)) return;
    evento.preventDefault();
    setSobre(false);
    void lerArquivosSoltos(evento.dataTransfer).then((arquivos) =>
      lote.adicionar(arquivos, { iniciar: true }),
    );
  };

  // Esc, clique fora e "Concluir" passam pela mesma pergunta quando ainda há envio em andamento.
  const pedirFechar = () => {
    if (estado.enviando) setConfirmando(true);
    else onFechar();
  };

  const ignoradosPorFormato = estado.ignorados.filter(
    (i) => i.motivo === MENSAGEM_FORMATO_NAO_SUPORTADO,
  ).length;
  const textoIgnorados =
    estado.ignorados.length === 0
      ? null
      : `${estado.ignorados.length} ${estado.ignorados.length === 1 ? 'arquivo ignorado' : 'arquivos ignorados'} ${
          ignoradosPorFormato === estado.ignorados.length ? 'por formato' : '(formato ou tamanho)'
        }`;

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && pedirFechar()}>
      <DialogContent>
        <div
          onDragOver={(e) => {
            if (!arrastandoArquivos(e.dataTransfer)) return;
            e.preventDefault();
            setSobre(true);
          }}
          onDragLeave={() => setSobre(false)}
          onDrop={aoSoltar}
          className={sobre ? 'outline-2 -outline-offset-2 outline-accent outline-dashed' : undefined}
        >
          <DialogHeader>
            <DialogTitle>Carregar fotos</DialogTitle>
            <DialogDescription className="sr-only">
              Escolha o perfil de qualidade e envie fotos para a biblioteca.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => entradaArquivos.current?.click()}>
                <ImagePlus aria-hidden="true" />
                Selecionar arquivos
              </Button>
              <Button variant="outline" onClick={() => entradaPasta.current?.click()}>
                <FolderOpen aria-hidden="true" />
                Selecionar pasta
              </Button>
              <span className="text-body-sm text-ink-3">ou arraste para esta janela</span>
              <input
                ref={entradaArquivos}
                type="file"
                multiple
                accept="image/*"
                hidden
                data-testid="entrada-arquivos"
                onChange={aoEscolher}
              />
              <input
                ref={entradaPasta}
                type="file"
                multiple
                hidden
                data-testid="entrada-pasta"
                onChange={aoEscolher}
                {...{ webkitdirectory: '' }}
              />
            </div>

            <fieldset className="flex flex-col gap-2" disabled={estado.iniciado}>
              <legend className="mb-2 text-label">Qualidade · definitiva para este envio</legend>
              <RadioGroup
                className="grid-cols-3"
                value={estado.perfil}
                onValueChange={(valor) => lote.definirPerfil(valor as Perfil)}
                disabled={estado.iniciado}
                aria-label="Qualidade"
              >
                {PERFIS_NA_TELA.map(({ perfil, nome }) => (
                  <RadioCard
                    key={perfil}
                    value={perfil}
                    className="flex flex-col gap-0.5 disabled:opacity-60"
                  >
                    <span className="text-sm font-medium text-ink">{nome}</span>
                    <span className="font-mono text-medida text-ink-3">{PERFIS[perfil].ladoFotoPx} px</span>
                  </RadioCard>
                ))}
              </RadioGroup>
              <span className="text-xs text-ink-3">
                Convertidas para WebP. Seus arquivos originais não são alterados.
              </span>
            </fieldset>

            {(estado.total > 0 || textoIgnorados) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 text-body-sm">
                  <span className="font-medium text-ink">
                    {estado.concluidas} de {estado.total} enviadas
                  </span>
                  {textoIgnorados && <span className="text-ink-3">{textoIgnorados}</span>}
                </div>
                <div
                  role="progressbar"
                  aria-label="Progresso do envio"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(fracao * 100)}
                  className="h-1.5 overflow-hidden rounded-full bg-sand"
                >
                  <div className="h-full bg-ink-2 transition-[width]" style={{ width: `${fracao * 100}%` }} />
                </div>
              </div>
            )}

            {(estado.itens.length > 0 || estado.ignorados.length > 0) && (
              <ul className="flex max-h-[240px] flex-col overflow-y-auto rounded-lg border border-line-soft">
                {estado.itens.map((item) => (
                  <LinhaDoArquivo
                    key={item.id}
                    item={item}
                    onNovamente={() => lote.tentarNovamente(item.id)}
                  />
                ))}
                {estado.ignorados.map((ignorado, i) => (
                  <LinhaIgnorada
                    key={`${ignorado.nome}-${i}`}
                    nome={ignorado.nome}
                    motivo={ignorado.motivo}
                  />
                ))}
              </ul>
            )}

            {confirmando && (
              <Alert>
                <span>Cancelar os envios restantes?</span>
                <span className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      lote.cancelarRestantes();
                      setConfirmando(false);
                      onFechar();
                    }}
                  >
                    Cancelar envios
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmando(false)}>
                    Continuar enviando
                  </Button>
                </span>
              </Alert>
            )}
          </div>

          <DialogFooter>
            {estado.enviando && (
              <Button variant="ghost" onClick={() => lote.cancelarRestantes()}>
                Cancelar restantes
              </Button>
            )}
            {podeEnviar && (
              <>
                <Button variant="ghost" onClick={onFechar}>
                  Cancelar
                </Button>
                <Button onClick={() => lote.iniciar()}>
                  {aguardando === 1 ? 'Enviar 1 foto' : `Enviar ${aguardando} fotos`}
                </Button>
              </>
            )}
            {!estado.enviando && !podeEnviar && <Button onClick={pedirFechar}>Concluir</Button>}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// A-18: o texto de cada estado.
function textoDoStatus(item: ItemUpload): string {
  switch (item.status) {
    case 'aguardando':
      return 'Aguardando';
    case 'na-fila':
      return 'Na fila';
    case 'enviando':
      return item.progresso >= 1 ? 'Processando…' : `Enviando ${Math.round(item.progresso * 100)}%`;
    case 'concluida':
      return item.imagem ? `Concluída · ${formatarBytes(item.imagem.bytes)}` : 'Concluída';
    case 'cancelada':
      return 'Cancelada';
    case 'falhou': {
      const motivo = item.erro ?? 'não foi possível enviar.';
      // Erro do arquivo (415, 413): a mensagem do servidor basta; falha de rede ou 5xx pode repetir.
      return item.podeRepetir === false ? motivo : `Falhou · ${motivo}`;
    }
  }
}

function Miniatura({ imagemId }: { imagemId?: string }) {
  return (
    <span className="size-9 shrink-0 overflow-hidden rounded-xs bg-sand">
      {imagemId && (
        <img
          src={urlArquivoImagem(imagemId, 'thumb')}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      )}
    </span>
  );
}

function LinhaDoArquivo({ item, onNovamente }: { item: ItemUpload; onNovamente: () => void }) {
  const cor =
    item.status === 'concluida'
      ? 'text-success-ink'
      : item.status === 'falhou'
        ? 'text-danger-ink'
        : 'text-ink-3';
  const repetir = (item.status === 'falhou' && item.podeRepetir !== false) || item.status === 'cancelada';
  return (
    <li className="flex items-center gap-3 border-b border-line-faint px-3 py-2 last:border-b-0">
      <Miniatura imagemId={item.imagem?._id} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-ink">{item.nome}</span>
        <span className={`truncate text-xs ${cor}`}>{textoDoStatus(item)}</span>
      </span>
      {repetir && (
        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onNovamente}>
          Tentar de novo
        </Button>
      )}
    </li>
  );
}

// RN-20: o arquivo recusado no browser aparece na lista, com o motivo.
function LinhaIgnorada({ nome, motivo }: { nome: string; motivo: string }) {
  const texto = motivo === MENSAGEM_FORMATO_NAO_SUPORTADO ? 'Formato não suportado' : motivo;
  return (
    <li className="flex items-center gap-3 border-b border-line-faint px-3 py-2 last:border-b-0">
      <Miniatura />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-ink">{nome}</span>
        <span className="truncate text-xs text-danger-ink">{texto}</span>
      </span>
    </li>
  );
}
