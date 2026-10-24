import type { z } from 'zod';

// Conversor Zod → $jsonSchema do Mongo (DM-07). Gerado a partir dos mesmos schemas da API,
// para que as duas camadas de validação não divirjam. Cobre tipo, faixa, tamanho, regex,
// enum, literal, datas, objetos strict e arrays. Refinamentos (superRefine) não entram:
// são regras entre campos e ficam só no Zod.

type JsonSchema = Record<string, unknown>;
// A definição interna do Zod não tem tipagem pública; lida apenas aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = Record<string, any>;

export function gerarJsonSchema(schema: z.ZodType): JsonSchema {
  return converter(schema);
}

function converter(schema: z.ZodType): JsonSchema {
  const def: Def = (schema as unknown as { _zod: { def: Def } })._zod.def;
  const meta = (schema.meta() ?? {}) as { bson?: string };

  if (meta.bson === 'objectId') return { bsonType: 'objectId' };

  switch (def.type) {
    case 'optional':
      return converter(def.innerType);
    case 'nullable':
      return anulavel(converter(def.innerType));
    case 'object':
      return objeto(def);
    case 'array':
      return array(def);
    case 'string':
      return texto(def);
    case 'number':
      return numero(def);
    case 'boolean':
      return { bsonType: 'bool' };
    case 'date':
      return { bsonType: 'date' };
    case 'enum': {
      const valores = Object.values(def.entries as Record<string, unknown>);
      return { bsonType: 'string', enum: valores };
    }
    case 'literal': {
      const valores = def.values as unknown[];
      return { bsonType: typeof valores[0] === 'string' ? 'string' : 'object', enum: valores };
    }
    default:
      throw new Error(`Tipo Zod sem conversão para $jsonSchema: ${def.type}`);
  }
}

function objeto(def: Def): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [chave, valor] of Object.entries(def.shape as Record<string, z.ZodType>)) {
    properties[chave] = converter(valor);
    if ((valor as unknown as { _zod: { def: Def } })._zod.def.type !== 'optional') {
      required.push(chave);
    }
  }
  const json: JsonSchema = { bsonType: 'object', properties };
  if (required.length > 0) json.required = required;
  if (def.catchall?._zod?.def?.type === 'never') json.additionalProperties = false;
  return json;
}

function array(def: Def): JsonSchema {
  const json: JsonSchema = { bsonType: 'array', items: converter(def.element) };
  for (const check of checks(def)) {
    if (check.check === 'min_length') json.minItems = check.minimum;
    if (check.check === 'max_length') json.maxItems = check.maximum;
    if (check.check === 'length_equals') {
      json.minItems = check.length;
      json.maxItems = check.length;
    }
  }
  return json;
}

function texto(def: Def): JsonSchema {
  const json: JsonSchema = { bsonType: 'string' };
  for (const check of checks(def)) {
    if (check.check === 'min_length') json.minLength = check.minimum;
    if (check.check === 'max_length') json.maxLength = check.maximum;
    if (check.check === 'string_format' && check.format === 'regex') {
      json.pattern = (check.pattern as RegExp).source;
    }
  }
  return json;
}

function numero(def: Def): JsonSchema {
  const json: JsonSchema = { bsonType: def.format === 'safeint' ? 'int' : 'number' };
  for (const check of checks(def)) {
    // $jsonSchema do Mongo segue draft 4: limite exclusivo é booleano ao lado de minimum/maximum.
    if (check.check === 'greater_than') {
      json.minimum = check.value;
      if (!check.inclusive) json.exclusiveMinimum = true;
    }
    if (check.check === 'less_than') {
      json.maximum = check.value;
      if (!check.inclusive) json.exclusiveMaximum = true;
    }
  }
  return json;
}

function anulavel(json: JsonSchema): JsonSchema {
  const tipo = json.bsonType;
  const resultado: JsonSchema = {
    ...json,
    bsonType: Array.isArray(tipo) ? [...tipo, 'null'] : [tipo, 'null'],
  };
  if (Array.isArray(json.enum)) resultado.enum = [...json.enum, null];
  return resultado;
}

// Checks Zod ficam em def.checks como objetos com o detalhe em `_zod.def`.
function checks(def: Def): Def[] {
  return ((def.checks ?? []) as { _zod: { def: Def } }[]).map((c) => c._zod.def);
}
