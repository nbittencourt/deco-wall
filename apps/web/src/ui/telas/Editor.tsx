import {
  alertasDaComposicao,
  alertasPorFoto,
  AVISO_CRIACAO_MS,
  formatarCm,
  formatarHora,
  nomeCopia,
  nomeNovaVariante,
  vagaNoPonto,
  type DirecaoSeta,
  type Perfil,
} from '@deco-wall/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { agendador, MS_POR_MINUTO } from '../../app/autosave';
import { useAvisoAoSair } from '../../app/avisoAoSair';
import { caminhoDoProjeto, navegarPadrao } from '../../app/navegacao';
import { ProvedorStore, useEditor, useStoreEditor, useVistaDaVariante } from '../../app/StoreContext';
import { criarStoreEditor, resumoDasVariantes } from '../../app/store';
import { clienteHttp } from '../../infra/clienteApi';
import type { ClienteApi } from '../../infra/dto';
import { Palco } from '../canvas/Palco';
import type { EstadoPalco, PalcoApi } from '../canvas/cena';
import { DialogoSairSemSalvar, DialogoTrocarParede } from '../componentes/proprios/DialogosProjeto';
import { StatusSalvamento, TEXTO_MEDIDAS_APROXIMADAS } from '../componentes/proprios/StatusSalvamento';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';
import { PainelComposicao } from '../paineis/PainelComposicao';
import { PainelFoto } from '../paineis/PainelFoto';
import { Comparacao } from './comparacao/Comparacao';
import { Biblioteca, TIPO_ARRASTO_IMAGEM } from './editor/Biblioteca';
import { cenaDaParede, dadosDaParede } from './editor/cenas';
import { DialogoTemplates } from './editor/DialogoTemplates';
import { DialogosGlobais } from './editor/DialogosGlobais';
import { DialogoDecisao, DialogoExcluirVariante, DialogoNomeVariante } from './editor/DialogosVariante';
import { EstadoVazio } from './editor/EstadoVazio';
import { HeaderEditor } from './editor/HeaderEditor';
import { ModoAreaUtil } from './editor/modos/ModoAreaUtil';
import { ModoCalibracao } from './editor/modos/ModoCalibracao';
import { ModoPerspectiva } from './editor/modos/ModoPerspectiva';
import { ModoRecorte } from './editor/modos/ModoRecorte';
import { ModoTemplate } from './editor/modos/ModoTemplate';
import { SeletorVariante } from './editor/SeletorVariante';
import { ToolbarCanvas } from './editor/ToolbarCanvas';

// Editor da parede (DESIGN §7, protótipos 02, 03 e 11; spec M1 §3.2, §3.3, §3.8; spec M2 §3). Header, três
// colunas e barra de status; os modos Perspectiva, Calibração, Área útil e Recorte trocam o header por uma
// barra escura.

export interface PropsEditor {
  projetoId: string;
  api?: ClienteApi;
  navegar?: (caminho: string) => void;
  // M3 (A-26): a comparação usa a mesma store do editor; trocar de tela não recarrega o projeto.
  tela?: 'editor' | 'comparar';
}

export function Editor({
  projetoId,
  api = clienteHttp,
  navegar = navegarPadrao,
  tela = 'editor',
}: PropsEditor) {
  const [store] = useState(() => criarStoreEditor(api));
  useEffect(() => {
    void store.getState().abrirProjeto(projetoId);
    void store.getState().carregarBiblioteca();
    void store.getState().carregarConfig();
  }, [store, projetoId]);

  return (
    <ProvedorStore store={store}>
      <EditorConteudo api={api} navegar={navegar} tela={tela} />
    </ProvedorStore>
  );
}

function EditorConteudo({
  api,
  navegar,
  tela,
}: {
  api: ClienteApi;
  navegar: (caminho: string) => void;
  tela: 'editor' | 'comparar';
}) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto);
  const variante = useEditor((s) => s.documento.variante);
  const sujo = useEditor((s) => s.documento.sujo);
  const erroCarregar = useEditor((s) => s.documento.erroCarregar);
  const modo = useEditor((s) => s.ui.modo);
  const autosaveMinutos = useEditor((s) => s.config.autosaveMinutos);

  useAvisoAoSair(sujo);

  // RF-71, SV-01: a cada AUTOSAVE_MINUTOS grava o rascunho da variante ativa, se mudou (inclusive nos modos e na
  // comparação: o salvamento automático segue em segundo plano).
  useEffect(
    () => agendador.periodico(() => void store.getState().salvarRascunho(), autosaveMinutos * MS_POR_MINUTO),
    [store, autosaveMinutos],
  );

  // Ctrl+S salva, inclusive com o foco num campo, e impede o "salvar página" do browser (RF-72). Na comparação
  // os atalhos de edição ficam inativos (A-16).
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
        evento.preventDefault();
        if (tela === 'comparar') return;
        store
          .getState()
          .salvarVariante()
          .catch(() => undefined);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [store, tela]);

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

  let conteudo = <EditorNormal api={api} navegar={navegar} />;
  if (tela === 'comparar') conteudo = <Comparacao navegar={navegar} />;
  else if (modo === 'perspectiva') conteudo = <ModoPerspectiva />;
  else if (modo === 'calibracao') conteudo = <ModoCalibracao />;
  else if (modo === 'area-util') conteudo = <ModoAreaUtil />;
  else if (modo === 'recorte') conteudo = <ModoRecorte />;
  else if (modo === 'template') conteudo = <ModoTemplate />;
  return (
    <>
      {conteudo}
      <DialogosGlobais />
    </>
  );
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

const textoPosicao = (p: { xCm: number; yCm: number }) =>
  `X ${formatarCm(p.xCm)} · Y ${formatarCm(p.yCm)} cm`;

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
  const arrasto = useEditor((s) => s.ui.arrasto);
  const conflito = useEditor((s) => s.documento.conflito);
  const erroSalvamento = useEditor((s) => s.documento.erroSalvamento);
  // M3: lista de variantes, galeria, avisos e o diálogo de conflito (aberto ou adiado).
  const listaVariantes = useEditor((s) => s.documento.lista);
  const galeriaAberta = useEditor((s) => s.ui.galeriaAberta);
  const dialogoConflito = useEditor((s) => s.ui.dialogoConflito);
  const avisoRascunho = useEditor((s) => s.documento.avisoRascunho);
  const avisoCriacao = useEditor((s) => s.ui.avisoCriacao);
  const avisoAreaUtilFora = useEditor((s) => s.ui.avisoAreaUtilFora);
  const selecaoId = useEditor((s) => s.ui.selecaoId);
  const bibliotecaSelecaoId = useEditor((s) => s.ui.bibliotecaSelecaoId);
  const podeDesfazer = useEditor((s) => s.podeDesfazer());
  const podeRefazer = useEditor((s) => s.podeRefazer());

  const palco = useRef<PalcoApi>(null);
  const [estadoPalco, setEstadoPalco] = useState<EstadoPalco>({ zoomPercentual: 100, gridOculto: false });
  const [areaTotal, setAreaTotal] = useState(true); // A-13: padrão ligado; estado da tela
  const [trocando, setTrocando] = useState(false);
  const [dialogoTroca, setDialogoTroca] = useState(false);
  const [dialogoSair, setDialogoSair] = useState(false);
  const [avisoTroca, setAvisoTroca] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  // M3: decisão ao deixar a ativa com alterações (A-12) e os diálogos de variante (A-02).
  const [pendente, setPendente] = useState<{ acao: () => void | Promise<void> } | null>(null);
  const [decidindo, setDecidindo] = useState(false);
  const [dialogoVar, setDialogoVar] = useState<
    | { tipo: 'nova' }
    | { tipo: 'duplicar'; id: string }
    | { tipo: 'renomear'; id: string }
    | { tipo: 'excluir'; id: string }
    | null
  >(null);

  // A-20: o aviso "Variante criada" some sozinho.
  useEffect(() => {
    if (!avisoCriacao) return undefined;
    const id = setTimeout(() => store.getState().dispensarAvisoCriacao(), AVISO_CRIACAO_MS);
    return () => clearTimeout(id);
  }, [avisoCriacao, store]);

  const parede = projeto.parede;
  const dados = dadosDaParede(projeto);
  const temFotos = variante.fotos.length > 0;
  const selecionada = variante.fotos.find((f) => f._id === selecaoId);
  const posicaoNaPilha = variante.fotos.findIndex((f) => f._id === selecaoId);
  // A-07: no arraste, a barra mostra a posição ao vivo; fora dele, a da foto.

  // Teclado da composição (RN-16, M2-01, A-08). As setas só movem com uma foto selecionada e o foco fora de
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

  // A-12: qualquer ação que deixe a ativa com alterações não salvas pergunta antes.
  const comDecisao = (acao: () => void | Promise<void>) => {
    if (store.getState().documento.sujo) setPendente({ acao });
    else void acao();
  };
  const aoSalvarEContinuar = async () => {
    setDecidindo(true);
    try {
      await store.getState().salvarVariante();
    } catch {
      // O 409 abre o diálogo de conflito e interrompe a ação.
    } finally {
      setDecidindo(false);
    }
    const acao = pendente?.acao;
    setPendente(null);
    const estado = store.getState().documento;
    if (estado.sujo || estado.conflito) return;
    await acao?.();
  };
  const aoDescartarEContinuar = async () => {
    const acao = pendente?.acao;
    setDecidindo(true);
    try {
      await store.getState().descartarAlteracoes();
    } finally {
      setDecidindo(false);
    }
    setPendente(null);
    await acao?.();
  };

  const nomesDasVariantes = listaVariantes.map((i) => i.nome);
  const nomeDe = (id: string) => listaVariantes.find((i) => i._id === id)?.nome ?? '';
  const aoDuplicar = (id: string) =>
    comDecisao(async () => {
      if (id !== store.getState().documento.variante?._id) await store.getState().alternarVariante(id);
      setDialogoVar({ tipo: 'duplicar', id });
    });

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
          mostrarAreaTotal: areaTotal,
          interativa: true,
          onSelecionar: (id) => store.getState().selecionarFoto(id),
          onMoverFoto: (id, xCm, yCm) => store.getState().moverFoto(id, xCm, yCm),
          onAbrirRecorte: (id) => store.getState().abrirRecorte(id),
          onArrastarFoto: (a) => store.getState().definirArrasto(a),
        })
      : null;

  const alertas = useMemo(
    () => alertasPorFoto(variante.fotos, dados.interior, variante.areaUtil),
    [variante.fotos, dados.interior, variante.areaUtil],
  );
  const resumo = useMemo(() => alertasDaComposicao(variante, dados.interior), [variante, dados.interior]);

  // "Adicionar" (A-05): precisa de escala e de uma foto escolhida na biblioteca.
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
    if (!ponto) return;
    // M3-01, A-23: soltar sobre uma vaga a preenche; fora de vaga, a foto entra como nova (M2 A-04).
    const vaga = vagaNoPonto(variante.fotos, ponto);
    if (vaga) store.getState().preencherVaga(vaga._id, imagemId);
    else store.getState().adicionarFoto(imagemId, ponto);
  };

  const dicaDeTeclas = variante.grid.snap
    ? 'Setas: 1 passo do grid · Shift + setas: 5 passos'
    : 'Setas: 1 cm · Shift + setas: 5 cm';

  return (
    <div className="flex h-dvh min-w-[1280px] flex-col">
      <HeaderEditor
        nome={projeto.nome}
        onRenomear={(nome) => store.getState().renomearProjeto(nome)}
        nomeVariante={nomeVariante}
        seletorVariante={
          <SeletorVariante
            itens={resumoDasVariantes(store.getState())}
            onAlternar={(id) => comDecisao(() => void store.getState().alternarVariante(id))}
            onNova={() => comDecisao(() => setDialogoVar({ tipo: 'nova' }))}
            onDuplicar={aoDuplicar}
            onTemplate={() => comDecisao(() => store.getState().abrirGaleria())}
            onRenomear={(id) => setDialogoVar({ tipo: 'renomear', id })}
            onExcluir={(id) => setDialogoVar({ tipo: 'excluir', id })}
          />
        }
        motivoComparar={
          listaVariantes.length < 2
            ? 'Crie ao menos duas variantes para comparar.'
            : dados.metodo === null
              ? 'Defina a escala primeiro.'
              : undefined
        }
        onComparar={() => navegar(`${caminhoDoProjeto(projeto._id)}/comparar`)}
        onTemplates={() => comDecisao(() => store.getState().abrirGaleria())}
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
            noTopo={posicaoNaPilha === variante.fotos.length - 1}
            noFundo={posicaoNaPilha === 0}
            areaTotal={areaTotal}
            onAreaTotal={setAreaTotal}
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
              {conflito?.origem === 'variante' && !dialogoConflito && (
                <Alert variant="alerta" className="pointer-events-auto max-w-[560px]">
                  <span>
                    {conflito.excluida
                      ? 'Esta variante foi excluída em outra aba.'
                      : `Esta variante foi salva em outra aba ${formatarHora(conflito.salvaEm)}.`}
                  </span>{' '}
                  <Button
                    variant="outline"
                    className="ml-2 h-7 px-3 text-sm"
                    onClick={() => void store.getState().abrirDialogoConflito()}
                  >
                    Resolver…
                  </Button>
                </Alert>
              )}
              {conflito?.origem === 'projeto' && (
                <Alert variant="alerta" className="pointer-events-auto max-w-[560px]">
                  <span>Este projeto foi alterado em outra aba. Recarregue para ver a versão salva.</span>{' '}
                  <Button
                    variant="outline"
                    className="ml-2 h-7 px-3 text-sm"
                    onClick={() => void store.getState().recarregar()}
                  >
                    Recarregar
                  </Button>
                </Alert>
              )}
              {avisoRascunho && (
                <Alert className="pointer-events-auto max-w-[560px]">
                  <span>Não foi possível salvar o rascunho automático. Use Salvar.</span>
                  <Button
                    variant="ghost"
                    className="ml-2 h-7 px-3 text-sm"
                    onClick={() => store.getState().dispensarAvisoRascunho()}
                  >
                    Dispensar
                  </Button>
                </Alert>
              )}
              {avisoCriacao && <Alert className="pointer-events-auto max-w-[560px]">{avisoCriacao}</Alert>}
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
              podePreencher={bibliotecaSelecaoId !== null}
              onPreencher={() => store.getState().preencherVagaSelecionada()}
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
              {textoPosicao(arrasto?.id === selecionada._id ? arrasto : selecionada)}
            </span>
          ) : (
            'Nenhuma foto selecionada'
          )}
        </span>
        {selecionada && <span className="text-xs text-ink-3">{dicaDeTeclas}</span>}
        <span className="flex-1" />
        <span className="text-xs text-ink-3">{TEXTO_MEDIDAS_APROXIMADAS}</span>
        <StatusSalvamento estado={salvamento} />
      </footer>

      <DialogoSairSemSalvar
        aberto={dialogoSair}
        onCancelar={() => setDialogoSair(false)}
        onSairSemSalvar={() => navegar('/')}
        onSalvarESair={() => void aoSalvarESair()}
      />
      <DialogoDecisao
        aberto={pendente !== null}
        nome={nomeVariante}
        ocupado={decidindo}
        onCancelar={() => setPendente(null)}
        onSalvar={() => void aoSalvarEContinuar()}
        onDescartar={() => void aoDescartarEContinuar()}
      />
      <DialogoNomeVariante
        aberto={dialogoVar?.tipo === 'nova'}
        titulo="Nova variante"
        rotuloConfirmar="Criar variante"
        nomeInicial={nomeNovaVariante(nomesDasVariantes)}
        onCancelar={() => setDialogoVar(null)}
        onConfirmar={async (nome) => {
          await store.getState().criarVarianteEmBranco(nome);
          setDialogoVar(null);
        }}
      />
      <DialogoNomeVariante
        aberto={dialogoVar?.tipo === 'duplicar'}
        titulo="Duplicar variante"
        rotuloConfirmar="Duplicar"
        nomeInicial={nomeCopia(nomeVariante, nomesDasVariantes)}
        onCancelar={() => setDialogoVar(null)}
        onConfirmar={async (nome) => {
          await store.getState().duplicarVariante(nome);
          setDialogoVar(null);
        }}
      />
      <DialogoNomeVariante
        aberto={dialogoVar?.tipo === 'renomear'}
        titulo="Renomear variante"
        rotuloConfirmar="Renomear"
        nomeInicial={dialogoVar?.tipo === 'renomear' ? nomeDe(dialogoVar.id) : ''}
        onCancelar={() => setDialogoVar(null)}
        onConfirmar={async (nome) => {
          if (dialogoVar?.tipo === 'renomear') await store.getState().renomearVariante(dialogoVar.id, nome);
          setDialogoVar(null);
        }}
      />
      <DialogoExcluirVariante
        aberto={dialogoVar?.tipo === 'excluir'}
        nome={dialogoVar?.tipo === 'excluir' ? nomeDe(dialogoVar.id) : ''}
        naoSalva={
          dialogoVar?.tipo === 'excluir' && dialogoVar.id === store.getState().documento.variante?._id && sujo
        }
        onCancelar={() => setDialogoVar(null)}
        onConfirmar={async () => {
          if (dialogoVar?.tipo === 'excluir') await store.getState().excluirVariante(dialogoVar.id);
          setDialogoVar(null);
        }}
      />
      <DialogoTemplates
        aberto={galeriaAberta}
        areaUtil={variante.areaUtil ?? dados.interior}
        bordaPadrao={bordaPadrao}
        temEscala={dados.metodo !== null}
        nomesExistentes={nomesDasVariantes}
        onCancelar={() => store.getState().fecharGaleria()}
        onPosicionar={(escolha) => store.getState().abrirPosicionarTemplate(escolha)}
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
