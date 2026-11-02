import {
  comandosDeExportacao,
  formatoPadraoDaExportacao,
  LADO_PREVIA_EXPORTACAO_PX,
  nomeDoArquivoExportado,
  pngDemorado,
  resolucaoDaPrevia,
  resolucaoDeExportacao,
  type FormatoExportacao,
} from '@deco-wall/domain';
import { Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { urlArquivoImagem, urlArquivoParede } from '../../../infra/clienteApi';
import { baixarArquivo, exportadorWorker, type Exportador } from '../../../infra/exportacao';
import type { OrigemImagem } from '../../../infra/exportacao-compositor';
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
import { Switch } from '../../componentes/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../../componentes/ui/toggle-group';

// Diálogo "Exportar imagem" (RF-80, RN-12, RN-19, ADR-08, M4-10 a M4-12, M4-18, A-13 a A-19, A-28; protótipo 10;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §3.8). Exporta o que está na tela, na resolução da parede, e
// não grava nada no servidor.

interface Props {
  exportador?: Exportador;
  baixar?: (blob: Blob, nome: string) => void;
  agora?: () => Date;
}

export function DialogoExportar(props: Props) {
  const aberta = useEditor((s) => s.ui.exportacaoAberta);
  // O conteúdo só existe com o diálogo aberto: formato, grid e prévia nascem do zero a cada abertura (A-15).
  return aberta ? <DialogoExportarAberto {...props} /> : null;
}

type Estado = 'ocioso' | 'gerando' | 'erro';

function DialogoExportarAberto({
  exportador = exportadorWorker,
  baixar = baixarArquivo,
  agora = () => new Date(),
}: Props) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const variante = useEditor((s) => s.documento.variante)!;
  const conteudo = useEditor((s) => s.conteudo)!;
  const sujo = useEditor((s) => s.documento.sujo);

  const parede = projeto.parede!;
  const resolucao = useMemo(() => resolucaoDeExportacao(parede), [parede]);
  const [formato, setFormato] = useState<FormatoExportacao>(() => formatoPadraoDaExportacao(resolucao));
  const [incluirGrid, setIncluirGrid] = useState(false);
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [indisponiveis, setIndisponiveis] = useState(0);
  const geracao = useRef<AbortController | null>(null);

  const comandos = useMemo(
    () =>
      comandosDeExportacao({
        variante: { grid: variante.grid, fotos: conteudo.fotos },
        parede,
        incluirGrid,
      }),
    [variante.grid, conteudo.fotos, parede, incluirGrid],
  );

  const urlDe = (origem: OrigemImagem) =>
    origem.tipo === 'parede'
      ? urlArquivoParede(
          projeto._id,
          parede.escala.metodo === 'perspectiva' ? 'retificada' : 'original',
          projeto.revisao,
        )
      : urlArquivoImagem(origem.imagemId, 'render');

  // M4-12: a prévia sai do mesmo compositor em escala reduzida; refeita ao mudar "Incluir grid". Fechar aborta.
  useEffect(() => {
    const controle = new AbortController();
    let url: string | null = null;
    exportador
      .previa({
        comandos,
        resolucao: resolucaoDaPrevia(resolucao, LADO_PREVIA_EXPORTACAO_PX),
        urlDe,
        sinal: controle.signal,
      })
      .then((resultado) => {
        if (controle.signal.aborted) return;
        url = URL.createObjectURL(resultado.blob);
        setPreviaUrl(url);
        setIndisponiveis(resultado.imagensIndisponiveis);
      })
      .catch(() => undefined);
    return () => {
      controle.abort();
      if (url) URL.revokeObjectURL(url);
    };
    // `urlDe` só depende do projeto, que não muda com o diálogo aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandos, resolucao, exportador]);

  // Fechar o diálogo aborta a geração em curso.
  useEffect(() => () => geracao.current?.abort(), []);

  const fechar = () => {
    geracao.current?.abort();
    store.getState().fecharExportacao();
  };

  const baixarArquivoGerado = async () => {
    const controle = new AbortController();
    geracao.current = controle;
    setEstado('gerando');
    try {
      const resultado = await exportador.exportar({
        comandos,
        resolucao,
        formato,
        urlDe,
        sinal: controle.signal,
      });
      if (controle.signal.aborted) return;
      baixar(
        resultado.blob,
        nomeDoArquivoExportado({ projeto: projeto.nome, variante: variante.nome, data: agora(), formato }),
      );
      store.getState().fecharExportacao();
    } catch (erro) {
      if (controle.signal.aborted || (erro instanceof DOMException && erro.name === 'AbortError')) return;
      setEstado('erro');
    }
  };

  const grande = pngDemorado(resolucao);
  const exigeAceite = formato === 'png' && grande;
  const megapixels = ((resolucao.larguraPx * resolucao.alturaPx) / 1_000_000).toFixed(1).replace('.', ',');
  const gerando = estado === 'gerando';
  const rotuloPrimario = gerando
    ? 'Gerando…'
    : estado === 'erro'
      ? 'Tentar de novo'
      : exigeAceite
        ? 'Aceitar e baixar PNG'
        : `Baixar ${formato.toUpperCase()}`;

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar imagem</DialogTitle>
          <DialogDescription>
            Salva a composição da variante como imagem, na resolução da parede.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 px-6 pb-6">
          <div className="flex h-[240px] w-[280px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stage ring-1 ring-line-soft">
            {previaUrl ? (
              <img
                src={previaUrl}
                alt="Prévia da exportação"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-body-sm text-ink-3">Gerando prévia…</span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-label">Formato</span>
              <ToggleGroup
                type="single"
                value={formato}
                onValueChange={(valor) => {
                  if (!valor) return;
                  setFormato(valor as FormatoExportacao);
                  if (estado === 'erro') setEstado('ocioso');
                }}
                aria-label="Formato"
                className="w-[160px]"
              >
                <ToggleGroupItem value="png">PNG</ToggleGroupItem>
                <ToggleGroupItem value="jpg">JPG</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <label className="flex items-center justify-between gap-3 text-body-sm text-ink">
              Incluir grid
              <Switch aria-label="Incluir grid" checked={incluirGrid} onCheckedChange={setIncluirGrid} />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-label">Resolução</span>
              <span className="font-mono text-medida text-ink">
                {resolucao.larguraPx} × {resolucao.alturaPx} px
              </span>
            </div>

            <p className="text-body-sm text-ink-2">
              Espaços sem foto aparecem em vermelho hachurado. O que passar da parede é recortado.
            </p>
            {sujo && (
              <p className="text-body-sm text-ink-2">
                Exporta o que está na tela, inclusive alterações não salvas.
              </p>
            )}
            {indisponiveis > 0 && (
              <p className="text-body-sm text-ink-2">
                {indisponiveis === 1
                  ? '1 foto com imagem indisponível sai como retângulo cinza.'
                  : `${indisponiveis} fotos com imagem indisponível saem como retângulo cinza.`}
              </p>
            )}
          </div>
        </div>

        {exigeAceite && estado !== 'erro' && (
          <div className="px-6 pb-4">
            <Alert>
              Esta imagem tem {megapixels} MP. Gerar PNG pode demorar bastante e o arquivo fica grande. JPG é
              mais rápido e abre em qualquer computador.
            </Alert>
          </div>
        )}
        {estado === 'erro' && (
          <div className="px-6 pb-4">
            <Alert variant="alerta">Não foi possível gerar a imagem.</Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button disabled={gerando} onClick={() => void baixarArquivoGerado()}>
            <Download aria-hidden="true" />
            {rotuloPrimario}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
