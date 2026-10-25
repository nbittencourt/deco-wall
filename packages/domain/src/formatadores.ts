import { arredondarCm } from './arredondar';

// DESIGN §8 / DS-02: vírgula decimal, 1 casa em cm, "×" (U+00D7) com espaços.
// Horários e datas exibidos no fuso de Brasília (DV-11).

const FUSO_BRASILIA = 'America/Sao_Paulo';

export function formatarCm(valor: number): string {
  return arredondarCm(valor).toFixed(1).replace('.', ',');
}

// Passo e medidas curtas: "5" quando inteiro, "2,5" quando fracionário (sem a casa decimal à toa).
export function formatarCmCurto(valor: number): string {
  const arredondado = arredondarCm(valor);
  return Number.isInteger(arredondado) ? String(arredondado) : arredondado.toFixed(1).replace('.', ',');
}

export function formatarDimensao(larguraCm: number, alturaCm: number): string {
  return `${formatarCm(larguraCm)} × ${formatarCm(alturaCm)} cm`;
}

export function formatarEscala(pxPorCm: number): string {
  return `${formatarCm(pxPorCm)} px/cm`;
}

// Sugerido: sem casa decimal, na orientação atual ("20 × 30").
// Personalizado: 1 casa decimal ("21,0 × 29,7").
export function formatarTamanho(t: {
  sugeridoId: string | null;
  larguraCm: number;
  alturaCm: number;
}): string {
  if (t.sugeridoId !== null) return `${t.larguraCm} × ${t.alturaCm}`;
  return `${formatarCm(t.larguraCm)} × ${formatarCm(t.alturaCm)}`;
}

function horaBrasilia(data: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(data);
}

export function formatarHora(data: Date): string {
  return `às ${horaBrasilia(data)}`;
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_BRASILIA,
    day: '2-digit',
    month: '2-digit',
  }).format(data);
}

// "aaaa-mm-dd" do dia da data no fuso de Brasília.
function diaBrasilia(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

const DIA_MS = 86_400_000;

// A-04: "editado hoje, 14:35", "editado ontem, 09:10", "editado em 12/10" (com o ano se for de outro ano).
// Os dias são comparados no fuso de Brasília; uma data no futuro (relógio adiantado) conta como hoje.
export function formatarEditadoEm(data: Date, agora: Date): string {
  const diaData = diaBrasilia(data);
  const diaAgora = diaBrasilia(agora);
  const dias = Math.round((Date.parse(diaAgora) - Date.parse(diaData)) / DIA_MS);
  if (dias <= 0) return `editado hoje, ${horaBrasilia(data)}`;
  if (dias === 1) return `editado ontem, ${horaBrasilia(data)}`;
  const anoData = diaData.slice(0, 4);
  const sufixoAno = anoData === diaAgora.slice(0, 4) ? '' : `/${anoData}`;
  return `editado em ${formatarData(data)}${sufixoAno}`;
}

// A-04: meta do card de projeto.
export function formatarMetaProjeto(
  projeto: { qtdVariantes: number; temParede: boolean; atualizadoEm: Date },
  agora: Date,
): string {
  const variantes = `${projeto.qtdVariantes} ${projeto.qtdVariantes === 1 ? 'variante' : 'variantes'}`;
  return `${variantes} · ${projeto.temParede ? formatarEditadoEm(projeto.atualizadoEm, agora) : 'parede não definida'}`;
}

// Campo numérico em cm com vírgula decimal ("12,5"). null quando não é um número (sem notação científica).
export function lerCm(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null;
  return Number(limpo);
}
