import { describe, expect, it } from 'vitest';
import {
  BORDA_PADRAO,
  GRID_PADRAO,
  LIMITE_PERSONALIZADO_CM,
  NOME_VARIANTE_PADRAO,
  PASSOS_GRID_CM,
  PERFIL_PADRAO,
  PERFIS,
  PRAZO_PURGA_DIAS,
  TAMANHO_PADRAO_ID,
  TAMANHOS_SUGERIDOS,
} from './constantes';

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
