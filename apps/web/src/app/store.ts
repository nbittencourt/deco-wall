import {
  AGRUPAR_SETAS_MS,
  alternarOrientacao,
  areaUtilForaDaParede,
  arredondarCm,
  BORDA_MAX_CM,
  duplicarFoto as duplicarFotoDaComposicao,
  encaixarPosicao,
  enviarParaTras as enviarParaTrasNaOrdem,
  HISTORICO_LIMITE,
  limitarAreaUtil,
  limitarPosicao,
  moverPorTeclado,
  mudarBorda,
  mudarTamanho,
  novaFoto,
  orientacaoDe,
  paredeInteira,
  trazerParaFrente as trazerParaFrenteNaOrdem,
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
  type DadosPerspectiva,
  type ImagemDto,
  type ProjetoDto,
  type RespostaParede,
  type SegmentoLinear,
  type VarianteDto,
} from '../infra/dto';

// Store do editor (ADR-03, docs/specs/M1-parede-e-escala.md §3.8, §6 e docs/specs/M2-biblioteca-e-composicao.md
// §4.7, §6): fatias `documento` (projeto aberto), `ui`, `biblioteca` e `config`, mais o `conteudo` desfazível da
// variante aberta. O zundo guarda o histórico só desse `conteudo` (M2-13): ele é uma chave de primeiro nível
// porque o zundo restaura o estado mesclando só o primeiro nível, e assim desfazer nunca toca no projeto, nas
// revisões nem no grid. Mutações só por ações nomeadas.

export type Modo = 'editor' | 'perspectiva' | 'calibracao' | 'area-util' | 'recorte';
// Texto da barra do modo Área útil (§3.6): de onde o usuário veio.
export type ContextoAreaUtil = 'perspectiva' | 'linear' | 'ajuste';

export type EstadoSalvamentoStore =
  { tipo: 'salvo'; em?: Date } | { tipo: 'alteracoes' } | { tipo: 'salvando' } | { tipo: 'conflito' };

// Origem do 409: outra aba salvou a variante (§3.8) ou alterou a parede do projeto (SV-09).
export type Conflito = { origem: 'variante'; salvaEm: Date } | { origem: 'projeto' };

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
  config: { uploadMaxMb: number };
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

  // ---- M2: fotos na parede (RF-30 a RF-35, RF-41, M2-04) ----
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

export function criarStoreEditor(api: ClienteApi, opcoes: OpcoesStore = {}): StoreEditor {
  const gerarId = opcoes.gerarId ?? (() => new ObjectId().toHexString());

  // A-08: a última seta, para agrupar as seguintes (mesma foto, menos de 1 s e nenhuma outra mudança no meio).
  let ultimaSeta: { id: string; em: number; conteudo: ConteudoVariante | null } | null = null;

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
          const igual =
            JSON.stringify(estado.conteudo) === JSON.stringify(doc.salvo.conteudo) &&
            JSON.stringify(doc.variante.grid) === JSON.stringify(doc.salvo.grid);
          doc.sujo = !igual;
          if (doc.salvamento.tipo !== 'salvando' && doc.salvamento.tipo !== 'conflito') {
            doc.salvamento = igual ? { tipo: 'salvo', em: doc.salvo.em } : { tipo: 'alteracoes' };
          }
        };

        // Marca a variante como alterada, mesmo que o conteúdo seja igual ao salvo (confirmar a área útil).
        const sujar = (estado: EstadoEditor) => {
          estado.documento.sujo = true;
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

        const carregar = async (id: string) => {
          const { projeto, variantes } = await api.obterProjeto(id);
          const variante = variantes.find((v) => v._id === projeto.ultimaVarianteId) ?? variantes[0] ?? null;
          set((estado) => {
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
          },
          biblioteca: { imagens: [], carregando: false, erro: null },
          config: { uploadMaxMb: 50 },
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
              const { uploadMaxMb } = await api.obterConfig();
              set((estado) => {
                estado.config.uploadMaxMb = uploadMaxMb;
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
            const { projeto, variante, sujo, sessaoId, revisaoBase, salvamento } = get().documento;
            const conteudo = get().conteudo;
            // A-11: durante o modo de recorte, Salvar e Ctrl+S ficam inativos.
            if (!projeto || !variante || !conteudo || !sujo || salvamento.tipo === 'salvando') return;
            if (get().ui.modo === 'recorte') return;

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
              set((estado) => {
                const doc = estado.documento;
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
              });
              // M2-05: os filtros Projeto e Variante refletem o estado salvo, que acabou de mudar.
              void get().carregarBiblioteca();
            } catch (erro) {
              if (erro instanceof ErroApi && erro.status === 409) {
                const salvaEm =
                  typeof erro.corpo.salvaEm === 'string' ? new Date(erro.corpo.salvaEm) : new Date();
                set((estado) => {
                  estado.documento.conflito = { origem: 'variante', salvaEm };
                  estado.documento.salvamento = { tipo: 'conflito' };
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
