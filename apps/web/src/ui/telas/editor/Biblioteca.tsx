import { filtrarBiblioteca, type FiltroBiblioteca } from '@deco-wall/domain';
import { Ellipsis, ImagePlus } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { arrastandoArquivos, lerArquivosSoltos } from '../../../app/arquivosSoltos';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { urlArquivoImagem } from '../../../infra/clienteApi';
import type { ClienteApi } from '../../../infra/dto';
import { CampoEmBreve, TEXTO_EM_BREVE } from '../../componentes/proprios/BotaoEmBreve';
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

// Coluna Biblioteca (protótipo 03; spec M2 §3.1): fotos de todos os projetos (RF-27), filtros (RF-28),
// miniaturas com nome e orientação (RF-22), "Carregar fotos" (RF-20) e arrastar para o canvas (RF-30).

// Tipo que o canvas aceita ao soltar uma miniatura (Editor).
export const TIPO_ARRASTO_IMAGEM = 'application/x-deco-imagem';

const ROTULO_ORIENTACAO = { retrato: 'Retrato', paisagem: 'Paisagem' } as const;

const ROTULO_NATURAL = { retrato: 'Retrato natural', paisagem: 'Paisagem natural' } as const;

// §3.1: um texto por filtro.
const TEXTO_VAZIO: Record<FiltroBiblioteca, string> = {
  todas: 'Nenhuma foto na biblioteca. Carregue fotos para começar.',
  projeto: 'Nenhuma foto neste projeto ainda.',
  variante: 'Nenhuma foto salva nesta variante ainda.',
};

export function Biblioteca({ api, temEscala }: { api: ClienteApi; temEscala: boolean }) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  // M2-05: os filtros olham o estado salvo, não as fotos ainda não salvas.
  const fotosSalvas = useEditor((s) => s.documento.salvo?.conteudo.fotos);
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const erro = useEditor((s) => s.biblioteca.erro);
  const escolhida = useEditor((s) => s.ui.bibliotecaSelecaoId);

  const [filtro, setFiltro] = useState<FiltroBiblioteca>('todas');
  const [dialogo, setDialogo] = useState<{ aberto: boolean; arquivos: File[] }>({
    aberto: false,
    arquivos: [],
  });
  const [recebendo, setRecebendo] = useState(false);

  const visiveis = filtrarBiblioteca(imagens, filtro, {
    projetoId: projeto._id,
    fotosSalvas: fotosSalvas ?? [],
  });

  const aoSoltarArquivos = (evento: DragEvent) => {
    if (!arrastandoArquivos(evento.dataTransfer)) return;
    evento.preventDefault();
    setRecebendo(false);
    // A-20: a biblioteca é global, então soltar arquivos vale também sem escala.
    void lerArquivosSoltos(evento.dataTransfer).then((arquivos) => {
      if (arquivos.length > 0) setDialogo({ aberto: true, arquivos });
    });
  };

  return (
    <aside
      onDragOver={(e) => {
        if (!arrastandoArquivos(e.dataTransfer)) return;
        e.preventDefault();
        setRecebendo(true);
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
        <span className="text-xs text-ink-3">
          {visiveis.length} {visiveis.length === 1 ? 'foto' : 'fotos'}
        </span>
      </div>

      <Button className="w-full" onClick={() => setDialogo({ aberto: true, arquivos: [] })}>
        <ImagePlus aria-hidden="true" />
        Carregar fotos
      </Button>

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

      {!temEscala && (
        <p className="text-body-sm text-ink-2">Defina a escala da parede para colocar fotos nela.</p>
      )}

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-body-sm text-ink-2">{TEXTO_VAZIO[filtro]}</p>
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
                  title={`${imagem.nomeOriginal} · ${ROTULO_NATURAL[imagem.orientacaoNatural]}`}
                  onClick={() => store.getState().selecionarImagemDaBiblioteca(imagem._id)}
                  onDragStart={(evento) => {
                    evento.dataTransfer.setData(TIPO_ARRASTO_IMAGEM, imagem._id);
                    evento.dataTransfer.effectAllowed = 'copy';
                    store.getState().selecionarImagemDaBiblioteca(imagem._id);
                  }}
                  className="flex w-full cursor-grab flex-col gap-1.5 text-left"
                >
                  <span
                    className={cn(
                      'block h-[92px] overflow-hidden rounded-[6px] bg-sand',
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
        onFechar={() => setDialogo({ aberto: false, arquivos: [] })}
      />
    </aside>
  );
}
