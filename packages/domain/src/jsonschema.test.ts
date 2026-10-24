import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { gerarJsonSchema } from './jsonschema';
import { FotoNaParedeSchema, IdSchema, ImagemSchema, TamanhoSchema, VarianteSchema } from './schemas';

type Campos = Record<string, Record<string, unknown>>;
const campos = (js: Record<string, unknown>): Campos => js.properties as Campos;

// Conversor Zod → $jsonSchema do Mongo (DM-07). Paridade com o Zod é testada na API.
describe('gerarJsonSchema — estrutura', () => {
  it('objeto vira bsonType object com required e additionalProperties false', () => {
    const js = gerarJsonSchema(TamanhoSchema);
    expect(js.bsonType).toBe('object');
    expect(js.required).toEqual(['sugeridoId', 'larguraCm', 'alturaCm']);
    expect(js.additionalProperties).toBe(false);
  });

  it('campo opcional não entra em required', () => {
    const js = gerarJsonSchema(VarianteSchema);
    expect(js.required).not.toContain('templateOrigem');
    expect(js.required).toContain('nome');
  });

  it('array vira bsonType array com items do tipo do elemento', () => {
    const js = gerarJsonSchema(VarianteSchema);
    const fotos = campos(js).fotos as { bsonType: string; items: { bsonType: string } };
    expect(fotos.bsonType).toBe('array');
    expect(fotos.items.bsonType).toBe('object');
  });
});

describe('gerarJsonSchema — tipos BSON (DM-01, DM-09)', () => {
  it('id hex vira objectId', () => {
    expect(gerarJsonSchema(IdSchema)).toMatchObject({ bsonType: 'objectId' });
    expect(campos(gerarJsonSchema(ImagemSchema))._id).toMatchObject({ bsonType: 'objectId' });
  });

  it('id opcional nulo vira objectId ou null', () => {
    const js = gerarJsonSchema(FotoNaParedeSchema);
    expect(campos(js).imagemId).toMatchObject({ bsonType: ['objectId', 'null'] });
  });

  it('data vira date e data nula vira date ou null', () => {
    const js = gerarJsonSchema(ImagemSchema);
    expect(campos(js).criadaEm).toMatchObject({ bsonType: 'date' });
    expect(campos(js).excluidaEm).toMatchObject({ bsonType: ['date', 'null'] });
  });

  it('inteiro vira int com mínimo; número real vira number', () => {
    const js = gerarJsonSchema(ImagemSchema);
    expect(campos(js).larguraPx).toMatchObject({ bsonType: 'int', minimum: 1 });
    expect(campos(gerarJsonSchema(TamanhoSchema)).larguraCm).toMatchObject({
      bsonType: 'number',
      minimum: 5,
      maximum: 150,
    });
  });

  it('número com limite exclusivo (> 0) vira minimum com exclusiveMinimum booleano (draft 4 do Mongo)', () => {
    const js = gerarJsonSchema(z.object({ x: z.number().positive() }));
    expect(campos(js).x).toMatchObject({ bsonType: 'number', minimum: 0, exclusiveMinimum: true });
  });
});

describe('gerarJsonSchema — restrições', () => {
  it('enum de strings vira enum', () => {
    expect(campos(gerarJsonSchema(ImagemSchema)).perfil).toMatchObject({
      enum: ['leve', 'medio', 'alto'],
    });
  });

  it('literal vira enum de um valor', () => {
    expect(campos(gerarJsonSchema(ImagemSchema)).mime).toMatchObject({
      enum: ['image/webp'],
    });
  });

  it('sugeridoId aceita os ids aprovados ou null', () => {
    const sugerido = campos(gerarJsonSchema(TamanhoSchema)).sugeridoId as {
      bsonType: string[];
      enum: unknown[];
    };
    expect(sugerido.bsonType).toEqual(['string', 'null']);
    expect(sugerido.enum).toEqual(expect.arrayContaining(['10x15', '75x120', null]));
    expect(sugerido.enum).not.toContain('99x99');
  });

  it('string vira com minLength e maxLength (nome da variante 1–60)', () => {
    expect(campos(gerarJsonSchema(VarianteSchema)).nome).toMatchObject({
      bsonType: 'string',
      minLength: 1,
      maxLength: 60,
    });
  });

  it('expressão regular de cor hexadecimal vira pattern', () => {
    const js = gerarJsonSchema(z.object({ cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }));
    expect(campos(js).cor).toMatchObject({ bsonType: 'string', pattern: '^#[0-9A-Fa-f]{6}$' });
  });
});
