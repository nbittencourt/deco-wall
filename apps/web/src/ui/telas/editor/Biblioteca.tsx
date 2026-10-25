import { Ellipsis, ImagePlus } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { arrastandoArquivos, lerArquivosSoltos } from '../../../app/arquivosSoltos';
import { filtrarImagens, type FiltroBiblioteca } from '../../../app/biblioteca';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { urlArquivoImagem } from '../../../infra/clienteApi';
import type { ClienteApi } from '../../../infra/dto';
import { BotaoInativo, CampoEmBreve, TEXTO_EM_BREVE } from '../../componentes/proprios/BotaoEmBreve';
import { ComDica } from '../../componentes/proprios/ComDica';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '../../componentes/ui/toggle-group';
import { cn } from '../../../lib/utils';
import { DialogoUpload } from './DialogoUpload';
import { MOTIVO_SEM_ESCALA } from './HeaderEditor';

// Coluna Biblioteca (protótipo 03; spec M2 §3.1): fotos de todos os projetos (RF-27), filtros (RF-28),
// miniaturas com nome e orientação (RF-22), "Carregar fotos" (RF-20) e arrastar para o canvas (RF-30).

// Tipo que o canvas aceita ao soltar uma miniatura (Editor).
export const TIPO_ARRASTO_IMAGEM = 'application/x-deco-imagem';

const ROTULO_ORIENTACAO = { retrato: 'Retrato', paisagem: 'Paisagem' } as const;

export function Biblioteca({
  api,
  temEscala,
  limiteMb = 50,
}: {
  api: ClienteApi;
  temEscala: boolean;
  limiteMb?: number;
}) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const fotos = useEditor((s) => s.documento.variante?.fotos);
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const erro = useEditor((s) => s.biblioteca.erro);
  const escolhida = useEditor((s) => s.ui.bibliotecaSelecaoId);

  const [filtro, setFiltro] = useState<FiltroBiblioteca>('todas');
  const [dialogo, setDialogo] = useState<{ aberto: boolean; arquivos: File[] }>({
    aberto: false,
    arquivos: [],
  });
  const [recebendo, setRecebendo] = useState(false);

  const visiveis = filtrarImagens(imagens, filtro, projeto._id, fotos ?? []);

  const aoSoltarArquivos = (evento: DragEvent) => {
    if (!arrastandoArquivos(evento.dataTransfer)) return;
    evento.preventDefault();
    setRecebendo(false);
    if (!temEscala) return;
    void lerArquivosSoltos(evento.dataTransfer).then((arquivos) => {
      if (arquivos.length > 0) setDialogo({ aberto: true, arquivos });
    });
  };

  return (
    <aside
      onDragOver={(e) => {
        if (!arrastandoArquivos(e.dataTransfer)) return;
        e.preventDefault();
        if (temEscala) setRecebendo(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRecebendo(false);
      }}
      onDrop={aoSoltarArquivos}
      aria-label="Biblioteca"
      className={cn(
        'flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-soft bg-surface p-4',
        recebendo && 'outline-2 -outline-offset-2 outline-accent outline-dashed',
      )}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-display-sm text-ink">Biblioteca</h2>
        {imagens.length > 0 && (
          <span className="text-xs text-ink-3">
            {imagens.length} {imagens.length === 1 ? 'foto' : 'fotos'}
          </span>
        )}
      </div>

      {temEscala ? (
        <Button className="w-full" onClick={() => setDialogo({ aberto: true, arquivos: [] })}>
          <ImagePlus aria-hidden="true" />
          Carregar fotos
        </Button>
      ) : (
        <BotaoInativo variant="default" className="w-full" motivo={MOTIVO_SEM_ESCALA}>
          <ImagePlus aria-hidden="true" />
          Carregar fotos
        </BotaoInativo>
      )}

      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={filtro}
          onValueChange={(valor) => valor && setFiltro(valor as FiltroBiblioteca)}
          aria-label="Filtro da biblioteca"
          className="w-[210px]"
        >
          <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
          <ToggleGroupItem value="projeto">Projeto</ToggleGroupItem>
          <ToggleGroupItem value="variante">Variante</ToggleGroupItem>
        </ToggleGroup>
        <DropdownMenu>
          <ComDica texto="Mais filtros">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Mais filtros">
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </ComDica>
          <DropdownMenuContent align="end">
            {/* RF-29: o fluxo de exclusão e restauração é do M4. */}
            <DropdownMenuItem
              aria-disabled="true"
              title={TEXTO_EM_BREVE}
              onSelect={(evento) => evento.preventDefault()}
              className="text-ink-disabled"
            >
              Excluídas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CampoEmBreve rotulo="Buscar por nome" placeholder="Buscar por nome" />

      {erro && <p className="text-body-sm text-danger-ink">{erro}</p>}

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-body-sm text-ink-2">
            {imagens.length === 0
              ? temEscala
                ? 'Nenhuma foto na biblioteca ainda.'
                : 'As fotos ficam disponíveis depois que a escala da parede for definida.'
              : 'Nenhuma foto neste filtro.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visiveis.map((imagem) => {
            const selecionada = escolhida === imagem._id;
            return (
              <li key={imagem._id}>
                <button
                  type="button"
                  draggable={temEscala}
                  aria-pressed={selecionada}
                  aria-label={`${imagem.nomeOriginal}, ${ROTULO_ORIENTACAO[imagem.orientacaoNatural]}`}
                  title={temEscala ? 'Arraste para a parede ou clique duas vezes para adicionar' : undefined}
                  onClick={() => store.getState().selecionarImagemDaBiblioteca(imagem._id)}
                  onDoubleClick={() => temEscala && store.getState().adicionarFoto(imagem._id)}
                  onDragStart={(evento) => {
                    evento.dataTransfer.setData(TIPO_ARRASTO_IMAGEM, imagem._id);
                    evento.dataTransfer.effectAllowed = 'copy';
                    store.getState().selecionarImagemDaBiblioteca(imagem._id);
                  }}
                  className="flex w-full cursor-grab flex-col gap-1.5 text-left"
                >
                  <span
                    className={cn(
                      'block h-[88px] overflow-hidden rounded-[6px] bg-sand',
                      selecionada ? 'ring-2 ring-accent' : 'ring-1 ring-line-soft',
                    )}
                  >
                    <img
                      src={urlArquivoImagem(imagem._id, 'thumb')}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="truncate text-xs text-ink">{imagem.nomeOriginal}</span>
                  <span className="-mt-1 text-xs text-ink-3">
                    {ROTULO_ORIENTACAO[imagem.orientacaoNatural]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <DialogoUpload
        aberto={dialogo.aberto}
        arquivosIniciais={dialogo.arquivos}
        projetoId={projeto._id}
        api={api}
        limiteMb={limiteMb}
        onFechar={() => setDialogo({ aberto: false, arquivos: [] })}
      />
    </aside>
  );
}
