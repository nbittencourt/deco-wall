import { escalaPxPorCm, paredeInteira, type AreaUtil } from '@deco-wall/domain';
import { urlArquivoParede } from '../../../infra/clienteApi';
import type { ProjetoDto, VarianteDto } from '../../../infra/dto';
import type { CenaAreaUtil, CenaParede } from '../../canvas/cena';

// Monta as cenas do Palco a partir do projeto e da variante (spec M1 §3.9). Sem Konva: roda nos testes.

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

// Editor e Área útil: a parede em cm (retificada ou a foto) com grid e área útil; sem escala, a foto em px.
export function cenaDaParede(projeto: ProjetoDto, variante: VarianteDto): CenaParede {
  const parede = projeto.parede;
  if (!parede) throw new Error('O projeto ainda não tem parede.');
  const dados = dadosDaParede(projeto);
  const chave = `parede:${projeto._id}:${projeto.revisao}`;

  if (parede.escala.metodo === 'perspectiva' && parede.retificada) {
    const r = parede.retificada;
    return {
      tipo: 'parede',
      chave,
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
    };
  }

  const pxPorCm = dados.pxPorCm;
  const comEscala = pxPorCm !== null;
  const k = comEscala ? 1 / pxPorCm : 1;
  return {
    tipo: 'parede',
    chave,
    imagemUrl: urlArquivoParede(projeto._id, 'original', projeto.revisao),
    imagem: { x: 0, y: 0, largura: parede.larguraPx * k, altura: parede.alturaPx * k },
    pxPorUnidade: comEscala ? pxPorCm : 1,
    comEscala,
    paredeInteira: dados.interior,
    grid: comEscala ? variante.grid : null,
    areaUtil: comEscala ? variante.areaUtil : null,
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
