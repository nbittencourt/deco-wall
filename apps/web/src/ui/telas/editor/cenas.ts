import { escalaPxPorCm, paredeInteira, type AreaUtil, type FotoNaParede, type Grid } from '@deco-wall/domain';
import { urlArquivoImagem, urlArquivoParede } from '../../../infra/clienteApi';
import type { ImagemDto, ProjetoDto } from '../../../infra/dto';
import type { CenaAreaUtil, CenaParede, CenaRecorte, FotoCena, RecorteCena } from '../../canvas/cena';

// Monta as cenas do Palco a partir do projeto e da variante (spec M1 §3.9, spec M2 §3.3). Sem Konva: roda nos
// testes.

export interface DadosParede {
  metodo: 'perspectiva' | 'linear' | null;
  pxPorCm: number | null;
  // Parede inteira em cm; null enquanto não há escala.
  interior: AreaUtil | null;
}

export function dadosDaParede(projeto: ProjetoDto): DadosParede {
  const parede = projeto.parede;
  if (!parede || parede.escala.metodo === null) return { metodo: null, pxPorCm: null, interior: null };
  return {
    metodo: parede.escala.metodo,
    pxPorCm: escalaPxPorCm(parede),
    interior: paredeInteira(parede),
  };
}

// As fotos da variante com a imagem resolvida na biblioteca (arquivo `render`, B-09).
// O que a cena precisa da variante aberta: o grid (da variante) e o conteúdo desfazível (fotos e área útil).
export interface VistaDaVariante {
  grid: Grid;
  fotos: FotoNaParede[];
  areaUtil: AreaUtil | null;
}

export function fotosDaCena(
  variante: Pick<VistaDaVariante, 'fotos'>,
  imagens: readonly ImagemDto[],
): FotoCena[] {
  const porId = new Map(imagens.map((i) => [i._id, i]));
  return variante.fotos.map((foto) => {
    const imagem = foto.imagemId ? porId.get(foto.imagemId) : undefined;
    return {
      id: foto._id,
      nome: imagem?.nomeOriginal ?? 'Imagem indisponível',
      xCm: foto.xCm,
      yCm: foto.yCm,
      tamanho: foto.tamanho,
      borda: foto.borda,
      recorte: foto.recorte,
      imagem: imagem
        ? {
            url: urlArquivoImagem(imagem._id, 'render'),
            larguraPx: imagem.larguraPx,
            alturaPx: imagem.alturaPx,
          }
        : null,
    };
  });
}

export interface InteracaoDaCena {
  selecaoId?: string | null;
  interativa?: boolean;
  onSelecionar?: (id: string | null) => void;
  onMoverFoto?: (id: string, xCm: number, yCm: number) => void;
  onAbrirRecorte?: (id: string) => void;
  onArrastarFoto?: (arrasto: { id: string; xCm: number; yCm: number } | null) => void;
}

// Editor, Área útil e Recorte: a parede em cm (retificada ou a foto) com grid, área útil e fotos; sem escala,
// a foto em px.
export function cenaDaParede(
  projeto: ProjetoDto,
  variante: VistaDaVariante,
  imagens: readonly ImagemDto[] = [],
  interacao: InteracaoDaCena = {},
): CenaParede {
  const parede = projeto.parede;
  if (!parede) throw new Error('O projeto ainda não tem parede.');
  const dados = dadosDaParede(projeto);
  const chave = `parede:${projeto._id}:${projeto.revisao}`;
  const comum = {
    tipo: 'parede' as const,
    chave,
    selecaoId: interacao.selecaoId ?? null,
    interativa: interacao.interativa ?? false,
    onSelecionar: interacao.onSelecionar,
    onMoverFoto: interacao.onMoverFoto,
    onAbrirRecorte: interacao.onAbrirRecorte,
    onArrastarFoto: interacao.onArrastarFoto,
  };

  if (parede.escala.metodo === 'perspectiva' && parede.retificada) {
    const r = parede.retificada;
    return {
      ...comum,
      imagemUrl: urlArquivoParede(projeto._id, 'retificada', projeto.revisao),
      imagem: {
        x: r.origemCm.x,
        y: r.origemCm.y,
        largura: r.larguraPx / r.pxPorCm,
        altura: r.alturaPx / r.pxPorCm,
      },
      pxPorUnidade: r.pxPorCm,
      comEscala: true,
      paredeInteira: dados.interior,
      grid: variante.grid,
      areaUtil: variante.areaUtil,
      fotos: fotosDaCena(variante, imagens),
    };
  }

  const pxPorCm = dados.pxPorCm;
  const comEscala = pxPorCm !== null;
  const k = comEscala ? 1 / pxPorCm : 1;
  return {
    ...comum,
    imagemUrl: urlArquivoParede(projeto._id, 'original', projeto.revisao),
    imagem: { x: 0, y: 0, largura: parede.larguraPx * k, altura: parede.alturaPx * k },
    pxPorUnidade: comEscala ? pxPorCm : 1,
    comEscala,
    paredeInteira: dados.interior,
    grid: comEscala ? variante.grid : null,
    areaUtil: comEscala ? variante.areaUtil : null,
    fotos: comEscala ? fotosDaCena(variante, imagens) : [],
  };
}

export function cenaDaAreaUtil(
  base: CenaParede,
  area: AreaUtil,
  onAreaChange: (area: AreaUtil) => void,
): CenaAreaUtil {
  const { tipo: _tipo, ...resto } = base;
  void _tipo;
  return { ...resto, tipo: 'area-util', area, onAreaChange };
}

// Modo de recorte (RN-14): o editor sem interação, mais a foto que está sendo enquadrada.
export function cenaDoRecorte(base: CenaParede, recorte: RecorteCena): CenaRecorte {
  const { tipo: _tipo, ...resto } = base;
  void _tipo;
  return { ...resto, tipo: 'recorte', interativa: false, recorte };
}
