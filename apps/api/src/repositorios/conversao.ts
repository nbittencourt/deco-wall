import { ObjectId } from 'mongodb';

// Fronteira do repositório (DM-01): no domínio os ids são strings hex de 24 caracteres; no banco, ObjectId.
// Só os campos de id são convertidos (um nome de projeto com 24 caracteres hex continua texto).
const CHAVES_ID = new Set([
  '_id',
  'projetoId',
  'ultimaVarianteId',
  'varianteId',
  'imagemId',
  'imagemAnteriorId',
]);
const HEX_24 = /^[0-9a-f]{24}$/;

export function paraMongo<T>(valor: T, chave?: string): unknown {
  if (typeof valor === 'string')
    return chave && CHAVES_ID.has(chave) && HEX_24.test(valor) ? new ObjectId(valor) : valor;
  if (valor === null || typeof valor !== 'object' || valor instanceof Date || valor instanceof ObjectId)
    return valor;
  if (Array.isArray(valor)) return valor.map((item) => paraMongo(item, chave));
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, paraMongo(v, k)]));
}

export function paraDominio<T = unknown>(valor: unknown): T {
  if (valor instanceof ObjectId) return valor.toHexString() as T;
  if (valor === null || typeof valor !== 'object' || valor instanceof Date) return valor as T;
  if (Array.isArray(valor)) return valor.map((item) => paraDominio(item)) as T;
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, paraDominio(v)])) as T;
}

export function idValido(id: string): boolean {
  return HEX_24.test(id);
}

export function oid(id: string): ObjectId | null {
  return idValido(id) ? new ObjectId(id) : null;
}
