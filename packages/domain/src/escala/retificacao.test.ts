import { describe, expect, it } from 'vitest';
import { PERSPECTIVA } from '../../../../tests/fixtures/paredes';
import { parede } from '../../../../tests/fixtures/dominio';
import { MARGEM_RETIFICACAO, PERFIS, PREVIA_LARGURA_PX } from '../constantes';
import { aplicarHomografia, calcularHomografia } from '../geometria/homografia';
import { ParedeSchema } from '../schemas';
import { paredeInteira } from './parede-inteira';
import { calcularPrevia, calcularRetificacao, homografiaBitmapParaImagem } from './retificacao';

// Retificação (ADR-04, M1-03; docs/specs/M1-parede-e-escala.md §4.2).

const RETANGULO = [
  { x: 0, y: 0 },
  { x: PERSPECTIVA.larguraCm, y: 0 },
  { x: PERSPECTIVA.larguraCm, y: PERSPECTIVA.alturaCm },
  { x: 0, y: PERSPECTIVA.alturaCm },
];

function entrada(sobrescrita: Record<string, unknown> = {}) {
  return {
    cantosPx: PERSPECTIVA.cantosPx,
    larguraCm: PERSPECTIVA.larguraCm,
    alturaCm: PERSPECTIVA.alturaCm,
    larguraImagemPx: PERSPECTIVA.larguraImagemPx,
    alturaImagemPx: PERSPECTIVA.alturaImagemPx,
    ladoMaxPx: PERFIS.leve.ladoParedePx,
    ...sobrescrita,
  };
}

// Caixa vizinha do retângulo de referência: +100% de L e de A em cada lado (M1-03).
const CAIXA = {
  minX: -PERSPECTIVA.larguraCm * MARGEM_RETIFICACAO,
  maxX: PERSPECTIVA.larguraCm * (1 + MARGEM_RETIFICACAO),
  minY: -PERSPECTIVA.alturaCm * MARGEM_RETIFICACAO,
  maxY: PERSPECTIVA.alturaCm * (1 + MARGEM_RETIFICACAO),
};

function areaPoligono(pts: { x: number; y: number }[]): number {
  let soma = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    soma += p.x * q.y - q.x * p.y;
  });
  return Math.abs(soma) / 2;
}

describe('calcularRetificacao — homografia (PRD aceite 6)', () => {
  it('leva os cantos da fixture a (0,0) (300,0) (300,200) (0,200) com erro < 0,01 cm', () => {
    const { homografia } = calcularRetificacao(entrada());
    PERSPECTIVA.cantosPx.forEach((p, i) => {
      const r = aplicarHomografia(homografia, p);
      expect(Math.abs(r.x - RETANGULO[i]!.x)).toBeLessThan(0.01);
      expect(Math.abs(r.y - RETANGULO[i]!.y)).toBeLessThan(0.01);
    });
  });

  it('é a mesma homografia de calcularHomografia(cantos → retângulo)', () => {
    const esperada = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO);
    const { homografia } = calcularRetificacao(entrada());
    const ponto = { x: 900, y: 500 };
    const a = aplicarHomografia(homografia, ponto);
    const b = aplicarHomografia(esperada, ponto);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('calcularRetificacao — parede inteira (M1-03)', () => {
  it('é o retângulo envolvente da foto inteira projetada, arredondado a 0,1 cm', () => {
    const { paredeInteiraCm, origemCm } = calcularRetificacao(entrada({ ladoMaxPx: 100_000 }));

    // Verificação independente: projeta os 4 cantos da foto (todos com w > 0 nesta fixture).
    const h = calcularHomografia(PERSPECTIVA.cantosPx, RETANGULO);
    const cantosFoto = [
      { x: 0, y: 0 },
      { x: PERSPECTIVA.larguraImagemPx, y: 0 },
      { x: PERSPECTIVA.larguraImagemPx, y: PERSPECTIVA.alturaImagemPx },
      { x: 0, y: PERSPECTIVA.alturaImagemPx },
    ].map((p) => aplicarHomografia(h, p));
    const xs = cantosFoto.map((p) => p.x);
    const ys = cantosFoto.map((p) => p.y);
    const minX = Math.max(Math.min(...xs), CAIXA.minX);
    const maxX = Math.min(Math.max(...xs), CAIXA.maxX);
    const minY = Math.max(Math.min(...ys), CAIXA.minY);
    const maxY = Math.min(Math.max(...ys), CAIXA.maxY);

    // Tolerância de 0,1 cm (arredondamento) + a quantização do bitmap em px.
    expect(paredeInteiraCm.xCm).toBeCloseTo(minX, 0);
    expect(paredeInteiraCm.yCm).toBeCloseTo(minY, 0);
    expect(paredeInteiraCm.xCm + paredeInteiraCm.larguraCm).toBeCloseTo(maxX, 0);
    expect(paredeInteiraCm.yCm + paredeInteiraCm.alturaCm).toBeCloseTo(maxY, 0);
    expect(origemCm).toEqual({ x: paredeInteiraCm.xCm, y: paredeInteiraCm.yCm });
  });

  it('contém o retângulo de referência e respeita a caixa de +100% por lado (no máximo 3L × 3A)', () => {
    const { paredeInteiraCm: p } = calcularRetificacao(entrada());
    expect(p.xCm).toBeLessThanOrEqual(0);
    expect(p.yCm).toBeLessThanOrEqual(0);
    expect(p.xCm + p.larguraCm).toBeGreaterThanOrEqual(PERSPECTIVA.larguraCm - 0.1);
    expect(p.yCm + p.alturaCm).toBeGreaterThanOrEqual(PERSPECTIVA.alturaCm - 0.1);
    expect(p.xCm).toBeGreaterThanOrEqual(CAIXA.minX - 0.1);
    expect(p.yCm).toBeGreaterThanOrEqual(CAIXA.minY - 0.1);
    expect(p.larguraCm).toBeLessThanOrEqual(PERSPECTIVA.larguraCm * 3 + 0.1);
    expect(p.alturaCm).toBeLessThanOrEqual(PERSPECTIVA.alturaCm * 3 + 0.1);
  });

  it('limita a região quando a foto é muito maior que o retângulo marcado', () => {
    // Retângulo de referência minúsculo no centro de uma foto grande: a região é cortada pela caixa.
    const cantosPequenos = [
      { x: 780, y: 580 },
      { x: 820, y: 580 },
      { x: 820, y: 620 },
      { x: 780, y: 620 },
    ];
    const r = calcularRetificacao(
      entrada({ cantosPx: cantosPequenos, larguraCm: 40, alturaCm: 40, ladoMaxPx: 100_000 }),
    );
    expect(r.paredeInteiraCm.xCm).toBeCloseTo(-40, 0);
    expect(r.paredeInteiraCm.yCm).toBeCloseTo(-40, 0);
    expect(r.paredeInteiraCm.larguraCm).toBeCloseTo(120, 0);
    expect(r.paredeInteiraCm.alturaCm).toBeCloseTo(120, 0);
  });

  it('descarta pontos atrás do horizonte (w ≤ 0) e continua dentro da caixa', () => {
    // Trapézio com forte convergência: a linha do horizonte cruza a foto (y ≈ 455 de 1000).
    const r = calcularRetificacao({
      cantosPx: [
        { x: 450, y: 500 },
        { x: 550, y: 500 },
        { x: 1000, y: 900 },
        { x: 0, y: 900 },
      ],
      larguraCm: 100,
      alturaCm: 100,
      larguraImagemPx: 1000,
      alturaImagemPx: 1000,
      ladoMaxPx: 2000,
    });
    const p = r.paredeInteiraCm;
    for (const v of [p.xCm, p.yCm, p.larguraCm, p.alturaCm, r.pxPorCm, r.larguraPx, r.alturaPx]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(p.xCm).toBeGreaterThanOrEqual(-100.1);
    expect(p.yCm).toBeGreaterThanOrEqual(-100.1);
    expect(p.xCm + p.larguraCm).toBeLessThanOrEqual(200.1);
    expect(p.yCm + p.alturaCm).toBeLessThanOrEqual(200.1);
    expect(p.larguraCm).toBeGreaterThan(0);
    expect(p.alturaCm).toBeGreaterThan(0);
  });
});

describe('calcularRetificacao — resolução (ADR-04, §4.2 item 4)', () => {
  it('lado maior do bitmap respeita o perfil quando a foto tem densidade de sobra', () => {
    const r = calcularRetificacao(entrada({ ladoMaxPx: 500 }));
    expect(Math.max(r.larguraPx, r.alturaPx)).toBeGreaterThanOrEqual(499);
    expect(Math.max(r.larguraPx, r.alturaPx)).toBeLessThanOrEqual(501);
    expect(r.pxPorCm).toBeCloseTo(500 / Math.max(r.paredeInteiraCm.larguraCm, r.paredeInteiraCm.alturaCm), 1);
  });

  it('nunca passa da densidade da foto original no retângulo de referência', () => {
    // Densidade = √(área do quadrilátero em px ÷ área real em cm²).
    const densidade = Math.sqrt(
      areaPoligono(PERSPECTIVA.cantosPx) / (PERSPECTIVA.larguraCm * PERSPECTIVA.alturaCm),
    );
    const r = calcularRetificacao(entrada({ ladoMaxPx: 100_000 }));
    expect(r.pxPorCm).toBeCloseTo(densidade, 6);
    expect(r.pxPorCm).toBeLessThan(5);
  });

  it('larguraPx e alturaPx cobrem a parede inteira na escala pxPorCm', () => {
    const r = calcularRetificacao(entrada());
    expect(Number.isInteger(r.larguraPx)).toBe(true);
    expect(Number.isInteger(r.alturaPx)).toBe(true);
    expect(Math.abs(r.larguraPx / r.pxPorCm - r.paredeInteiraCm.larguraCm)).toBeLessThan(0.6 / r.pxPorCm);
    expect(Math.abs(r.alturaPx / r.pxPorCm - r.paredeInteiraCm.alturaCm)).toBeLessThan(0.6 / r.pxPorCm);
  });

  it('é determinística (servidor e Worker chegam às mesmas dimensões)', () => {
    expect(calcularRetificacao(entrada())).toEqual(calcularRetificacao(entrada()));
  });
});

describe('paredeInteiraCm × paredeInteira(parede persistida)', () => {
  it('a parede inteira derivada dos campos gravados é idêntica à calculada (sem avisos falsos)', () => {
    const r = calcularRetificacao(entrada());
    const persistida = ParedeSchema.parse(
      parede({
        larguraPx: PERSPECTIVA.larguraImagemPx,
        alturaPx: PERSPECTIVA.alturaImagemPx,
        retificada: {
          arquivo: 'paredes/x.retificada.webp',
          larguraPx: r.larguraPx,
          alturaPx: r.alturaPx,
          pxPorCm: r.pxPorCm,
          origemCm: r.origemCm,
        },
      }),
    );
    expect(paredeInteira(persistida)).toEqual(r.paredeInteiraCm);
  });
});

describe('homografiaBitmapParaImagem', () => {
  it('leva pixels do bitmap retificado de volta à foto', () => {
    const r = calcularRetificacao(entrada());
    const h = homografiaBitmapParaImagem(r);
    // Pixel do canto (0,0) cm e do canto (L,A) cm no bitmap.
    const cantoSE = aplicarHomografia(h, {
      x: (0 - r.origemCm.x) * r.pxPorCm,
      y: (0 - r.origemCm.y) * r.pxPorCm,
    });
    const cantoNO = aplicarHomografia(h, {
      x: (PERSPECTIVA.larguraCm - r.origemCm.x) * r.pxPorCm,
      y: (PERSPECTIVA.alturaCm - r.origemCm.y) * r.pxPorCm,
    });
    expect(cantoSE.x).toBeCloseTo(PERSPECTIVA.cantosPx[0]!.x, 4);
    expect(cantoSE.y).toBeCloseTo(PERSPECTIVA.cantosPx[0]!.y, 4);
    expect(cantoNO.x).toBeCloseTo(PERSPECTIVA.cantosPx[2]!.x, 4);
    expect(cantoNO.y).toBeCloseTo(PERSPECTIVA.cantosPx[2]!.y, 4);
  });
});

describe('calcularPrevia (RF-06, DV-06)', () => {
  const previa = calcularPrevia({
    cantosPx: PERSPECTIVA.cantosPx,
    larguraCm: PERSPECTIVA.larguraCm,
    alturaCm: PERSPECTIVA.alturaCm,
  });

  it('tem 320 px de largura e a proporção do retângulo de referência (sem a margem)', () => {
    expect(previa.larguraPx).toBe(PREVIA_LARGURA_PX);
    expect(previa.alturaPx).toBe(
      Math.round((PREVIA_LARGURA_PX * PERSPECTIVA.alturaCm) / PERSPECTIVA.larguraCm),
    );
  });

  it('o bitmap da prévia cobre exatamente o quadrilátero marcado', () => {
    const topoEsq = aplicarHomografia(previa.homografiaBitmapParaImagem, { x: 0, y: 0 });
    const baixoDir = aplicarHomografia(previa.homografiaBitmapParaImagem, {
      x: previa.larguraPx,
      y: previa.alturaPx,
    });
    expect(topoEsq.x).toBeCloseTo(PERSPECTIVA.cantosPx[0]!.x, 4);
    expect(topoEsq.y).toBeCloseTo(PERSPECTIVA.cantosPx[0]!.y, 4);
    // Arredondar a altura em px desloca no máximo meio pixel da prévia.
    expect(Math.abs(baixoDir.x - PERSPECTIVA.cantosPx[2]!.x)).toBeLessThan(5);
    expect(Math.abs(baixoDir.y - PERSPECTIVA.cantosPx[2]!.y)).toBeLessThan(5);
  });
});
