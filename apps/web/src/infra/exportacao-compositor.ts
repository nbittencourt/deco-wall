import {
  calcularRecorte,
  FAIXA_HACHURA_CM,
  FAIXA_HACHURA_MIN_PX,
  type AreaUtil,
  type ComandoExportacao,
  type ResolucaoExportacao,
} from '@deco-wall/domain';

// Compositor da exportação (RF-80, RN-12, RN-19, ADR-08, M4-10, M4-11, A-14 a A-17;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.5). Desenha os comandos do domínio, uma imagem por vez, num
// contexto 2D (o `OffscreenCanvas` do Worker; nos testes, um gravador). Não conhece Konva nem o DOM.

// O subconjunto do Canvas 2D que o compositor usa.
export interface Contexto2DExportacao {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  rect(x: number, y: number, largura: number, altura: number): void;
  clip(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, largura: number, altura: number): void;
  drawImage(imagem: ImagemDesenhavel, dx: number, dy: number, dw: number, dh: number): void;
  drawImage(
    imagem: ImagemDesenhavel,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

// Um bitmap decodificado; `close` libera a memória assim que a imagem é desenhada.
export interface ImagemDesenhavel {
  width: number;
  height: number;
  close?: () => void;
}

export type OrigemImagem = { tipo: 'parede'; arquivo: string } | { tipo: 'foto'; imagemId: string };

// Chave de cada imagem no pedido ao Worker (a URL sai do mapa `urls`).
export const chaveDaOrigem = (origem: OrigemImagem): string =>
  origem.tipo === 'parede' ? `parede:${origem.arquivo}` : `foto:${origem.imagemId}`;

const COR_DANGER = '#B42318'; // tokens do tema (danger e sand) fixos em hex: o Worker não lê CSS
const COR_IMAGEM_INDISPONIVEL = '#EFEAE1';
const ALFA_FAIXA_FORTE = 0.45;
const ALFA_FAIXA_FRACA = 0.16;

// A-16: faixas de 0,5 cm na densidade da saída, com mínimo de 3 px (na prévia reduzida 0,5 cm seria < 1 px).
export function larguraFaixaHachuraPx(pxPorCm: number): number {
  return Math.max(FAIXA_HACHURA_CM * pxPorCm, FAIXA_HACHURA_MIN_PX);
}

function abortou(sinal?: AbortSignal): never | void {
  if (sinal?.aborted) throw new DOMException('Operação cancelada.', 'AbortError');
}

// Múltiplos do passo entre `de` e `ate`, bordas incluídas, sem acumular erro de ponto flutuante.
function multiplos(passo: number, de: number, ate: number): number[] {
  const saida: number[] = [];
  const primeiro = Math.ceil(de / passo - 1e-9);
  const ultimo = Math.floor(ate / passo + 1e-9);
  for (let k = primeiro; k <= ultimo; k += 1) saida.push(Number((k * passo).toFixed(6)));
  return saida;
}

export async function comporExportacao(args: {
  ctx: Contexto2DExportacao;
  comandos: readonly ComandoExportacao[];
  resolucao: ResolucaoExportacao;
  // JPG não tem transparência: o fundo sai branco. No PNG o que não tem parede fica transparente.
  fundoBranco: boolean;
  carregar: (origem: OrigemImagem) => Promise<ImagemDesenhavel | null>;
  sinal?: AbortSignal;
}): Promise<{ imagensIndisponiveis: number }> {
  const { ctx, comandos, resolucao, sinal } = args;
  const { larguraPx, alturaPx, pxPorCm } = resolucao;
  // A origem da parede é a origem da saída: cm → px relativo a ela.
  const regiao = comandos.find((c) => c.tipo === 'parede');
  const origem = regiao?.tipo === 'parede' ? regiao.origemCm : { x: 0, y: 0 };
  const px = (cm: number, de: number) => (cm - de) * pxPorCm;
  const retangulo = (r: AreaUtil) => ({
    x: px(r.xCm, origem.x),
    y: px(r.yCm, origem.y),
    largura: r.larguraCm * pxPorCm,
    altura: r.alturaCm * pxPorCm,
  });

  let imagensIndisponiveis = 0;
  if (args.fundoBranco) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, larguraPx, alturaPx);
  }

  for (const comando of comandos) {
    abortou(sinal);
    if (comando.tipo === 'parede') {
      const imagem = await args.carregar({ tipo: 'parede', arquivo: comando.arquivo });
      if (!imagem) throw new Error('Não foi possível carregar a imagem da parede.');
      ctx.drawImage(imagem, 0, 0, larguraPx, alturaPx);
      imagem.close?.();
    } else if (comando.tipo === 'grid') {
      desenharGrid(ctx, comando, resolucao, origem);
    } else if (comando.tipo === 'placeholder') {
      desenharPlaceholder(ctx, retangulo(comando.externo), pxPorCm);
    } else {
      const externo = retangulo(comando.externo);
      const imagem = await args.carregar({ tipo: 'foto', imagemId: comando.imagemId });
      if (!imagem) {
        imagensIndisponiveis += 1;
        ctx.globalAlpha = 1;
        ctx.fillStyle = COR_IMAGEM_INDISPONIVEL;
        ctx.fillRect(externo.x, externo.y, externo.largura, externo.altura);
        continue;
      }
      if (comando.borda) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = comando.borda.cor;
        ctx.fillRect(externo.x, externo.y, externo.largura, externo.altura);
      }
      const impresso = retangulo(comando.impresso);
      // A mesma função do canvas (RF-33, RN-14): a janela do recorte em px da imagem.
      const janela = calcularRecorte(
        { larguraPx: imagem.width, alturaPx: imagem.height },
        { larguraCm: comando.impresso.larguraCm, alturaCm: comando.impresso.alturaCm },
        comando.recorte,
      );
      ctx.drawImage(
        imagem,
        janela.x,
        janela.y,
        janela.largura,
        janela.altura,
        impresso.x,
        impresso.y,
        impresso.largura,
        impresso.altura,
      );
      imagem.close?.();
    }
  }
  return { imagensIndisponiveis };
}

// A-15: linhas de 1 px nos múltiplos do passo (a partir de 0,0), só dentro da parede inteira.
function desenharGrid(
  ctx: Contexto2DExportacao,
  comando: Extract<ComandoExportacao, { tipo: 'grid' }>,
  { larguraPx, alturaPx, pxPorCm }: ResolucaoExportacao,
  origem: { x: number; y: number },
) {
  const { passoCm, origemCm, tamanhoCm } = comando;
  const entre = (valor: number, maximo: number) => Math.min(Math.max(valor, 0.5), maximo - 0.5);
  ctx.beginPath();
  for (const x of multiplos(passoCm, origemCm.x, origemCm.x + tamanhoCm.larguraCm)) {
    const xpx = entre((x - origem.x) * pxPorCm, larguraPx);
    ctx.moveTo(xpx, 0);
    ctx.lineTo(xpx, alturaPx);
  }
  for (const y of multiplos(passoCm, origemCm.y, origemCm.y + tamanhoCm.alturaCm)) {
    const ypx = entre((y - origem.y) * pxPorCm, alturaPx);
    ctx.moveTo(0, ypx);
    ctx.lineTo(larguraPx, ypx);
  }
  ctx.strokeStyle = comando.cor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = comando.opacidade;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// RN-19, A-16: retângulo externo em hachura vermelha a 45°, faixas alternando danger a 45% e a 16%.
function desenharPlaceholder(
  ctx: Contexto2DExportacao,
  r: { x: number; y: number; largura: number; altura: number },
  pxPorCm: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.largura, r.altura);
  ctx.clip();
  ctx.fillStyle = COR_DANGER;
  // Faixa de largura `faixa` medida na perpendicular: no eixo x, `faixa · √2`. Cada faixa é o trecho entre as
  // diagonais x + y = c e x + y = c + passo, cortado pelo retângulo (o clip faz o resto).
  const passo = larguraFaixaHachuraPx(pxPorCm) * Math.SQRT2;
  const base = r.x + r.y;
  const total = Math.ceil((r.largura + r.altura) / passo);
  for (let k = 0; k < total; k += 1) {
    const c0 = base + k * passo;
    const c1 = c0 + passo;
    ctx.globalAlpha = k % 2 === 0 ? ALFA_FAIXA_FORTE : ALFA_FAIXA_FRACA;
    ctx.beginPath();
    ctx.moveTo(c0 - r.y, r.y);
    ctx.lineTo(c1 - r.y, r.y);
    ctx.lineTo(c1 - (r.y + r.altura), r.y + r.altura);
    ctx.lineTo(c0 - (r.y + r.altura), r.y + r.altura);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
