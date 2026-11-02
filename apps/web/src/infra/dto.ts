import type {
  AreaUtil,
  Borda,
  FotoNaParede,
  Grid,
  Imagem,
  Perfil,
  Projeto,
  Pt,
  Variante,
} from '@deco-wall/domain';

// Formatos que trafegam entre a API e a web (docs/specs/M1-parede-e-escala.md §5). No JSON as datas
// chegam como texto ISO; o resto segue os tipos do domínio.

type DatasEmTexto<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };

export type ProjetoDto = DatasEmTexto<Projeto, 'criadoEm' | 'atualizadoEm'>;
export type VarianteDto = DatasEmTexto<Variante, 'criadaEm' | 'salvaEm'>;
export type ImagemDto = Omit<Imagem, 'criadaEm' | 'excluidaEm' | 'purgaEm'> & {
  criadaEm: string;
  excluidaEm: string | null;
  purgaEm: string | null;
};

export interface ResumoProjeto {
  _id: string;
  nome: string;
  atualizadoEm: string;
  qtdVariantes: number;
  // M3-02: soma das vagas (placeholders) das variantes salvas.
  semFoto: number;
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

// M3-08: resumo do rascunho elegível (mais novo que a versão oficial), um por variante.
export interface ResumoRascunhoDto {
  varianteId: string;
  sessaoId: string;
  salvoEm: string;
  revisaoBase: number;
  qtdFotos: number;
}

export interface ConteudoRascunho {
  grid: Grid;
  bordaPadrao: Borda;
  areaUtil: AreaUtil | null;
  fotos: FotoNaParede[];
}

export interface CorpoRascunho {
  sessaoId: string;
  revisaoBase: number;
  conteudo: ConteudoRascunho;
}

export interface RascunhoDto {
  sessaoId: string;
  revisaoBase: number;
  conteudo: ConteudoRascunho;
  salvoEm: string;
}

// M3, §5: de onde a variante nova vem.
export type OrigemVariante =
  | { tipo: 'vazia' }
  | { tipo: 'copia'; fotos: FotoNaParede[] }
  | { tipo: 'template'; templateId: string; posicaoCm: { xCm: number; yCm: number }; borda: Borda };

export interface CorpoCriarVariante {
  sessaoId: string;
  nome: string;
  grid: Grid;
  bordaPadrao: Borda;
  areaUtil: AreaUtil | null;
  origem: OrigemVariante;
}

export interface ProjetoCompletoDto {
  projeto: ProjetoDto;
  variantes: VarianteDto[];
  rascunhos: ResumoRascunhoDto[];
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
  obterProjeto(id: string): Promise<ProjetoCompletoDto>;
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
  listarImagens(): Promise<ImagemDto[]>;
  enviarImagem(
    dados: { arquivo: File; perfil: Perfil; projetoId: string },
    opcoes?: OpcoesEnvio,
  ): Promise<ImagemDto>;
  // A-28, M3-07: limite real de upload (UPLOAD_MAX_MB) e intervalo do rascunho (AUTOSAVE_MINUTOS).
  obterConfig(): Promise<{ uploadMaxMb: number; autosaveMinutos: number }>;
  salvarVariante(
    projetoId: string,
    varianteId: string,
    corpo: CorpoSalvarVariante,
  ): Promise<{ revisao: number; salvaEm: string }>;

  // ---- M3: variantes e rascunhos (spec M3 §5) ----
  obterVariante(projetoId: string, varianteId: string): Promise<VarianteDto>;
  criarVariante(projetoId: string, corpo: CorpoCriarVariante): Promise<VarianteDto>;
  renomearVariante(
    projetoId: string,
    varianteId: string,
    nome: string,
  ): Promise<{ _id: string; nome: string }>;
  excluirVariante(projetoId: string, varianteId: string): Promise<void>;
  definirUltimaVariante(projetoId: string, varianteId: string): Promise<ProjetoDto>;
  salvarRascunho(projetoId: string, varianteId: string, corpo: CorpoRascunho): Promise<{ salvoEm: string }>;
  // Sem `sessaoId`, o mais recente elegível, de qualquer sessão.
  obterRascunho(projetoId: string, varianteId: string, sessaoId?: string): Promise<RascunhoDto>;
  apagarRascunho(projetoId: string, varianteId: string, sessaoId: string): Promise<void>;
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
