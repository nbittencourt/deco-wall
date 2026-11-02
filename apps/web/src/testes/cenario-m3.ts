import {
  aplicarTemplate,
  BORDA_PADRAO,
  GRID_PADRAO,
  templatePorId,
  type FotoNaParede,
} from '@deco-wall/domain';
import { vi } from 'vitest';
import { criarStoreEditor, type StoreEditor } from '../app/store';
import {
  ErroApi,
  type ClienteApi,
  type CorpoCriarVariante,
  type ImagemDto,
  type ImagemExcluidaDto,
  type VarianteAfetadaDto,
  type ProjetoDto,
  type ResumoRascunhoDto,
  type VarianteDto,
} from '../infra/dto';

// Cenário de testes do M3 (docs/specs/M3-variantes-templates-e-salvamento.md §7): um servidor falso em memória
// por trás do ClienteApi, com variantes, rascunhos e revisões, para a store e as telas serem testadas sem rede.

export const hex = (n: number) => n.toString(16).padStart(24, '0');
export const ID_PROJETO = hex(301);
export const ID_BASE = hex(201);
export const ID_V2 = hex(202);
export const ID_V3 = hex(203);
export const SALVA_EM = '2026-11-02T13:00:00.000Z';
export const SALVA_EM_2 = '2026-11-02T13:30:00.000Z';
export const RASCUNHO_EM = '2026-11-02T13:10:00.000Z';

// Parede linear de 1200 × 900 px a 4 px/cm → parede inteira 300 × 225 cm.
export const PAREDE_LINEAR: NonNullable<ProjetoDto['parede']> = {
  perfil: 'leve',
  arquivo: `paredes/${ID_PROJETO}.webp`,
  thumb: `paredes/${ID_PROJETO}.thumb.webp`,
  larguraPx: 1200,
  alturaPx: 900,
  escala: {
    metodo: 'linear',
    linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
    homografia: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 1],
  },
};
export const AREA_TOTAL = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
export const AREA_UTIL = { xCm: 10, yCm: 10, larguraCm: 200, alturaCm: 150 };

export const imagem = (n: number, orientacaoNatural: 'retrato' | 'paisagem' = 'retrato'): ImagemDto => ({
  _id: hex(n),
  nomeOriginal: `foto-${n}.jpg`,
  perfil: 'leve',
  larguraPx: 600,
  alturaPx: 800,
  orientacaoNatural,
  bytes: 1,
  arquivos: { render: `imagens/${hex(n)}.webp`, thumb: `imagens/${hex(n)}.thumb.webp` },
  mime: 'image/webp',
  criadaEm: SALVA_EM,
  projetos: [ID_PROJETO],
  excluidaEm: null,
  purgaEm: null,
  schemaVersion: 1,
});
export const RETRATO = imagem(1);
export const PAISAGEM = imagem(2, 'paisagem');

export function foto(n: number, sobrescrita: Partial<FotoNaParede> = {}): FotoNaParede {
  return {
    _id: hex(1000 + n),
    imagemId: RETRATO._id,
    imagemAnteriorId: null,
    tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
    xCm: 40 + n * 5,
    yCm: 30,
    recorte: { offsetX: 0, offsetY: 0 },
    borda: { ...BORDA_PADRAO },
    ...sobrescrita,
  };
}

export const vaga = (n: number, sobrescrita: Partial<FotoNaParede> = {}) =>
  foto(n, { imagemId: null, ...sobrescrita });

export function variante(sobrescrita: Partial<VarianteDto> = {}): VarianteDto {
  return {
    _id: ID_BASE,
    projetoId: ID_PROJETO,
    nome: 'Base',
    ordem: 0,
    criadaEm: SALVA_EM,
    revisao: 1,
    salvaEm: SALVA_EM,
    salvaPorSessao: 'sistema',
    grid: { ...GRID_PADRAO },
    bordaPadrao: { ...BORDA_PADRAO },
    areaUtil: AREA_UTIL,
    fotos: [],
    schemaVersion: 1,
    ...sobrescrita,
  };
}

export function projeto(sobrescrita: Partial<ProjetoDto> = {}): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome: 'Sala',
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 3,
    ultimaVarianteId: ID_BASE,
    parede: PAREDE_LINEAR,
    schemaVersion: 1,
    ...sobrescrita,
  };
}

export interface OpcoesCenario {
  projeto?: Partial<ProjetoDto>;
  variantes?: VarianteDto[];
  rascunhos?: ResumoRascunhoDto[];
  // Rascunhos já gravados no servidor falso (a chave é `<varianteId>:<sessaoId>`).
  rascunhosGuardados?: Record<string, RascunhoGuardado>;
  autosaveMinutos?: number;
  // M4: imagens já excluídas no servidor falso (aparecem na lista "Excluídas").
  excluidas?: ImagemExcluidaDto[];
  // M4, A-11: ao salvar, o servidor falso converte as fotos dessas imagens e devolve `imagensExcluidas`.
  excluirAoSalvar?: string[];
}

export interface RascunhoGuardado {
  sessaoId: string;
  revisaoBase: number;
  conteudo: {
    grid: VarianteDto['grid'];
    bordaPadrao: VarianteDto['bordaPadrao'];
    areaUtil: VarianteDto['areaUtil'];
    fotos: FotoNaParede[];
  };
  salvoEm: string;
}

// Duas variantes por padrão: "Base" com 2 fotos e "Variante 2" com 1 foto e 1 vaga.
export function variantesPadrao(): VarianteDto[] {
  return [
    variante({ fotos: [foto(1), foto(2)] }),
    variante({ _id: ID_V2, nome: 'Variante 2', ordem: 1, fotos: [foto(3), vaga(4)] }),
  ];
}

export function criarCenario(opcoes: OpcoesCenario = {}) {
  let proximoId = 500;
  const novoId = () => hex(proximoId++);
  const servidor = new Map<string, VarianteDto>(
    (opcoes.variantes ?? variantesPadrao()).map((v) => [v._id, structuredClone(v)]),
  );
  const rascunhos = new Map<string, RascunhoGuardado>(Object.entries(opcoes.rascunhosGuardados ?? {}));
  const dadosProjeto = projeto(opcoes.projeto);
  const lista = () => [...servidor.values()].sort((a, b) => a.ordem - b.ordem);
  // M4: a biblioteca do servidor falso (ativas e excluídas) e as operações do ciclo de vida.
  const imagensAtivas = new Map<string, ImagemDto>(
    [RETRATO, PAISAGEM].map((i) => [i._id, structuredClone(i)]),
  );
  const imagensExcluidas = new Map<string, ImagemExcluidaDto>(
    (opcoes.excluidas ?? []).map((i) => [i._id, structuredClone(i)]),
  );
  const contar = (v: VarianteDto, imagemId: string) => v.fotos.filter((f) => f.imagemId === imagemId).length;
  const converterNoServidor = (imagemId: string): VarianteAfetadaDto[] => {
    const afetadas: VarianteAfetadaDto[] = [];
    for (const v of servidor.values()) {
      const n = contar(v, imagemId);
      if (n === 0) continue;
      v.fotos = v.fotos.map((f) =>
        f.imagemId === imagemId ? { ...f, imagemId: null, imagemAnteriorId: imagemId } : f,
      );
      v.revisao += 1;
      afetadas.push({ projetoId: v.projetoId, varianteId: v._id, revisao: v.revisao, fotos: n });
    }
    return afetadas;
  };

  const conflito = (v: VarianteDto) =>
    new ErroApi(409, {
      erro: 'Esta variante foi salva em outra aba.',
      revisao: v.revisao,
      salvaEm: v.salvaEm,
      salvaPorSessao: v.salvaPorSessao,
    });

  const api = {
    listarProjetos: vi.fn(async () => []),
    criarProjeto: vi.fn(),
    obterProjeto: vi.fn(async () => ({
      projeto: structuredClone(dadosProjeto),
      variantes: structuredClone(lista()),
      rascunhos: structuredClone(opcoes.rascunhos ?? []),
    })),
    renomearProjeto: vi.fn(),
    excluirProjeto: vi.fn(),
    enviarParede: vi.fn(),
    aplicarCalibracao: vi.fn(),
    aplicarPerspectiva: vi.fn(),
    listarImagens: vi.fn(async () => structuredClone([...imagensAtivas.values()])),
    listarImagensExcluidas: vi.fn(async () => structuredClone([...imagensExcluidas.values()])),
    associacoesDaImagem: vi.fn(async (id: string) => {
      const imagem = imagensAtivas.get(id) ?? imagensExcluidas.get(id);
      if (!imagem) throw new ErroApi(404, { erro: 'Imagem não encontrada.' });
      return {
        imagem: {
          _id: id,
          nomeOriginal: imagem.nomeOriginal,
          thumbUrl: `/api/imagens/${id}/arquivo?tipo=thumb`,
        },
        usos: lista()
          .filter((v) => contar(v, id) > 0)
          .map((v) => ({
            projetoId: ID_PROJETO,
            projetoNome: dadosProjeto.nome,
            varianteId: v._id,
            varianteNome: v.nome,
            vezes: contar(v, id),
          })),
        projetos: imagem.projetos.map((p) => ({ projetoId: p, projetoNome: dadosProjeto.nome })),
      };
    }),
    excluirImagem: vi.fn(async (id: string) => {
      const imagem = imagensAtivas.get(id);
      if (!imagem) throw new ErroApi(404, { erro: 'Imagem não encontrada.' });
      imagensAtivas.delete(id);
      imagensExcluidas.set(id, {
        ...imagem,
        excluidaEm: SALVA_EM_2,
        purgaEm: '2026-12-02T13:30:00.000Z',
        diasRestantes: 30,
      });
      const afetadas = converterNoServidor(id);
      return {
        imagem: { _id: id, excluidaEm: SALVA_EM_2, purgaEm: '2026-12-02T13:30:00.000Z' },
        afetadas,
        fotosConvertidas: afetadas.reduce((soma, a) => soma + a.fotos, 0),
      };
    }),
    restaurarImagem: vi.fn(async (id: string) => {
      const excluida = imagensExcluidas.get(id);
      if (!excluida) throw new ErroApi(404, { erro: 'Imagem não encontrada.' });
      if (excluida.diasRestantes <= 0) {
        throw new ErroApi(410, { erro: 'Esta imagem passou do prazo de 30 dias e será removida.' });
      }
      imagensExcluidas.delete(id);
      const { diasRestantes: _dias, ...imagem } = excluida;
      void _dias;
      const restaurada: ImagemDto = { ...imagem, excluidaEm: null, purgaEm: null };
      imagensAtivas.set(id, restaurada);
      return structuredClone(restaurada);
    }),
    removerImagemDoProjeto: vi.fn(async (_pid: string, imagemId: string) => {
      if (!imagensAtivas.has(imagemId) && !imagensExcluidas.has(imagemId)) {
        throw new ErroApi(404, { erro: 'Imagem não encontrada.' });
      }
      const afetadas: Omit<VarianteAfetadaDto, 'projetoId'>[] = [];
      for (const v of servidor.values()) {
        const n = contar(v, imagemId);
        if (n === 0) continue;
        v.fotos = v.fotos.filter((f) => f.imagemId !== imagemId);
        v.revisao += 1;
        afetadas.push({ varianteId: v._id, revisao: v.revisao, fotos: n });
      }
      return { afetadas, fotosRemovidas: afetadas.reduce((soma, a) => soma + a.fotos, 0) };
    }),
    enviarImagem: vi.fn(),
    obterConfig: vi.fn(async () => ({ uploadMaxMb: 50, autosaveMinutos: opcoes.autosaveMinutos ?? 5 })),
    definirUltimaVariante: vi.fn(async (_pid: string, varianteId: string) => {
      dadosProjeto.ultimaVarianteId = varianteId;
      return structuredClone(dadosProjeto);
    }),
    obterVariante: vi.fn(async (_pid: string, varianteId: string) => {
      const v = servidor.get(varianteId);
      if (!v) throw new ErroApi(404, { erro: 'Variante não encontrada.' });
      return structuredClone(v);
    }),
    salvarVariante: vi.fn(
      async (
        _pid: string,
        varianteId: string,
        corpo: { sessaoId: string; revisaoBase: number } & Pick<
          VarianteDto,
          'grid' | 'bordaPadrao' | 'areaUtil' | 'fotos'
        >,
      ) => {
        const v = servidor.get(varianteId);
        if (!v) throw new ErroApi(404, { erro: 'Variante não encontrada.' });
        if (v.revisao !== corpo.revisaoBase) throw conflito(v);
        const excluidasAgora = opcoes.excluirAoSalvar ?? [];
        Object.assign(v, {
          grid: corpo.grid,
          bordaPadrao: corpo.bordaPadrao,
          areaUtil: corpo.areaUtil,
          fotos: corpo.fotos.map((f) =>
            f.imagemId && excluidasAgora.includes(f.imagemId)
              ? { ...f, imagemId: null, imagemAnteriorId: f.imagemId }
              : f,
          ),
          revisao: v.revisao + 1,
          salvaEm: SALVA_EM_2,
          salvaPorSessao: corpo.sessaoId,
        });
        rascunhos.delete(`${varianteId}:${corpo.sessaoId}`);
        return {
          revisao: v.revisao,
          salvaEm: SALVA_EM_2,
          imagensExcluidas: [
            ...new Set(
              corpo.fotos.flatMap((f) =>
                f.imagemId && excluidasAgora.includes(f.imagemId) ? [f.imagemId] : [],
              ),
            ),
          ],
        };
      },
    ),
    criarVariante: vi.fn(async (_pid: string, corpo: CorpoCriarVariante) => {
      const ordem = Math.max(...lista().map((v) => v.ordem)) + 1;
      let fotos: FotoNaParede[] = [];
      let bordaPadrao = corpo.bordaPadrao;
      let templateOrigem: string | null = null;
      if (corpo.origem.tipo === 'copia') {
        fotos = corpo.origem.fotos.map((f) => ({ ...structuredClone(f), _id: novoId() }));
      } else if (corpo.origem.tipo === 'template') {
        const template = templatePorId(corpo.origem.templateId)!;
        fotos = aplicarTemplate({
          template,
          posicaoCm: corpo.origem.posicaoCm,
          borda: corpo.origem.borda,
          novoId,
        }).fotos;
        bordaPadrao = corpo.origem.borda;
        templateOrigem = template.id;
      }
      const nova = variante({
        _id: novoId(),
        nome: corpo.nome,
        ordem,
        revisao: 1,
        salvaEm: SALVA_EM_2,
        salvaPorSessao: corpo.sessaoId,
        grid: corpo.grid,
        bordaPadrao,
        areaUtil: corpo.areaUtil,
        templateOrigem,
        fotos,
      });
      servidor.set(nova._id, nova);
      dadosProjeto.ultimaVarianteId = nova._id;
      return structuredClone(nova);
    }),
    renomearVariante: vi.fn(async (_pid: string, varianteId: string, nome: string) => {
      const v = servidor.get(varianteId);
      if (!v) throw new ErroApi(404, { erro: 'Variante não encontrada.' });
      v.nome = nome;
      return { _id: varianteId, nome };
    }),
    excluirVariante: vi.fn(async (_pid: string, varianteId: string) => {
      if (!servidor.has(varianteId)) throw new ErroApi(404, { erro: 'Variante não encontrada.' });
      if (servidor.size <= 1)
        throw new ErroApi(409, { erro: 'Todo projeto precisa de ao menos uma variante.' });
      servidor.delete(varianteId);
    }),
    salvarRascunho: vi.fn(
      async (
        _pid: string,
        varianteId: string,
        corpo: { sessaoId: string; revisaoBase: number; conteudo: RascunhoGuardado['conteudo'] },
      ) => {
        const v = servidor.get(varianteId);
        if (!v) throw new ErroApi(404, { erro: 'Variante não encontrada.' });
        if (v.revisao !== corpo.revisaoBase) throw conflito(v);
        rascunhos.set(`${varianteId}:${corpo.sessaoId}`, {
          sessaoId: corpo.sessaoId,
          revisaoBase: corpo.revisaoBase,
          conteudo: structuredClone(corpo.conteudo),
          salvoEm: RASCUNHO_EM,
        });
        return { salvoEm: RASCUNHO_EM };
      },
    ),
    obterRascunho: vi.fn(async (_pid: string, varianteId: string, sessaoId?: string) => {
      const todos = [...rascunhos.entries()].filter(([chave]) => chave.startsWith(`${varianteId}:`));
      const achado = sessaoId
        ? todos.find(([chave]) => chave === `${varianteId}:${sessaoId}`)
        : todos.sort((a, b) => b[1].salvoEm.localeCompare(a[1].salvoEm))[0];
      if (!achado) throw new ErroApi(404, { erro: 'Rascunho não encontrado.' });
      return structuredClone(achado[1]);
    }),
    apagarRascunho: vi.fn(async (_pid: string, varianteId: string, sessaoId: string) => {
      rascunhos.delete(`${varianteId}:${sessaoId}`);
    }),
  };
  return { api: api as unknown as ClienteApi & typeof api, servidor, rascunhos, dadosProjeto, novoId };
}

export type Cenario = ReturnType<typeof criarCenario>;

// Abre o projeto na store, com ids de foto determinísticos.
export async function abrirCenario(opcoes: OpcoesCenario = {}) {
  const cenario = criarCenario(opcoes);
  let n = 900;
  const store: StoreEditor = criarStoreEditor(cenario.api, { gerarId: () => hex(n++) });
  await store.getState().abrirProjeto(ID_PROJETO);
  await store.getState().carregarBiblioteca();
  await store.getState().carregarConfig();
  return { ...cenario, store, estado: () => store.getState() };
}
