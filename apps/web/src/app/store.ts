import {
  aplicarBorda,
  aplicarTamanho,
  areaUtilForaDaParede,
  arredondarCm,
  criarFoto,
  criarHistorico,
  desfazer as desfazerHistorico,
  duplicarFoto as duplicarFotoDaComposicao,
  enviarParaTras as enviarParaTrasNaOrdem,
  LIMITE_BORDA_CM,
  limitarAreaUtil,
  moverPorSeta as moverPorSetaDoDominio,
  paredeInteira,
  podeDesfazer as historicoPodeDesfazer,
  podeRefazer as historicoPodeRefazer,
  posicaoDoDrop,
  posicaoInicial,
  refazer as refazerHistorico,
  registrar,
  tamanhoExterno,
  trazerParaFrente as trazerParaFrenteNaOrdem,
  trocarOrientacao as trocarOrientacaoDoTamanho,
  type AreaUtil,
  type Borda,
  type DirecaoSeta,
  type FotoNaParede,
  type Grid,
  type Historico,
  type OffsetRecorte,
  type OrientacaoEscolhida,
  type Perfil,
  type Pt,
  type Tamanho,
} from '@deco-wall/domain';
import { ObjectId } from 'bson';
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
// §6): fatias `documento` (projeto aberto), `ui` e `biblioteca`, mais o `historico` de desfazer por variante.
// Mutações só por ações nomeadas.

export type Modo = 'editor' | 'perspectiva' | 'calibracao' | 'area-util' | 'recorte';
// Texto da barra do modo Área útil (§3.6): de onde o usuário veio.
export type ContextoAreaUtil = 'perspectiva' | 'linear' | 'ajuste';

export type EstadoSalvamentoStore =
  { tipo: 'salvo'; em?: Date } | { tipo: 'alteracoes' } | { tipo: 'salvando' } | { tipo: 'conflito' };

// Origem do 409: outra aba salvou a variante (§3.8) ou alterou a parede do projeto (SV-09).
export type Conflito = { origem: 'variante'; salvaEm: Date } | { origem: 'projeto' };

export interface Documento {
  projeto: ProjetoDto | null;
  variante: VarianteDto | null;
  // Revisão oficial que esta sessão carregou ou gravou por último (SV-04).
  revisaoBase: number;
  sujo: boolean;
  // Conta alterações locais: um salvamento só zera `sujo` se nada mudou enquanto a requisição corria.
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
}

export interface Ui {
  modo: Modo;
  contextoAreaUtil: ContextoAreaUtil;
  // RN-35: a escala foi refeita e a área útil ficou fora da parede inteira.
  avisoAreaUtilFora: boolean;
  // Foto selecionada na parede (seleção única — B-01) e imagem escolhida na biblioteca (M2-04).
  selecaoId: string | null;
  bibliotecaSelecaoId: string | null;
  recorte: RascunhoRecorte | null;
}

export interface Biblioteca {
  imagens: ImagemDto[];
  carregando: boolean;
  erro: string | null;
}

// O que o desfazer cobre (M2-03): fotos, área útil e borda padrão. O grid fica de fora.
export interface ConteudoVariante {
  fotos: FotoNaParede[];
  areaUtil: AreaUtil | null;
  bordaPadrao: Borda;
}

export interface OpcoesStore {
  // Ids de foto novos; o padrão usa ObjectId (ADR-07). Os testes injetam uma sequência.
  gerarId?: () => string;
}

export interface EstadoEditor {
  documento: Documento;
  ui: Ui;
  biblioteca: Biblioteca;
  // Uma pilha por variante, fora do `documento`: desfazer nunca toca no projeto nem nas revisões.
  historico: Record<string, Historico<ConteudoVariante>>;
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

  // ---- M2: biblioteca ----
  carregarBiblioteca(): Promise<void>;
  adotarImagem(imagem: ImagemDto): void;
  selecionarImagemDaBiblioteca(id: string | null): void;

  // ---- M2: fotos na parede (RF-30 a RF-35, RF-41, M2-04) ----
  // Devolve o id da foto criada, ou null se não deu (sem escala ou imagem fora da biblioteca).
  adicionarFoto(imagemId: string, centroCm?: Pt): string | null;
  adicionarFotoSelecionada(): string | null;
  selecionarFoto(id: string | null): void;
  moverFoto(id: string, xCm: number, yCm: number): void;
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
  abrirRecorte(fotoId: string): void;
  atualizarRecorte(parcial: { tamanho?: Tamanho; offset?: OffsetRecorte }): void;
  concluirRecorte(): void;
  cancelarRecorte(): void;

  // ---- M2: desfazer e refazer (RF-70, RN-18) ----
  desfazer(): void;
  refazer(): void;
  podeDesfazer(): boolean;
  podeRefazer(): boolean;
}

export type StoreEditor = StoreApi<EstadoEditor>;

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

// Os estados do immer são imutáveis e compartilham estrutura: comparar o JSON basta e é barato.
const mesmoConteudo = (a: ConteudoVariante, b: ConteudoVariante) => JSON.stringify(a) === JSON.stringify(b);

const mesmoTamanho = (a: Tamanho, b: Tamanho) =>
  a.sugeridoId === b.sugeridoId && a.larguraCm === b.larguraCm && a.alturaCm === b.alturaCm;

const limitarBorda = (cm: number) =>
  arredondarCm(Math.min(Math.max(cm, LIMITE_BORDA_CM.min), LIMITE_BORDA_CM.max));

export function criarStoreEditor(api: ClienteApi, opcoes: OpcoesStore = {}): StoreEditor {
  const gerarId = opcoes.gerarId ?? (() => new ObjectId().toHexString());
  return createStore<EstadoEditor>()(
    immer((set, get) => {
      // Marca a variante como alterada localmente (status "Alterações não salvas").
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
      // ou zerada). Adotá-las evita que o próximo salvamento da variante dê 409 contra si mesmo.
      const adotarResposta = (resposta: RespostaParede) => {
        set((estado) => {
          estado.documento.projeto = resposta.projeto;
          const variante = estado.documento.variante;
          if (!variante) return;
          const alterada = resposta.variantesAlteradas.find((v) => v._id === variante._id);
          if (alterada) {
            variante.revisao = alterada.revisao;
            variante.areaUtil = alterada.areaUtil;
            estado.documento.revisaoBase = alterada.revisao;
          }
        });
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
        const { projeto, variante } = get().documento;
        const parede = paredeInteiraDe(projeto);
        set((estado) => {
          estado.ui.avisoAreaUtilFora = Boolean(
            parede && variante?.areaUtil && areaUtilForaDaParede(variante.areaUtil, parede),
          );
        });
      };

      const carregar = async (id: string) => {
        const { projeto, variantes } = await api.obterProjeto(id);
        const variante = variantes.find((v) => v._id === projeto.ultimaVarianteId) ?? variantes[0] ?? null;
        set((estado) => {
          estado.documento.projeto = projeto;
          estado.documento.variante = variante;
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
          estado.historico = {};
        });
      };

      // Aplica uma mudança ao conteúdo desfazível da variante como UM passo do histórico (M2-02). A função
      // recebe o conteúdo atual e devolve o novo (ou null); sem mudança real, nada é registrado.
      const alterarConteudo = (calcular: (c: ConteudoVariante) => ConteudoVariante | null): boolean => {
        const variante = get().documento.variante;
        if (!variante) return false;
        const antes = conteudoDe(variante);
        const depois = calcular(antes);
        if (!depois || mesmoConteudo(antes, depois)) return false;
        const pilha = get().historico[variante._id] ?? criarHistorico<ConteudoVariante>();
        const novaPilha = registrar(pilha, antes);
        set((estado) => {
          const v = estado.documento.variante!;
          v.fotos = depois.fotos;
          v.areaUtil = depois.areaUtil;
          v.bordaPadrao = depois.bordaPadrao;
          estado.historico[v._id] = novaPilha;
          sujar(estado);
        });
        return true;
      };

      const trocarFoto = (id: string, calcular: (f: FotoNaParede) => FotoNaParede): boolean =>
        alterarConteudo((c) =>
          c.fotos.some((f) => f._id === id)
            ? { ...c, fotos: c.fotos.map((f) => (f._id === id ? calcular(f) : f)) }
            : null,
        );

      // Restaura um instantâneo (desfazer/refazer): marca como alterado e solta a seleção que sumiu.
      const restaurar = (conteudo: ConteudoVariante, pilha: Historico<ConteudoVariante>) => {
        set((estado) => {
          const v = estado.documento.variante!;
          v.fotos = conteudo.fotos;
          v.areaUtil = conteudo.areaUtil;
          v.bordaPadrao = conteudo.bordaPadrao;
          estado.historico[v._id] = pilha;
          if (estado.ui.selecaoId && !conteudo.fotos.some((f) => f._id === estado.ui.selecaoId)) {
            estado.ui.selecaoId = null;
          }
          sujar(estado);
        });
      };

      return {
        documento: {
          projeto: null,
          variante: null,
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
        ui: {
          modo: 'editor',
          contextoAreaUtil: 'ajuste',
          avisoAreaUtilFora: false,
          selecaoId: null,
          bibliotecaSelecaoId: null,
          recorte: null,
        },
        biblioteca: { imagens: [], carregando: false, erro: null },
        historico: {},

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
            sujar(estado);
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
          get().definirAreaUtil(area);
          set((estado) => {
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

        // ---- M2: biblioteca ----

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
          const imagem = get().biblioteca.imagens.find((i) => i._id === imagemId);
          const parede = paredeInteiraDe(projeto);
          if (!variante || !imagem || !parede) return null; // RF-13, RN-08: sem escala não há fotos

          const id = gerarId();
          const nova = criarFoto({ id, imagem, bordaPadrao: variante.bordaPadrao, posicao: { x: 0, y: 0 } });
          const externo = tamanhoExterno(nova);
          const grid = { snap: variante.grid.snap, passoCm: variante.grid.passoCm };
          const posicao = centroCm
            ? posicaoDoDrop({ ponto: centroCm, externo, grid })
            : posicaoInicial({ area: variante.areaUtil ?? parede, fotos: variante.fotos, externo, grid });

          alterarConteudo((c) => ({
            ...c,
            fotos: [...c.fotos, { ...nova, xCm: posicao.x, yCm: posicao.y }],
          }));
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
            const existe = id !== null && estado.documento.variante?.fotos.some((f) => f._id === id);
            estado.ui.selecaoId = existe ? id : null;
          });
        },

        moverFoto(id, xCm, yCm) {
          trocarFoto(id, (f) => ({ ...f, xCm: arredondarCm(xCm), yCm: arredondarCm(yCm) }));
        },

        moverPorSeta(id, direcao, shift) {
          const variante = get().documento.variante;
          if (!variante) return;
          trocarFoto(id, (f) => {
            const p = moverPorSetaDoDominio(f, direcao, {
              snap: variante.grid.snap,
              passoCm: variante.grid.passoCm,
              shift,
            });
            return { ...f, xCm: p.x, yCm: p.y };
          });
        },

        trocarTamanho(id, tamanho) {
          trocarFoto(id, (f) => aplicarTamanho(f, tamanho));
        },

        trocarOrientacao(id, orientacao) {
          trocarFoto(id, (f) => {
            const tamanho = trocarOrientacaoDoTamanho(f.tamanho, orientacao);
            return mesmoTamanho(tamanho, f.tamanho) ? f : aplicarTamanho(f, tamanho);
          });
        },

        alterarBordaDaFoto(id, parcial) {
          trocarFoto(id, (f) =>
            aplicarBorda(f, {
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
          const original = variante?.fotos.find((f) => f._id === id);
          if (!variante || !original) return;
          const novoId = gerarId();
          const copia = duplicarFotoDaComposicao(original, novoId, {
            snap: variante.grid.snap,
            passoCm: variante.grid.passoCm,
          });
          alterarConteudo((c) => ({ ...c, fotos: [...c.fotos, copia] }));
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

        abrirRecorte(fotoId) {
          const foto = get().documento.variante?.fotos.find((f) => f._id === fotoId);
          if (!foto || get().ui.modo !== 'editor') return;
          set((estado) => {
            estado.ui.recorte = { fotoId, tamanho: { ...foto.tamanho }, offset: { ...foto.recorte } };
            estado.ui.selecaoId = fotoId;
            estado.ui.modo = 'recorte';
          });
        },

        atualizarRecorte(parcial) {
          set((estado) => {
            const rascunho = estado.ui.recorte;
            if (!rascunho) return;
            // RN-28: mudar o tamanho recentraliza o recorte.
            if (parcial.tamanho && !mesmoTamanho(parcial.tamanho, rascunho.tamanho)) {
              rascunho.tamanho = { ...parcial.tamanho };
              rascunho.offset = { offsetX: 0, offsetY: 0 };
            }
            if (parcial.offset) rascunho.offset = { ...parcial.offset };
          });
        },

        concluirRecorte() {
          const rascunho = get().ui.recorte;
          if (!rascunho) return;
          trocarFoto(rascunho.fotoId, (f) => {
            const base = mesmoTamanho(rascunho.tamanho, f.tamanho) ? f : aplicarTamanho(f, rascunho.tamanho);
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
          const variante = get().documento.variante;
          if (!variante || get().ui.modo !== 'editor') return;
          const pilha = get().historico[variante._id];
          if (!pilha) return;
          const resultado = desfazerHistorico(pilha, conteudoDe(variante));
          if (resultado) restaurar(resultado.estado, resultado.historico);
        },

        refazer() {
          const variante = get().documento.variante;
          if (!variante || get().ui.modo !== 'editor') return;
          const pilha = get().historico[variante._id];
          if (!pilha) return;
          const resultado = refazerHistorico(pilha, conteudoDe(variante));
          if (resultado) restaurar(resultado.estado, resultado.historico);
        },

        podeDesfazer() {
          const id = get().documento.variante?._id;
          const pilha = id ? get().historico[id] : undefined;
          return pilha ? historicoPodeDesfazer(pilha) : false;
        },

        podeRefazer() {
          const id = get().documento.variante?._id;
          const pilha = id ? get().historico[id] : undefined;
          return pilha ? historicoPodeRefazer(pilha) : false;
        },

        async salvarVariante() {
          const { projeto, variante, sujo, sessaoId, revisaoBase, alteracoes, salvamento } = get().documento;
          if (!projeto || !variante || !sujo || salvamento.tipo === 'salvando') return;

          set((estado) => {
            estado.documento.salvamento = { tipo: 'salvando' };
            estado.documento.erroSalvamento = null;
          });
          try {
            const resposta = await api.salvarVariante(projeto._id, variante._id, {
              sessaoId,
              revisaoBase,
              grid: variante.grid,
              bordaPadrao: variante.bordaPadrao,
              areaUtil: variante.areaUtil,
              fotos: variante.fotos,
            });
            set((estado) => {
              const doc = estado.documento;
              if (doc.variante) {
                doc.variante.revisao = resposta.revisao;
                doc.variante.salvaEm = resposta.salvaEm;
              }
              doc.revisaoBase = resposta.revisao;
              // Se o usuário mexeu durante a gravação, continua sujo.
              doc.sujo = doc.alteracoes !== alteracoes;
              doc.salvamento = doc.sujo
                ? { tipo: 'alteracoes' }
                : { tipo: 'salvo', em: new Date(resposta.salvaEm) };
            });
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
  );
}
