import {
  AGRUPAR_SETAS_MS,
  alternarOrientacao,
  aplicarTemplate,
  areaUtilForaDaParede,
  arredondarCm,
  BORDA_MAX_CM,
  centralizarNaAreaUtil,
  duplicarFoto as duplicarFotoDaComposicao,
  encaixarConjunto,
  encaixarPosicao,
  enviarParaTras as enviarParaTrasNaOrdem,
  estadoDeSalvamento,
  FALHAS_ANTES_DO_AVISO,
  formatarHoraMinuto,
  HISTORICO_LIMITE,
  limitarAreaUtil,
  limitarConjunto,
  limitarPosicao,
  maiorQueAreaUtil,
  moverPorTeclado,
  mudarBorda,
  mudarTamanho,
  nomeDoTemplateUnico,
  novaFoto,
  orientacaoDe,
  paredeInteira,
  preencherVaga as preencherVagaNaVariante,
  rascunhoDesatualizado,
  semFoto,
  templatePorId,
  trazerParaFrente as trazerParaFrenteNaOrdem,
  truncarNome,
  type AreaUtil,
  type Borda,
  type DirecaoSeta,
  type FotoNaParede,
  type Grid,
  type OffsetRecorte,
  type OrientacaoEscolhida,
  type Perfil,
  type Pt,
  type Tamanho,
} from '@deco-wall/domain';
import { ObjectId } from 'bson';
import { temporal, type TemporalState } from 'zundo';
import { immer } from 'zustand/middleware/immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  ErroApi,
  type ClienteApi,
  type ConteudoRascunho,
  type DadosPerspectiva,
  type ImagemDto,
  type OrigemVariante,
  type ProjetoDto,
  type RespostaParede,
  type ResumoRascunhoDto,
  type SegmentoLinear,
  type VarianteDto,
} from '../infra/dto';

// Store do editor (ADR-03, docs/specs/M1-parede-e-escala.md §3.8, §6 e docs/specs/M2-biblioteca-e-composicao.md
// §4.7, §6): fatias `documento` (projeto aberto), `ui`, `biblioteca` e `config`, mais o `conteudo` desfazível da
// variante aberta. O zundo guarda o histórico só desse `conteudo` (M2-13): ele é uma chave de primeiro nível
// porque o zundo restaura o estado mesclando só o primeiro nível, e assim desfazer nunca toca no projeto, nas
// revisões nem no grid. Mutações só por ações nomeadas.

export type Modo = 'editor' | 'perspectiva' | 'calibracao' | 'area-util' | 'recorte' | 'template';
// Texto da barra do modo Área útil (§3.6): de onde o usuário veio.
export type ContextoAreaUtil = 'perspectiva' | 'linear' | 'ajuste';

export type EstadoSalvamentoStore =
  | { tipo: 'salvo'; em?: Date }
  | { tipo: 'alteracoes' }
  | { tipo: 'salvando' }
  | { tipo: 'rascunho'; em: Date }
  | { tipo: 'conflito' };

// Origem do 409: outra aba salvou a variante (§3.8, M3 §3.5) ou alterou a parede do projeto (SV-09). Na variante,
// `deRascunho` diz se o conflito veio do rascunho (só `Alert`) ou do Salvar (diálogo); `excluida` é o 404 (M3-09);
// `salva` é a versão oficial, buscada para os cartões do diálogo.
export type Conflito =
  | { origem: 'variante'; salvaEm: Date; deRascunho: boolean; excluida: boolean; salva: VarianteDto | null }
  | { origem: 'projeto' };

// M3 (A-01): uma linha do seletor. A contagem da ativa vem do conteúdo em tela (`resumoDasVariantes`).
export interface ItemLista {
  _id: string;
  nome: string;
  ordem: number;
  qtdFotos: number;
  semFoto: number;
}

// M3-10: o que a comparação mostra de uma variante (a ativa em memória, as outras no cache).
export interface VisaoDaVariante {
  _id: string;
  nome: string;
  grid: Grid;
  conteudo: ConteudoVariante;
  naoSalva: boolean;
}

export interface ResumoVariante extends ItemLista {
  ativa: boolean;
  naoSalva: boolean;
}

// M3-08: a oferta de recuperar um rascunho mais novo que a versão oficial.
export interface Recuperacao {
  varianteId: string;
  sessaoId: string;
  salvoEm: Date;
  revisaoBase: number;
  qtdFotos: number;
  // Base antiga (SV-07): a revisão oficial passou da que o rascunho conhecia.
  desatualizado: boolean;
  // Com base antiga, o conteúdo do rascunho vem antes da escolha, para o diálogo mostrar as duas versões (A-09).
  previa: ConteudoRascunho | null;
}

// M3, RN-32: o posicionamento do template, com as vagas já calculadas pelo domínio.
export interface EstadoTemplate {
  templateId: string;
  nome: string;
  borda: Borda;
  // Caixa do conjunto, com o canto superior esquerdo na posição atual.
  conjunto: AreaUtil;
  fotos: FotoNaParede[];
  vagasMaiores: number;
  maiorQueAreaUtil: boolean;
  criando: boolean;
  erro: string | null;
}

// O que o desfazer cobre (M2-03): fotos, área útil e borda padrão. O grid fica de fora.
export interface ConteudoVariante {
  fotos: FotoNaParede[];
  areaUtil: AreaUtil | null;
  bordaPadrao: Borda;
}

// A variante aberta sem a parte desfazível, que vive em `conteudo`.
export type VarianteAberta = Omit<VarianteDto, keyof ConteudoVariante>;

// O que o servidor tem da variante (último carregamento ou salvamento): serve ao status depois de desfazer
// (A-26) e aos filtros da biblioteca (M2-05).
export interface SnapshotSalvo {
  grid: Grid;
  conteudo: ConteudoVariante;
  // Hora do último salvamento desta sessão; sem salvamento, o estado aberto não tem hora.
  em?: Date;
}

export interface Documento {
  projeto: ProjetoDto | null;
  variante: VarianteAberta | null;
  salvo: SnapshotSalvo | null;
  // Revisão oficial que esta sessão carregou ou gravou por último (SV-04).
  revisaoBase: number;
  sujo: boolean;
  // Conta alterações locais.
  alteracoes: number;
  sessaoId: string;
  salvamento: EstadoSalvamentoStore;
  conflito: Conflito | null;
  erroSalvamento: string | null;
  // M3: todas as variantes do projeto, na ordem; aviso do rascunho depois de falhas seguidas (A-07).
  lista: ItemLista[];
  avisoRascunho: boolean;
  // Hora da última alteração local da ativa (cartão "A minha" do conflito, A-14).
  alteradoEm: Date | null;
  carregando: boolean;
  erroCarregar: string | null;
}

// Rascunho do modo de recorte (RN-14, DESIGN §7.0): só vira foto ao concluir.
export interface RascunhoRecorte {
  fotoId: string;
  tamanho: Tamanho;
  offset: OffsetRecorte;
  // Mostra os campos Largura × Altura (RN-28): tamanho personalizado, ou "Personalizado…" escolhido.
  personalizado: boolean;
}

// Posição da foto enquanto é arrastada (A-07): fora do desfazer; o `dragend` grava na store.
export interface Arrasto {
  id: string;
  xCm: number;
  yCm: number;
}

export interface Ui {
  modo: Modo;
  contextoAreaUtil: ContextoAreaUtil;
  // RN-35: a escala foi refeita e a área útil ficou fora da parede inteira.
  avisoAreaUtilFora: boolean;
  // Foto selecionada na parede (seleção única — A-06) e imagem escolhida na biblioteca (A-03).
  selecaoId: string | null;
  bibliotecaSelecaoId: string | null;
  recorte: RascunhoRecorte | null;
  arrasto: Arrasto | null;
  // M3: diálogo de conflito, oferta de recuperação, galeria e posicionamento de template.
  dialogoConflito: boolean;
  recuperacao: Recuperacao | null;
  galeriaAberta: boolean;
  template: EstadoTemplate | null;
  avisoCriacao: string | null;
}

export interface Biblioteca {
  imagens: ImagemDto[];
  carregando: boolean;
  erro: string | null;
}

export interface OpcoesStore {
  // Ids de foto novos; o padrão usa ObjectId (ADR-07). Os testes injetam uma sequência.
  gerarId?: () => string;
}

export interface EstadoEditor {
  documento: Documento;
  // Fotos, área útil e borda padrão da variante aberta: a única parte que o zundo guarda (M2-13).
  conteudo: ConteudoVariante | null;
  ui: Ui;
  biblioteca: Biblioteca;
  // A-28: limite de upload lido do servidor; 50 MB até a leitura chegar.
  config: { uploadMaxMb: number; autosaveMinutos: number };
  // Quantos passos há para desfazer e refazer (espelho do zundo, para a UI reagir).
  passos: { desfazer: number; refazer: number };
  abrirProjeto(id: string): Promise<void>;
  recarregar(): Promise<void>;
  renomearProjeto(nome: string): Promise<void>;
  definirModo(modo: Modo): void;
  dispensarAvisoAreaUtil(): void;
  alterarGrid(parcial: Partial<Grid>): void;
  definirAreaUtil(area: AreaUtil): void;
  usarParedeInteira(): void;
  confirmarAreaUtil(area: AreaUtil): void;
  enviarParede(
    arquivo: File,
    perfil: Perfil,
    onProgresso?: (fracao: number) => void,
    sinal?: AbortSignal,
  ): Promise<void>;
  aplicarCalibracao(linear: SegmentoLinear): Promise<void>;
  aplicarPerspectiva(perspectiva: DadosPerspectiva, retificada: Blob, sinal?: AbortSignal): Promise<void>;
  salvarVariante(): Promise<void>;

  // ---- M2: configuração e biblioteca ----
  carregarConfig(): Promise<void>;
  carregarBiblioteca(): Promise<void>;
  adotarImagem(imagem: ImagemDto): void;
  selecionarImagemDaBiblioteca(id: string | null): void;

  // ---- M2: fotos na parede (RF-30 a RF-35, RF-41, A-04) ----
  // Devolve o id da foto criada, ou null se não deu (sem escala ou imagem fora da biblioteca).
  adicionarFoto(imagemId: string, centroCm?: Pt): string | null;
  adicionarFotoSelecionada(): string | null;
  selecionarFoto(id: string | null): void;
  // Arraste e campos X/Y: com snap ligado encaixa no grid (M2-12) e respeita o limite da M2-11.
  moverFoto(id: string, xCm: number, yCm: number): void;
  alterarPosicao(id: string, xCm: number, yCm: number): void;
  definirArrasto(arrasto: Arrasto | null): void;
  moverPorSeta(id: string, direcao: DirecaoSeta, shift: boolean): void;
  trocarTamanho(id: string, tamanho: Tamanho): void;
  trocarOrientacao(id: string, orientacao: OrientacaoEscolhida): void;
  alterarBordaDaFoto(id: string, parcial: Partial<Borda>): void;
  alterarBordaPadrao(parcial: Partial<Borda>): void;
  duplicarFoto(id: string): void;
  removerFoto(id: string): void;
  trazerParaFrente(id: string): void;
  enviarParaTras(id: string): void;

  // ---- M2: modo de recorte (RN-14, RN-28) ----
  abrirRecorte(fotoId: string, opcoes?: { personalizado?: boolean }): void;
  atualizarRecorte(parcial: { tamanho?: Tamanho; offset?: OffsetRecorte; personalizado?: boolean }): void;
  concluirRecorte(): void;
  cancelarRecorte(): void;

  // ---- M2: desfazer e refazer (RF-70, RN-18) ----
  desfazer(): void;
  refazer(): void;
  podeDesfazer(): boolean;
  podeRefazer(): boolean;

  // ---- M3: comparação (RF-92, M3-10): o estado de trabalho da variante, só para leitura ----
  visaoDaVariante(id: string): VisaoDaVariante | null;

  // ---- M3: variantes (RF-91, M3-03 a M3-05) ----
  // Só a ativa tem estado de trabalho: com alterações não salvas (ou fora do modo editor), alternar recusa.
  alternarVariante(id: string): Promise<boolean>;
  descartarAlteracoes(): Promise<void>;
  criarVarianteEmBranco(nome: string): Promise<void>;
  duplicarVariante(nome: string): Promise<void>;
  renomearVariante(id: string, nome: string): Promise<void>;
  excluirVariante(id: string): Promise<void>;

  // ---- M3: rascunho, conflito e recuperação (RF-71, RF-73) ----
  salvarRascunho(): Promise<void>;
  dispensarAvisoRascunho(): void;
  abrirDialogoConflito(): Promise<void>;
  fecharDialogoConflito(): void;
  resolverConflito(saida: 'manter' | 'usar-salva' | 'nova-variante'): Promise<void>;
  resolverVarianteExcluida(acao: 'nova' | 'descartar'): Promise<void>;
  recuperarRascunho(): Promise<void>;
  descartarRascunhoOferecido(): Promise<void>;
  fecharRecuperacao(): void;
  recuperarComoNovaVariante(): Promise<void>;

  // ---- M3: vagas e templates (M3-01, RF-93) ----
  preencherVaga(fotoId: string, imagemId: string): void;
  preencherVagaSelecionada(): void;
  abrirGaleria(): void;
  fecharGaleria(): void;
  abrirPosicionarTemplate(escolha: { templateId: string; borda: Borda }): void;
  // Devolve a posição efetiva (com snap e limite), para o nó arrastado acompanhá-la.
  moverConjunto(xCm: number, yCm: number): { xCm: number; yCm: number };
  centralizarConjunto(): void;
  cancelarTemplate(): void;
  confirmarTemplate(): Promise<void>;
  dispensarAvisoCriacao(): void;
}

// O que o zundo guarda a cada passo.
type ParteDesfazivel = { conteudo: ConteudoVariante | null };

export type StoreEditor = StoreApi<EstadoEditor> & { temporal: StoreApi<TemporalState<ParteDesfazivel>> };

function novaSessao(): string {
  return globalThis.crypto.randomUUID();
}

function paredeInteiraDe(projeto: ProjetoDto | null): AreaUtil | null {
  if (!projeto?.parede || projeto.parede.escala.metodo === null) return null;
  return paredeInteira(projeto.parede);
}

const conteudoDe = (v: VarianteDto): ConteudoVariante => ({
  fotos: v.fotos,
  areaUtil: v.areaUtil,
  bordaPadrao: v.bordaPadrao,
});

const semConteudo = ({ fotos: _f, areaUtil: _a, bordaPadrao: _b, ...resto }: VarianteDto): VarianteAberta => {
  void _f;
  void _a;
  void _b;
  return resto;
};

// Os estados do immer são imutáveis e compartilham estrutura: comparar o JSON basta e é barato.
const mesmoConteudo = (a: ConteudoVariante, b: ConteudoVariante) => JSON.stringify(a) === JSON.stringify(b);

const mesmoTamanho = (a: Tamanho, b: Tamanho) =>
  a.sugeridoId === b.sugeridoId && a.larguraCm === b.larguraCm && a.alturaCm === b.alturaCm;

const limitarBorda = (cm: number) => arredondarCm(Math.min(Math.max(cm, 0), BORDA_MAX_CM));

const MENSAGEM_ULTIMA = 'Todo projeto precisa de ao menos uma variante.';
const MENSAGEM_SUJA = 'Há alterações não salvas.';

const itemDe = (v: VarianteDto): ItemLista => ({
  _id: v._id,
  nome: v.nome,
  ordem: v.ordem,
  qtdFotos: v.fotos.length,
  semFoto: semFoto(v.fotos),
});

// A-05: o que se guarda de uma variante salva que não está aberta; a pilha do zundo volta na reativação.
interface EntradaCache {
  variante: VarianteAberta;
  conteudo: ConteudoVariante;
  salvo: SnapshotSalvo;
  revisaoBase: number;
  past: Partial<ParteDesfazivel>[];
  future: Partial<ParteDesfazivel>[];
}

const entradaDe = (v: VarianteDto, em?: Date): EntradaCache => ({
  variante: semConteudo(v),
  conteudo: conteudoDe(v),
  salvo: { grid: v.grid, conteudo: conteudoDe(v), em },
  revisaoBase: v.revisao,
  past: [],
  future: [],
});

// A-01: lista do seletor, com a contagem da ativa tirada do conteúdo em tela (M3-02).
export function resumoDasVariantes(estado: EstadoEditor): ResumoVariante[] {
  const ativa = estado.documento.variante;
  return estado.documento.lista.map((item) =>
    ativa && ativa._id === item._id && estado.conteudo
      ? {
          ...item,
          nome: ativa.nome,
          qtdFotos: estado.conteudo.fotos.length,
          semFoto: semFoto(estado.conteudo.fotos),
          ativa: true,
          naoSalva: estado.documento.sujo,
        }
      : { ...item, ativa: false, naoSalva: false },
  );
}

const mensagemDe = (erro: unknown, padrao: string) => (erro instanceof Error ? erro.message : padrao);

export function criarStoreEditor(api: ClienteApi, opcoes: OpcoesStore = {}): StoreEditor {
  const gerarId = opcoes.gerarId ?? (() => new ObjectId().toHexString());

  // A-08: a última seta, para agrupar as seguintes (mesma foto, menos de 1 s e nenhuma outra mudança no meio).
  let ultimaSeta: { id: string; em: number; conteudo: ConteudoVariante | null } | null = null;

  // M3 (A-05): as variantes salvas que não estão abertas, o que o rascunho da sessão já gravou (A-06, A-07) e as
  // ofertas de recuperação já feitas (A-08). Fora da store: a UI só precisa do `lista` e do `ui.recuperacao`.
  const cache = new Map<string, EntradaCache>();
  const jaOfereceu = new Set<string>();
  let resumosRascunho: ResumoRascunhoDto[] = [];
  let rascunhoGravado: { snapshot: string; em: Date } | null = null;
  let falhasRascunho = 0;
  let sequenciaPrevia = 0;

  const store: StoreEditor = createStore<EstadoEditor>()(
    temporal(
      immer((set, get) => {
        const historico = () => store.temporal.getState();

        // Roda uma mudança sem criar passo de desfazer.
        const semPasso = <T>(fazer: () => T): T => {
          const t = historico();
          t.pause();
          try {
            return fazer();
          } finally {
            t.resume();
          }
        };

        // A-26: o conteúdo e o grid iguais ao último salvamento voltam o status a "Salvo"; senão, "Alterações não
        // salvas". Vale dentro de um `set` do immer.
        const reavaliarStatus = (estado: EstadoEditor) => {
          const doc = estado.documento;
          if (!doc.salvo || !estado.conteudo || !doc.variante) return;
          doc.alteradoEm = new Date();
          const igual =
            JSON.stringify(estado.conteudo) === JSON.stringify(doc.salvo.conteudo) &&
            JSON.stringify(doc.variante.grid) === JSON.stringify(doc.salvo.grid);
          doc.sujo = !igual;
          if (doc.salvamento.tipo === 'salvando' || doc.salvamento.tipo === 'conflito') return;
          // A-06: difere da oficial e nada mudou depois do rascunho = "Rascunho salvo".
          const mudouDepoisDoRascunho =
            !rascunhoGravado ||
            JSON.stringify({ grid: doc.variante.grid, conteudo: estado.conteudo }) !==
              rascunhoGravado.snapshot;
          const situacao = estadoDeSalvamento({
            conflito: false,
            salvando: false,
            sujoOficial: !igual,
            sujoRascunho: mudouDepoisDoRascunho,
            salvoEm: doc.salvo.em,
            rascunhoEm: rascunhoGravado?.em,
          });
          doc.salvamento =
            situacao.tipo === 'salvo'
              ? { tipo: 'salvo', em: situacao.em }
              : situacao.tipo === 'rascunho'
                ? { tipo: 'rascunho', em: situacao.em }
                : { tipo: 'alteracoes' };
        };

        // Marca a variante como alterada, mesmo que o conteúdo seja igual ao salvo (confirmar a área útil).
        const sujar = (estado: EstadoEditor) => {
          estado.documento.sujo = true;
          estado.documento.alteradoEm = new Date();
          estado.documento.alteracoes += 1;
          if (
            estado.documento.salvamento.tipo !== 'salvando' &&
            estado.documento.salvamento.tipo !== 'conflito'
          ) {
            estado.documento.salvamento = { tipo: 'alteracoes' };
          }
        };

        // SV-09: o servidor devolve o projeto e as novas revisões das variantes tocadas (área útil inicial
        // ou zerada). Adotá-las evita que o próximo salvamento da variante dê 409 contra si mesmo. A área útil
        // vinda do servidor não é passo do usuário: não entra no desfazer.
        const adotarResposta = (resposta: RespostaParede) => {
          semPasso(() =>
            set((estado) => {
              estado.documento.projeto = resposta.projeto;
              const variante = estado.documento.variante;
              if (!variante) return;
              const alterada = resposta.variantesAlteradas.find((v) => v._id === variante._id);
              if (alterada) {
                variante.revisao = alterada.revisao;
                estado.documento.revisaoBase = alterada.revisao;
                if (estado.conteudo) estado.conteudo.areaUtil = alterada.areaUtil;
                if (estado.documento.salvo) estado.documento.salvo.conteudo.areaUtil = alterada.areaUtil;
              }
            }),
          );
        };

        const registrarConflitoDoProjeto = (erro: unknown) => {
          if (erro instanceof ErroApi && erro.status === 409) {
            set((estado) => {
              estado.documento.conflito = { origem: 'projeto' };
              estado.documento.salvamento = { tipo: 'conflito' };
            });
          }
        };

        // Depois de refazer a escala: se a área útil ficou fora da nova parede inteira, avisa (RN-35).
        const conferirAreaUtil = () => {
          const { projeto } = get().documento;
          const areaUtil = get().conteudo?.areaUtil;
          const parede = paredeInteiraDe(projeto);
          set((estado) => {
            estado.ui.avisoAreaUtilFora = Boolean(
              parede && areaUtil && areaUtilForaDaParede(areaUtil, parede),
            );
          });
        };

        // M3-08, A-08: na primeira ativação da variante na sessão, oferece o rascunho elegível, se houver.
        const oferecerRecuperacao = (varianteId: string) => {
          if (jaOfereceu.has(varianteId)) return;
          jaOfereceu.add(varianteId);
          const resumo = resumosRascunho.find((r) => r.varianteId === varianteId);
          const variante = get().documento.variante;
          if (!resumo || !variante || variante._id !== varianteId) return;
          const desatualizado = rascunhoDesatualizado(resumo, variante);
          set((estado) => {
            estado.ui.recuperacao = {
              varianteId,
              sessaoId: resumo.sessaoId,
              salvoEm: new Date(resumo.salvoEm),
              revisaoBase: resumo.revisaoBase,
              qtdFotos: resumo.qtdFotos,
              desatualizado,
              previa: null,
            };
          });
          if (!desatualizado) return;
          const projetoId = get().documento.projeto?._id;
          if (!projetoId) return;
          api
            .obterRascunho(projetoId, varianteId, resumo.sessaoId)
            .then((rascunho) =>
              set((estado) => {
                const oferta = estado.ui.recuperacao;
                if (oferta && oferta.varianteId === varianteId) oferta.previa = rascunho.conteudo;
              }),
            )
            .catch(() => undefined);
        };

        // A contagem do seletor da ativa acompanha o conteúdo, mas a lista guarda a última situação salva.
        const sincronizarLista = (estado: EstadoEditor) => {
          const v = estado.documento.variante;
          const c = estado.conteudo;
          if (!v || !c) return;
          const item = estado.documento.lista.find((i) => i._id === v._id);
          if (!item) return;
          item.nome = v.nome;
          item.qtdFotos = c.fotos.length;
          item.semFoto = semFoto(c.fotos);
        };

        // A-05: a ativa, limpa, vai para o cache com a pilha de desfazer; a escolhida vem de lá.
        const guardarAtivaNoCache = () => {
          const doc = get().documento;
          const conteudo = get().conteudo;
          if (!doc.variante || !conteudo || !doc.salvo) return;
          const t = historico();
          cache.set(doc.variante._id, {
            variante: doc.variante,
            conteudo,
            salvo: doc.salvo,
            revisaoBase: doc.revisaoBase,
            past: [...t.pastStates],
            future: [...t.futureStates],
          });
        };

        const ativarEntrada = (entrada: EntradaCache) => {
          rascunhoGravado = null;
          falhasRascunho = 0;
          ultimaSeta = null;
          semPasso(() => {
            set((estado) => {
              const doc = estado.documento;
              doc.variante = entrada.variante;
              estado.conteudo = entrada.conteudo;
              doc.salvo = entrada.salvo;
              doc.revisaoBase = entrada.revisaoBase;
              doc.sujo = false;
              doc.alteracoes = 0;
              doc.salvamento = { tipo: 'salvo', em: entrada.salvo.em };
              doc.conflito = null;
              doc.erroSalvamento = null;
              doc.avisoRascunho = false;
              doc.alteradoEm = null;
              estado.ui.dialogoConflito = false;
              estado.ui.selecaoId = null;
              estado.ui.recorte = null;
              estado.ui.arrasto = null;
              sincronizarLista(estado);
            });
            // A pilha da variante entra sem registrar a troca como passo (RN-18, PRD aceite 12).
            store.temporal.setState({ pastStates: entrada.past, futureStates: entrada.future });
          });
        };

        // "Usar a salva" e o 409: a versão oficial vira o estado de trabalho; histórico e rascunho da sessão saem.
        const adotarVersaoSalva = (salva: VarianteDto) => {
          ativarEntrada(entradaDe(salva, new Date(salva.salvaEm)));
        };

        const apagarRascunhoDaSessao = async () => {
          const { projeto, variante, sessaoId } = get().documento;
          if (!projeto || !variante) return;
          try {
            await api.apagarRascunho(projeto._id, variante._id, sessaoId);
          } catch {
            // O rascunho velho some no próximo salvamento (A-10); não atrapalha o que o usuário decidiu.
          }
        };

        const registrarNovaNaLista = (nova: VarianteDto) => {
          set((estado) => {
            estado.documento.lista.push(itemDe(nova));
            if (estado.documento.projeto) estado.documento.projeto.ultimaVarianteId = nova._id;
          });
          jaOfereceu.add(nova._id);
        };

        // Cria no servidor e abre a nova (com a ativa limpa, M3-03). Grid, borda padrão e área útil vêm da ativa
        // em tela (M3-05).
        const criarEAtivar = async (nome: string, origem: OrigemVariante): Promise<VarianteDto> => {
          const { projeto, variante, sessaoId, sujo } = get().documento;
          const conteudo = get().conteudo;
          if (!projeto || !variante || !conteudo) throw new Error('Nenhum projeto aberto.');
          if (sujo) throw new Error(MENSAGEM_SUJA);
          const nova = await api.criarVariante(projeto._id, {
            sessaoId,
            nome,
            grid: variante.grid,
            bordaPadrao: conteudo.bordaPadrao,
            areaUtil: conteudo.areaUtil,
            origem,
          });
          guardarAtivaNoCache();
          registrarNovaNaLista(nova);
          ativarEntrada(entradaDe(nova));
          return nova;
        };

        // Variante vizinha (anterior na ordem, ou a seguinte se era a primeira) para depois de uma exclusão.
        const vizinhaDe = (id: string): ItemLista | undefined => {
          const lista = get().documento.lista;
          const i = lista.findIndex((item) => item._id === id);
          return lista[i - 1] ?? lista[i + 1];
        };

        const tirarDaLista = (id: string) => {
          set((estado) => {
            estado.documento.lista = estado.documento.lista.filter((item) => item._id !== id);
          });
        };

        // Busca a versão oficial para os cartões do diálogo de conflito (A-14).
        const buscarVersaoSalva = async () => {
          const { projeto, variante, conflito } = get().documento;
          if (
            !projeto ||
            !variante ||
            conflito?.origem !== 'variante' ||
            conflito.excluida ||
            conflito.salva
          ) {
            return;
          }
          try {
            const salva = await api.obterVariante(projeto._id, variante._id);
            set((estado) => {
              const atual = estado.documento.conflito;
              if (atual?.origem === 'variante') atual.salva = salva;
            });
          } catch (erro) {
            if (erro instanceof ErroApi && erro.status === 404) {
              set((estado) => {
                const atual = estado.documento.conflito;
                if (atual?.origem === 'variante') atual.excluida = true;
              });
            }
          }
        };

        const carregar = async (id: string) => {
          const { projeto, variantes, rascunhos } = await api.obterProjeto(id);
          const variante = variantes.find((v) => v._id === projeto.ultimaVarianteId) ?? variantes[0] ?? null;
          cache.clear();
          jaOfereceu.clear();
          // As fakes de teste do M1/M2 não devolvem rascunhos.
          resumosRascunho = rascunhos ?? [];
          rascunhoGravado = null;
          falhasRascunho = 0;
          for (const v of variantes) if (v._id !== variante?._id) cache.set(v._id, entradaDe(v));
          set((estado) => {
            estado.documento.lista = variantes.map(itemDe);
            estado.documento.avisoRascunho = false;
            estado.ui.dialogoConflito = false;
            estado.ui.recuperacao = null;
            estado.ui.galeriaAberta = false;
            estado.ui.template = null;
            estado.ui.avisoCriacao = null;
            estado.documento.projeto = projeto;
            estado.documento.variante = variante ? semConteudo(variante) : null;
            estado.conteudo = variante ? conteudoDe(variante) : null;
            estado.documento.salvo = variante
              ? { grid: variante.grid, conteudo: conteudoDe(variante) }
              : null;
            estado.documento.revisaoBase = variante?.revisao ?? 0;
            estado.documento.sujo = false;
            estado.documento.alteracoes = 0;
            estado.documento.salvamento = { tipo: 'salvo' };
            estado.documento.conflito = null;
            estado.documento.erroSalvamento = null;
            estado.ui.modo = 'editor';
            estado.ui.avisoAreaUtilFora = false;
            estado.ui.selecaoId = null;
            estado.ui.recorte = null;
            estado.ui.arrasto = null;
          });
          // A-27: abrir e recarregar (depois de um 409) descartam o histórico.
          historico().clear();
          ultimaSeta = null;
          if (variante) oferecerRecuperacao(variante._id);
        };

        // Aplica uma mudança ao conteúdo desfazível como UM passo do histórico (M2-03). A função recebe o conteúdo
        // atual e devolve o novo (ou null); sem mudança real, nada é registrado.
        const alterarConteudo = (calcular: (c: ConteudoVariante) => ConteudoVariante | null): boolean => {
          const antes = get().conteudo;
          if (!antes) return false;
          const depois = calcular(antes);
          if (!depois || mesmoConteudo(antes, depois)) return false;
          set((estado) => {
            estado.conteudo = depois;
            estado.documento.alteracoes += 1;
            reavaliarStatus(estado);
          });
          return true;
        };

        const trocarFoto = (id: string, calcular: (f: FotoNaParede) => FotoNaParede): boolean =>
          alterarConteudo((c) =>
            c.fotos.some((f) => f._id === id)
              ? { ...c, fotos: c.fotos.map((f) => (f._id === id ? calcular(f) : f)) }
              : null,
          );

        // M2-11: movimentos do usuário mantêm 1 cm da foto dentro da parede inteira.
        const posicionar = (f: FotoNaParede, x: number, y: number): FotoNaParede => {
          const grid = get().documento.variante?.grid;
          const parede = paredeInteiraDe(get().documento.projeto);
          const encaixada = grid
            ? encaixarPosicao({ x, y }, grid)
            : { x: arredondarCm(x), y: arredondarCm(y) };
          const movida = { ...f, xCm: encaixada.x, yCm: encaixada.y };
          return parede ? { ...movida, ...limitarPosicao(movida, parede) } : movida;
        };

        // Depois de desfazer ou refazer: a seleção que sumiu cai, e o status acompanha o conteúdo (A-26).
        const aposDesfazer = () => {
          set((estado) => {
            const id = estado.ui.selecaoId;
            if (id && !estado.conteudo?.fotos.some((f) => f._id === id)) estado.ui.selecaoId = null;
            estado.documento.alteracoes += 1;
            reavaliarStatus(estado);
          });
        };

        return {
          documento: {
            projeto: null,
            variante: null,
            salvo: null,
            revisaoBase: 0,
            sujo: false,
            alteracoes: 0,
            sessaoId: novaSessao(),
            salvamento: { tipo: 'salvo' },
            conflito: null,
            erroSalvamento: null,
            lista: [],
            avisoRascunho: false,
            alteradoEm: null,
            carregando: false,
            erroCarregar: null,
          },
          conteudo: null,
          ui: {
            modo: 'editor',
            contextoAreaUtil: 'ajuste',
            avisoAreaUtilFora: false,
            selecaoId: null,
            bibliotecaSelecaoId: null,
            recorte: null,
            arrasto: null,
            dialogoConflito: false,
            recuperacao: null,
            galeriaAberta: false,
            template: null,
            avisoCriacao: null,
          },
          biblioteca: { imagens: [], carregando: false, erro: null },
          config: { uploadMaxMb: 50, autosaveMinutos: 5 },
          passos: { desfazer: 0, refazer: 0 },

          async abrirProjeto(id) {
            set((estado) => {
              estado.documento.carregando = true;
              estado.documento.erroCarregar = null;
            });
            try {
              await carregar(id);
            } catch (erro) {
              set((estado) => {
                estado.documento.erroCarregar =
                  erro instanceof Error ? erro.message : 'Não foi possível abrir o projeto.';
              });
            } finally {
              set((estado) => {
                estado.documento.carregando = false;
              });
            }
          },

          async recarregar() {
            const projeto = get().documento.projeto;
            if (projeto) await carregar(projeto._id);
          },

          async renomearProjeto(nome) {
            const projeto = get().documento.projeto;
            if (!projeto) return;
            const atualizado = await api.renomearProjeto(projeto._id, nome.trim());
            set((estado) => {
              if (estado.documento.projeto) {
                estado.documento.projeto.nome = atualizado.nome;
                estado.documento.projeto.atualizadoEm = atualizado.atualizadoEm;
              }
            });
          },

          definirModo(modo) {
            set((estado) => {
              estado.ui.modo = modo;
              if (modo === 'area-util') estado.ui.contextoAreaUtil = 'ajuste';
            });
          },

          dispensarAvisoAreaUtil() {
            set((estado) => {
              estado.ui.avisoAreaUtilFora = false;
            });
          },

          // O grid é auxílio de visão: marca a variante como alterada, mas não entra no desfazer (M2-03).
          alterarGrid(parcial) {
            set((estado) => {
              if (!estado.documento.variante) return;
              Object.assign(estado.documento.variante.grid, parcial);
              estado.documento.alteracoes += 1;
              reavaliarStatus(estado);
            });
          },

          // M1-04, M2-03: a área útil é da variante e entra no desfazer.
          definirAreaUtil(area) {
            const parede = paredeInteiraDe(get().documento.projeto);
            if (!parede) return;
            alterarConteudo((c) => ({ ...c, areaUtil: limitarAreaUtil(area, parede) }));
          },

          usarParedeInteira() {
            const parede = paredeInteiraDe(get().documento.projeto);
            if (!parede) return;
            alterarConteudo((c) => ({ ...c, areaUtil: parede }));
          },

          confirmarAreaUtil(area) {
            const antes = get().documento.alteracoes;
            get().definirAreaUtil(area);
            set((estado) => {
              // Confirmar sempre conta como alteração da variante (M1 §3.6), mesmo com a área igual à gravada.
              if (estado.documento.alteracoes === antes) sujar(estado);
              estado.ui.modo = 'editor';
              estado.ui.avisoAreaUtilFora = false;
            });
          },

          async enviarParede(arquivo, perfil, onProgresso, sinal) {
            const projeto = get().documento.projeto;
            if (!projeto) return;
            try {
              const resposta = await api.enviarParede(
                projeto._id,
                { arquivo, perfil, revisaoBase: projeto.revisao },
                { onProgresso, sinal },
              );
              adotarResposta(resposta);
              // A-27: trocar a parede descarta o histórico.
              historico().clear();
              ultimaSeta = null;
              set((estado) => {
                estado.ui.modo = 'perspectiva'; // M1-06: o upload abre direto o modo Perspectiva
                estado.ui.avisoAreaUtilFora = false;
              });
            } catch (erro) {
              registrarConflitoDoProjeto(erro);
              throw erro;
            }
          },

          async aplicarCalibracao(linear) {
            const projeto = get().documento.projeto;
            if (!projeto) return;
            try {
              const resposta = await api.aplicarCalibracao(projeto._id, {
                revisaoBase: projeto.revisao,
                linear,
              });
              adotarResposta(resposta);
              // Primeira escala (o servidor gravou a área útil): abre o modo Área útil (M1-08).
              const primeira = resposta.variantesAlteradas.some((v) => v.areaUtil !== null);
              set((estado) => {
                estado.ui.modo = primeira ? 'area-util' : 'editor';
                estado.ui.contextoAreaUtil = 'linear';
              });
              conferirAreaUtil();
            } catch (erro) {
              registrarConflitoDoProjeto(erro);
              throw erro;
            }
          },

          async aplicarPerspectiva(perspectiva, retificada, sinal) {
            const projeto = get().documento.projeto;
            if (!projeto) return;
            try {
              const resposta = await api.aplicarPerspectiva(
                projeto._id,
                { revisaoBase: projeto.revisao, perspectiva },
                retificada,
                { sinal },
              );
              adotarResposta(resposta);
              const primeira = resposta.variantesAlteradas.some((v) => v.areaUtil !== null);
              set((estado) => {
                estado.ui.modo = primeira ? 'area-util' : 'editor';
                estado.ui.contextoAreaUtil = 'perspectiva';
              });
              conferirAreaUtil();
            } catch (erro) {
              registrarConflitoDoProjeto(erro);
              throw erro;
            }
          },

          // ---- M2: configuração e biblioteca ----

          async carregarConfig() {
            try {
              const { uploadMaxMb, autosaveMinutos } = await api.obterConfig();
              set((estado) => {
                estado.config.uploadMaxMb = uploadMaxMb;
                if (autosaveMinutos) estado.config.autosaveMinutos = autosaveMinutos;
              });
            } catch {
              // Sem a configuração, vale o padrão de 50 MB; o servidor confere de qualquer forma.
            }
          },

          async carregarBiblioteca() {
            set((estado) => {
              estado.biblioteca.carregando = true;
            });
            try {
              const imagens = await api.listarImagens();
              set((estado) => {
                estado.biblioteca.imagens = imagens;
                estado.biblioteca.erro = null;
              });
            } catch (erro) {
              set((estado) => {
                estado.biblioteca.erro =
                  erro instanceof Error ? erro.message : 'Não foi possível carregar a biblioteca.';
              });
            } finally {
              set((estado) => {
                estado.biblioteca.carregando = false;
              });
            }
          },

          adotarImagem(imagem) {
            set((estado) => {
              if (estado.biblioteca.imagens.some((i) => i._id === imagem._id)) return;
              estado.biblioteca.imagens.unshift(imagem);
            });
          },

          selecionarImagemDaBiblioteca(id) {
            set((estado) => {
              estado.ui.bibliotecaSelecaoId = id;
            });
          },

          // ---- M2: fotos na parede ----

          adicionarFoto(imagemId, centroCm) {
            const { projeto, variante } = get().documento;
            const conteudo = get().conteudo;
            const imagem = get().biblioteca.imagens.find((i) => i._id === imagemId);
            const parede = paredeInteiraDe(projeto);
            if (!variante || !conteudo || !imagem || !parede) return null; // RF-13, RN-08: sem escala não há fotos

            const id = gerarId();
            // A-04: no botão, o centro da área útil; ao soltar, o ponto de soltura.
            const area = conteudo.areaUtil ?? parede;
            const nova = novaFoto({
              id,
              imagem,
              bordaPadrao: conteudo.bordaPadrao,
              centroCm: centroCm ?? { x: area.xCm + area.larguraCm / 2, y: area.yCm + area.alturaCm / 2 },
              grid: { snap: variante.grid.snap, passoCm: variante.grid.passoCm },
              fotos: conteudo.fotos,
            });
            // M2-11: soltar muito longe da parede não deixa a foto fora de alcance.
            const foto = { ...nova, ...limitarPosicao(nova, parede) };

            alterarConteudo((c) => ({ ...c, fotos: [...c.fotos, foto] }));
            set((estado) => {
              estado.ui.selecaoId = id;
            });
            return id;
          },

          adicionarFotoSelecionada() {
            const escolhida = get().ui.bibliotecaSelecaoId;
            return escolhida ? get().adicionarFoto(escolhida) : null;
          },

          selecionarFoto(id) {
            set((estado) => {
              const existe = id !== null && estado.conteudo?.fotos.some((f) => f._id === id);
              estado.ui.selecaoId = existe ? id : null;
            });
          },

          alterarPosicao(id, xCm, yCm) {
            trocarFoto(id, (f) => posicionar(f, xCm, yCm));
            set((estado) => {
              estado.ui.arrasto = null;
            });
          },

          moverFoto(id, xCm, yCm) {
            get().alterarPosicao(id, xCm, yCm);
          },

          definirArrasto(arrasto) {
            set((estado) => {
              estado.ui.arrasto = arrasto;
            });
          },

          moverPorSeta(id, direcao, shift) {
            const variante = get().documento.variante;
            if (!variante) return;
            const agora = Date.now();
            const agrupa =
              ultimaSeta !== null &&
              ultimaSeta.id === id &&
              agora - ultimaSeta.em < AGRUPAR_SETAS_MS &&
              ultimaSeta.conteudo === get().conteudo;
            const mover = () =>
              trocarFoto(id, (f) => {
                const p = moverPorTeclado(f, direcao, {
                  shift,
                  grid: { snap: variante.grid.snap, passoCm: variante.grid.passoCm },
                });
                return posicionar(f, p.xCm, p.yCm);
              });
            // A-08: setas seguidas na mesma foto, a menos de 1 s uma da outra, formam 1 passo de desfazer.
            const mudou = agrupa ? semPasso(mover) : mover();
            if (mudou) ultimaSeta = { id, em: agora, conteudo: get().conteudo };
          },

          trocarTamanho(id, tamanho) {
            trocarFoto(id, (f) => mudarTamanho(f, tamanho));
          },

          trocarOrientacao(id, orientacao) {
            trocarFoto(id, (f) => {
              const atual = orientacaoDe(f.tamanho);
              if (atual === 'quadrado' || atual === orientacao) return f;
              return mudarTamanho(f, alternarOrientacao(f.tamanho));
            });
          },

          alterarBordaDaFoto(id, parcial) {
            trocarFoto(id, (f) =>
              mudarBorda(f, {
                larguraCm:
                  parcial.larguraCm === undefined ? f.borda.larguraCm : limitarBorda(parcial.larguraCm),
                cor: parcial.cor ?? f.borda.cor,
              }),
            );
          },

          alterarBordaPadrao(parcial) {
            alterarConteudo((c) => ({
              ...c,
              bordaPadrao: {
                larguraCm:
                  parcial.larguraCm === undefined ? c.bordaPadrao.larguraCm : limitarBorda(parcial.larguraCm),
                cor: parcial.cor ?? c.bordaPadrao.cor,
              },
            }));
          },

          duplicarFoto(id) {
            const variante = get().documento.variante;
            const original = get().conteudo?.fotos.find((f) => f._id === id);
            if (!variante || !original) return;
            const novoId = gerarId();
            const copia = duplicarFotoDaComposicao(original, novoId, {
              snap: variante.grid.snap,
              passoCm: variante.grid.passoCm,
            });
            const parede = paredeInteiraDe(get().documento.projeto);
            const final = parede ? { ...copia, ...limitarPosicao(copia, parede) } : copia;
            alterarConteudo((c) => ({ ...c, fotos: [...c.fotos, final] }));
            set((estado) => {
              estado.ui.selecaoId = novoId;
            });
          },

          removerFoto(id) {
            const removeu = alterarConteudo((c) =>
              c.fotos.some((f) => f._id === id) ? { ...c, fotos: c.fotos.filter((f) => f._id !== id) } : null,
            );
            if (removeu) {
              set((estado) => {
                if (estado.ui.selecaoId === id) estado.ui.selecaoId = null;
              });
            }
          },

          trazerParaFrente(id) {
            alterarConteudo((c) => ({ ...c, fotos: trazerParaFrenteNaOrdem(c.fotos, id) }));
          },

          enviarParaTras(id) {
            alterarConteudo((c) => ({ ...c, fotos: enviarParaTrasNaOrdem(c.fotos, id) }));
          },

          // ---- M2: modo de recorte ----

          abrirRecorte(fotoId, opcoes = {}) {
            const foto = get().conteudo?.fotos.find((f) => f._id === fotoId);
            // M2-06: placeholder não tem imagem para enquadrar.
            if (!foto || foto.imagemId === null || get().ui.modo !== 'editor') return;
            set((estado) => {
              estado.ui.recorte = {
                fotoId,
                tamanho: { ...foto.tamanho },
                offset: { ...foto.recorte },
                personalizado: opcoes.personalizado ?? foto.tamanho.sugeridoId === null,
              };
              estado.ui.selecaoId = fotoId;
              estado.ui.modo = 'recorte';
            });
          },

          atualizarRecorte(parcial) {
            set((estado) => {
              const rascunho = estado.ui.recorte;
              if (!rascunho) return;
              // M2-09, RN-28: mudar o tamanho recentraliza o recorte.
              if (parcial.tamanho && !mesmoTamanho(parcial.tamanho, rascunho.tamanho)) {
                rascunho.tamanho = { ...parcial.tamanho };
                rascunho.offset = { offsetX: 0, offsetY: 0 };
              }
              if (parcial.offset) rascunho.offset = { ...parcial.offset };
              if (parcial.personalizado !== undefined) rascunho.personalizado = parcial.personalizado;
            });
          },

          concluirRecorte() {
            const rascunho = get().ui.recorte;
            if (!rascunho) return;
            trocarFoto(rascunho.fotoId, (f) => {
              const base = mesmoTamanho(rascunho.tamanho, f.tamanho) ? f : mudarTamanho(f, rascunho.tamanho);
              return { ...base, recorte: { ...rascunho.offset } };
            });
            set((estado) => {
              estado.ui.recorte = null;
              estado.ui.modo = 'editor';
            });
          },

          cancelarRecorte() {
            set((estado) => {
              estado.ui.recorte = null;
              estado.ui.modo = 'editor';
            });
          },

          // ---- M2: desfazer e refazer ----

          desfazer() {
            if (get().ui.modo !== 'editor' || !get().conteudo) return;
            if (historico().pastStates.length === 0) return;
            historico().undo();
            ultimaSeta = null;
            aposDesfazer();
          },

          refazer() {
            if (get().ui.modo !== 'editor' || !get().conteudo) return;
            if (historico().futureStates.length === 0) return;
            historico().redo();
            ultimaSeta = null;
            aposDesfazer();
          },

          podeDesfazer: () => get().passos.desfazer > 0,
          podeRefazer: () => get().passos.refazer > 0,

          async salvarVariante() {
            const { projeto, variante, sujo, sessaoId, revisaoBase, salvamento, conflito } = get().documento;
            const conteudo = get().conteudo;
            // A-11: durante o modo de recorte, Salvar e Ctrl+S ficam inativos.
            if (!projeto || !variante || !conteudo || !sujo || salvamento.tipo === 'salvando') return;
            if (get().ui.modo === 'recorte') return;
            // M3-09: com o conflito da variante em aberto, Salvar reabre o diálogo em vez de insistir.
            if (conflito?.origem === 'variante') {
              await get().abrirDialogoConflito();
              return;
            }

            // O que vai para o servidor: depois do salvamento é o novo "último salvo" (A-26, M2-05), mesmo que o
            // usuário mexa enquanto a requisição corre.
            const enviado = { grid: variante.grid, conteudo };
            set((estado) => {
              estado.documento.salvamento = { tipo: 'salvando' };
              estado.documento.erroSalvamento = null;
            });
            try {
              const resposta = await api.salvarVariante(projeto._id, variante._id, {
                sessaoId,
                revisaoBase,
                grid: enviado.grid,
                bordaPadrao: enviado.conteudo.bordaPadrao,
                areaUtil: enviado.conteudo.areaUtil,
                fotos: enviado.conteudo.fotos,
              });
              // SV-02: o hard save vale como nova base; o rascunho da sessão deixa de contar (A-10).
              rascunhoGravado = null;
              falhasRascunho = 0;
              set((estado) => {
                const doc = estado.documento;
                doc.avisoRascunho = false;
                if (doc.variante) {
                  doc.variante.revisao = resposta.revisao;
                  doc.variante.salvaEm = resposta.salvaEm;
                }
                doc.revisaoBase = resposta.revisao;
                doc.salvo = {
                  grid: JSON.parse(JSON.stringify(enviado.grid)) as Grid,
                  conteudo: enviado.conteudo,
                  em: new Date(resposta.salvaEm),
                };
                doc.salvamento = { tipo: 'salvo', em: doc.salvo.em };
                // Se o usuário mexeu durante a gravação, continua sujo.
                reavaliarStatus(estado);
                sincronizarLista(estado);
              });
              // M2-05: os filtros Projeto e Variante refletem o estado salvo, que acabou de mudar.
              void get().carregarBiblioteca();
            } catch (erro) {
              if (erro instanceof ErroApi && erro.status === 409) {
                const salvaEm =
                  typeof erro.corpo.salvaEm === 'string' ? new Date(erro.corpo.salvaEm) : new Date();
                // M3-09: o 409 do Salvar abre o diálogo na hora, com a versão salva para os cartões.
                set((estado) => {
                  estado.documento.conflito = {
                    origem: 'variante',
                    salvaEm,
                    deRascunho: false,
                    excluida: false,
                    salva: null,
                  };
                  estado.documento.salvamento = { tipo: 'conflito' };
                  estado.ui.dialogoConflito = true;
                });
                await buscarVersaoSalva();
              } else if (erro instanceof ErroApi && erro.status === 404) {
                // M3-09: a variante foi excluída em outra aba.
                set((estado) => {
                  estado.documento.conflito = {
                    origem: 'variante',
                    salvaEm: new Date(),
                    deRascunho: false,
                    excluida: true,
                    salva: null,
                  };
                  estado.documento.salvamento = { tipo: 'conflito' };
                  estado.ui.dialogoConflito = true;
                });
              } else {
                set((estado) => {
                  estado.documento.salvamento = { tipo: 'alteracoes' };
                  estado.documento.erroSalvamento =
                    erro instanceof Error ? erro.message : 'Não foi possível salvar.';
                });
              }
              throw erro;
            }
          },

          visaoDaVariante(id) {
            const doc = get().documento;
            const conteudo = get().conteudo;
            if (doc.variante?._id === id && conteudo) {
              return {
                _id: id,
                nome: doc.variante.nome,
                grid: doc.variante.grid,
                conteudo,
                naoSalva: doc.sujo,
              };
            }
            const entrada = cache.get(id);
            if (!entrada) return null;
            return {
              _id: id,
              nome: entrada.variante.nome,
              grid: entrada.variante.grid,
              conteudo: entrada.conteudo,
              naoSalva: false,
            };
          },

          // ---- M3: variantes (RF-91, M3-03 a M3-05, A-05) ----

          async alternarVariante(id) {
            const { projeto, variante, sujo, salvamento } = get().documento;
            if (!projeto || !variante || variante._id === id) return false;
            if (get().ui.modo !== 'editor' || sujo || salvamento.tipo === 'salvando') return false;
            const entrada = cache.get(id);
            if (!entrada) return false;
            guardarAtivaNoCache();
            cache.delete(id);
            ativarEntrada(entrada);
            set((estado) => {
              if (estado.documento.projeto) estado.documento.projeto.ultimaVarianteId = id;
            });
            oferecerRecuperacao(id);
            void api.definirUltimaVariante(projeto._id, id).catch(() => undefined);
            return true;
          },

          // A-12: "Descartar alterações" volta ao salvo, zera a pilha e apaga o rascunho da sessão.
          async descartarAlteracoes() {
            const { salvo } = get().documento;
            if (!salvo) return;
            rascunhoGravado = null;
            falhasRascunho = 0;
            ultimaSeta = null;
            semPasso(() =>
              set((estado) => {
                const doc = estado.documento;
                estado.conteudo = salvo.conteudo;
                if (doc.variante) doc.variante.grid = salvo.grid;
                doc.sujo = false;
                doc.alteracoes += 1;
                doc.salvamento = { tipo: 'salvo', em: salvo.em };
                doc.conflito = null;
                doc.erroSalvamento = null;
                doc.avisoRascunho = false;
                estado.ui.dialogoConflito = false;
                estado.ui.selecaoId = null;
                estado.ui.recorte = null;
                estado.ui.arrasto = null;
                sincronizarLista(estado);
              }),
            );
            historico().clear();
            await apagarRascunhoDaSessao();
          },

          async criarVarianteEmBranco(nome) {
            await criarEAtivar(nome, { tipo: 'vazia' });
          },

          // M3-04: duplicar copia o estado em tela.
          async duplicarVariante(nome) {
            const fotos = get().conteudo?.fotos ?? [];
            await criarEAtivar(nome, { tipo: 'copia', fotos });
          },

          async renomearVariante(id, nome) {
            const projeto = get().documento.projeto;
            if (!projeto) return;
            const resposta = await api.renomearVariante(projeto._id, id, nome);
            const entrada = cache.get(id);
            if (entrada) entrada.variante = { ...entrada.variante, nome: resposta.nome };
            set((estado) => {
              const item = estado.documento.lista.find((i) => i._id === id);
              if (item) item.nome = resposta.nome;
              if (estado.documento.variante?._id === id) estado.documento.variante.nome = resposta.nome;
            });
          },

          // M3-04, RN-23: a última não se exclui; se era a ativa, abre a vizinha e as alterações dela se perdem.
          async excluirVariante(id) {
            const { projeto, variante, lista } = get().documento;
            if (!projeto) return;
            if (lista.length <= 1) throw new Error(MENSAGEM_ULTIMA);
            await api.excluirVariante(projeto._id, id);
            if (variante?._id === id) {
              const vizinha = vizinhaDe(id);
              const entrada = vizinha ? cache.get(vizinha._id) : undefined;
              tirarDaLista(id);
              if (vizinha && entrada) {
                cache.delete(vizinha._id);
                ativarEntrada(entrada);
                set((estado) => {
                  if (estado.documento.projeto) estado.documento.projeto.ultimaVarianteId = vizinha._id;
                });
                oferecerRecuperacao(vizinha._id);
              }
            } else {
              cache.delete(id);
              tirarDaLista(id);
            }
          },

          // ---- M3: rascunho — um tick do salvamento automático (RF-71, SV-01, A-07) ----

          async salvarRascunho() {
            const { projeto, variante, sujo, salvamento, sessaoId, revisaoBase } = get().documento;
            const conteudo = get().conteudo;
            if (!projeto || !variante || !conteudo || !sujo) return;
            if (salvamento.tipo === 'salvando' || salvamento.tipo === 'conflito') return;
            const snapshot = JSON.stringify({ grid: variante.grid, conteudo });
            if (rascunhoGravado?.snapshot === snapshot) return;
            try {
              const { salvoEm } = await api.salvarRascunho(projeto._id, variante._id, {
                sessaoId,
                revisaoBase,
                conteudo: {
                  grid: variante.grid,
                  bordaPadrao: conteudo.bordaPadrao,
                  areaUtil: conteudo.areaUtil,
                  fotos: conteudo.fotos,
                },
              });
              rascunhoGravado = { snapshot, em: new Date(salvoEm) };
              falhasRascunho = 0;
              set((estado) => {
                estado.documento.avisoRascunho = false;
                reavaliarStatus(estado);
              });
            } catch (erro) {
              if (erro instanceof ErroApi && (erro.status === 409 || erro.status === 404)) {
                // M3-07: conflito no rascunho = `Alert` com "Resolver…"; o rascunho fica suspenso (SV-06).
                const excluida = erro.status === 404;
                const salvaEm =
                  typeof erro.corpo.salvaEm === 'string' ? new Date(erro.corpo.salvaEm) : new Date();
                set((estado) => {
                  estado.documento.conflito = {
                    origem: 'variante',
                    salvaEm,
                    deRascunho: true,
                    excluida,
                    salva: null,
                  };
                  estado.documento.salvamento = { tipo: 'conflito' };
                });
                return;
              }
              falhasRascunho += 1;
              if (falhasRascunho >= FALHAS_ANTES_DO_AVISO) {
                set((estado) => {
                  estado.documento.avisoRascunho = true;
                });
              }
            }
          },

          dispensarAvisoRascunho() {
            set((estado) => {
              estado.documento.avisoRascunho = false;
            });
          },

          // ---- M3: conflito (RF-73, SV-05, M3-09, A-14) ----

          async abrirDialogoConflito() {
            if (get().documento.conflito?.origem !== 'variante') return;
            set((estado) => {
              estado.ui.dialogoConflito = true;
            });
            await buscarVersaoSalva();
          },

          // Esc ou ×: a decisão fica para depois; o conflito e o `Alert` continuam.
          fecharDialogoConflito() {
            set((estado) => {
              estado.ui.dialogoConflito = false;
            });
          },

          async resolverConflito(saida) {
            const { projeto, variante, conflito, sessaoId } = get().documento;
            const conteudo = get().conteudo;
            if (!projeto || !variante || !conteudo) return;
            if (conflito?.origem !== 'variante' || conflito.excluida) return;
            const salva = conflito.salva ?? (await api.obterVariante(projeto._id, variante._id));

            if (saida === 'manter') {
              // Grava a minha sobre a revisão atual do servidor; um novo 409 reabre o diálogo.
              set((estado) => {
                estado.documento.conflito = null;
                estado.documento.revisaoBase = salva.revisao;
                estado.documento.salvamento = { tipo: 'alteracoes' };
                estado.ui.dialogoConflito = false;
              });
              await get().salvarVariante();
              return;
            }

            if (saida === 'usar-salva') {
              await apagarRascunhoDaSessao();
              adotarVersaoSalva(salva);
              return;
            }

            // 'nova-variante': o meu conteúdo vira variante nova e a original adota a versão salva.
            const nome = truncarNome(variante.nome, ` (cópia ${formatarHoraMinuto(new Date())})`);
            const nova = await api.criarVariante(projeto._id, {
              sessaoId,
              nome,
              grid: variante.grid,
              bordaPadrao: conteudo.bordaPadrao,
              areaUtil: conteudo.areaUtil,
              origem: { tipo: 'copia', fotos: conteudo.fotos },
            });
            await apagarRascunhoDaSessao();
            cache.set(variante._id, entradaDe(salva, new Date(salva.salvaEm)));
            set((estado) => {
              const item = estado.documento.lista.find((i) => i._id === variante._id);
              if (item) Object.assign(item, itemDe(salva));
            });
            registrarNovaNaLista(nova);
            ativarEntrada(entradaDe(nova));
          },

          // 404 ao salvar: a variante foi excluída em outra aba (M3-09).
          async resolverVarianteExcluida(acao) {
            const { projeto, variante, conflito, sessaoId } = get().documento;
            const conteudo = get().conteudo;
            if (!projeto || !variante || !conteudo) return;
            if (conflito?.origem !== 'variante' || !conflito.excluida) return;
            const excluidaId = variante._id;

            if (acao === 'nova') {
              const nome = truncarNome(variante.nome, ` (cópia ${formatarHoraMinuto(new Date())})`);
              const nova = await api.criarVariante(projeto._id, {
                sessaoId,
                nome,
                grid: variante.grid,
                bordaPadrao: conteudo.bordaPadrao,
                areaUtil: conteudo.areaUtil,
                origem: { tipo: 'copia', fotos: conteudo.fotos },
              });
              tirarDaLista(excluidaId);
              registrarNovaNaLista(nova);
              ativarEntrada(entradaDe(nova));
              return;
            }

            const vizinha = vizinhaDe(excluidaId);
            const entrada = vizinha ? cache.get(vizinha._id) : undefined;
            tirarDaLista(excluidaId);
            if (vizinha && entrada) {
              cache.delete(vizinha._id);
              ativarEntrada(entrada);
              set((estado) => {
                if (estado.documento.projeto) estado.documento.projeto.ultimaVarianteId = vizinha._id;
              });
              oferecerRecuperacao(vizinha._id);
              void api.definirUltimaVariante(projeto._id, vizinha._id).catch(() => undefined);
            }
          },

          // ---- M3: recuperação de rascunho (SV-03, SV-07, M3-08, A-09) ----

          async recuperarRascunho() {
            const { projeto, variante } = get().documento;
            const oferta = get().ui.recuperacao;
            if (!projeto || !variante || !oferta || oferta.varianteId !== variante._id) return;
            const rascunho = await api.obterRascunho(projeto._id, variante._id, oferta.sessaoId);
            ultimaSeta = null;
            // Entra como alteração não salva sobre a revisão oficial de agora (A-09).
            rascunhoGravado = null;
            semPasso(() => {
              set((estado) => {
                const doc = estado.documento;
                estado.conteudo = {
                  fotos: rascunho.conteudo.fotos,
                  areaUtil: rascunho.conteudo.areaUtil,
                  bordaPadrao: rascunho.conteudo.bordaPadrao,
                };
                if (doc.variante) doc.variante.grid = rascunho.conteudo.grid;
                doc.revisaoBase = doc.variante?.revisao ?? doc.revisaoBase;
                doc.alteracoes += 1;
                estado.ui.recuperacao = null;
                estado.ui.selecaoId = null;
                reavaliarStatus(estado);
                if (!doc.sujo) sujar(estado);
              });
            });
            historico().clear();
          },

          async descartarRascunhoOferecido() {
            const { projeto } = get().documento;
            const oferta = get().ui.recuperacao;
            if (!projeto || !oferta) return;
            try {
              await api.apagarRascunho(projeto._id, oferta.varianteId, oferta.sessaoId);
            } catch {
              // O rascunho obsoleto é limpo no próximo hard save (A-10).
            }
            resumosRascunho = resumosRascunho.filter(
              (r) => !(r.varianteId === oferta.varianteId && r.sessaoId === oferta.sessaoId),
            );
            set((estado) => {
              estado.ui.recuperacao = null;
            });
          },

          // ×/Esc: abre a versão salva e mantém o rascunho; a pergunta volta na próxima abertura do projeto.
          fecharRecuperacao() {
            set((estado) => {
              estado.ui.recuperacao = null;
            });
          },

          // A-09: com base antiga, o rascunho pode virar variante própria em vez de sobrescrever a salva.
          async recuperarComoNovaVariante() {
            const { projeto, variante, sessaoId } = get().documento;
            const oferta = get().ui.recuperacao;
            if (!projeto || !variante || !oferta || get().documento.sujo) return;
            const rascunho = await api.obterRascunho(projeto._id, variante._id, oferta.sessaoId);
            const nome = truncarNome(
              variante.nome,
              ` (rascunho ${formatarHoraMinuto(new Date(rascunho.salvoEm))})`,
            );
            const nova = await api.criarVariante(projeto._id, {
              sessaoId,
              nome,
              grid: rascunho.conteudo.grid,
              bordaPadrao: rascunho.conteudo.bordaPadrao,
              areaUtil: rascunho.conteudo.areaUtil,
              origem: { tipo: 'copia', fotos: rascunho.conteudo.fotos },
            });
            try {
              await api.apagarRascunho(projeto._id, variante._id, oferta.sessaoId);
            } catch {
              // O rascunho obsoleto é limpo no próximo hard save (A-10).
            }
            resumosRascunho = resumosRascunho.filter((r) => r.varianteId !== variante._id);
            guardarAtivaNoCache();
            registrarNovaNaLista(nova);
            ativarEntrada(entradaDe(nova));
            set((estado) => {
              estado.ui.recuperacao = null;
            });
          },

          // ---- M3: preencher vaga (M3-01, A-23) ----

          preencherVaga(fotoId, imagemId) {
            if (!get().biblioteca.imagens.some((i) => i._id === imagemId)) return;
            trocarFoto(fotoId, (f) => preencherVagaNaVariante(f, imagemId));
          },

          preencherVagaSelecionada() {
            const { selecaoId, bibliotecaSelecaoId } = get().ui;
            if (selecaoId && bibliotecaSelecaoId) get().preencherVaga(selecaoId, bibliotecaSelecaoId);
          },

          // ---- M3: templates (RF-93, RN-29 a RN-32, M3-06) ----

          abrirGaleria() {
            set((estado) => {
              estado.ui.galeriaAberta = true;
            });
          },

          fecharGaleria() {
            set((estado) => {
              estado.ui.galeriaAberta = false;
            });
          },

          abrirPosicionarTemplate({ templateId, borda }) {
            const { projeto, variante, sujo } = get().documento;
            const conteudo = get().conteudo;
            const parede = paredeInteiraDe(projeto);
            const template = templatePorId(templateId);
            // A-12: a decisão sobre as alterações vem antes; sem escala não há onde posicionar.
            if (!variante || !conteudo || !parede || !template || sujo || get().ui.modo !== 'editor') return;
            const area = conteudo.areaUtil ?? parede;
            const calcular = (xCm: number, yCm: number) =>
              aplicarTemplate({
                template,
                posicaoCm: { xCm, yCm },
                borda,
                novoId: () => `previa-${(sequenciaPrevia += 1)}`,
              });
            const centro = centralizarNaAreaUtil(calcular(0, 0).conjunto, area);
            const resultado = calcular(centro.xCm, centro.yCm);
            set((estado) => {
              estado.ui.template = {
                templateId,
                nome: template.nome,
                borda,
                conjunto: resultado.conjunto,
                fotos: resultado.fotos,
                vagasMaiores: resultado.vagasMaiores,
                maiorQueAreaUtil: maiorQueAreaUtil(resultado.conjunto, area),
                criando: false,
                erro: null,
              };
              estado.ui.modo = 'template';
              estado.ui.galeriaAberta = false;
              estado.ui.selecaoId = null;
            });
          },

          // Snap só no canto do conjunto; a caixa mantém 1 cm dentro da parede inteira (M3-06).
          moverConjunto(xCm, yCm) {
            const atual = get().ui.template;
            const grid = get().documento.variante?.grid;
            const parede = paredeInteiraDe(get().documento.projeto);
            const template = atual && templatePorId(atual.templateId);
            if (!atual || !grid || !parede || !template) return { xCm, yCm };
            const posicao = limitarConjunto(
              encaixarConjunto({ xCm, yCm }, { snap: grid.snap, passoCm: grid.passoCm }),
              atual.conjunto,
              parede,
            );
            const resultado = aplicarTemplate({
              template,
              posicaoCm: posicao,
              borda: atual.borda,
              novoId: () => `previa-${(sequenciaPrevia += 1)}`,
            });
            set((estado) => {
              if (!estado.ui.template) return;
              estado.ui.template.conjunto = resultado.conjunto;
              estado.ui.template.fotos = resultado.fotos;
            });
            return posicao;
          },

          centralizarConjunto() {
            const atual = get().ui.template;
            const conteudo = get().conteudo;
            const parede = paredeInteiraDe(get().documento.projeto);
            const template = atual && templatePorId(atual.templateId);
            if (!atual || !conteudo || !parede || !template) return;
            const centro = centralizarNaAreaUtil(atual.conjunto, conteudo.areaUtil ?? parede);
            const resultado = aplicarTemplate({
              template,
              posicaoCm: centro,
              borda: atual.borda,
              novoId: () => `previa-${(sequenciaPrevia += 1)}`,
            });
            set((estado) => {
              if (!estado.ui.template) return;
              estado.ui.template.conjunto = resultado.conjunto;
              estado.ui.template.fotos = resultado.fotos;
            });
          },

          // RN-32: Cancelar volta à galeria; fechar a galeria não cria nada.
          cancelarTemplate() {
            set((estado) => {
              estado.ui.template = null;
              estado.ui.modo = 'editor';
              estado.ui.galeriaAberta = true;
            });
          },

          async confirmarTemplate() {
            const atual = get().ui.template;
            if (!atual || atual.criando) return;
            set((estado) => {
              if (estado.ui.template) {
                estado.ui.template.criando = true;
                estado.ui.template.erro = null;
              }
            });
            try {
              const nome = nomeDoTemplateUnico(
                atual.nome,
                get().documento.lista.map((i) => i.nome),
              );
              const nova = await criarEAtivar(nome, {
                tipo: 'template',
                templateId: atual.templateId,
                posicaoCm: { xCm: atual.conjunto.xCm, yCm: atual.conjunto.yCm },
                borda: atual.borda,
              });
              set((estado) => {
                estado.ui.template = null;
                estado.ui.modo = 'editor';
                estado.ui.avisoCriacao = `Variante “${nova.nome}” criada com ${nova.fotos.length} vagas.`;
              });
            } catch (erro) {
              set((estado) => {
                if (!estado.ui.template) return;
                estado.ui.template.criando = false;
                estado.ui.template.erro = mensagemDe(erro, 'Não foi possível criar a variante.');
              });
            }
          },

          dispensarAvisoCriacao() {
            set((estado) => {
              estado.ui.avisoCriacao = null;
            });
          },
        };
      }),
      {
        // ADR-03, §4.7: só o conteúdo da variante é desfazível; qualquer outra mudança da store (seleção, modo,
        // grid, biblioteca) não cria passo. A comparação é por referência: o immer só troca o objeto quando muda.
        partialize: (estado): ParteDesfazivel => ({ conteudo: estado.conteudo }),
        equality: (a, b) => a.conteudo === b.conteudo,
        limit: HISTORICO_LIMITE,
      },
    ),
  );

  // Espelha o tamanho das pilhas na store principal, para os botões Desfazer e Refazer reagirem.
  store.temporal.subscribe((t) => {
    const desfazer = t.pastStates.length;
    const refazer = t.futureStates.length;
    const atual = store.getState().passos;
    if (atual.desfazer === desfazer && atual.refazer === refazer) return;
    store.setState({ passos: { desfazer, refazer } });
  });

  return store;
}
