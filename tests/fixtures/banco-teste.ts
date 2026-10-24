import { MongoClient, ObjectId, type Db } from 'mongodb';

// Banco de teste: mesma instância de MONGODB_URI, database `parede-fotos-test`,
// recriado a cada execução (docs/specs/M0-setup.md §5.5).
export const NOME_BANCO_TESTE = 'parede-fotos-test';

const HEX_24 = /^[0-9a-f]{24}$/;

export function uriBancoTeste(): string {
  const base = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/parede-fotos';
  const url = new URL(base);
  url.pathname = `/${NOME_BANCO_TESTE}`;
  return url.toString();
}

export async function abrirBancoTesteLimpo(): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(uriBancoTeste());
  await client.connect();
  const db = client.db(NOME_BANCO_TESTE);
  await db.dropDatabase();
  return { client, db };
}

// Fronteira do repositório: ObjectId (banco) → string hex (domínio). Datas preservadas.
export function paraDominio<T>(valor: T): unknown {
  if (valor instanceof ObjectId) return valor.toHexString();
  if (valor instanceof Date || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(paraDominio);
  return Object.fromEntries(Object.entries(valor).map(([chave, v]) => [chave, paraDominio(v)]));
}

// Inverso: strings hex de 24 caracteres (domínio) → ObjectId (banco).
export function paraMongo<T>(valor: T): unknown {
  if (typeof valor === 'string' && HEX_24.test(valor)) return new ObjectId(valor);
  if (valor instanceof Date || valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(paraMongo);
  return Object.fromEntries(Object.entries(valor).map(([chave, v]) => [chave, paraMongo(v)]));
}
