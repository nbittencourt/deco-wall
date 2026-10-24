import { describe, expect, it } from 'vitest';
import {
  AreaUtilSchema,
  BordaSchema,
  EscalaSchema,
  FotoNaParedeSchema,
  GridSchema,
  IdSchema,
  ImagemSchema,
  ParedeSchema,
  ProjetoSchema,
  PtSchema,
  RascunhoSchema,
  TamanhoSchema,
  VarianteSchema,
} from './schemas';
import {
  AGORA,
  areaUtil,
  borda,
  escalaPerspectiva,
  foto,
  grid,
  id,
  imagem,
  parede,
  projeto,
  rascunho,
  tamanho,
  variante,
} from '../../../tests/fixtures/dominio';

const aceita = (schema: { safeParse: (v: unknown) => { success: boolean } }, valor: unknown) =>
  expect(schema.safeParse(valor).success).toBe(true);
const rejeita = (schema: { safeParse: (v: unknown) => { success: boolean } }, valor: unknown) =>
  expect(schema.safeParse(valor).success).toBe(false);

describe('IdSchema (DM-01)', () => {
  it('aceita string hex de 24 caracteres', () => {
    aceita(IdSchema, id(1));
  });

  it('rejeita tamanho errado, caracteres não hex e não-string', () => {
    rejeita(IdSchema, 'a'.repeat(23));
    rejeita(IdSchema, 'a'.repeat(25));
    rejeita(IdSchema, 'g'.repeat(24));
    rejeita(IdSchema, 12345);
  });
});

describe('PtSchema', () => {
  it('aceita ponto com x e y numéricos', () => {
    aceita(PtSchema, { x: 1.5, y: 2 });
  });

  it('rejeita coordenada não numérica', () => {
    rejeita(PtSchema, { x: '1', y: 2 });
  });
});

describe('TamanhoSchema (RN-01, RN-28, RN-05)', () => {
  it('aceita sugerido em retrato (20 × 30) e em paisagem (30 × 20)', () => {
    aceita(TamanhoSchema, tamanho());
    aceita(TamanhoSchema, tamanho({ larguraCm: 30, alturaCm: 20 }));
  });

  it('rejeita sugerido cujas medidas não são o tamanho declarado', () => {
    rejeita(TamanhoSchema, tamanho({ larguraCm: 20, alturaCm: 25 }));
  });

  it('rejeita sugeridoId fora da lista aprovada', () => {
    rejeita(TamanhoSchema, tamanho({ sugeridoId: '99x99' }));
  });

  it('aceita personalizado (sugeridoId null) com 1 casa decimal (21,0 × 29,7)', () => {
    aceita(TamanhoSchema, { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 });
  });

  it('aceita personalizado nos limites de 5 e 150 cm (RN-28)', () => {
    aceita(TamanhoSchema, { sugeridoId: null, larguraCm: 5, alturaCm: 150 });
  });

  it('rejeita personalizado fora de 5–150 cm (RN-28, exemplos de aceite)', () => {
    rejeita(TamanhoSchema, { sugeridoId: null, larguraCm: 4.9, alturaCm: 30 });
    rejeita(TamanhoSchema, { sugeridoId: null, larguraCm: 150.1, alturaCm: 30 });
    rejeita(TamanhoSchema, tamanho({ larguraCm: 200 }));
  });

  it('quadrado (13x13) não aceita lados diferentes', () => {
    aceita(TamanhoSchema, tamanho({ sugeridoId: '13x13', larguraCm: 13, alturaCm: 13 }));
    rejeita(TamanhoSchema, tamanho({ sugeridoId: '13x13', larguraCm: 13, alturaCm: 15 }));
  });

  it('rejeita campos fora do modelo', () => {
    rejeita(TamanhoSchema, { ...tamanho(), cor: '#000000' });
  });
});

describe('GridSchema (RN-15)', () => {
  it('aceita o grid padrão', () => {
    aceita(GridSchema, grid());
  });

  it('rejeita passo zero ou negativo', () => {
    rejeita(GridSchema, grid({ passoCm: 0 }));
    rejeita(GridSchema, grid({ passoCm: -5 }));
  });

  it('rejeita cor que não é hexadecimal e opacidade fora de 0–1', () => {
    rejeita(GridSchema, grid({ cor: 'cinza' }));
    rejeita(GridSchema, grid({ opacidade: 1.5 }));
  });
});

describe('BordaSchema (RN-02, RN-03)', () => {
  it('aceita borda 0 cm (sem borda)', () => {
    aceita(BordaSchema, borda());
  });

  it('rejeita largura negativa e cor fora de hexadecimal', () => {
    rejeita(BordaSchema, borda({ larguraCm: -1 }));
    rejeita(BordaSchema, borda({ cor: 'red' }));
  });
});

describe('AreaUtilSchema (RN-33)', () => {
  it('aceita área com largura e altura positivas', () => {
    aceita(AreaUtilSchema, areaUtil());
  });

  it('rejeita área sem largura', () => {
    rejeita(AreaUtilSchema, areaUtil({ larguraCm: 0 }));
  });
});

describe('FotoNaParedeSchema (DM-04, DM-16, TPL-05)', () => {
  it('aceita foto com imagem', () => {
    aceita(FotoNaParedeSchema, foto());
  });

  it('aceita placeholder com recomendação (imagem excluída anterior)', () => {
    aceita(FotoNaParedeSchema, foto({ imagemId: null, imagemAnteriorId: id(9) }));
  });

  it('aceita vaga de template (sem imagem e sem recomendação)', () => {
    aceita(FotoNaParedeSchema, foto({ imagemId: null, imagemAnteriorId: null }));
  });

  it('aceita recorte nos limites −1 e 1', () => {
    aceita(FotoNaParedeSchema, foto({ recorte: { offsetX: -1, offsetY: 1 } }));
  });

  it('rejeita recorte fora de −1..1', () => {
    rejeita(FotoNaParedeSchema, foto({ recorte: { offsetX: 1.5, offsetY: 0 } }));
    rejeita(FotoNaParedeSchema, foto({ recorte: { offsetX: 0, offsetY: -1.01 } }));
  });

  it('rejeita imagemId que não é id válido', () => {
    rejeita(FotoNaParedeSchema, foto({ imagemId: 'xyz' }));
  });

  it('rejeita campo extra', () => {
    rejeita(FotoNaParedeSchema, { ...foto(), rotacao: 90 });
  });
});

describe('EscalaSchema (RN-08, ADR-04)', () => {
  it('aceita escala ainda não definida (metodo null)', () => {
    aceita(EscalaSchema, { metodo: null });
  });

  it('aceita perspectiva com cantos, dimensões e homografia', () => {
    aceita(EscalaSchema, escalaPerspectiva());
  });

  it('aceita calibração linear com homografia', () => {
    aceita(EscalaSchema, {
      metodo: 'linear',
      linear: { p1: { x: 0, y: 0 }, p2: { x: 300, y: 0 }, comprimentoCm: 100 },
      homografia: [0.1, 0, 0, 0, 0.1, 0, 0, 0, 1],
    });
  });

  it('rejeita perspectiva sem os dados de perspectiva', () => {
    rejeita(EscalaSchema, { metodo: 'perspectiva', homografia: Array(9).fill(0) });
  });

  it('rejeita linear sem os dados lineares', () => {
    rejeita(EscalaSchema, { metodo: 'linear', homografia: Array(9).fill(0) });
  });

  it('rejeita homografia que não tem 9 elementos', () => {
    rejeita(EscalaSchema, { ...escalaPerspectiva(), homografia: [1, 0, 0, 0, 1, 0, 0, 0] });
  });

  it('rejeita perspectiva com menos de 4 cantos', () => {
    const e = escalaPerspectiva();
    e.perspectiva.cantosPx = e.perspectiva.cantosPx.slice(0, 3);
    rejeita(EscalaSchema, e);
  });
});

describe('ParedeSchema (RF-05, ADR-04)', () => {
  it('aceita parede calibrada por perspectiva com retificada', () => {
    aceita(ParedeSchema, parede());
  });

  it('exige a imagem retificada quando a escala é por perspectiva', () => {
    rejeita(ParedeSchema, parede({ retificada: undefined }));
  });

  it('rejeita perfil fora de leve/medio/alto', () => {
    rejeita(ParedeSchema, parede({ perfil: 'ultra' }));
  });

  it('rejeita dimensão em px zero ou negativa', () => {
    rejeita(ParedeSchema, parede({ larguraPx: 0 }));
  });
});

describe('ProjetoSchema (RN-17, RN-23)', () => {
  it('aceita projeto com parede ainda não enviada (null)', () => {
    aceita(ProjetoSchema, projeto({ parede: null }));
  });

  it('aceita nome de 1 a 100 caracteres', () => {
    aceita(ProjetoSchema, projeto({ nome: 'x' }));
    aceita(ProjetoSchema, projeto({ nome: 'x'.repeat(100) }));
  });

  it('rejeita nome vazio ou com 101 caracteres', () => {
    rejeita(ProjetoSchema, projeto({ nome: '' }));
    rejeita(ProjetoSchema, projeto({ nome: 'x'.repeat(101) }));
  });

  it('rejeita revisão não inteira', () => {
    rejeita(ProjetoSchema, projeto({ revisao: 1.5 }));
  });
});

describe('VarianteSchema (ADR-12, RN-23, RN-35, DM-03)', () => {
  it('aceita variante com fotos e área útil', () => {
    aceita(VarianteSchema, variante());
  });

  it('aceita variante vazia, como a "Base" recém-criada (RN-23)', () => {
    aceita(VarianteSchema, variante({ fotos: [] }));
  });

  it('aceita área útil ainda não definida (null)', () => {
    aceita(VarianteSchema, variante({ areaUtil: null }));
  });

  it('aceita templateOrigem informado, nulo ou ausente', () => {
    aceita(VarianteSchema, variante({ templateOrigem: 'piramide' }));
    aceita(VarianteSchema, variante({ templateOrigem: null }));
    const semCampo = variante();
    delete (semCampo as Record<string, unknown>).templateOrigem;
    aceita(VarianteSchema, semCampo);
  });

  it('rejeita nome vazio ou com 61 caracteres (1–60)', () => {
    rejeita(VarianteSchema, variante({ nome: '' }));
    rejeita(VarianteSchema, variante({ nome: 'x'.repeat(61) }));
  });

  it('rejeita grid inválido aninhado', () => {
    rejeita(VarianteSchema, variante({ grid: grid({ passoCm: 0 }) }));
  });

  it('rejeita foto inválida aninhada (tamanho de 200 cm)', () => {
    rejeita(VarianteSchema, variante({ fotos: [foto({ tamanho: tamanho({ larguraCm: 200 }) })] }));
  });

  it('rejeita data no formato texto', () => {
    rejeita(VarianteSchema, variante({ salvaEm: AGORA.toISOString() }));
  });
});

describe('RascunhoSchema (SV-01, §4.6)', () => {
  it('aceita rascunho com conteúdo no formato da variante', () => {
    aceita(RascunhoSchema, rascunho());
  });

  it('exige a revisão base sobre a qual foi feito', () => {
    const semBase = rascunho();
    delete (semBase as Record<string, unknown>).revisaoBase;
    rejeita(RascunhoSchema, semBase);
  });
});

describe('ImagemSchema (RF-25, RN-21, RN-24, DM-14)', () => {
  it('aceita imagem ativa', () => {
    aceita(ImagemSchema, imagem());
  });

  it('aceita imagem excluída com datas de exclusão e purga', () => {
    aceita(ImagemSchema, imagem({ excluidaEm: AGORA, purgaEm: AGORA }));
  });

  it('rejeita perfil desconhecido', () => {
    rejeita(ImagemSchema, imagem({ perfil: 'ultra' }));
  });

  it('rejeita orientação fora de retrato/paisagem', () => {
    rejeita(ImagemSchema, imagem({ orientacaoNatural: 'quadrada' }));
  });

  it('rejeita mime diferente de WebP (o original nunca é guardado)', () => {
    rejeita(ImagemSchema, imagem({ mime: 'image/jpeg' }));
  });

  it('rejeita largura em px zero e data em formato texto', () => {
    rejeita(ImagemSchema, imagem({ larguraPx: 0 }));
    rejeita(ImagemSchema, imagem({ excluidaEm: '2026-10-12' }));
  });
});
