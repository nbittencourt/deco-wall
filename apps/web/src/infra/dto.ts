import type { AreaUtil, Borda, Grid, Perfil, Projeto, Pt, Variante } from '@deco-wall/domain';

// Formatos que trafegam entre a API e a web (docs/specs/M1-parede-e-escala.md §5). No JSON as datas
// chegam como texto ISO; o resto segue os tipos do domínio.

type DatasEmTexto<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };

export type ProjetoDto = DatasEmTexto<Projeto, 'criadoEm' | 'atualizadoEm'>;
export type VarianteDto = DatasEmTexto<Variante, 'criadaEm' | 'salvaEm'>;

export interface ResumoProjeto {
  _id: string;
  nome: string;
  atualizadoEm: string;
  qtdVariantes: number;
  temParede: boolean;
  thumbUrl: string | null;
}

export interface VarianteAlterada {
  _id: string;
  revisao: number;
  areaUtil: AreaUtil | null;
}

export interface RespostaParede {
  projeto: ProjetoDto;
  variantesAlteradas: VarianteAlterada[];
}

export interface SegmentoLinear {
  p1: Pt;
  p2: Pt;
  comprimentoCm: number;
}

export interface DadosPerspectiva {
  cantosPx: Pt[];
  larguraCm: number;
  alturaCm: number;
}

export interface CorpoSalvarVariante {
  sessaoId: string;
  revisaoBase: number;
  grid: Grid;
  bordaPadrao: Borda;
  areaUtil: AreaUtil | null;
  fotos: Variante['fotos'];
}

export interface OpcoesEnvio {
  // Fração de 0 a 1 do que já subiu (barra de progresso do upload).
  onProgresso?: (fracao: number) => void;
  sinal?: AbortSignal;
}

// Porta da aplicação para a API local (ADR-03): a store recebe uma implementação, e os testes, uma falsa.
export interface ClienteApi {
  listarProjetos(): Promise<ResumoProjeto[]>;
  criarProjeto(nome?: string): Promise<{ projeto: ProjetoDto; variantes: VarianteDto[] }>;
  obterProjeto(id: string): Promise<{ projeto: ProjetoDto; variantes: VarianteDto[] }>;
  renomearProjeto(id: string, nome: string): Promise<ProjetoDto>;
  excluirProjeto(id: string): Promise<void>;
  enviarParede(
    id: string,
    dados: { arquivo: File; perfil: Perfil; revisaoBase: number },
    opcoes?: OpcoesEnvio,
  ): Promise<RespostaParede>;
  aplicarCalibracao(
    id: string,
    dados: { revisaoBase: number; linear: SegmentoLinear },
  ): Promise<RespostaParede>;
  aplicarPerspectiva(
    id: string,
    dados: { revisaoBase: number; perspectiva: DadosPerspectiva },
    retificada: Blob,
    opcoes?: OpcoesEnvio,
  ): Promise<RespostaParede>;
  salvarVariante(
    projetoId: string,
    varianteId: string,
    corpo: CorpoSalvarVariante,
  ): Promise<{ revisao: number; salvaEm: string }>;
}

// Resposta de erro da API: `corpo.erro` é a mensagem em pt-BR; no 409 do salvamento o corpo traz
// { revisao, salvaEm, salvaPorSessao } de quem salvou antes.
export class ErroApi extends Error {
  readonly status: number;
  readonly corpo: Record<string, unknown>;

  constructor(status: number, corpo: Record<string, unknown> = {}) {
    super(typeof corpo.erro === 'string' ? corpo.erro : `A requisição falhou (${status}).`);
    this.name = 'ErroApi';
    this.status = status;
    this.corpo = corpo;
  }
}
