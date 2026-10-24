import {
  areaUtilForaDaParede,
  limitarAreaUtil,
  paredeInteira,
  type AreaUtil,
  type Grid,
  type Perfil,
} from '@deco-wall/domain';
import { immer } from 'zustand/middleware/immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  ErroApi,
  type ClienteApi,
  type DadosPerspectiva,
  type ProjetoDto,
  type RespostaParede,
  type SegmentoLinear,
  type VarianteDto,
} from '../infra/dto';

// Store do editor (ADR-03, docs/specs/M1-parede-e-escala.md §3.8, §6): fatia `documento` (projeto aberto) e
// fatia `ui`. Mutações só por ações nomeadas. O desfazer (zundo) entra no M2.

export type Modo = 'editor' | 'perspectiva' | 'calibracao' | 'area-util';
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

export interface Ui {
  modo: Modo;
  contextoAreaUtil: ContextoAreaUtil;
  // RN-35: a escala foi refeita e a área útil ficou fora da parede inteira.
  avisoAreaUtilFora: boolean;
}

export interface EstadoEditor {
  documento: Documento;
  ui: Ui;
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
}

export type StoreEditor = StoreApi<EstadoEditor>;

function novaSessao(): string {
  return globalThis.crypto.randomUUID();
}

function paredeInteiraDe(projeto: ProjetoDto | null): AreaUtil | null {
  if (!projeto?.parede || projeto.parede.escala.metodo === null) return null;
  return paredeInteira(projeto.parede);
}

export function criarStoreEditor(api: ClienteApi): StoreEditor {
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
        ui: { modo: 'editor', contextoAreaUtil: 'ajuste', avisoAreaUtilFora: false },

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

        alterarGrid(parcial) {
          set((estado) => {
            if (!estado.documento.variante) return;
            Object.assign(estado.documento.variante.grid, parcial);
            sujar(estado);
          });
        },

        definirAreaUtil(area) {
          const parede = paredeInteiraDe(get().documento.projeto);
          if (!parede) return;
          set((estado) => {
            if (!estado.documento.variante) return;
            estado.documento.variante.areaUtil = limitarAreaUtil(area, parede);
            sujar(estado);
          });
        },

        usarParedeInteira() {
          const parede = paredeInteiraDe(get().documento.projeto);
          if (!parede) return;
          set((estado) => {
            if (!estado.documento.variante) return;
            estado.documento.variante.areaUtil = parede;
            sujar(estado);
          });
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
