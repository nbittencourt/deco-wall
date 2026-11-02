import { filtrarBiblioteca, type FiltroBiblioteca } from '@deco-wall/domain';
import { Ellipsis, ImagePlus } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { arrastandoArquivos, lerArquivosSoltos } from '../../../app/arquivosSoltos';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { urlArquivoImagem } from '../../../infra/clienteApi';
import type { ClienteApi, ImagemExcluidaDto } from '../../../infra/dto';
import { CampoEmBreve } from '../../componentes/proprios/BotaoEmBreve';
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

// Coluna Biblioteca (protótipo 03; spec M2 §3.1; spec M4 §3.1, §3.4): fotos de todos os projetos (RF-27), filtros
// (RF-28), miniaturas com nome e orientação (RF-22), "Carregar fotos" (RF-20), arrastar para o canvas (RF-30),
// menu ⋯ "Remover ou excluir…" (RF-29) e a lista "Excluídas" com restauração (M4-07).

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

type Filtro = FiltroBiblioteca | 'excluidas';

// A-07: com 3 dias ou menos o prazo fica em danger-ink.
const DIAS_EM_ALERTA = 3;

export function Biblioteca({
  api,
  temEscala,
  onRemoverOuExcluir,
}: {
  api: ClienteApi;
  temEscala: boolean;
  // A-03: quem monta a tela decide se pergunta antes (ativa com alterações não salvas).
  onRemoverOuExcluir: (imagemId: string) => void;
}) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  // M2-05: os filtros olham o estado salvo, não as fotos ainda não salvas.
  const fotosSalvas = useEditor((s) => s.documento.salvo?.conteudo.fotos);
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const excluidas = useEditor((s) => s.biblioteca.excluidas);
  const erro = useEditor((s) => s.biblioteca.erro);
  const escolhida = useEditor((s) => s.ui.bibliotecaSelecaoId);

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [erroRestaurar, setErroRestaurar] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ aberto: boolean; arquivos: File[] }>({
    aberto: false,
    arquivos: [],
  });
  const [recebendo, setRecebendo] = useState(false);

  const emExcluidas = filtro === 'excluidas';
  const visiveis = emExcluidas
    ? []
    : filtrarBiblioteca(imagens, filtro, {
        projetoId: projeto._id,
        fotosSalvas: fotosSalvas ?? [],
      });

  const escolherFiltro = (novo: Filtro) => {
    setFiltro(novo);
    setErroRestaurar(null);
    if (novo === 'excluidas') void store.getState().carregarExcluidas();
  };

  const restaurar = (id: string) => {
    setErroRestaurar(null);
    store
      .getState()
      .restaurarImagem(id)
      .catch((falha: unknown) =>
        setErroRestaurar(falha instanceof Error ? falha.message : 'Não foi possível restaurar a imagem.'),
      );
  };

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
          {emExcluidas
            ? `${excluidas.length} ${excluidas.length === 1 ? 'excluída' : 'excluídas'}`
            : `${visiveis.length} ${visiveis.length === 1 ? 'foto' : 'fotos'}`}
        </span>
      </div>

      <Button className="w-full" onClick={() => setDialogo({ aberto: true, arquivos: [] })}>
        <ImagePlus aria-hidden="true" />
        Carregar fotos
      </Button>

      <div className="flex items-center gap-2">
        {/* "Excluídas" desmarca os outros (DESIGN §6): com ela ativa o grupo fica sem valor. */}
        <ToggleGroup
          type="single"
          value={emExcluidas ? '' : filtro}
          onValueChange={(valor) => valor && escolherFiltro(valor as FiltroBiblioteca)}
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
            <DropdownMenuItem onSelect={() => escolherFiltro('excluidas')}>Excluídas</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {emExcluidas && (
        <Button variant="outline" className="h-7 w-fit px-3 text-sm" onClick={() => escolherFiltro('todas')}>
          Excluídas ×
        </Button>
      )}

      <CampoEmBreve rotulo="Buscar por nome" placeholder="Buscar por nome" />

      {erro && <p className="text-body-sm text-danger-ink">{erro}</p>}

      {!temEscala && !emExcluidas && (
        <p className="text-body-sm text-ink-2">Defina a escala da parede para colocar fotos nela.</p>
      )}

      {emExcluidas ? (
        <ListaExcluidas excluidas={excluidas} erro={erroRestaurar} onRestaurar={restaurar} />
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-body-sm text-ink-2">{TEXTO_VAZIO[filtro as FiltroBiblioteca]}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {visiveis.map((imagem) => {
            const selecionada = escolhida === imagem._id;
            return (
              <li key={imagem._id} className="group relative">
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
                {/* A-01: irmão da miniatura (botão dentro de botão não vale); aparece no hover, no foco por
                    teclado, com o menu aberto e na miniatura selecionada. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Mais ações de ${imagem.nomeOriginal}`}
                      className={cn(
                        'absolute top-1 right-1 size-7 opacity-0 transition-opacity',
                        'group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                        selecionada && 'opacity-100',
                      )}
                    >
                      <Ellipsis aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onRemoverOuExcluir(imagem._id)}>
                      Remover ou excluir…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

// A-07: miniatura esmaecida, prazo restante e Restaurar. Restaurar não devolve a foto às composições.
function ListaExcluidas({
  excluidas,
  erro,
  onRestaurar,
}: {
  excluidas: ImagemExcluidaDto[];
  erro: string | null;
  onRestaurar: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-ink-2">
        Removidas definitivamente após 30 dias. Restaurar não devolve a foto às composições.
      </p>
      {erro && <p className="text-body-sm text-danger-ink">{erro}</p>}
      {excluidas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line p-6 text-center">
          <p className="text-body-sm text-ink-2">Nenhuma imagem excluída.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {excluidas.map((imagem) => (
            <li key={imagem._id} className="flex items-center gap-3">
              <span className="block h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[6px] bg-sand ring-1 ring-line-soft">
                <img
                  src={urlArquivoImagem(imagem._id, 'thumb')}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="size-full object-cover opacity-55 grayscale"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs text-ink">{imagem.nomeOriginal}</span>
                <span
                  className={cn(
                    'text-xs',
                    imagem.diasRestantes <= DIAS_EM_ALERTA ? 'text-danger-ink' : 'text-ink-3',
                  )}
                >
                  {imagem.diasRestantes === 1 ? '1 dia restante' : `${imagem.diasRestantes} dias restantes`}
                </span>
              </span>
              <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => onRestaurar(imagem._id)}>
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
