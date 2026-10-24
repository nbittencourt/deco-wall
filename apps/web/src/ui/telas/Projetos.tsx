import { formatarMetaProjeto } from '@deco-wall/domain';
import { ImageOff, MoreHorizontal, Plus, Search } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { caminhoDoProjeto, navegarPadrao } from '../../app/navegacao';
import { clienteHttp } from '../../infra/clienteApi';
import type { ClienteApi, ResumoProjeto } from '../../infra/dto';
import { CampoEmBreve } from '../componentes/proprios/BotaoEmBreve';
import { ComDica } from '../componentes/proprios/ComDica';
import { DialogoExcluirProjeto, DialogoRenomearProjeto } from '../componentes/proprios/DialogosProjeto';
import { StatusApi } from '../componentes/proprios/StatusApi';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../componentes/ui/dropdown-menu';

// Tela Projetos com dados reais (spec M1 §3.1; protótipo 01). Busca de projetos segue inativa (DV-03).

export interface PropsProjetos {
  api?: ClienteApi;
  navegar?: (caminho: string) => void;
  agora?: () => Date;
}

export function Projetos({
  api = clienteHttp,
  navegar = navegarPadrao,
  agora = () => new Date(),
}: PropsProjetos) {
  const [projetos, setProjetos] = useState<ResumoProjeto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<ResumoProjeto | null>(null);
  const [excluindo, setExcluindo] = useState<ResumoProjeto | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .listarProjetos()
      .then((lista) => {
        if (!ativo) return;
        setProjetos(lista);
        setErro(null);
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar os projetos.');
      });
    return () => {
      ativo = false;
    };
  }, [api]);

  // A-02: cria "Projeto sem nome" na hora e abre o editor; o nome se muda depois.
  const criarProjeto = async () => {
    setCriando(true);
    try {
      const { projeto } = await api.criarProjeto();
      navegar(caminhoDoProjeto(projeto._id));
    } catch {
      setErro('Não foi possível criar o projeto.');
      setCriando(false);
    }
  };

  const abrir = (evento: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.button !== 0) return;
    evento.preventDefault();
    navegar(caminhoDoProjeto(id));
  };

  const vazio = projetos !== null && projetos.length === 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between gap-6 border-b border-line-soft bg-surface px-6">
        <span className="text-display-sm text-ink">Simulador de Parede de Fotos</span>
        <StatusApi />
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display-xl text-ink">Projetos</h1>
            <p className="text-body-sm text-ink-2">
              Uma parede por projeto. As fotos da biblioteca valem para todos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <CampoEmBreve rotulo="Buscar projeto" placeholder="Buscar projeto" className="h-10 pl-9" />
            </div>
            <Button size="lista" disabled={criando} onClick={() => void criarProjeto()}>
              <Plus aria-hidden="true" />
              Novo projeto
            </Button>
          </div>
        </div>

        {erro && <Alert variant="alerta">{erro}</Alert>}

        {vazio && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line p-12 text-center">
            <h2 className="text-display-md text-ink">Nenhum projeto ainda</h2>
            <p className="text-body-sm text-ink-2">Crie um projeto para começar pela foto da parede.</p>
            <Button size="lista" disabled={criando} onClick={() => void criarProjeto()}>
              <Plus aria-hidden="true" />
              Novo projeto
            </Button>
          </div>
        )}

        {projetos && projetos.length > 0 && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {projetos.map((projeto) => (
              <li
                key={projeto._id}
                className="relative flex flex-col overflow-hidden rounded-lg border border-line-soft bg-surface transition-shadow hover:shadow-md"
              >
                <a
                  href={caminhoDoProjeto(projeto._id)}
                  aria-label={`Abrir ${projeto.nome}`}
                  onClick={(evento) => abrir(evento, projeto._id)}
                  className="flex flex-col"
                >
                  {projeto.thumbUrl ? (
                    <img
                      src={projeto.thumbUrl}
                      alt={`Parede de ${projeto.nome}`}
                      className="h-40 w-full bg-paper object-cover"
                    />
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 bg-paper text-ink-3">
                      <ImageOff className="size-6" aria-hidden="true" />
                      <span className="text-body-sm">Sem foto da parede</span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5 p-4 pr-14">
                    <h2 className="text-display-sm truncate text-ink">{projeto.nome}</h2>
                    <p className="text-body-sm text-ink-3">
                      {formatarMetaProjeto(
                        {
                          qtdVariantes: projeto.qtdVariantes,
                          temParede: projeto.temParede,
                          atualizadoEm: new Date(projeto.atualizadoEm),
                        },
                        agora(),
                      )}
                    </p>
                  </div>
                </a>
                <div className="absolute right-3 bottom-3">
                  <DropdownMenu>
                    <ComDica texto="Mais ações">
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Mais ações de ${projeto.nome}`}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                    </ComDica>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setRenomeando(projeto)}>Renomear</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setExcluindo(projeto)} className="text-danger-ink">
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <DialogoRenomearProjeto
        aberto={renomeando !== null}
        nomeAtual={renomeando?.nome ?? ''}
        onCancelar={() => setRenomeando(null)}
        onConfirmar={async (nome) => {
          if (!renomeando) return;
          await api.renomearProjeto(renomeando._id, nome);
          setProjetos((lista) => lista?.map((p) => (p._id === renomeando._id ? { ...p, nome } : p)) ?? null);
          setRenomeando(null);
        }}
      />
      <DialogoExcluirProjeto
        aberto={excluindo !== null}
        nome={excluindo?.nome ?? ''}
        onCancelar={() => setExcluindo(null)}
        onConfirmar={async () => {
          if (!excluindo) return;
          await api.excluirProjeto(excluindo._id);
          setProjetos((lista) => lista?.filter((p) => p._id !== excluindo._id) ?? null);
          setExcluindo(null);
        }}
      />
    </div>
  );
}
