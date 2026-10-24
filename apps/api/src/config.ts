// Leitura e validação do .env (ADR-11, docs/specs/M0-setup.md §5.3).
// Valida só o formato. Existência da pasta e acesso ao Mongo são checados na inicialização.

export interface Config {
  pastaFotos: string;
  mongoUri: string;
  apiPort: number;
  webPort: number;
  autosaveMinutos: number;
  uploadMaxMb: number;
  // RNF-01: a API nunca escuta fora da máquina local.
  hostApi: '127.0.0.1';
}

export class ErroConfiguracao extends Error {
  readonly mensagens: string[];

  constructor(mensagens: string[]) {
    super(`Configuração inválida:\n- ${mensagens.join('\n- ')}`);
    this.name = 'ErroConfiguracao';
    this.mensagens = mensagens;
  }
}

type Ambiente = Record<string, string | undefined>;

const MONGO_PADRAO = 'mongodb://127.0.0.1:27017/parede-fotos';

export function lerConfig(env: Ambiente = process.env): Config {
  const erros: string[] = [];

  const pastaFotos = (env.PASTA_FOTOS ?? '').trim();
  if (pastaFotos === '') erros.push('PASTA_FOTOS é obrigatória (pasta onde ficam as fotos processadas)');

  const mongoUri = (env.MONGODB_URI ?? MONGO_PADRAO).trim();
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    erros.push('MONGODB_URI deve começar com mongodb:// ou mongodb+srv://');
  }

  const apiPort = porta(env.API_PORT, 3001, 'API_PORT', erros);
  const webPort = porta(env.WEB_PORT, 5173, 'WEB_PORT', erros);
  const autosaveMinutos = positivo(env.AUTOSAVE_MINUTOS, 5, 'AUTOSAVE_MINUTOS', erros);
  const uploadMaxMb = positivo(env.UPLOAD_MAX_MB, 50, 'UPLOAD_MAX_MB', erros);

  if (erros.length > 0) throw new ErroConfiguracao(erros);

  return {
    pastaFotos,
    mongoUri,
    apiPort,
    webPort,
    autosaveMinutos,
    uploadMaxMb,
    hostApi: '127.0.0.1',
  };
}

function porta(valor: string | undefined, padrao: number, nome: string, erros: string[]): number {
  if (valor === undefined || valor.trim() === '') return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    erros.push(`${nome} deve ser um inteiro entre 1 e 65535 (recebido: "${valor}")`);
    return padrao;
  }
  return numero;
}

function positivo(valor: string | undefined, padrao: number, nome: string, erros: string[]): number {
  if (valor === undefined || valor.trim() === '') return padrao;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    erros.push(`${nome} deve ser um número maior que zero (recebido: "${valor}")`);
    return padrao;
  }
  return numero;
}
