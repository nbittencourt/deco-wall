import {
  calcularRecorte,
  deslocarRecorte,
  encaixarPosicao,
  formatarDimensao,
  formatarTamanho,
  limitarPosicao,
  retanguloExterno,
  tamanhoExterno,
  type AreaUtil,
  type Grid,
  type Pt,
  type Viewport,
} from '@deco-wall/domain';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo, useRef } from 'react';
import { Circle, Group, Image as KonvaImage, Label, Line, Path, Rect, Shape, Tag, Text } from 'react-konva';
import {
  caixaAreaTotal,
  comArrasto,
  destaquesDaCena,
  imagemIndisponivel,
  opacidadeDaFoto,
  SEM_ALERTAS,
  type Arrasto,
} from './anotacoes';
import type { CenaParede, CenaRecorte, FotoCena } from './cena';
import { CORES_CANVAS, MEDIDAS_CANVAS } from './theme';
import { useImagem, useImagemComEstado } from './useImagem';

export type { Arrasto };

// Fotos no Konva (docs/specs/M2-biblioteca-e-composicao.md §3.3, §3.5; DESIGN §2.2). Duas partes, como no
// Palco: a cena em cm (as fotos e o modo de recorte) e a sobreposição em px de tela (seleção, alertas,
// bounding box), que mantém o tamanho dos traços e rótulos em qualquer zoom.

const FONTE_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const CONTORNO_BORDA = 'rgba(31, 27, 22, 0.18)';

const aTela = (vp: Viewport, p: Pt): Pt => ({ x: p.x * vp.escala + vp.x, y: p.y * vp.escala + vp.y });

function definirCursor(evento: KonvaEventObject<MouseEvent>, cursor: string) {
  const palco = evento.target.getStage()?.container();
  if (palco) palco.style.cursor = cursor;
}

// ---- cena (cm) ----

// Placeholder (DESIGN §2.2, M2-06): hachura de 45° em `danger` 20% sobre `#FBEDEA` e borda tracejada de 1,5 px. O
// ícone e o tamanho em mono ficam na sobreposição (px de tela).
const ESPACO_HACHURA_CM = 1.5;

function Placeholder({ foto }: { foto: FotoCena }) {
  const b = foto.borda.larguraCm;
  const { larguraCm: l, alturaCm: a } = foto.tamanho;
  return (
    <Group x={b} y={b}>
      {/* O fundo escuta o mouse: é ele que seleciona e arrasta o placeholder. */}
      <Rect width={l} height={a} fill={CORES_CANVAS.placeholderFundo} />
      <Shape
        listening={false}
        stroke={CORES_CANVAS.placeholderHachura}
        strokeWidth={1}
        strokeScaleEnabled={false}
        sceneFunc={(ctx, forma) => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, l, a);
          ctx.clip();
          ctx.beginPath();
          for (let d = -a; d < l; d += ESPACO_HACHURA_CM) {
            ctx.moveTo(d, a);
            ctx.lineTo(d + a, 0);
          }
          ctx.strokeShape(forma);
          ctx.restore();
        }}
      />
      <Rect
        listening={false}
        width={l}
        height={a}
        stroke={CORES_CANVAS.placeholderBorda}
        strokeWidth={MEDIDAS_CANVAS.bordaPlaceholderPx}
        strokeScaleEnabled={false}
        dash={[6, 4]}
      />
    </Group>
  );
}

function FotoNode({
  foto,
  interativa,
  grid,
  parede,
  opacidade,
  onSelecionar,
  onArrasto,
  onSoltar,
  onAbrirRecorte,
  onFalhaDaImagem,
}: {
  foto: FotoCena;
  interativa: boolean;
  grid: Grid | null;
  // M2-11: o limite de posição vale no arraste.
  parede: AreaUtil | null;
  opacidade: number;
  onSelecionar?: (id: string) => void;
  onFalhaDaImagem: (id: string, falhou: boolean) => void;
  onArrasto: (arrasto: Arrasto) => void;
  onSoltar: (arrasto: Arrasto) => void;
  onAbrirRecorte?: (id: string) => void;
}) {
  const { imagem, falhou } = useImagemComEstado(foto.imagem?.url ?? null);
  useEffect(() => {
    onFalhaDaImagem(foto.id, falhou);
    return () => onFalhaDaImagem(foto.id, false);
  }, [foto.id, falhou, onFalhaDaImagem]);
  const externo = tamanhoExterno(foto.tamanho, foto.borda);
  const borda = foto.borda.larguraCm;
  const recorte =
    imagem && foto.imagem
      ? calcularRecorte(
          { larguraPx: foto.imagem.larguraPx, alturaPx: foto.imagem.alturaPx },
          foto.tamanho,
          foto.recorte,
        )
      : null;

  // A-04, M2-11: o canto superior esquerdo externo é encaixado no grid e limitado à parede; o Konva move o
  // nó, a store só recebe a posição final no `dragend`.
  const posicaoDoNo = (no: Konva.Node): Pt => {
    const bruta = { x: no.x(), y: no.y() };
    const encaixada = grid ? encaixarPosicao(bruta, grid) : bruta;
    if (!parede) return encaixada;
    const limitada = limitarPosicao(
      { xCm: encaixada.x, yCm: encaixada.y, tamanho: foto.tamanho, borda: foto.borda },
      parede,
    );
    return { x: limitada.xCm, y: limitada.yCm };
  };

  return (
    <Group
      name="foto"
      x={foto.xCm}
      y={foto.yCm}
      listening={interativa}
      draggable={interativa}
      opacity={opacidade}
      onMouseDown={() => onSelecionar?.(foto.id)}
      onDblClick={() => onAbrirRecorte?.(foto.id)}
      onMouseEnter={(e) => definirCursor(e, 'move')}
      onMouseLeave={(e) => definirCursor(e, '')}
      onDragMove={(e) => {
        const p = posicaoDoNo(e.target);
        e.target.position(p);
        onArrasto({ id: foto.id, xCm: p.x, yCm: p.y });
      }}
      onDragEnd={(e) => {
        const p = posicaoDoNo(e.target);
        e.target.position(p);
        onSoltar({ id: foto.id, xCm: p.x, yCm: p.y });
      }}
    >
      {borda > 0 && (
        <Rect
          width={externo.larguraCm}
          height={externo.alturaCm}
          fill={foto.borda.cor}
          stroke={CONTORNO_BORDA}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
      )}
      {imagem && recorte ? (
        <KonvaImage
          image={imagem}
          x={borda}
          y={borda}
          width={foto.tamanho.larguraCm}
          height={foto.tamanho.alturaCm}
          crop={{ x: recorte.x, y: recorte.y, width: recorte.largura, height: recorte.altura }}
        />
      ) : foto.placeholder ? (
        <Placeholder foto={foto} />
      ) : (
        <Rect
          x={borda}
          y={borda}
          width={foto.tamanho.larguraCm}
          height={foto.tamanho.alturaCm}
          fill={CORES_CANVAS.fotoSemImagem}
        />
      )}
    </Group>
  );
}

export function FotosDaCena({
  cena,
  ocultaId,
  onArrasto,
  onSoltar,
  onFalhaDaImagem,
}: {
  cena: CenaParede | CenaRecorte;
  // A foto que está no modo de recorte é desenhada à parte.
  ocultaId?: string;
  onArrasto: (arrasto: Arrasto) => void;
  onSoltar: (arrasto: Arrasto) => void;
  onFalhaDaImagem: (id: string, falhou: boolean) => void;
}) {
  const interativa = cena.tipo === 'parede' && cena.interativa;
  return (
    <>
      {cena.fotos
        .filter((f) => f.id !== ocultaId)
        .map((foto) => (
          <FotoNode
            key={foto.id}
            foto={foto}
            interativa={interativa}
            grid={cena.grid}
            parede={cena.paredeInteira}
            opacidade={opacidadeDaFoto(cena, foto.id)}
            onSelecionar={cena.onSelecionar}
            onFalhaDaImagem={onFalhaDaImagem}
            onArrasto={(a) => {
              onArrasto(a);
              cena.onArrastarFoto?.(a); // A-07: a barra de status mostra a posição ao vivo
            }}
            onSoltar={(a) => {
              onSoltar(a);
              cena.onMoverFoto?.(a.id, a.xCm, a.yCm);
              cena.onArrastarFoto?.(null);
            }}
            onAbrirRecorte={cena.onAbrirRecorte}
          />
        ))}
    </>
  );
}

// Modo de recorte (DESIGN §7.0): a imagem inteira cobrindo o quadro, a parte de fora esmaecida e o quadro
// em destaque. Arrastar a imagem desloca o recorte, só no eixo com sobra.
export function CamadaRecorte({ cena }: { cena: CenaRecorte }) {
  const { foto, tamanho, offset, onOffsetChange } = cena.recorte;
  const imagem = useImagem(foto.imagem?.url ?? null);
  const inicio = useRef<{ offset: typeof offset; x: number; y: number } | null>(null);

  const borda = foto.borda.larguraCm;
  const quadro = {
    xCm: foto.xCm + borda,
    yCm: foto.yCm + borda,
    larguraCm: tamanho.larguraCm,
    alturaCm: tamanho.alturaCm,
  };

  const medidas = foto.imagem ? { larguraPx: foto.imagem.larguraPx, alturaPx: foto.imagem.alturaPx } : null;
  // cm por px da imagem na escala que cobre o quadro.
  const cmPorPx = medidas
    ? Math.max(quadro.larguraCm / medidas.larguraPx, quadro.alturaCm / medidas.alturaPx)
    : 1;
  const posicaoDaImagem = (o: typeof offset): Pt => {
    const r = calcularRecorte(medidas!, tamanho, o);
    return { x: quadro.xCm - r.x * cmPorPx, y: quadro.yCm - r.y * cmPorPx };
  };

  return (
    <>
      {imagem && medidas && (
        <KonvaImage
          name="recorte-imagem"
          image={imagem}
          {...posicaoDaImagem(offset)}
          width={medidas.larguraPx * cmPorPx}
          height={medidas.alturaPx * cmPorPx}
          draggable
          onMouseEnter={(e) => definirCursor(e, 'move')}
          onMouseLeave={(e) => definirCursor(e, '')}
          onDragStart={(e) => {
            inicio.current = { offset, x: e.target.x(), y: e.target.y() };
          }}
          onDragMove={(e) => {
            const base = inicio.current;
            if (!base) return;
            // Mover a imagem no quadro em cm equivale a mover `delta / cmPorPx` px da imagem.
            const novo = deslocarRecorte(
              base.offset,
              { x: (e.target.x() - base.x) / cmPorPx, y: (e.target.y() - base.y) / cmPorPx },
              medidas,
              tamanho,
            );
            e.target.position(posicaoDaImagem(novo));
            onOffsetChange(novo);
          }}
        />
      )}
      <Shape
        listening={false}
        fill={CORES_CANVAS.exteriorAreaUtilModo}
        fillRule="evenodd"
        sceneFunc={(ctx, forma) => {
          ctx.beginPath();
          ctx.rect(-100000, -100000, 200000, 200000);
          ctx.rect(quadro.xCm, quadro.yCm, quadro.larguraCm, quadro.alturaCm);
          ctx.closePath();
          ctx.fillShape(forma);
        }}
      />
      <Rect
        listening={false}
        x={quadro.xCm}
        y={quadro.yCm}
        width={quadro.larguraCm}
        height={quadro.alturaCm}
        stroke={CORES_CANVAS.selecao}
        strokeWidth={MEDIDAS_CANVAS.bordaSelecaoPx}
        strokeScaleEnabled={false}
      />
    </>
  );
}

// ---- sobreposição (px de tela) ----

// IBM Plex Mono tem avanço de 0,6 em: a 11 px, 6,6 px por caractere. Serve para alinhar rótulos sem medir.
const LARGURA_CARACTERE_PX = MEDIDAS_CANVAS.fonteMedidaPx * 0.6;
// O Konva só aceita o mesmo padding nos quatro lados.
const PADDING_PILL_PX = 5;
const PREFIXO_ICONE = '   ';

function larguraDoPill(texto: string, icone: boolean): number {
  return 2 * PADDING_PILL_PX + (texto.length + (icone ? PREFIXO_ICONE.length : 0)) * LARGURA_CARACTERE_PX;
}

function Pill({
  x,
  y,
  texto,
  fundo,
  icone = false,
  ancora = 'inicio',
}: {
  x: number;
  y: number;
  texto: string;
  fundo: string;
  icone?: boolean;
  // "fim": o rótulo termina em x (alinhado à direita).
  ancora?: 'inicio' | 'fim';
}) {
  const esquerda = ancora === 'fim' ? x - larguraDoPill(texto, icone) : x;
  return (
    <Label x={esquerda} y={y} listening={false}>
      <Tag fill={fundo} cornerRadius={9} />
      <Text
        text={icone ? `${PREFIXO_ICONE}${texto}` : texto}
        fontFamily={FONTE_MONO}
        fontSize={MEDIDAS_CANVAS.fonteMedidaPx}
        fill={CORES_CANVAS.pillMedidaTexto}
        padding={PADDING_PILL_PX}
      />
      {icone && (
        <>
          <Circle x={12} y={10.5} radius={4.5} stroke="#FFFFFF" strokeWidth={1.2} />
          <Line points={[12, 8.5, 12, 11.2]} stroke="#FFFFFF" strokeWidth={1.2} lineCap="round" />
          <Circle x={12} y={13} radius={0.6} fill="#FFFFFF" />
        </>
      )}
    </Label>
  );
}

const TEXTO_ALERTA = {
  parede: 'Fora da parede',
  'area-util': 'Fora da área útil',
  sobreposicao: 'Sobreposição',
} as const;

// Seleção, alertas, placeholders, imagem indisponível e bounding box das fotos do editor (spec M2 §3.3, §3.7;
// A-12, A-13, A-16). A decisão do que aparece vem de `anotacoes.ts`; aqui só o desenho, em px de tela.
export function SobreposicaoFotos({
  cena,
  vp,
  arrasto,
  falhas,
}: {
  cena: CenaParede | CenaRecorte;
  vp: Viewport;
  arrasto: Arrasto | null;
  falhas: ReadonlySet<string>;
}) {
  const fotos = useMemo(() => comArrasto(cena.fotos, arrasto), [cena.fotos, arrasto]);
  const { alertas, acima } = useMemo(() => destaquesDaCena(fotos, cena), [fotos, cena]);
  if (!cena.comEscala) return null;

  const emTela = (caixa: AreaUtil) => {
    const topo = aTela(vp, { x: caixa.xCm, y: caixa.yCm });
    return { x: topo.x, y: topo.y, largura: caixa.larguraCm * vp.escala, altura: caixa.alturaCm * vp.escala };
  };

  // A-13: a caixa aparece com 1 foto ou mais, se o toggle "Área total" estiver ligado.
  const caixaGeral = caixaAreaTotal(fotos, cena);
  const geral = caixaGeral ? emTela(caixaGeral) : null;
  const folga = MEDIDAS_CANVAS.folgaBoundingBoxPx;
  const selecionada = fotos.find((f) => f.id === cena.selecaoId);
  const d = MEDIDAS_CANVAS.offsetSobreposicaoPx;

  return (
    <>
      {geral && caixaGeral && (
        <>
          <Rect
            listening={false}
            x={geral.x - folga}
            y={geral.y - folga}
            width={geral.largura + 2 * folga}
            height={geral.altura + 2 * folga}
            stroke={CORES_CANVAS.areaUtil}
            strokeWidth={MEDIDAS_CANVAS.bordaBoundingBoxPx}
            dash={[6, 4]}
          />
          <Pill
            x={geral.x + geral.largura + folga}
            y={geral.y - folga - 24}
            ancora="fim"
            fundo={CORES_CANVAS.areaUtil}
            texto={formatarDimensao(caixaGeral.larguraCm, caixaGeral.alturaCm)}
          />
        </>
      )}

      {fotos.map((foto) => {
        const r = emTela(retanguloExterno(foto));
        const a = alertas.get(foto.id) ?? SEM_ALERTAS;
        return (
          <Group key={foto.id} listening={false}>
            {foto.placeholder && <MarcaDoPlaceholder foto={foto} r={r} />}
            {imagemIndisponivel(foto, falhas) && <MarcaDeImagemIndisponivel r={r} />}
            {(a.sobreposicao || a.fora) && (
              <Rect
                x={r.x - d}
                y={r.y - d}
                width={r.largura + 2 * d}
                height={r.altura + 2 * d}
                stroke={CORES_CANVAS.sobreposicao}
                strokeWidth={MEDIDAS_CANVAS.bordaSobreposicaoPx}
                dash={[6, 4]}
              />
            )}
            {/* A-12: "Sobreposição" no canto inferior direito da foto da camada superior. */}
            {acima.has(foto.id) && (
              <Pill
                x={r.x + r.largura - 6}
                y={r.y + r.altura - 6 - ALTURA_PILL_PX}
                ancora="fim"
                fundo={CORES_CANVAS.sobreposicao}
                icone
                texto={TEXTO_ALERTA.sobreposicao}
              />
            )}
            {/* A-12: "Fora da parede" ou "Fora da área útil" em pill abaixo da foto, alinhada à direita. */}
            {a.fora && (
              <Pill
                x={r.x + r.largura + d}
                y={r.y + r.altura + d + 6}
                ancora="fim"
                fundo={CORES_CANVAS.sobreposicao}
                icone
                texto={TEXTO_ALERTA[a.fora]}
              />
            )}
          </Group>
        );
      })}

      {selecionada && <SelecaoDaFoto foto={selecionada} vp={vp} />}
    </>
  );
}

const ALTURA_PILL_PX = 2 * PADDING_PILL_PX + MEDIDAS_CANVAS.fonteMedidaPx * 1.2;

// Placeholder (DESIGN §2.2): ícone imagem-cortada `danger-ink` no centro e o tamanho em mono sobre branco 80%.
function MarcaDoPlaceholder({
  foto,
  r,
}: {
  foto: FotoCena;
  r: { x: number; y: number; largura: number; altura: number };
}) {
  const texto = formatarTamanho(foto.tamanho);
  const largura = larguraDoPill(texto, false);
  const cx = r.x + r.largura / 2;
  const cy = r.y + r.altura / 2;
  return (
    <Group listening={false}>
      <IconeImagemCortada x={cx} y={cy - 12} cor={CORES_CANVAS.placeholderTexto} />
      <Label x={cx - largura / 2} y={cy + 4}>
        <Tag fill="rgba(255, 255, 255, 0.8)" cornerRadius={4} />
        <Text
          text={texto}
          fontFamily={FONTE_MONO}
          fontSize={MEDIDAS_CANVAS.fonteMedidaPx}
          fill={CORES_CANVAS.placeholderTexto}
          padding={3}
        />
      </Label>
    </Group>
  );
}

// A-16: retângulo `sand` (desenhado na cena), ícone e o texto "Imagem indisponível" em `ink-3`.
function MarcaDeImagemIndisponivel({ r }: { r: { x: number; y: number; largura: number; altura: number } }) {
  const cx = r.x + r.largura / 2;
  const cy = r.y + r.altura / 2;
  return (
    <Group listening={false}>
      <IconeImagemCortada x={cx} y={cy - 14} cor={CORES_CANVAS.textoSemImagem} />
      <Text
        x={r.x}
        y={cy + 4}
        width={r.largura}
        align="center"
        text="Imagem indisponível"
        fontFamily="'Instrument Sans', system-ui, sans-serif"
        fontSize={11}
        fill={CORES_CANVAS.textoSemImagem}
        wrap="word"
        ellipsis
        height={32}
      />
    </Group>
  );
}

function IconeImagemCortada({ x, y, cor }: { x: number; y: number; cor: string }) {
  return (
    <Path
      x={x - 9}
      y={y}
      data="M2 2H14L16 4V14H2Z M2 12L6 8L10 12 M12 6.5A1 1 0 1 0 12.01 6.5 M0 0L18 16"
      stroke={cor}
      strokeWidth={1.4}
      lineCap="round"
      lineJoin="round"
    />
  );
}

function SelecaoDaFoto({ foto, vp }: { foto: FotoCena; vp: Viewport }) {
  const caixa = retanguloExterno(foto);
  const topo = aTela(vp, { x: caixa.xCm, y: caixa.yCm });
  const largura = caixa.larguraCm * vp.escala;
  const altura = caixa.alturaCm * vp.escala;
  const d = MEDIDAS_CANVAS.offsetSelecaoPx;
  const lado = MEDIDAS_CANVAS.alcaSelecaoPx;
  const cantos: Pt[] = [
    { x: topo.x - d, y: topo.y - d },
    { x: topo.x + largura + d, y: topo.y - d },
    { x: topo.x - d, y: topo.y + altura + d },
    { x: topo.x + largura + d, y: topo.y + altura + d },
  ];
  return (
    <Group listening={false}>
      <Rect
        x={topo.x - d}
        y={topo.y - d}
        width={largura + 2 * d}
        height={altura + 2 * d}
        stroke={CORES_CANVAS.selecao}
        strokeWidth={MEDIDAS_CANVAS.bordaSelecaoPx}
      />
      {cantos.map((c, i) => (
        <Rect
          key={i}
          x={c.x - lado / 2}
          y={c.y - lado / 2}
          width={lado}
          height={lado}
          cornerRadius={MEDIDAS_CANVAS.raioAlcaPx}
          fill={CORES_CANVAS.alcaSelecao}
          stroke={CORES_CANVAS.selecao}
          strokeWidth={MEDIDAS_CANVAS.bordaAlcaPx}
        />
      ))}
      <Pill
        x={topo.x - d}
        y={topo.y + altura + d + 8}
        fundo={CORES_CANVAS.pillMedida}
        texto={formatarDimensao(caixa.larguraCm, caixa.alturaCm)}
      />
    </Group>
  );
}

// Modo de recorte: medida do quadro e o ícone de mover no centro (protótipo 16).
export function SobreposicaoRecorte({ cena, vp }: { cena: CenaRecorte; vp: Viewport }) {
  const { foto, tamanho } = cena.recorte;
  const b = foto.borda.larguraCm;
  const topo = aTela(vp, { x: foto.xCm + b, y: foto.yCm + b });
  const largura = tamanho.larguraCm * vp.escala;
  const altura = tamanho.alturaCm * vp.escala;
  return (
    <Group listening={false}>
      <Group x={topo.x + largura / 2} y={topo.y + altura / 2}>
        <Circle radius={16} fill="rgba(31, 27, 22, 0.6)" />
        <Path
          data="M0 -9V9M0 -9L-3 -6M0 -9L3 -6M0 9L-3 6M0 9L3 6M-9 0H9M-9 0L-6 -3M-9 0L-6 3M9 0L6 -3M9 0L6 3"
          stroke="#FFFFFF"
          strokeWidth={1.6}
          lineCap="round"
          lineJoin="round"
        />
      </Group>
      <Pill
        x={topo.x}
        y={topo.y + altura + 10}
        fundo={CORES_CANVAS.pillMedida}
        texto={formatarDimensao(tamanho.larguraCm, tamanho.alturaCm)}
      />
    </Group>
  );
}
