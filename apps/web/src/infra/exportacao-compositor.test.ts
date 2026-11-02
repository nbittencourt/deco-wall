import type { ComandoExportacao } from '@deco-wall/domain';
import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  comporExportacao,
  larguraFaixaHachuraPx,
  type Contexto2DExportacao,
  type ImagemDesenhavel,
  type OrigemImagem,
} from './exportacao-compositor';

// Compositor da exportação (RF-80, RN-12, RN-19, ADR-08, M4-10, M4-11, A-14 a A-17;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.5). Roda no Worker sobre um OffscreenCanvas; aqui, sobre um
// contexto que só grava as chamadas.

type Chamada = [string, ...unknown[]];

function contextoGravador() {
  const chamadas: Chamada[] = [];
  const estado = { fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1 };
  const registro =
    (nome: string) =>
    (...args: unknown[]) => {
      chamadas.push([nome, ...args]);
    };
  const metodos = {
    save: registro('save'),
    restore: registro('restore'),
    beginPath: registro('beginPath'),
    rect: registro('rect'),
    clip: registro('clip'),
    moveTo: registro('moveTo'),
    lineTo: registro('lineTo'),
    closePath: registro('closePath'),
    stroke: () => chamadas.push(['stroke', estado.strokeStyle, estado.lineWidth, estado.globalAlpha]),
    fill: () => chamadas.push(['fill', estado.fillStyle, estado.globalAlpha]),
    fillRect: (...a: unknown[]) => chamadas.push(['fillRect', ...a, estado.fillStyle, estado.globalAlpha]),
    drawImage: registro('drawImage'),
  };
  const ctx = new Proxy(metodos, {
    set(_alvo, chave, valor) {
      (estado as Record<string, unknown>)[chave as string] = valor;
      return true;
    },
    get(alvo, chave) {
      return chave in estado
        ? (estado as Record<string, unknown>)[chave as string]
        : Reflect.get(alvo, chave);
    },
  }) as unknown as Contexto2DExportacao;
  return { ctx, chamadas };
}

const imagem = (width: number, height: number): ImagemDesenhavel & { close: Mock<() => void> } => ({
  width,
  height,
  close: vi.fn<() => void>(),
});

// Parede de 300 × 200 cm a 10 px/cm (3000 × 2000 px), origem em 0,0.
const RESOLUCAO = { larguraPx: 3000, alturaPx: 2000, pxPorCm: 10 };
const PAREDE: ComandoExportacao = {
  tipo: 'parede',
  arquivo: 'paredes/p.retificada.webp',
  origemCm: { x: 0, y: 0 },
  tamanhoCm: { larguraCm: 300, alturaCm: 200 },
};
const FOTO = {
  tipo: 'foto',
  fotoId: 'f1',
  imagemId: 'i1',
  externo: { xCm: 40, yCm: 30, larguraCm: 24, alturaCm: 34 },
  impresso: { xCm: 42, yCm: 32, larguraCm: 20, alturaCm: 30 },
  borda: { larguraCm: 2, cor: '#F5F1E8' },
  recorte: { offsetX: 0.5, offsetY: 0 },
} satisfies ComandoExportacao;

function carregador(mapa: Record<string, ImagemDesenhavel | null>) {
  return vi.fn(async (origem: OrigemImagem) =>
    origem.tipo === 'parede' ? (mapa.parede ?? null) : (mapa[origem.imagemId] ?? null),
  );
}

const nomes = (chamadas: Chamada[]) => chamadas.map((c) => c[0]);

describe('comporExportacao — fundo e parede (M4-10, A-14)', () => {
  it('PNG não preenche o fundo; a parede ocupa o canvas inteiro', async () => {
    const { ctx, chamadas } = contextoGravador();
    const parede = imagem(3000, 2000);
    await comporExportacao({
      ctx,
      comandos: [PAREDE],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede }),
    });
    expect(chamadas).toEqual([['drawImage', parede, 0, 0, 3000, 2000]]);
    expect(parede.close).toHaveBeenCalled();
  });

  it('JPG preenche o fundo de branco antes de tudo', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE],
      resolucao: RESOLUCAO,
      fundoBranco: true,
      carregar: carregador({ parede: imagem(10, 10) }),
    });
    expect(chamadas[0]).toEqual(['fillRect', 0, 0, 3000, 2000, '#FFFFFF', 1]);
    expect(chamadas[1]![0]).toBe('drawImage');
  });

  it('a parede é escalada para a resolução pedida (prévia reduzida)', async () => {
    const { ctx, chamadas } = contextoGravador();
    const parede = imagem(3000, 2000);
    await comporExportacao({
      ctx,
      comandos: [PAREDE],
      resolucao: { larguraPx: 480, alturaPx: 320, pxPorCm: 1.6 },
      fundoBranco: false,
      carregar: carregador({ parede }),
    });
    expect(chamadas).toEqual([['drawImage', parede, 0, 0, 480, 320]]);
  });

  it('sem a imagem da parede, falha com mensagem clara', async () => {
    const { ctx } = contextoGravador();
    await expect(
      comporExportacao({
        ctx,
        comandos: [PAREDE],
        resolucao: RESOLUCAO,
        fundoBranco: false,
        carregar: carregador({}),
      }),
    ).rejects.toThrow('Não foi possível carregar a imagem da parede.');
  });
});

describe('comporExportacao — fotos (RN-19, A-16)', () => {
  it('borda por fora (retângulo externo) e imagem em cover no retângulo impresso, com o recorte', async () => {
    const { ctx, chamadas } = contextoGravador();
    const parede = imagem(3000, 2000);
    const foto = imagem(600, 800);
    const carregar = carregador({ parede, i1: foto });
    const r = await comporExportacao({
      ctx,
      comandos: [PAREDE, FOTO],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar,
    });
    expect(r).toEqual({ imagensIndisponiveis: 0 });
    expect(carregar).toHaveBeenCalledWith({ tipo: 'foto', imagemId: 'i1' });
    // borda: retângulo externo em px, na cor da borda
    expect(chamadas[1]).toEqual(['fillRect', 400, 300, 240, 340, '#F5F1E8', 1]);
    // janela do recorte da MESMA função do canvas: 600×800 em 20×30 cm, offsetX 0,5
    const [nome, img, sx, sy, sw, sh, dx, dy, dw, dh] = chamadas[2]!;
    expect(nome).toBe('drawImage');
    expect(img).toBe(foto);
    expect(sx as number).toBeCloseTo(50, 5);
    expect(sy).toBe(0);
    expect(sw as number).toBeCloseTo(533.3333, 3);
    expect(sh).toBe(800);
    expect([dx, dy, dw, dh]).toEqual([420, 320, 200, 300]);
    expect(foto.close).toHaveBeenCalled();
  });

  it('sem borda, não desenha o retângulo da borda', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE, { ...FOTO, borda: null, impresso: FOTO.externo }],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10), i1: imagem(600, 800) }),
    });
    expect(nomes(chamadas)).toEqual(['drawImage', 'drawImage']);
  });

  it('imagem indisponível sai como retângulo cinza (sand) do tamanho externo e é contada', async () => {
    const { ctx, chamadas } = contextoGravador();
    const r = await comporExportacao({
      ctx,
      comandos: [PAREDE, FOTO, { ...FOTO, fotoId: 'f2', imagemId: 'i2' }],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10), i1: null, i2: null }),
    });
    expect(r).toEqual({ imagensIndisponiveis: 2 });
    expect(chamadas[1]).toEqual(['fillRect', 400, 300, 240, 340, '#EFEAE1', 1]);
    expect(chamadas[2]).toEqual(['fillRect', 400, 300, 240, 340, '#EFEAE1', 1]);
  });

  it('desenha as fotos na ordem dos comandos (pilha)', async () => {
    const { ctx, chamadas } = contextoGravador();
    const a = imagem(600, 800);
    const b = imagem(600, 800);
    await comporExportacao({
      ctx,
      comandos: [
        PAREDE,
        { ...FOTO, imagemId: 'a', borda: null, impresso: FOTO.externo },
        { ...FOTO, imagemId: 'b', borda: null, impresso: FOTO.externo },
      ],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10), a, b }),
    });
    expect(chamadas.map((c) => c[1]).filter((x) => x === a || x === b)).toEqual([a, b]);
  });
});

describe('comporExportacao — placeholder em hachura vermelha (RN-19, A-16)', () => {
  const PLACEHOLDER: ComandoExportacao = {
    tipo: 'placeholder',
    fotoId: 'p1',
    externo: { xCm: 10, yCm: 20, larguraCm: 26, alturaCm: 36 },
  };

  it('recorta ao retângulo externo e pinta faixas a 45° alternando 45% e 16% de danger', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE, PLACEHOLDER],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10) }),
    });
    const resto = chamadas.slice(1);
    expect(resto[0]).toEqual(['save']);
    expect(resto).toContainEqual(['rect', 100, 200, 260, 360]);
    expect(resto).toContainEqual(['clip']);
    const preenchimentos = resto.filter((c) => c[0] === 'fill');
    expect(new Set(preenchimentos.map((c) => c[2]))).toEqual(new Set([0.45, 0.16]));
    expect(new Set(preenchimentos.map((c) => c[1]))).toEqual(new Set(['#B42318']));
    expect(resto.at(-1)).toEqual(['restore']);
  });

  it('não desenha borda no placeholder', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE, PLACEHOLDER],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10) }),
    });
    expect(chamadas.filter((c) => c[0] === 'fillRect')).toEqual([]);
  });

  it('larguraFaixaHachuraPx: 0,5 cm na densidade da saída, com mínimo de 3 px', () => {
    expect(larguraFaixaHachuraPx(10)).toBe(5);
    expect(larguraFaixaHachuraPx(1.6)).toBe(3);
    expect(larguraFaixaHachuraPx(6)).toBe(3);
  });
});

describe('comporExportacao — grid (A-15)', () => {
  const GRID: ComandoExportacao = {
    tipo: 'grid',
    passoCm: 100,
    cor: '#1F1B16',
    opacidade: 0.08,
    origemCm: { x: 0, y: 0 },
    tamanhoCm: { larguraCm: 300, alturaCm: 200 },
  };

  it('linhas de 1 px nos múltiplos do passo, com as bordas da parede, na cor e opacidade da variante', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE, GRID],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10) }),
    });
    // verticais em 0, 100, 200, 300 cm e horizontais em 0, 100, 200 cm: 7 linhas
    expect(chamadas.filter((c) => c[0] === 'moveTo')).toHaveLength(7);
    expect(chamadas.filter((c) => c[0] === 'lineTo')).toHaveLength(7);
    expect(chamadas.filter((c) => c[0] === 'stroke')).toContainEqual(['stroke', '#1F1B16', 1, 0.08]);
  });

  it('o grid fica abaixo das fotos: desenha antes delas', async () => {
    const { ctx, chamadas } = contextoGravador();
    await comporExportacao({
      ctx,
      comandos: [PAREDE, GRID, FOTO],
      resolucao: RESOLUCAO,
      fundoBranco: false,
      carregar: carregador({ parede: imagem(10, 10), i1: imagem(600, 800) }),
    });
    const ordem = nomes(chamadas);
    expect(ordem.indexOf('stroke')).toBeGreaterThan(-1);
    expect(ordem.indexOf('stroke')).toBeLessThan(ordem.indexOf('fillRect'));
  });
});

describe('comporExportacao — cancelamento (M4-12)', () => {
  it('rejeita com AbortError quando o sinal já foi abortado', async () => {
    const { ctx } = contextoGravador();
    const controle = new AbortController();
    controle.abort();
    await expect(
      comporExportacao({
        ctx,
        comandos: [PAREDE],
        resolucao: RESOLUCAO,
        fundoBranco: false,
        carregar: carregador({ parede: imagem(10, 10) }),
        sinal: controle.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('para entre as fotos quando o sinal aborta no meio', async () => {
    const { ctx } = contextoGravador();
    const controle = new AbortController();
    const carregar = vi.fn(async (origem: OrigemImagem) => {
      if (origem.tipo === 'foto') controle.abort();
      return imagem(600, 800);
    });
    await expect(
      comporExportacao({
        ctx,
        comandos: [PAREDE, FOTO, { ...FOTO, imagemId: 'i2' }],
        resolucao: RESOLUCAO,
        fundoBranco: false,
        carregar,
        sinal: controle.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(carregar).toHaveBeenCalledTimes(2); // a parede e só a primeira foto
  });
});
