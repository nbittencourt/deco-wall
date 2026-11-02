import type { FormatoExportacao } from './resolucao';

// Nome do arquivo exportado (RF-80, DV-11, A-18; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.6).

const FUSO_BRASILIA = 'America/Sao_Paulo';
const LIMITE_SLUG = 60;

// NFD, sem diacríticos, minúsculas; qualquer sequência fora de a-z0-9 vira um hífen; as pontas são aparadas.
export function slugDoNome(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, LIMITE_SLUG).replace(/-+$/g, '');
}

// "AAAAMMDD-HHmm" no fuso de Brasília.
function carimbo(data: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data);
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${campo('year')}${campo('month')}${campo('day')}-${campo('hour')}${campo('minute')}`;
}

export function nomeDoArquivoExportado(args: {
  projeto: string;
  variante: string;
  data: Date;
  formato: FormatoExportacao;
}): string {
  const projeto = slugDoNome(args.projeto) || 'projeto';
  const variante = slugDoNome(args.variante) || 'variante';
  return `${projeto}-${variante}-${carimbo(args.data)}.${args.formato}`;
}
