import { arredondarCm } from './arredondar';

// DESIGN §8 / DS-02: vírgula decimal, 1 casa em cm, "×" (U+00D7) com espaços.
// Horários e datas exibidos no fuso de Brasília (DV-11).

const FUSO_BRASILIA = 'America/Sao_Paulo';

export function formatarCm(valor: number): string {
  return arredondarCm(valor).toFixed(1).replace('.', ',');
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

export function formatarHora(data: Date): string {
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(data);
  return `às ${hora}`;
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_BRASILIA,
    day: '2-digit',
    month: '2-digit',
  }).format(data);
}
