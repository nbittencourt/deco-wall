import { z } from 'zod';
import { LIMITE_PERSONALIZADO_CM, TAMANHOS_SUGERIDOS } from './constantes';

// Schemas do modelo (docs/specs/M0-setup.md §4). Fonte única de validação: API e web.
// `.strict()` em todo objeto: campo fora do modelo é erro (espelha `additionalProperties: false` no Mongo).
// Regras entre campos usam superRefine e valem só no Zod (o $jsonSchema não as expressa).

// DM-01: id é string hex de 24 caracteres; o metadado `bson` diz ao conversor que é ObjectId.
export const IdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/)
  .meta({ bson: 'objectId' });

const CorHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const CaminhoSchema = z.string().min(1);
const PerfilSchema = z.enum(['leve', 'medio', 'alto']);
const PositivoInteiroSchema = z.int().min(1);

export const PtSchema = z.object({ x: z.number(), y: z.number() }).strict();

const IdsSugeridos = TAMANHOS_SUGERIDOS.map((t) => t.id) as [string, ...string[]];
const DimensaoCmSchema = z.number().min(LIMITE_PERSONALIZADO_CM.min).max(LIMITE_PERSONALIZADO_CM.max);

// RN-01 / RN-28: sugerido (com id) ou personalizado (sugeridoId null).
export const TamanhoSchema = z
  .object({
    sugeridoId: z.enum(IdsSugeridos).nullable(),
    larguraCm: DimensaoCmSchema,
    alturaCm: DimensaoCmSchema,
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.sugeridoId === null) return;
    const sugerido = TAMANHOS_SUGERIDOS.find((s) => s.id === t.sugeridoId);
    if (!sugerido) return;
    // Sugerido aceita qualquer orientação: as medidas são o par {menor, maior} em qualquer ordem.
    const naOrdem = t.larguraCm === sugerido.menorCm && t.alturaCm === sugerido.maiorCm;
    const girado = t.larguraCm === sugerido.maiorCm && t.alturaCm === sugerido.menorCm;
    if (!naOrdem && !girado) {
      ctx.addIssue({
        code: 'custom',
        path: ['larguraCm'],
        message: `As medidas não correspondem ao tamanho ${sugerido.id}`,
      });
    }
  });

export const GridSchema = z
  .object({
    visivel: z.boolean(),
    snap: z.boolean(),
    passoCm: z.number().positive(),
    principalACada: PositivoInteiroSchema,
    cor: CorHexSchema,
    opacidade: z.number().min(0).max(1),
  })
  .strict();

export const BordaSchema = z
  .object({
    larguraCm: z.number().min(0),
    cor: CorHexSchema,
  })
  .strict();

export const AreaUtilSchema = z
  .object({
    xCm: z.number(),
    yCm: z.number(),
    larguraCm: z.number().positive(),
    alturaCm: z.number().positive(),
  })
  .strict();

const RecorteSchema = z
  .object({
    offsetX: z.number().min(-1).max(1),
    offsetY: z.number().min(-1).max(1),
  })
  .strict();

// DM-04 / DM-16: imagemId null = placeholder; imagemAnteriorId guarda a recomendação.
export const FotoNaParedeSchema = z
  .object({
    _id: IdSchema,
    imagemId: IdSchema.nullable(),
    imagemAnteriorId: IdSchema.nullable(),
    tamanho: TamanhoSchema,
    xCm: z.number(),
    yCm: z.number(),
    recorte: RecorteSchema,
    borda: BordaSchema,
  })
  .strict();

const PerspectivaSchema = z
  .object({
    cantosPx: z.array(PtSchema).length(4),
    larguraCm: z.number().positive(),
    alturaCm: z.number().positive(),
  })
  .strict();

const LinearSchema = z
  .object({
    p1: PtSchema,
    p2: PtSchema,
    comprimentoCm: z.number().positive(),
  })
  .strict();

// ADR-04 / RN-08: escala por perspectiva (principal) ou linear; `metodo` null bloqueia fotos.
export const EscalaSchema = z
  .object({
    metodo: z.enum(['perspectiva', 'linear']).nullable(),
    perspectiva: PerspectivaSchema.optional(),
    linear: LinearSchema.optional(),
    homografia: z.array(z.number()).length(9).optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.metodo === null) return;
    if (!e.homografia) {
      ctx.addIssue({ code: 'custom', path: ['homografia'], message: 'Escala calibrada exige homografia' });
    }
    if (e.metodo === 'perspectiva' && !e.perspectiva) {
      ctx.addIssue({ code: 'custom', path: ['perspectiva'], message: 'Método perspectiva exige seus dados' });
    }
    if (e.metodo === 'linear' && !e.linear) {
      ctx.addIssue({ code: 'custom', path: ['linear'], message: 'Método linear exige seus dados' });
    }
  });

const RetificadaSchema = z
  .object({
    arquivo: CaminhoSchema,
    larguraPx: PositivoInteiroSchema,
    alturaPx: PositivoInteiroSchema,
    pxPorCm: z.number().positive(),
    origemCm: PtSchema,
  })
  .strict();

export const ParedeSchema = z
  .object({
    perfil: PerfilSchema,
    arquivo: CaminhoSchema,
    thumb: CaminhoSchema,
    larguraPx: PositivoInteiroSchema,
    alturaPx: PositivoInteiroSchema,
    escala: EscalaSchema,
    retificada: RetificadaSchema.optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.escala.metodo === 'perspectiva' && !p.retificada) {
      ctx.addIssue({
        code: 'custom',
        path: ['retificada'],
        message: 'Escala por perspectiva exige a imagem retificada',
      });
    }
  });

export const ProjetoSchema = z
  .object({
    _id: IdSchema,
    nome: z.string().min(1).max(100),
    criadoEm: z.date(),
    atualizadoEm: z.date(),
    revisao: PositivoInteiroSchema,
    ultimaVarianteId: IdSchema.optional(),
    parede: ParedeSchema.nullable(),
    schemaVersion: PositivoInteiroSchema,
  })
  .strict();

// DM-03 / RN-23: variante "Base" nasce vazia; templateOrigem é informativo (TPL-04).
export const VarianteSchema = z
  .object({
    _id: IdSchema,
    projetoId: IdSchema,
    nome: z.string().min(1).max(60),
    ordem: z.int().min(0),
    criadaEm: z.date(),
    revisao: PositivoInteiroSchema,
    salvaEm: z.date(),
    salvaPorSessao: CaminhoSchema,
    grid: GridSchema,
    bordaPadrao: BordaSchema,
    areaUtil: AreaUtilSchema.nullable(),
    templateOrigem: z.string().min(1).nullable().optional(),
    fotos: z.array(FotoNaParedeSchema),
    schemaVersion: PositivoInteiroSchema,
  })
  .strict();

// §4.6: conteúdo tem o mesmo formato da variante (sem identificação própria).
export const RascunhoSchema = z
  .object({
    _id: IdSchema,
    varianteId: IdSchema,
    projetoId: IdSchema,
    sessaoId: CaminhoSchema,
    revisaoBase: PositivoInteiroSchema,
    conteudo: z
      .object({
        grid: GridSchema,
        bordaPadrao: BordaSchema,
        areaUtil: AreaUtilSchema.nullable(),
        fotos: z.array(FotoNaParedeSchema),
      })
      .strict(),
    salvoEm: z.date(),
  })
  .strict();

// §4.3: biblioteca global. Só WebP (RN-21: o original não é guardado).
export const ImagemSchema = z
  .object({
    _id: IdSchema,
    nomeOriginal: z.string().min(1),
    perfil: PerfilSchema,
    larguraPx: PositivoInteiroSchema,
    alturaPx: PositivoInteiroSchema,
    orientacaoNatural: z.enum(['retrato', 'paisagem']),
    bytes: z.int().min(0),
    arquivos: z
      .object({
        render: CaminhoSchema,
        thumb: CaminhoSchema,
      })
      .strict(),
    mime: z.literal('image/webp'),
    criadaEm: z.date(),
    projetos: z.array(IdSchema),
    excluidaEm: z.date().nullable(),
    purgaEm: z.date().nullable(),
    schemaVersion: PositivoInteiroSchema,
  })
  .strict();

export type Pt = z.infer<typeof PtSchema>;
export type Tamanho = z.infer<typeof TamanhoSchema>;
export type Grid = z.infer<typeof GridSchema>;
export type Borda = z.infer<typeof BordaSchema>;
export type AreaUtil = z.infer<typeof AreaUtilSchema>;
export type FotoNaParede = z.infer<typeof FotoNaParedeSchema>;
export type Escala = z.infer<typeof EscalaSchema>;
export type Parede = z.infer<typeof ParedeSchema>;
export type Projeto = z.infer<typeof ProjetoSchema>;
export type Variante = z.infer<typeof VarianteSchema>;
export type Rascunho = z.infer<typeof RascunhoSchema>;
export type Imagem = z.infer<typeof ImagemSchema>;
