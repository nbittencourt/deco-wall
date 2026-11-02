import {
  alertasPorFoto,
  boundingBox,
  formatarDimensao,
  formatarTamanho,
  retanguloExterno,
  sobreposicoes,
  type AlertasDaFoto,
  type AreaUtil,
} from '@deco-wall/domain';
import type { CenaParede, CenaRecorte, FotoCena } from './cena';

// O que o canvas desenha por cima das fotos, em dados (spec M2 §3.3, §3.7; A-12, A-13, A-16; DESIGN §2.2).
// Sem Konva: o Palco desenha a partir daqui e o gancho de teste (`window.__deco.anotacoesDaCena`) devolve a
// mesma lista, para os E2E conferirem pills e textos que não existem no DOM.

export type TipoAnotacao =
  | 'sobreposicao'
  | 'fora-da-parede'
  | 'fora-da-area-util'
  | 'area-total'
  | 'selecao'
  | 'imagem-indisponivel'
  | 'placeholder';

export interface Anotacao {
  tipo: TipoAnotacao;
  fotoId: string | null;
  texto: string;
}

export interface Arrasto {
  id: string;
  xCm: number;
  yCm: number;
}

// A foto que está sendo arrastada ocupa a posição ao vivo (A-07), antes de a store saber.
export function comArrasto(fotos: readonly FotoCena[], arrasto: Arrasto | null): FotoCena[] {
  if (!arrasto) return [...fotos];
  return fotos.map((f) => (f.id === arrasto.id ? { ...f, xCm: arrasto.xCm, yCm: arrasto.yCm } : f));
}

// A-12: pills e contornos. `acima`: as fotos da camada superior de cada sobreposição, que recebem a pill.
export function destaquesDaCena(fotos: readonly FotoCena[], cena: CenaParede | CenaRecorte) {
  // M3-10: a comparação pode esconder os alertas (visualização limpa).
  if (cena.mostrarAlertas === false)
    return { alertas: new Map<string, AlertasDaFoto>(), acima: new Set<string>() };
  const geometricas = fotos.map((f) => ({
    _id: f.id,
    xCm: f.xCm,
    yCm: f.yCm,
    tamanho: f.tamanho,
    borda: f.borda,
  }));
  const alertas = alertasPorFoto(geometricas, cena.paredeInteira, cena.areaUtil);
  return { alertas, acima: new Set(sobreposicoes(geometricas).acima) };
}

export const SEM_ALERTAS: AlertasDaFoto = { sobreposicao: false, fora: null };

// A-16: sem imagem na biblioteca, ou com o arquivo que não carregou (404, falha de decodificação). O placeholder
// (sem imagem associada) é outra coisa (M2-06).
export const imagemIndisponivel = (foto: FotoCena, falhas: ReadonlySet<string>) =>
  !foto.placeholder && (foto.imagem === null || falhas.has(foto.id));

// A-11: no modo de recorte, as outras fotos ficam a 35%.
export const OPACIDADE_FOTOS_BLOQUEADAS = 0.35;
export function opacidadeDaFoto(cena: CenaParede | CenaRecorte, id: string): number {
  return cena.tipo === 'recorte' && cena.recorte.foto.id !== id ? OPACIDADE_FOTOS_BLOQUEADAS : 1;
}

// A-13: a caixa "Área total" aparece com 1 foto ou mais, quando o toggle da toolbar está ligado.
export function caixaAreaTotal(fotos: readonly FotoCena[], cena: CenaParede | CenaRecorte): AreaUtil | null {
  return cena.mostrarAreaTotal ? boundingBox(fotos) : null;
}

export function anotacoesDaCena(
  cena: CenaParede | CenaRecorte,
  arrasto: Arrasto | null,
  falhas: ReadonlySet<string>,
): Anotacao[] {
  if (!cena.comEscala) return [];
  const fotos = comArrasto(cena.fotos, arrasto);
  const { alertas, acima } = destaquesDaCena(fotos, cena);
  const notas: Anotacao[] = [];

  const caixa = caixaAreaTotal(fotos, cena);
  if (caixa) {
    notas.push({
      tipo: 'area-total',
      fotoId: null,
      texto: formatarDimensao(caixa.larguraCm, caixa.alturaCm),
    });
  }
  for (const foto of fotos) {
    if (foto.placeholder) {
      notas.push({ tipo: 'placeholder', fotoId: foto.id, texto: formatarTamanho(foto.tamanho) });
    } else if (imagemIndisponivel(foto, falhas)) {
      notas.push({ tipo: 'imagem-indisponivel', fotoId: foto.id, texto: 'Imagem indisponível' });
    }
    const a = alertas.get(foto.id) ?? SEM_ALERTAS;
    if (a.fora === 'parede') notas.push({ tipo: 'fora-da-parede', fotoId: foto.id, texto: 'Fora da parede' });
    if (a.fora === 'area-util') {
      notas.push({ tipo: 'fora-da-area-util', fotoId: foto.id, texto: 'Fora da área útil' });
    }
    if (acima.has(foto.id)) notas.push({ tipo: 'sobreposicao', fotoId: foto.id, texto: 'Sobreposição' });
  }
  const selecionada = fotos.find((f) => f.id === cena.selecaoId);
  if (selecionada) {
    const r = retanguloExterno(selecionada);
    notas.push({
      tipo: 'selecao',
      fotoId: selecionada.id,
      texto: formatarDimensao(r.larguraCm, r.alturaCm),
    });
  }
  return notas;
}
