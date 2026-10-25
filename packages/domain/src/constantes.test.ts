import { describe, expect, it } from 'vitest';
import {
  BORDA_PADRAO,
  AREA_UTIL_MIN_CM,
  CORES_GRID,
  GRID_PADRAO,
  GRID_PASSO_MIN_PX,
  LIMITE_NOME_PROJETO,
  LIMITE_PASSO_GRID_CM,
  LIMITE_PERSONALIZADO_CM,
  LIMITES_REFERENCIA_CM,
  MARGEM_RETIFICACAO,
  NOME_PROJETO_PADRAO,
  NOME_VARIANTE_PADRAO,
  PASSOS_GRID_CM,
  PERFIL_PADRAO,
  PERFIS,
  PRAZO_PURGA_DIAS,
  PREVIA_LARGURA_PX,
  SEGMENTO_MIN_PX,
  TAMANHO_PADRAO_ID,
  TAMANHOS_SUGERIDOS,
  THUMB_PAREDE_PX,
  ZOOM,
} from './constantes';
import { GridSchema } from './schemas';

describe('tamanhos sugeridos (RN-01, FMT-01)', () => {
  it('lista os 17 tamanhos aprovados, na ordem do grupo', () => {
    expect(TAMANHOS_SUGERIDOS.map((t) => t.id)).toEqual([
      '10x15',
      '13x18',
      '15x21',
      '20x25',
      '20x30',
      '13x13',
      '15x15',
      '30x40',
      '30x45',
      '40x50',
      '40x60',
      '50x60',
      '50x70',
      '60x80',
      '60x90',
      '70x100',
      '75x120',
    ]);
  });

  it('id é "menor x maior" e os lados batem com o id', () => {
    for (const t of TAMANHOS_SUGERIDOS) {
      expect(t.id).toBe(`${t.menorCm}x${t.maiorCm}`);
      expect(t.menorCm).toBeLessThanOrEqual(t.maiorCm);
    }
  });

  it('separa em grupos padrão (5), quadrado (2) e grande (10)', () => {
    const grupo = (g: string) => TAMANHOS_SUGERIDOS.filter((t) => t.grupo === g).map((t) => t.id);
    expect(grupo('padrao')).toEqual(['10x15', '13x18', '15x21', '20x25', '20x30']);
    expect(grupo('quadrado')).toEqual(['13x13', '15x15']);
    expect(grupo('grande')).toHaveLength(10);
  });

  it('quadrados têm lados iguais e os demais têm lados diferentes', () => {
    for (const t of TAMANHOS_SUGERIDOS) {
      if (t.grupo === 'quadrado') expect(t.menorCm).toBe(t.maiorCm);
      else expect(t.menorCm).toBeLessThan(t.maiorCm);
    }
  });

  it('nenhum sugerido ultrapassa o limite do personalizado (RN-28)', () => {
    for (const t of TAMANHOS_SUGERIDOS) {
      expect(t.maiorCm).toBeLessThanOrEqual(LIMITE_PERSONALIZADO_CM.max);
    }
  });

  it('tamanho padrão ao adicionar foto é 10x15 (RN-04)', () => {
    expect(TAMANHO_PADRAO_ID).toBe('10x15');
    expect(TAMANHOS_SUGERIDOS.some((t) => t.id === TAMANHO_PADRAO_ID)).toBe(true);
  });
});

describe('tamanho personalizado (RN-28)', () => {
  it('5 a 150 cm por lado, passo 0,1 cm', () => {
    expect(LIMITE_PERSONALIZADO_CM).toEqual({ min: 5, max: 150, passo: 0.1 });
  });
});

describe('grid e borda (RN-03, RN-15)', () => {
  it('grid nasce visível, com snap ligado e passo de 5 cm', () => {
    expect(GRID_PADRAO).toMatchObject({ visivel: true, snap: true, passoCm: 5 });
  });

  it('passos do grid são 1, 2, 5 e 10 cm', () => {
    expect(PASSOS_GRID_CM).toEqual([1, 2, 5, 10]);
  });

  it('borda padrão é 0 cm, cor branca', () => {
    expect(BORDA_PADRAO).toEqual({ larguraCm: 0, cor: '#FFFFFF' });
  });
});

describe('perfis de qualidade (ADR-05)', () => {
  it('Leve, Médio e Alto com lados e qualidade WebP da ADR-05', () => {
    expect(Object.keys(PERFIS)).toEqual(['leve', 'medio', 'alto']);
    expect(PERFIS.leve).toEqual({ ladoFotoPx: 1024, ladoParedePx: 3072, qualidadeWebp: 0.8 });
    expect(PERFIS.medio).toEqual({ ladoFotoPx: 2048, ladoParedePx: 4096, qualidadeWebp: 0.85 });
    expect(PERFIS.alto).toEqual({ ladoFotoPx: 3072, ladoParedePx: 6144, qualidadeWebp: 0.9 });
  });

  it('padrão do upload é Leve (RF-25)', () => {
    expect(PERFIL_PADRAO).toBe('leve');
  });
});

describe('outras constantes', () => {
  it('nome da variante inicial é "Base" (RN-23)', () => {
    expect(NOME_VARIANTE_PADRAO).toBe('Base');
  });

  it('prazo de purga é 30 dias (RN-24)', () => {
    expect(PRAZO_PURGA_DIAS).toBe(30);
  });
});

// Spec M1 §4.1 e premissas A-02, A-06 a A-09, A-12.
describe('constantes do M1', () => {
  it('GRID_PADRAO é um grid completo e válido (A-08, DESIGN §2.2)', () => {
    expect(GRID_PADRAO).toEqual({
      visivel: true,
      snap: true,
      passoCm: 5,
      principalACada: 5,
      cor: '#1F1B16',
      opacidade: 0.08,
    });
    expect(GridSchema.safeParse(GRID_PADRAO).success).toBe(true);
  });

  it('cores prontas do grid: Tinta, Branco e Cinza (A-08)', () => {
    expect(CORES_GRID).toEqual([
      { nome: 'Tinta', hex: '#1F1B16' },
      { nome: 'Branco', hex: '#FFFFFF' },
      { nome: 'Cinza', hex: '#8C8C8C' },
    ]);
  });

  it('passo "Outro" vai de 0,5 a 100 cm, de 0,1 em 0,1 (A-08)', () => {
    expect(LIMITE_PASSO_GRID_CM).toEqual({ min: 0.5, max: 100, passo: 0.1 });
  });

  it('grid some abaixo de 4 px na tela (A-07)', () => {
    expect(GRID_PASSO_MIN_PX).toBe(4);
  });

  it('margem de retificação é 100% por lado (M1-03)', () => {
    expect(MARGEM_RETIFICACAO).toBe(1);
  });

  it('medidas de referência: 10 a 2000 cm (A-09)', () => {
    expect(LIMITES_REFERENCIA_CM).toEqual({ min: 10, max: 2000 });
  });

  it('área útil mínima: 5 cm por lado (RN-33)', () => {
    expect(AREA_UTIL_MIN_CM).toBe(5);
  });

  it('miniatura da parede 400 px e prévia da perspectiva 320 px', () => {
    expect(THUMB_PAREDE_PX).toBe(400);
    expect(PREVIA_LARGURA_PX).toBe(320);
  });

  it('segmento da calibração linear: mínimo de 20 px da imagem (A-12)', () => {
    expect(SEGMENTO_MIN_PX).toBe(20);
  });

  it('zoom de 10% a 800%, fator 1,1 por passo da roda (A-06)', () => {
    expect(ZOOM).toEqual({ min: 0.1, max: 8, passo: 1.1 });
  });

  it('projeto novo se chama "Projeto sem nome", com nome de até 100 caracteres (A-02)', () => {
    expect(NOME_PROJETO_PADRAO).toBe('Projeto sem nome');
    expect(LIMITE_NOME_PROJETO).toBe(100);
  });
});
