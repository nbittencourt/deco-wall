import { retanguloExterno } from '../composicao/foto';
import type { OffsetRecorte } from '../composicao/recorte';
import type { ParedeGeometria } from '../escala/parede-inteira';
import type { AreaUtil, Borda, FotoNaParede, Grid, Pt } from '../schemas';
import { regiaoDeExportacao } from './resolucao';

// Comandos de desenho da exportação (RF-80, RN-12, RN-19, ADR-08, M4-10, M4-11, A-15, A-16;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.5). Tudo em cm e na ordem de desenho; o executor (web)
// converte para px com o `pxPorCm` da resolução, calcula a janela do recorte (calcularRecorte, a mesma
// função do canvas) quando conhece o tamanho da imagem e recorta no limite do bitmap.

export interface TamanhoCm {
  larguraCm: number;
  alturaCm: number;
}

export type ComandoExportacao =
  | { tipo: 'parede'; arquivo: string; origemCm: Pt; tamanhoCm: TamanhoCm }
  | {
      tipo: 'grid';
      passoCm: number;
      cor: string;
      opacidade: number;
      origemCm: Pt;
      tamanhoCm: TamanhoCm;
    }
  | {
      tipo: 'foto';
      fotoId: string;
      imagemId: string;
      externo: AreaUtil;
      impresso: AreaUtil;
      borda: Borda | null;
      recorte: OffsetRecorte;
    }
  | { tipo: 'placeholder'; fotoId: string; externo: AreaUtil };

type ParedeComArquivos = ParedeGeometria & {
  arquivo: string;
  retificada?: NonNullable<ParedeGeometria['retificada']> & { arquivo: string };
};

export interface EntradaExportacao {
  variante: { grid: Grid; fotos: readonly FotoNaParede[] };
  parede: ParedeComArquivos;
  incluirGrid: boolean;
}

export function comandosDeExportacao(entrada: EntradaExportacao): ComandoExportacao[] {
  const { variante, parede } = entrada;
  const regiao = regiaoDeExportacao(parede);
  const origemCm = { x: regiao.xCm, y: regiao.yCm };
  const tamanhoCm = { larguraCm: regiao.larguraCm, alturaCm: regiao.alturaCm };

  const arquivo =
    parede.escala.metodo === 'perspectiva' && parede.retificada ? parede.retificada.arquivo : parede.arquivo;
  const comandos: ComandoExportacao[] = [{ tipo: 'parede', arquivo, origemCm, tamanhoCm }];

  if (entrada.incluirGrid) {
    const g = variante.grid;
    comandos.push({
      tipo: 'grid',
      passoCm: g.passoCm,
      cor: g.cor,
      opacidade: g.opacidade,
      origemCm,
      tamanhoCm,
    });
  }

  for (const f of variante.fotos) {
    const externo = retanguloExterno(f);
    if (f.imagemId === null) {
      comandos.push({ tipo: 'placeholder', fotoId: f._id, externo });
      continue;
    }
    const b = f.borda.larguraCm;
    comandos.push({
      tipo: 'foto',
      fotoId: f._id,
      imagemId: f.imagemId,
      externo,
      impresso: {
        xCm: externo.xCm + b,
        yCm: externo.yCm + b,
        larguraCm: externo.larguraCm - 2 * b,
        alturaCm: externo.alturaCm - 2 * b,
      },
      borda: b > 0 ? { larguraCm: b, cor: f.borda.cor } : null,
      recorte: { offsetX: f.recorte.offsetX, offsetY: f.recorte.offsetY },
    });
  }
  return comandos;
}
