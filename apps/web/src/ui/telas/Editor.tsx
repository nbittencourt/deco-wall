import {
  alertasDaComposicao,
  alertasPorFoto,
  formatarCm,
  formatarHora,
  type DirecaoSeta,
  type Perfil,
} from '@deco-wall/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAvisoAoSair } from '../../app/avisoAoSair';
import { navegarPadrao } from '../../app/navegacao';
import { ProvedorStore, useEditor, useStoreEditor, useVistaDaVariante } from '../../app/StoreContext';
import { criarStoreEditor } from '../../app/store';
import { clienteHttp } from '../../infra/clienteApi';
import type { ClienteApi } from '../../infra/dto';
import { Palco } from '../canvas/Palco';
import type { EstadoPalco, PalcoApi } from '../canvas/cena';
import { DialogoSairSemSalvar, DialogoTrocarParede } from '../componentes/proprios/DialogosProjeto';
import { StatusSalvamento } from '../componentes/proprios/StatusSalvamento';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';
import { PainelComposicao } from '../paineis/PainelComposicao';
import { PainelFoto } from '../paineis/PainelFoto';
import { Biblioteca, TIPO_ARRASTO_IMAGEM } from './editor/Biblioteca';
import { cenaDaParede, dadosDaParede } from './editor/cenas';
import { EstadoVazio } from './editor/EstadoVazio';
import { HeaderEditor } from './editor/HeaderEditor';
import { ModoAreaUtil } from './editor/modos/ModoAreaUtil';
import { ModoCalibracao } from './editor/modos/ModoCalibracao';
import { ModoPerspectiva } from './editor/modos/ModoPerspectiva';
import { ModoRecorte } from './editor/modos/ModoRecorte';
import { ToolbarCanvas } from './editor/ToolbarCanvas';

// Editor da parede (DESIGN §7, protótipos 02, 03 e 11; spec M1 §3.2, §3.3, §3.8; spec M2 §3). Header, três
// colunas e barra de status; os modos Perspectiva, Calibração, Área útil e Recorte trocam o header por uma
// barra escura.

export interface PropsEditor {
  projetoId: string;
  api?: ClienteApi;
  navegar?: (caminho: string) => void;
}

export function Editor({ projetoId, api = clienteHttp, navegar = navegarPadrao }: PropsEditor) {
  const [store] = useState(() => criarStoreEditor(api));
  useEffect(() => {
    void store.getState().abrirProjeto(projetoId);
    void store.getState().carregarBiblioteca();
    void store.getState().carregarConfig();
  }, [store, projetoId]);

  return (
    <ProvedorStore store={store}>
      <EditorConteudo api={api} navegar={navegar} />
    </ProvedorStore>
  );
}

function EditorConteudo({ api, navegar }: { api: ClienteApi; navegar: (caminho: string) => void }) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto);
  const variante = useEditor((s) => s.documento.variante);
  const sujo = useEditor((s) => s.documento.sujo);
  const erroCarregar = useEditor((s) => s.documento.erroCarregar);
  const modo = useEditor((s) => s.ui.modo);

  useAvisoAoSair(sujo);

  // Ctrl+S salva, inclusive com o foco num campo, e impede o "salvar página" do browser (RF-72).
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
        evento.preventDefault();
        store
          .getState()
          .salvarVariante()
          .catch(() => undefined);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [store]);

  if (erroCarregar) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <Alert variant="alerta">{erroCarregar}</Alert>
        <Button variant="outline" onClick={() => navegar('/')}>
          Voltar aos projetos
        </Button>
      </div>
    );
  }
  if (!projeto || !variante) {
    return <p className="p-6 text-body-sm text-ink-2">Carregando projeto…</p>;
  }

  if (modo === 'perspectiva') return <ModoPerspectiva />;
  if (modo === 'calibracao') return <ModoCalibracao />;
  if (modo === 'area-util') return <ModoAreaUtil />;
  if (modo === 'recorte') return <ModoRecorte />;
  return <EditorNormal api={api} navegar={navegar} />;
}

// Elementos em que as setas, Esc e Ctrl+Z são do próprio elemento (texto, menus, controles com roving focus).
const SELETOR_CAMPO =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [role="combobox"], [role="spinbutton"]';

const DIRECOES: Record<string, DirecaoSeta> = {
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  ArrowUp: 'cima',
  ArrowDown: 'baixo',
};

function EditorNormal({ api, navegar }: { api: ClienteApi; navegar: (caminho: string) => void }) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const variante = useVistaDaVariante();
  const nomeVariante = useEditor((s) => s.documento.variante!.nome);
  const bordaPadrao = useEditor((s) => s.conteudo!.bordaPadrao);
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const sujo = useEditor((s) => s.documento.sujo);
  const salvamento = useEditor((s) => s.documento.salvamento);
  const limiteMb = useEditor((s) => s.config.uploadMaxMb);
  const conflito = useEditor((s) => s.documento.conflito);
  const erroSalvamento = useEditor((s) => s.documento.erroSalvamento);
  const avisoAreaUtilFora = useEditor((s) => s.ui.avisoAreaUtilFora);
  const selecaoId = useEditor((s) => s.ui.selecaoId);
  const bibliotecaSelecaoId = useEditor((s) => s.ui.bibliotecaSelecaoId);
  const podeDesfazer = useEditor((s) => s.podeDesfazer());
  const podeRefazer = useEditor((s) => s.podeRefazer());

  const palco = useRef<PalcoApi>(null);
  const [estadoPalco, setEstadoPalco] = useState<EstadoPalco>({ zoomPercentual: 100, gridOculto: false });
  const [trocando, setTrocando] = useState(false);
  const [dialogoTroca, setDialogoTroca] = useState(false);
  const [dialogoSair, setDialogoSair] = useState(false);
  const [avisoTroca, setAvisoTroca] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const parede = projeto.parede;
  const dados = dadosDaParede(projeto);
  const temFotos = variante.fotos.length > 0;
  const selecionada = variante.fotos.find((f) => f._id === selecaoId);

  // Teclado da composição (RN-16, M2-09, B-07). As setas só movem com uma foto selecionada e o foco fora de
  // campos; menus e diálogos abertos têm prioridade.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented) return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest(SELETOR_CAMPO)) return;
      const estado = store.getState();

      if (evento.ctrlKey || evento.metaKey) {
        const tecla = evento.key.toLowerCase();
        if (tecla === 'z') {
          evento.preventDefault();
          if (evento.shiftKey) estado.refazer();
          else estado.desfazer();
        } else if (tecla === 'y') {
          evento.preventDefault();
          estado.refazer();
        }
        return;
      }

      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (evento.key === 'Escape') {
        estado.selecionarFoto(null);
        return;
      }
      const direcao = DIRECOES[evento.key];
      const id = estado.ui.selecaoId;
      if (direcao && id) {
        evento.preventDefault();
        estado.moverPorSeta(id, direcao, evento.shiftKey);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [store]);

  const aoEscolherArquivo = async (arquivo: File, perfil: Perfil) => {
    setErroEnvio(null);
    setProgresso(0);
    try {
      await store.getState().enviarParede(arquivo, perfil, setProgresso);
      setTrocando(false);
    } catch (falha) {
      setErroEnvio(falha instanceof Error ? falha.message : 'Não foi possível enviar a foto.');
    } finally {
      setProgresso(null);
    }
  };

  const salvar = () =>
    store
      .getState()
      .salvarVariante()
      .catch(() => undefined);

  const aoVoltar = () => {
    if (sujo) setDialogoSair(true);
    else navegar('/');
  };

  const aoSalvarESair = async () => {
    await salvar();
    setDialogoSair(false);
    if (!store.getState().documento.sujo) navegar('/');
  };

  // M1-05: só se troca a parede com tudo salvo (a troca mexe nas variantes) e sem fotos posicionadas.
  const aoTrocarParede = () => {
    if (sujo) {
      setAvisoTroca(true);
      return;
    }
    setAvisoTroca(false);
    setDialogoTroca(true);
  };

  const cena =
    parede && !trocando
      ? cenaDaParede(projeto, variante, imagens, {
          selecaoId,
          interativa: true,
          onSelecionar: (id) => store.getState().selecionarFoto(id),
          onMoverFoto: (id, xCm, yCm) => store.getState().moverFoto(id, xCm, yCm),
          onAbrirRecorte: (id) => store.getState().abrirRecorte(id),
        })
      : null;

  const alertas = useMemo(
    () => alertasPorFoto(variante.fotos, dados.interior, variante.areaUtil),
    [variante.fotos, dados.interior, variante.areaUtil],
  );
  const resumo = useMemo(() => alertasDaComposicao(variante, dados.interior), [variante, dados.interior]);

  // "Adicionar" (M2-04): precisa de escala e de uma foto escolhida na biblioteca.
  const motivoAdicionar =
    dados.metodo === null
      ? 'Defina a escala primeiro.'
      : bibliotecaSelecaoId === null
        ? 'Selecione uma foto na biblioteca.'
        : undefined;

  const aoSoltarNoCanvas = (evento: React.DragEvent) => {
    const imagemId = evento.dataTransfer.getData(TIPO_ARRASTO_IMAGEM);
    if (!imagemId) return;
    evento.preventDefault();
    const ponto = palco.current?.dePaginaParaConteudo(evento.clientX, evento.clientY);
    if (ponto) store.getState().adicionarFoto(imagemId, ponto);
  };

  const dicaDeTeclas = variante.grid.snap
    ? 'Setas movem 1 passo do grid · Shift + setas: 5 passos'
    : 'Setas movem 1 cm · Shift + setas: 5 cm';

  return (
    <div className="flex h-dvh min-w-[1280px] flex-col">
      <HeaderEditor
        nome={projeto.nome}
        onRenomear={(nome) => store.getState().renomearProjeto(nome)}
        nomeVariante={nomeVariante}
        temParede={parede !== null}
        metodo={dados.metodo}
        pxPorCm={dados.pxPorCm}
        temFotos={temFotos}
        grid={variante.grid}
        gridOculto={estadoPalco.gridOculto}
        salvando={salvamento.tipo === 'salvando'}
        podeDesfazer={podeDesfazer}
        podeRefazer={podeRefazer}
        onDesfazer={() => store.getState().desfazer()}
        onRefazer={() => store.getState().refazer()}
        onVoltar={aoVoltar}
        onAlterarGrid={(parcial) => store.getState().alterarGrid(parcial)}
        onSalvar={() => void salvar()}
        onAreaUtil={() => store.getState().definirModo('area-util')}
        onPerspectiva={() => store.getState().definirModo('perspectiva')}
        onCalibrar={() => store.getState().definirModo('calibracao')}
        onTrocarParede={aoTrocarParede}
      />

      <div className="flex min-h-0 flex-1">
        <Biblioteca api={api} temEscala={dados.metodo !== null} />

        <section className="flex min-w-0 flex-1 flex-col">
          <ToolbarCanvas
            zoomPercentual={estadoPalco.zoomPercentual}
            palco={palco}
            comPalco={cena !== null}
            motivoAdicionar={motivoAdicionar}
            temSelecao={selecionada !== undefined}
            onAdicionar={() => store.getState().adicionarFotoSelecionada()}
            onDuplicar={() => selecaoId && store.getState().duplicarFoto(selecaoId)}
            onTrazerParaFrente={() => selecaoId && store.getState().trazerParaFrente(selecaoId)}
            onEnviarParaTras={() => selecaoId && store.getState().enviarParaTras(selecaoId)}
          />
          <div
            className="relative min-h-0 flex-1 bg-stage"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TIPO_ARRASTO_IMAGEM)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={aoSoltarNoCanvas}
          >
            {cena ? (
              <Palco ref={palco} cena={cena} onEstado={setEstadoPalco} />
            ) : (
              <EstadoVazio
                limiteMb={limiteMb}
                enviando={progresso}
                erro={erroEnvio}
                onArquivo={(arquivo, perfil) => void aoEscolherArquivo(arquivo, perfil)}
                onCancelar={trocando ? () => setTrocando(false) : undefined}
              />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-4">
              {conflito && (
                <Alert variant="alerta" className="pointer-events-auto max-w-[560px]">
                  <span>
                    {conflito.origem === 'variante'
                      ? `Esta variante foi salva em outra aba ${formatarHora(conflito.salvaEm)}. Recarregue para ver a versão salva.`
                      : 'Este projeto foi alterado em outra aba. Recarregue para ver a versão salva.'}
                  </span>{' '}
                  <Button
                    variant="outline"
                    className="ml-2 h-7 px-3 text-sm"
                    onClick={() => void store.getState().recarregar()}
                  >
                    Recarregar
                  </Button>
                </Alert>
              )}
              {erroSalvamento && !conflito && (
                <Alert variant="alerta" className="pointer-events-auto max-w-[560px]">
                  {erroSalvamento}
                </Alert>
              )}
              {avisoTroca && sujo && (
                <Alert className="pointer-events-auto max-w-[560px]">
                  Salve as alterações antes de trocar a parede.
                </Alert>
              )}
              {parede && !trocando && dados.metodo === null && (
                <Alert className="pointer-events-auto max-w-[560px]">
                  <span>Defina a escala da parede para posicionar fotos.</span>
                  <span className="mt-2 flex gap-2">
                    <Button onClick={() => store.getState().definirModo('perspectiva')}>
                      Corrigir perspectiva
                    </Button>
                    <Button variant="outline" onClick={() => store.getState().definirModo('calibracao')}>
                      Calibrar com uma medida
                    </Button>
                  </span>
                </Alert>
              )}
              {avisoAreaUtilFora && (
                <Alert className="pointer-events-auto max-w-[560px]">
                  <span>A área útil ficou fora da parede. Ajuste em Área útil.</span>
                  <span className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        store.getState().dispensarAvisoAreaUtil();
                        store.getState().definirModo('area-util');
                      }}
                    >
                      Ajustar
                    </Button>
                    <Button variant="ghost" onClick={() => store.getState().dispensarAvisoAreaUtil()}>
                      Dispensar
                    </Button>
                  </span>
                </Alert>
              )}
            </div>
          </div>
        </section>

        <aside className="flex w-80 shrink-0 flex-col gap-[18px] overflow-y-auto border-l border-line-soft bg-surface p-5">
          {selecionada ? (
            <PainelFoto
              // A chave refaz os campos ao trocar de foto.
              key={selecionada._id}
              foto={selecionada}
              imagem={imagens.find((i) => i._id === selecionada.imagemId)}
              alertas={alertas.get(selecionada._id)}
              onTrocarTamanho={(tamanho) => store.getState().trocarTamanho(selecionada._id, tamanho)}
              onTrocarOrientacao={(o) => store.getState().trocarOrientacao(selecionada._id, o)}
              onAlterarBorda={(parcial) => store.getState().alterarBordaDaFoto(selecionada._id, parcial)}
              onMover={(x, y) => store.getState().moverFoto(selecionada._id, x, y)}
              onAjustarRecorte={() => store.getState().abrirRecorte(selecionada._id)}
              onPersonalizado={() => store.getState().abrirRecorte(selecionada._id, { personalizado: true })}
              onDuplicar={() => store.getState().duplicarFoto(selecionada._id)}
              onRemover={() => store.getState().removerFoto(selecionada._id)}
            />
          ) : (
            <PainelComposicao
              escala={{ metodo: dados.metodo, pxPorCm: dados.pxPorCm }}
              areaUtil={dados.metodo ? variante.areaUtil : null}
              paredeInteira={dados.interior}
              grid={variante.grid}
              resumo={resumo}
              bordaPadrao={bordaPadrao}
              onAlterarBordaPadrao={(parcial) => store.getState().alterarBordaPadrao(parcial)}
              onRecalibrar={() =>
                store.getState().definirModo(dados.metodo === 'perspectiva' ? 'perspectiva' : 'calibracao')
              }
              onAjustarAreaUtil={() => store.getState().definirModo('area-util')}
              onAlterarAreaUtil={(area) => store.getState().definirAreaUtil(area)}
              onAlterarGrid={(parcial) => store.getState().alterarGrid(parcial)}
            />
          )}
        </aside>
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-line-soft bg-surface px-4">
        <span className="min-w-0 truncate text-body-sm text-ink-2">
          {selecionada ? (
            <span className="font-mono text-medida">
              X {formatarCm(selecionada.xCm)} · Y {formatarCm(selecionada.yCm)} cm
            </span>
          ) : (
            'Nenhuma foto selecionada'
          )}
        </span>
        {selecionada && <span className="text-xs text-ink-3">{dicaDeTeclas}</span>}
        <span className="flex-1" />
        <StatusSalvamento estado={salvamento} />
      </footer>

      <DialogoSairSemSalvar
        aberto={dialogoSair}
        onCancelar={() => setDialogoSair(false)}
        onSairSemSalvar={() => navegar('/')}
        onSalvarESair={() => void aoSalvarESair()}
      />
      <DialogoTrocarParede
        aberto={dialogoTroca}
        onCancelar={() => setDialogoTroca(false)}
        onConfirmar={() => {
          setDialogoTroca(false);
          setErroEnvio(null);
          setTrocando(true);
        }}
      />
    </div>
  );
}
