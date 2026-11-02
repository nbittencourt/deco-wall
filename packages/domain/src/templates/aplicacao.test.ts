import { describe, expect, it } from 'vitest';
import { id } from '../../../../tests/fixtures/dominio';
import { lerModelosDoMarkdown } from '../../../../tests/fixtures/templates-md';
import { retanguloExterno } from '../composicao/foto';
import { TOLERANCIA_CM } from '../constantes';
import {
  aplicarTemplate,
  centralizarNaAreaUtil,
  encaixarConjunto,
  limitarConjunto,
  maiorQueAreaUtil,
  tamanhoParaCelula,
} from './aplicacao';
import { TEMPLATES, type Template } from './catalogo';

// Aplicação de template (RN-29 a RN-32, M3-06; docs/specs/M3-variantes-templates-e-salvamento.md §4.2 a §4.4).

const MODELOS = lerModelosDoMarkdown();
const BORDA_0 = { larguraCm: 0, cor: '#FFFFFF' };
const BORDA_2 = { larguraCm: 2, cor: '#F5F1E8' };
const sequencia = () => {
  let n = 0;
  return () => id((n += 1));
};

describe('tamanhoParaCelula (RN-29, §4.2)', () => {
  const linhas = MODELOS.flatMap((m) => m.linhas.map((l) => ({ modelo: m.id, ...l })));

  it('o documento tem as 82 linhas "Foto (borda 0)"', () => {
    expect(linhas).toHaveLength(82);
  });

  it.each(linhas)(
    '$modelo #$numero: célula $celula.larguraCm × $celula.alturaCm → $foto.larguraCm × $foto.alturaCm',
    (linha) => {
      const { tamanho, cresceu } = tamanhoParaCelula(linha.celula, 0);
      expect(cresceu).toBe(false);
      expect(tamanho.larguraCm).toBe(linha.foto.larguraCm);
      expect(tamanho.alturaCm).toBe(linha.foto.alturaCm);
      const menor = Math.min(linha.foto.larguraCm, linha.foto.alturaCm);
      const maior = Math.max(linha.foto.larguraCm, linha.foto.alturaCm);
      expect(tamanho.sugeridoId).toBe(`${menor}x${maior}`);
    },
  );

  it('exemplos da spec (borda 0)', () => {
    expect(tamanhoParaCelula({ larguraCm: 27.9, alturaCm: 35.6 }, 0).tamanho).toMatchObject({
      larguraCm: 20,
      alturaCm: 30,
    });
    expect(tamanhoParaCelula({ larguraCm: 15.2, alturaCm: 20.3 }, 0).tamanho).toMatchObject({
      larguraCm: 13,
      alturaCm: 18,
    });
    expect(tamanhoParaCelula({ larguraCm: 40.6, alturaCm: 50.8 }, 0).tamanho).toMatchObject({
      larguraCm: 40,
      alturaCm: 50,
    });
    expect(tamanhoParaCelula({ larguraCm: 50.8, alturaCm: 25.4 }, 0).tamanho).toMatchObject({
      larguraCm: 30,
      alturaCm: 20,
    });
  });

  it('célula quadrada usa a orientação retrato: 20,3 × 20,3 → 13 × 18', () => {
    expect(tamanhoParaCelula({ larguraCm: 20.3, alturaCm: 20.3 }, 0).tamanho).toEqual({
      sugeridoId: '13x18',
      larguraCm: 13,
      alturaCm: 18,
    });
  });

  it('com borda de 2 cm o tamanho externo (impresso + 2 × borda) tem de caber: 20,3 × 25,4 → 15 × 21', () => {
    const { tamanho, cresceu } = tamanhoParaCelula({ larguraCm: 20.3, alturaCm: 25.4 }, 2);
    expect(cresceu).toBe(false);
    expect(tamanho).toEqual({ sugeridoId: '15x21', larguraCm: 15, alturaCm: 21 });
  });

  it('folga de 0,05 cm: 19,96 × 29,96 ainda recebe 20 × 30; 19,9 × 29,9 não', () => {
    expect(tamanhoParaCelula({ larguraCm: 19.96, alturaCm: 29.96 }, 0).tamanho).toMatchObject({
      larguraCm: 20,
      alturaCm: 30,
    });
    expect(tamanhoParaCelula({ larguraCm: 19.9, alturaCm: 29.9 }, 0).tamanho).not.toMatchObject({
      larguraCm: 20,
      alturaCm: 30,
    });
  });

  it('nenhum cabe: 10 × 15 na orientação da célula e cresceu', () => {
    // 20,3 × 20,3 com borda de 4 cm: nem 13 × 13 (21 cm) nem 10 × 15 (18 × 23) cabem.
    expect(tamanhoParaCelula({ larguraCm: 20.3, alturaCm: 20.3 }, 4)).toEqual({
      tamanho: { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      cresceu: true,
    });
    expect(tamanhoParaCelula({ larguraCm: 30, alturaCm: 20 }, 9)).toEqual({
      tamanho: { sugeridoId: '10x15', larguraCm: 15, alturaCm: 10 },
      cresceu: true,
    });
  });
});

describe('aplicarTemplate (RN-29 a RN-31, §4.3)', () => {
  it.each(MODELOS)('$id: vagas do documento, centralizadas na célula, sem borda', (modelo) => {
    const template = TEMPLATES.find((t) => t.id === modelo.id)!;
    const { fotos, conjunto, vagasMaiores } = aplicarTemplate({
      template,
      posicaoCm: { xCm: 0, yCm: 0 },
      borda: BORDA_0,
      novoId: sequencia(),
    });
    expect(fotos).toHaveLength(modelo.vagas);
    expect(vagasMaiores).toBe(0);
    expect(Math.abs(conjunto.larguraCm - modelo.totalCm.larguraCm)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(conjunto.alturaCm - modelo.totalCm.alturaCm)).toBeLessThanOrEqual(0.1);
    modelo.linhas.forEach((linha, i) => {
      const f = fotos[i]!;
      expect(f.tamanho.larguraCm).toBe(linha.foto.larguraCm);
      expect(f.tamanho.alturaCm).toBe(linha.foto.alturaCm);
      // Centro da vaga = centro da célula (arredondamento de 0,1 cm).
      const centroX = f.xCm + f.tamanho.larguraCm / 2;
      const centroY = f.yCm + f.tamanho.alturaCm / 2;
      expect(Math.abs(centroX - (linha.xCm + linha.celula.larguraCm / 2))).toBeLessThanOrEqual(0.1);
      expect(Math.abs(centroY - (linha.yCm + linha.celula.alturaCm / 2))).toBeLessThanOrEqual(0.1);
    });
  });

  it.each(MODELOS)('$id: as vagas são placeholders novos, sem sobreposição com borda 0', (modelo) => {
    const template = TEMPLATES.find((t) => t.id === modelo.id)!;
    const { fotos } = aplicarTemplate({
      template,
      posicaoCm: { xCm: 0, yCm: 0 },
      borda: BORDA_0,
      novoId: sequencia(),
    });
    expect(new Set(fotos.map((f) => f._id)).size).toBe(fotos.length);
    for (const f of fotos) {
      expect(f.imagemId).toBeNull();
      expect(f.imagemAnteriorId).toBeNull();
      expect(f.recorte).toEqual({ offsetX: 0, offsetY: 0 });
      expect(f.borda).toEqual(BORDA_0);
    }
    const r = fotos.map(retanguloExterno);
    for (let i = 0; i < r.length; i += 1) {
      for (let j = i + 1; j < r.length; j += 1) {
        const a = r[i]!;
        const b = r[j]!;
        const sobrepoe =
          a.xCm < b.xCm + b.larguraCm - TOLERANCIA_CM &&
          b.xCm < a.xCm + a.larguraCm - TOLERANCIA_CM &&
          a.yCm < b.yCm + b.alturaCm - TOLERANCIA_CM &&
          b.yCm < a.yCm + a.alturaCm - TOLERANCIA_CM;
        expect(sobrepoe, `${modelo.id}: vagas ${i + 1} e ${j + 1}`).toBe(false);
      }
    }
  });

  it('a posição é o canto superior esquerdo do conjunto', () => {
    const template = TEMPLATES.find((t) => t.id === 'piramide')!;
    const base = aplicarTemplate({
      template,
      posicaoCm: { xCm: 0, yCm: 0 },
      borda: BORDA_0,
      novoId: sequencia(),
    });
    const movido = aplicarTemplate({
      template,
      posicaoCm: { xCm: 12.5, yCm: 40 },
      borda: BORDA_0,
      novoId: sequencia(),
    });
    expect(movido.conjunto).toEqual({ ...base.conjunto, xCm: 12.5, yCm: 40 });
    movido.fotos.forEach((f, i) => {
      expect(f.xCm).toBeCloseTo(base.fotos[i]!.xCm + 12.5, 5);
      expect(f.yCm).toBeCloseTo(base.fotos[i]!.yCm + 40, 5);
    });
  });

  it('todas as vagas recebem a borda única escolhida e cabem na célula (borda 2 cm)', () => {
    const template = TEMPLATES.find((t) => t.id === 'escada')!;
    const { fotos, vagasMaiores } = aplicarTemplate({
      template,
      posicaoCm: { xCm: 0, yCm: 0 },
      borda: BORDA_2,
      novoId: sequencia(),
    });
    expect(vagasMaiores).toBe(0);
    fotos.forEach((f, i) => {
      const celula = template.celulas[i]!;
      const externo = retanguloExterno(f);
      expect(f.borda).toEqual(BORDA_2);
      expect(externo.larguraCm).toBeLessThanOrEqual(celula.larguraCm + TOLERANCIA_CM);
      expect(externo.alturaCm).toBeLessThanOrEqual(celula.alturaCm + TOLERANCIA_CM);
    });
    // Escada #2 (20,3 × 25,4) com borda 2 cm: 15 × 21 (externo 19 × 25).
    expect(fotos[1]!.tamanho).toMatchObject({ larguraCm: 15, alturaCm: 21 });
  });

  it('as posições têm precisão de 0,1 cm (RN-27)', () => {
    const template = TEMPLATES.find((t) => t.id === 'espiral')!;
    const { fotos } = aplicarTemplate({
      template,
      posicaoCm: { xCm: 13.37, yCm: 4.21 },
      borda: BORDA_2,
      novoId: sequencia(),
    });
    for (const f of fotos) {
      expect(Math.abs(f.xCm * 10 - Math.round(f.xCm * 10))).toBeLessThan(1e-6);
      expect(Math.abs(f.yCm * 10 - Math.round(f.yCm * 10))).toBeLessThan(1e-6);
    }
  });

  it('o conjunto contém todas as vagas', () => {
    for (const template of TEMPLATES) {
      const { fotos, conjunto } = aplicarTemplate({
        template,
        posicaoCm: { xCm: 20, yCm: 30 },
        borda: BORDA_2,
        novoId: sequencia(),
      });
      for (const f of fotos) {
        const e = retanguloExterno(f);
        expect(e.xCm).toBeGreaterThanOrEqual(conjunto.xCm - TOLERANCIA_CM);
        expect(e.yCm).toBeGreaterThanOrEqual(conjunto.yCm - TOLERANCIA_CM);
        expect(e.xCm + e.larguraCm).toBeLessThanOrEqual(conjunto.xCm + conjunto.larguraCm + TOLERANCIA_CM);
        expect(e.yCm + e.alturaCm).toBeLessThanOrEqual(conjunto.yCm + conjunto.alturaCm + TOLERANCIA_CM);
      }
    }
  });
});

describe('afastamento das vizinhas (M3-06, A-31, §4.3 passo 3)', () => {
  // Duas células de 12 × 17 separadas por 1 cm de vão: com borda de 2 cm o 10 × 15 externo (14 × 19) não cabe
  // e as duas vagas crescidas se sobrepõem em 1 cm.
  const apertado: Template = {
    id: 'sintetico',
    nome: 'Sintético',
    celulas: [
      { xCm: 0, yCm: 0, larguraCm: 12, alturaCm: 17 },
      { xCm: 13, yCm: 0, larguraCm: 12, alturaCm: 17 },
    ],
  };

  const aplicar = (template: Template, borda = BORDA_2) =>
    aplicarTemplate({ template, posicaoCm: { xCm: 0, yCm: 0 }, borda, novoId: sequencia() });

  it('vaga que não cabe cresce em torno do centro, conta em vagasMaiores e empurra a vizinha', () => {
    const { fotos, vagasMaiores } = aplicar(apertado);
    expect(vagasMaiores).toBe(2);
    expect(fotos.map((f) => f.tamanho)).toEqual([
      { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
      { sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 },
    ]);
    const a = retanguloExterno(fotos[0]!);
    const b = retanguloExterno(fotos[1]!);
    // Sem sobreposição depois do afastamento.
    expect(a.xCm + a.larguraCm).toBeLessThanOrEqual(b.xCm + TOLERANCIA_CM);
    // O conjunto cresce 1 cm para cima e para a esquerda (as vagas crescidas passam das células) e a posição é o
    // canto do conjunto: a primeira vaga mantém o centro da célula (6; 8,5), deslocado por esse 1 cm → (7; 9,5).
    expect(a.xCm + a.larguraCm / 2).toBeCloseTo(7, 1);
    expect(a.yCm + a.alturaCm / 2).toBeCloseTo(9.5, 1);
    // A segunda é a empurrada, no eixo de menor penetração (X): mesma altura, mais à direita.
    expect(b.yCm + b.alturaCm / 2).toBeCloseTo(9.5, 1);
    expect(b.xCm + b.larguraCm / 2).toBeGreaterThanOrEqual(7 + 14 - TOLERANCIA_CM);
  });

  it('o conjunto passa a incluir a vaga empurrada', () => {
    const { fotos, conjunto } = aplicar(apertado);
    const b = retanguloExterno(fotos[1]!);
    expect(conjunto.xCm + conjunto.larguraCm).toBeGreaterThanOrEqual(b.xCm + b.larguraCm - TOLERANCIA_CM);
  });

  it('sem vaga crescida, nada se move: as posições são as centralizadas', () => {
    const { fotos, vagasMaiores } = aplicar(apertado, BORDA_0);
    expect(vagasMaiores).toBe(0);
    // 12 × 17 comporta o 10 × 15 (o maior que cabe), centralizado: x = 1, y = 1.
    expect(fotos[0]).toMatchObject({ xCm: 1, yCm: 1 });
    expect(fotos[1]).toMatchObject({ xCm: 14, yCm: 1 });
  });

  it('vagas empurradas podem empurrar outras (cascata) e o resultado termina', () => {
    const fila: Template = {
      id: 'fila',
      nome: 'Fila',
      celulas: [0, 1, 2, 3].map((i) => ({ xCm: i * 13, yCm: 0, larguraCm: 12, alturaCm: 17 })),
    };
    const { fotos, vagasMaiores } = aplicar(fila);
    expect(vagasMaiores).toBe(4);
    const r = fotos.map(retanguloExterno);
    for (let i = 1; i < r.length; i += 1) {
      expect(r[i - 1]!.xCm + r[i - 1]!.larguraCm).toBeLessThanOrEqual(r[i]!.xCm + TOLERANCIA_CM);
    }
  });

  it('termina com a borda máxima em todos os modelos, rápido (< 200 ms cada)', () => {
    for (const template of TEMPLATES) {
      const inicio = performance.now();
      const { fotos } = aplicar(template, { larguraCm: 20, cor: '#FFFFFF' });
      expect(fotos).toHaveLength(template.celulas.length);
      expect(performance.now() - inicio).toBeLessThan(200);
    }
  });
});

describe('maiorQueAreaUtil (§4.3 passo 8)', () => {
  const area = { xCm: 0, yCm: 0, larguraCm: 140, alturaCm: 90 };

  it('maior em qualquer eixo', () => {
    expect(maiorQueAreaUtil({ larguraCm: 151, alturaCm: 70.6 }, area)).toBe(true);
    expect(maiorQueAreaUtil({ larguraCm: 100, alturaCm: 95 }, area)).toBe(true);
  });

  it('cabe ou empata (tolerância de 0,05 cm): não é maior', () => {
    expect(maiorQueAreaUtil({ larguraCm: 140, alturaCm: 90 }, area)).toBe(false);
    expect(maiorQueAreaUtil({ larguraCm: 140.04, alturaCm: 90 }, area)).toBe(false);
    expect(maiorQueAreaUtil({ larguraCm: 140.1, alturaCm: 90 }, area)).toBe(true);
    expect(maiorQueAreaUtil({ larguraCm: 100, alturaCm: 60 }, area)).toBe(false);
  });
});

describe('centralizarNaAreaUtil (RN-32, §4.4)', () => {
  const area = { xCm: 10, yCm: 20, larguraCm: 200, alturaCm: 100 };

  it('centraliza o conjunto na área útil, a 0,1 cm', () => {
    expect(centralizarNaAreaUtil({ larguraCm: 151, alturaCm: 70.6 }, area)).toEqual({
      xCm: 34.5,
      yCm: 34.7,
    });
  });

  it('conjunto maior estoura igualmente dos dois lados', () => {
    expect(centralizarNaAreaUtil({ larguraCm: 250, alturaCm: 120 }, area)).toEqual({ xCm: -15, yCm: 10 });
  });
});

describe('encaixarConjunto (M3-06, A-21)', () => {
  it('com snap, encaixa o canto superior esquerdo no grid', () => {
    expect(encaixarConjunto({ xCm: 12.3, yCm: 7.4 }, { snap: true, passoCm: 5 })).toEqual({
      xCm: 10,
      yCm: 5,
    });
  });

  it('sem snap, só arredonda a 0,1 cm', () => {
    expect(encaixarConjunto({ xCm: 12.34, yCm: 7.46 }, { snap: false, passoCm: 5 })).toEqual({
      xCm: 12.3,
      yCm: 7.5,
    });
  });
});

describe('limitarConjunto (M3-06, M2-11)', () => {
  const parede = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
  const conjunto = { larguraCm: 100, alturaCm: 50 };

  it('dentro da parede, não muda', () => {
    expect(limitarConjunto({ xCm: 40, yCm: 30 }, conjunto, parede)).toEqual({ xCm: 40, yCm: 30 });
  });

  it('mantém 1 cm da caixa do conjunto dentro da parede inteira, por eixo', () => {
    expect(limitarConjunto({ xCm: -900, yCm: -900 }, conjunto, parede)).toEqual({ xCm: -99, yCm: -49 });
    expect(limitarConjunto({ xCm: 900, yCm: 900 }, conjunto, parede)).toEqual({ xCm: 299, yCm: 199 });
  });
});
