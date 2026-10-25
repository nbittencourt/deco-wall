import {
  calcularAlertas,
  caixaDaComposicao,
  caixaExterna,
  deslocarRecorte,
  encaixarPosicao,
  formatarDimensao,
  recorteCover,
  tamanhoExterno,
  type AlertasDaFoto,
  type AreaUtil,
  type Grid,
  type Pt,
  type Viewport,
} from '@deco-wall/domain';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useMemo, useRef } from 'react';
import { Circle, Group, Image as KonvaImage, Label, Line, Path, Rect, Shape, Tag, Text } from 'react-konva';
import type { CenaParede, CenaRecorte, FotoCena } from './cena';
import { CORES_CANVAS, MEDIDAS_CANVAS } from './theme';
import { useImagem } from './useImagem';

// Fotos no Konva (docs/specs/M2-biblioteca-e-composicao.md §3.3, §3.5; DESIGN §2.2). Duas partes, como no
// Palco: a cena em cm (as fotos e o modo de recorte) e a sobreposição em px de tela (seleção, alertas,
// bounding box), que mantém o tamanho dos traços e rótulos em qualquer zoom.

const FONTE_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const CONTORNO_BORDA = 'rgba(31, 27, 22, 0.18)';

// Posição da foto enquanto é arrastada (ainda não está na store — B-03).
export interface Arrasto {
  id: string;
  xCm: number;
  yCm: number;
}

const aTela = (vp: Viewport, p: Pt): Pt => ({ x: p.x * vp.escala + vp.x, y: p.y * vp.escala + vp.y });

function definirCursor(evento: KonvaEventObject<MouseEvent>, cursor: string) {
  const palco = evento.target.getStage()?.container();
  if (palco) palco.style.cursor = cursor;
}

function comArrasto(fotos: readonly FotoCena[], arrasto: Arrasto | null): FotoCena[] {
  if (!arrasto) return [...fotos];
  return fotos.map((f) => (f.id === arrasto.id ? { ...f, xCm: arrasto.xCm, yCm: arrasto.yCm } : f));
}

// ---- cena (cm) ----

function FotoNode({
  foto,
  interativa,
  grid,
  onSelecionar,
  onArrasto,
  onSoltar,
  onAbrirRecorte,
}: {
  foto: FotoCena;
  interativa: boolean;
  grid: Grid | null;
  onSelecionar?: (id: string) => void;
  onArrasto: (arrasto: Arrasto) => void;
  onSoltar: (arrasto: Arrasto) => void;
  onAbrirRecorte?: (id: string) => void;
}) {
  const imagem = useImagem(foto.imagem?.url ?? null);
  const externo = tamanhoExterno(foto);
  const borda = foto.borda.larguraCm;
  const recorte =
    imagem && foto.imagem
      ? recorteCover(
          { larguraPx: foto.imagem.larguraPx, alturaPx: foto.imagem.alturaPx },
          foto.tamanho,
          foto.recorte,
        )
      : null;

  // M2-04, B-02: o canto superior esquerdo externo é encaixado no grid; o Konva move o nó, a store só
  // recebe a posição final no `dragend`.
  const posicaoDoNo = (no: Konva.Node): Pt => {
    const bruta = { x: no.x(), y: no.y() };
    return grid?.snap ? encaixarPosicao(bruta, grid.passoCm) : bruta;
  };

  return (
    <Group
      name="foto"
      x={foto.xCm}
      y={foto.yCm}
      listening={interativa}
      draggable={interativa}
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
}: {
  cena: CenaParede | CenaRecorte;
  // A foto que está no modo de recorte é desenhada à parte.
  ocultaId?: string;
  onArrasto: (arrasto: Arrasto) => void;
  onSoltar: (arrasto: Arrasto) => void;
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
            onSelecionar={cena.onSelecionar}
            onArrasto={onArrasto}
            onSoltar={(a) => {
              onSoltar(a);
              cena.onMoverFoto?.(a.id, a.xCm, a.yCm);
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
    const r = recorteCover(medidas!, tamanho, o);
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
            const novo = deslocarRecorte(medidas, tamanho, base.offset, {
              x: e.target.x() - base.x,
              y: e.target.y() - base.y,
            });
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
const PADDING_PILL_PX = 8;
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
        paddingLeft={PADDING_PILL_PX}
        paddingRight={PADDING_PILL_PX}
        paddingTop={3}
        paddingBottom={3}
      />
      {icone && (
        <>
          <Circle x={14} y={9.5} radius={4.5} stroke="#FFFFFF" strokeWidth={1.2} />
          <Line points={[14, 7.5, 14, 10.2]} stroke="#FFFFFF" strokeWidth={1.2} lineCap="round" />
          <Circle x={14} y={12} radius={0.6} fill="#FFFFFF" />
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

function textosDoAlerta(alertas: AlertasDaFoto): string[] {
  const textos: string[] = [];
  if (alertas.fora) textos.push(TEXTO_ALERTA[alertas.fora]);
  if (alertas.sobreposicao) textos.push(TEXTO_ALERTA.sobreposicao);
  return textos;
}

// Seleção, alertas e bounding box das fotos do editor (spec M2 §3.3).
export function SobreposicaoFotos({
  cena,
  vp,
  arrasto,
}: {
  cena: CenaParede;
  vp: Viewport;
  arrasto: Arrasto | null;
}) {
  const fotos = useMemo(() => comArrasto(cena.fotos, arrasto), [cena.fotos, arrasto]);
  const alertas = useMemo(
    () =>
      calcularAlertas(
        fotos.map((f) => ({ _id: f.id, xCm: f.xCm, yCm: f.yCm, tamanho: f.tamanho, borda: f.borda })),
        cena.paredeInteira,
        cena.areaUtil,
      ),
    [fotos, cena.paredeInteira, cena.areaUtil],
  );
  if (!cena.comEscala) return null;

  const emTela = (caixa: AreaUtil) => {
    const topo = aTela(vp, { x: caixa.xCm, y: caixa.yCm });
    return { x: topo.x, y: topo.y, largura: caixa.larguraCm * vp.escala, altura: caixa.alturaCm * vp.escala };
  };

  const caixaGeral = fotos.length >= 2 ? caixaDaComposicao(fotos) : null;
  const geral = caixaGeral ? emTela(caixaGeral) : null;
  const folga = MEDIDAS_CANVAS.folgaBoundingBoxPx;
  const selecionada = fotos.find((f) => f.id === cena.selecaoId);

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
        const textos = textosDoAlerta(alertas.get(foto.id) ?? { sobreposicao: false, fora: null });
        if (textos.length === 0) return null;
        const r = emTela(caixaExterna(foto));
        const d = MEDIDAS_CANVAS.offsetSobreposicaoPx;
        let x = r.x;
        return (
          <Group key={foto.id} listening={false}>
            <Rect
              x={r.x - d}
              y={r.y - d}
              width={r.largura + 2 * d}
              height={r.altura + 2 * d}
              stroke={CORES_CANVAS.sobreposicao}
              strokeWidth={MEDIDAS_CANVAS.bordaSobreposicaoPx}
              dash={[6, 4]}
            />
            {textos.map((texto) => {
              const pill = (
                <Pill
                  key={texto}
                  x={x}
                  y={r.y - d - 24}
                  fundo={CORES_CANVAS.sobreposicao}
                  icone
                  texto={texto}
                />
              );
              x += larguraDoPill(texto, true) + 6;
              return pill;
            })}
          </Group>
        );
      })}

      {selecionada && <SelecaoDaFoto foto={selecionada} vp={vp} />}
    </>
  );
}

function SelecaoDaFoto({ foto, vp }: { foto: FotoCena; vp: Viewport }) {
  const caixa = caixaExterna(foto);
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
