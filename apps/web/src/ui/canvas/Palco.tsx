import {
  ajustarATela,
  formatarDimensao,
  gridVisivelNoZoom,
  limitarZoom,
  linhasVisiveis,
  moverAreaUtil,
  redimensionarAreaUtil,
  SEGMENTO_MIN_PX,
  ZOOM,
  type AlcaAreaUtil,
  type AreaUtil,
  type Grid,
  type Pt,
  type Viewport,
  zoomNoPonto,
} from '@deco-wall/domain';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Label,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Tag,
  Text,
} from 'react-konva';
import type {
  Cena,
  CenaAreaUtil,
  CenaCalibracao,
  CenaParede,
  CenaPerspectiva,
  EstadoPalco,
  PalcoApi,
  RetanguloConteudo,
} from './cena';
import { CORES_CANVAS, MEDIDAS_CANVAS } from './theme';
import { useImagem } from './useImagem';

// Palco: único módulo que fala com o Konva (ADR-02). Duas camadas: a cena em unidades do conteúdo
// (cm ou px da foto), com zoom e pan; e a sobreposição em px de tela (alças, rótulos, lupa), para que
// os controles tenham sempre o mesmo tamanho na tela, qualquer que seja o zoom.

// Só o botão esquerdo arrasta nós (alças, interior da área): o do meio fica livre para o pan (A-06).
Konva.dragButtons = [0];

const MARGEM_AJUSTE_PX = 24;
const PASSO_BOTAO = 1.25;
const FONTE_MONO = "'IBM Plex Mono', ui-monospace, monospace";

// Contrato de teste (spec M1 §3.9): converte um ponto do conteúdo atual em coordenadas da página, para o
// Playwright arrastar alças que não existem no DOM.
declare global {
  interface Window {
    __deco?: { paraTela: (x: number, y: number) => { x: number; y: number } };
  }
}

export interface PropsPalco {
  cena: Cena;
  onEstado?: (estado: EstadoPalco) => void;
  ref?: Ref<PalcoApi>;
}

const aTela = (vp: Viewport, p: Pt): Pt => ({ x: p.x * vp.escala + vp.x, y: p.y * vp.escala + vp.y });
const deTela = (vp: Viewport, p: Pt): Pt => ({ x: (p.x - vp.x) / vp.escala, y: (p.y - vp.y) / vp.escala });

function conteudoDe(cena: Cena): RetanguloConteudo {
  if (cena.tipo === 'perspectiva' || cena.tipo === 'calibracao') {
    return { x: 0, y: 0, largura: cena.larguraPx, altura: cena.alturaPx };
  }
  return cena.imagem;
}

const pxPorUnidadeDe = (cena: Cena) =>
  cena.tipo === 'perspectiva' || cena.tipo === 'calibracao' ? 1 : cena.pxPorUnidade;

export function Palco({ cena, onEstado, ref }: PropsPalco) {
  const caixa = useRef<HTMLDivElement>(null);
  const [tela, setTela] = useState({ largura: 0, altura: 0 });
  const [vp, setVp] = useState<Viewport | null>(null);
  const vpAtual = useRef<Viewport | null>(null);
  const ajuste = useRef<Viewport | null>(null);
  const chaveAjustada = useRef<string | null>(null);
  const pan = useRef<{ x: number; y: number; vp: Viewport } | null>(null);
  // Espaço segurado: a cena deixa de receber o mouse e qualquer arrasto vira pan (A-06).
  const [espaco, setEspaco] = useState(false);
  const cenaAtual = useRef(cena);
  const ultimoEstado = useRef<EstadoPalco | null>(null);

  useEffect(() => {
    vpAtual.current = vp;
    cenaAtual.current = cena;
  });

  // Tamanho do contêiner.
  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return undefined;
    const medir = () => setTela({ largura: elemento.clientWidth, altura: elemento.clientHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  // Enquadramento inicial ("Ajustar à tela"): a cada nova cena (chave) e na primeira medição.
  useEffect(() => {
    if (tela.largura === 0 || tela.altura === 0) return;
    if (chaveAjustada.current === cena.chave) return;
    chaveAjustada.current = cena.chave;
    const inicial = ajustarATela(conteudoDe(cenaAtual.current), tela, MARGEM_AJUSTE_PX);
    ajuste.current = inicial;
    setVp(inicial);
  }, [cena.chave, tela]);

  const limitesEscala = () => {
    const base = pxPorUnidadeDe(cenaAtual.current);
    const razaoAjuste = (ajuste.current?.escala ?? base) / base;
    return { min: limitarZoom(0, razaoAjuste) * base, max: ZOOM.max * base };
  };

  const dar = (fator: number, ponto?: Pt) => {
    const atual = vpAtual.current;
    if (!atual) return;
    const centro = ponto ?? { x: tela.largura / 2, y: tela.altura / 2 };
    setVp(zoomNoPonto(atual, fator, centro, limitesEscala()));
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomMais: () => dar(PASSO_BOTAO),
      zoomMenos: () => dar(1 / PASSO_BOTAO),
      ajustar: () => {
        const novo = ajustarATela(conteudoDe(cenaAtual.current), tela, MARGEM_AJUSTE_PX);
        ajuste.current = novo;
        setVp(novo);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dar` lê tudo de refs e do tamanho da tela
    [tela],
  );

  // Estado exibido na toolbar do editor (porcentagem de zoom) e no header (grid oculto neste zoom).
  useEffect(() => {
    if (!vp) return;
    const base = pxPorUnidadeDe(cena);
    // Só a parede com escala tem grid (`grid` é null sem escala).
    const grid = cena.tipo === 'parede' || cena.tipo === 'area-util' ? cena.grid : null;
    const estado: EstadoPalco = {
      zoomPercentual: Math.round((vp.escala / base) * 100),
      gridOculto: Boolean(grid?.visivel && !gridVisivelNoZoom(grid.passoCm, vp.escala)),
    };
    // Só avisa quando algo mudou: a cena é recriada a cada render da tela.
    const ultimo = ultimoEstado.current;
    if (ultimo && ultimo.zoomPercentual === estado.zoomPercentual && ultimo.gridOculto === estado.gridOculto)
      return;
    ultimoEstado.current = estado;
    onEstado?.(estado);
  }, [vp, cena, onEstado]);

  // Gancho de teste (ver `declare global`). Só existe com o enquadramento pronto: antes disso a conversão
  // não tem o que usar.
  const pronto = vp !== null;
  useEffect(() => {
    if (!pronto) return undefined;
    window.__deco = {
      paraTela: (x, y) => {
        const retangulo = caixa.current?.getBoundingClientRect();
        const atual = vpAtual.current;
        if (!retangulo || !atual) return { x: Number.NaN, y: Number.NaN };
        return {
          x: retangulo.left + x * atual.escala + atual.x,
          y: retangulo.top + y * atual.escala + atual.y,
        };
      },
    };
    return () => {
      delete window.__deco;
    };
  }, [pronto]);

  // Pan (A-06): arrastar o fundo ou a imagem, com o botão esquerdo; o botão do meio e Espaço + arrastar
  // movem a vista mesmo sobre as alças e a área útil, que ocupam a parede inteira por padrão.
  useEffect(() => {
    const mover = (evento: MouseEvent) => {
      const inicio = pan.current;
      if (!inicio) return;
      setVp({
        ...inicio.vp,
        x: inicio.vp.x + evento.clientX - inicio.x,
        y: inicio.vp.y + evento.clientY - inicio.y,
      });
    };
    const soltar = () => {
      pan.current = null;
    };
    const digitando = (alvo: EventTarget | null) => {
      const elemento = alvo as HTMLElement | null;
      return Boolean(
        elemento &&
        (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(elemento.tagName) || elemento.isContentEditable),
      );
    };
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.code !== 'Space' || digitando(evento.target)) return;
      evento.preventDefault();
      setEspaco(true);
    };
    const aoSoltarTecla = (evento: KeyboardEvent) => {
      if (evento.code === 'Space') setEspaco(false);
    };
    const aoPerderFoco = () => setEspaco(false);
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
    window.addEventListener('keydown', aoPressionarTecla);
    window.addEventListener('keyup', aoSoltarTecla);
    window.addEventListener('blur', aoPerderFoco);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
      window.removeEventListener('keydown', aoPressionarTecla);
      window.removeEventListener('keyup', aoSoltarTecla);
      window.removeEventListener('blur', aoPerderFoco);
    };
  }, []);

  const aoPressionar = (evento: KonvaEventObject<MouseEvent>) => {
    const alvo = evento.target;
    const noFundo = alvo === alvo.getStage() || alvo.hasName('pan');
    const botao = evento.evt.button;
    // Com Espaço as camadas não escutam: o alvo é o próprio palco e o botão esquerdo também vale.
    const permitido = botao === 1 || (botao === 0 && (noFundo || espaco));
    if (!permitido || !vpAtual.current) return;
    if (botao === 1) evento.evt.preventDefault(); // sem o "autoscroll" do botão do meio
    pan.current = { x: evento.evt.clientX, y: evento.evt.clientY, vp: vpAtual.current };
  };

  const aoRolar = (evento: KonvaEventObject<WheelEvent>) => {
    evento.evt.preventDefault();
    const ponteiro = evento.target.getStage()?.getPointerPosition();
    if (!ponteiro) return;
    dar(evento.evt.deltaY < 0 ? ZOOM.passo : 1 / ZOOM.passo, ponteiro);
  };

  return (
    <div
      ref={caixa}
      data-testid="palco"
      className={`relative size-full overflow-hidden ${espaco ? 'cursor-grab' : ''}`}
    >
      {vp && tela.largura > 0 && tela.altura > 0 && (
        <Stage width={tela.largura} height={tela.altura} onMouseDown={aoPressionar} onWheel={aoRolar}>
          <Layer x={vp.x} y={vp.y} scaleX={vp.escala} scaleY={vp.escala} listening={!espaco}>
            <CamadaCena cena={cena} vp={vp} tela={tela} />
          </Layer>
          <Layer listening={!espaco}>
            <Sobreposicao cena={cena} vp={vp} tela={tela} />
          </Layer>
        </Stage>
      )}
    </div>
  );
}

// ---- cena (unidades do conteúdo) ----

function CamadaCena({
  cena,
  vp,
  tela,
}: {
  cena: Cena;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  if (cena.tipo === 'perspectiva' || cena.tipo === 'calibracao') {
    return (
      <ImagemDaCena
        url={cena.imagemUrl}
        retangulo={{ x: 0, y: 0, largura: cena.larguraPx, altura: cena.alturaPx }}
      />
    );
  }
  return <CamadaParede cena={cena} vp={vp} tela={tela} />;
}

function ImagemDaCena({ url, retangulo }: { url: string; retangulo: RetanguloConteudo }) {
  const imagem = useImagem(url);
  if (!imagem) return null;
  return (
    <KonvaImage
      name="pan"
      image={imagem}
      x={retangulo.x}
      y={retangulo.y}
      width={retangulo.largura}
      height={retangulo.altura}
    />
  );
}

function CamadaParede({
  cena,
  vp,
  tela,
}: {
  cena: CenaParede | CenaAreaUtil;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  const noModoArea = cena.tipo === 'area-util';
  // No modo Área útil vale a área em edição; no editor, a salva na variante.
  const area = noModoArea ? cena.area : cena.areaUtil;
  const parede = cena.paredeInteira;

  return (
    <>
      <ImagemDaCena url={cena.imagemUrl} retangulo={cena.imagem} />
      {cena.comEscala && cena.grid?.visivel && parede && (
        <GradeDoGrid grid={cena.grid} parede={parede} vp={vp} tela={tela} />
      )}
      {cena.comEscala && parede && area && (
        <>
          <Shape
            listening={false}
            fill={noModoArea ? CORES_CANVAS.exteriorAreaUtilModo : CORES_CANVAS.exteriorAreaUtilEditor}
            fillRule="evenodd"
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              ctx.rect(parede.xCm, parede.yCm, parede.larguraCm, parede.alturaCm);
              ctx.rect(area.xCm, area.yCm, area.larguraCm, area.alturaCm);
              ctx.closePath();
              ctx.fillShape(forma);
            }}
          />
          <Rect
            listening={false}
            x={area.xCm}
            y={area.yCm}
            width={area.larguraCm}
            height={area.alturaCm}
            stroke={CORES_CANVAS.areaUtil}
            strokeWidth={MEDIDAS_CANVAS.bordaAreaUtilPx}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        </>
      )}
      {noModoArea && parede && <InteriorArrastavel cena={cena} parede={parede} />}
    </>
  );
}

function GradeDoGrid({
  grid,
  parede,
  vp,
  tela,
}: {
  grid: Grid;
  parede: AreaUtil;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  const janela: AreaUtil = {
    xCm: -vp.x / vp.escala,
    yCm: -vp.y / vp.escala,
    larguraCm: tela.largura / vp.escala,
    alturaCm: tela.altura / vp.escala,
  };
  const { xs, ys } = linhasVisiveis({
    passoCm: grid.passoCm,
    limitesCm: parede,
    janelaCm: janela,
    pxPorCmTela: vp.escala,
  });
  if (xs.length === 0 && ys.length === 0) return null;

  const x0 = Math.max(parede.xCm, janela.xCm);
  const x1 = Math.min(parede.xCm + parede.larguraCm, janela.xCm + janela.larguraCm);
  const y0 = Math.max(parede.yCm, janela.yCm);
  const y1 = Math.min(parede.yCm + parede.alturaCm, janela.yCm + janela.alturaCm);

  return (
    <Shape
      listening={false}
      stroke={grid.cor}
      opacity={grid.opacidade}
      strokeWidth={1}
      strokeScaleEnabled={false}
      sceneFunc={(ctx, forma) => {
        ctx.beginPath();
        for (const x of xs) {
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
        }
        for (const y of ys) {
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
        }
        ctx.strokeShape(forma);
      }}
    />
  );
}

// Arrastar o interior da área move o retângulo (M1-07: livre a 0,1 cm, sem snap).
function InteriorArrastavel({ cena, parede }: { cena: CenaAreaUtil; parede: AreaUtil }) {
  const inicio = useRef<{ area: AreaUtil } | null>(null);
  const { area } = cena;
  return (
    <Rect
      name="interior"
      x={area.xCm}
      y={area.yCm}
      width={area.larguraCm}
      height={area.alturaCm}
      fill="rgba(0,0,0,0.001)"
      draggable
      onMouseEnter={(e) => definirCursor(e, 'move')}
      onMouseLeave={(e) => definirCursor(e, '')}
      onDragStart={() => {
        inicio.current = { area };
      }}
      onDragMove={(e) => {
        const base = inicio.current?.area ?? area;
        const no = e.target;
        const nova = moverAreaUtil(base, { x: no.x() - base.xCm, y: no.y() - base.yCm }, parede);
        no.position({ x: nova.xCm, y: nova.yCm });
        cena.onAreaChange(nova);
      }}
    />
  );
}

function definirCursor(evento: KonvaEventObject<MouseEvent>, cursor: string) {
  const palco = evento.target.getStage()?.container();
  if (palco) palco.style.cursor = cursor;
}

// ---- sobreposição (px de tela) ----

function Sobreposicao({
  cena,
  vp,
  tela,
}: {
  cena: Cena;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  switch (cena.tipo) {
    case 'perspectiva':
      return <AlcasPerspectiva cena={cena} vp={vp} tela={tela} />;
    case 'calibracao':
      return <AlcasCalibracao cena={cena} vp={vp} tela={tela} />;
    case 'area-util':
      return (
        <>
          <RotulosDaParede cena={cena} vp={vp} />
          <AlcasAreaUtil cena={cena} vp={vp} />
        </>
      );
    default:
      return <RotulosDaParede cena={cena} vp={vp} />;
  }
}

function RotulosDaParede({ cena, vp }: { cena: CenaParede | CenaAreaUtil; vp: Viewport }) {
  if (!cena.comEscala) return null;
  const origem = aTela(vp, { x: 0, y: 0 });
  const area = cena.tipo === 'area-util' ? cena.area : cena.areaUtil;
  const canto = area ? aTela(vp, { x: area.xCm, y: area.yCm }) : null;
  return (
    <>
      <Text
        listening={false}
        x={origem.x + 4}
        y={origem.y + 4}
        text="0,0"
        fontFamily={FONTE_MONO}
        fontSize={MEDIDAS_CANVAS.fonteMedidaPx}
        fill={CORES_CANVAS.origem}
      />
      {area && canto && (
        <Text
          listening={false}
          x={canto.x}
          y={canto.y - 16}
          text={`Área útil · ${formatarDimensao(area.larguraCm, area.alturaCm)}`}
          fontFamily={FONTE_MONO}
          fontSize={MEDIDAS_CANVAS.fonteMedidaPx}
          fill={CORES_CANVAS.areaUtil}
        />
      )}
    </>
  );
}

// 8 alças de 12 px: cantos e meios dos lados.
const ALCAS: { alca: AlcaAreaUtil; fx: number; fy: number; cursor: string }[] = [
  { alca: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { alca: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { alca: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { alca: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { alca: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { alca: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { alca: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { alca: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

function AlcasAreaUtil({ cena, vp }: { cena: CenaAreaUtil; vp: Viewport }) {
  const { area, paredeInteira: parede } = cena;
  if (!parede) return null;
  const lado = MEDIDAS_CANVAS.alcaAreaUtilPx;
  const posicao = (a: AreaUtil, fx: number, fy: number) =>
    aTela(vp, { x: a.xCm + a.larguraCm * fx, y: a.yCm + a.alturaCm * fy });

  return (
    <>
      {ALCAS.map(({ alca, fx, fy, cursor }) => {
        const p = posicao(area, fx, fy);
        return (
          <Rect
            key={alca}
            name={`alca-${alca}`}
            x={p.x}
            y={p.y}
            offsetX={lado / 2}
            offsetY={lado / 2}
            width={lado}
            height={lado}
            fill={CORES_CANVAS.alcaSelecao}
            stroke={CORES_CANVAS.selecao}
            strokeWidth={MEDIDAS_CANVAS.bordaAlcaPx}
            draggable
            hitStrokeWidth={10}
            onMouseEnter={(e) => definirCursor(e, cursor)}
            onMouseLeave={(e) => definirCursor(e, '')}
            onDragMove={(e) => {
              const no = e.target;
              const nova = redimensionarAreaUtil(area, alca, deTela(vp, { x: no.x(), y: no.y() }), parede);
              const destino = posicao(nova, fx, fy);
              no.position(destino);
              cena.onAreaChange(nova);
            }}
          />
        );
      })}
    </>
  );
}

// ---- alças de perspectiva e de calibração ----

function AlcaRedonda({
  posicao,
  ativa,
  numero,
  onMover,
  onIniciar,
  onSoltar,
}: {
  posicao: Pt;
  ativa: boolean;
  numero?: number;
  // Recebe a posição de tela do ponteiro e devolve a posição aceita (já limitada).
  onMover: (tela: Pt) => Pt;
  onIniciar: () => void;
  onSoltar: () => void;
}) {
  return (
    <Group
      x={posicao.x}
      y={posicao.y}
      draggable
      onMouseEnter={(e) => definirCursor(e, 'pointer')}
      onMouseLeave={(e) => definirCursor(e, '')}
      onDragStart={onIniciar}
      onDragMove={(e) => {
        const no = e.target;
        no.position(onMover({ x: no.x(), y: no.y() }));
      }}
      onDragEnd={onSoltar}
    >
      <Circle
        radius={MEDIDAS_CANVAS.alcaPerspectivaPx / 2}
        fill={ativa ? CORES_CANVAS.selecao : '#FFFFFF'}
        stroke={CORES_CANVAS.selecao}
        strokeWidth={MEDIDAS_CANVAS.bordaAlcaPerspectivaPx}
        hitStrokeWidth={14}
      />
      {numero !== undefined && (
        <Label x={11} y={-26} listening={false}>
          <Tag fill={CORES_CANVAS.pillMedida} cornerRadius={9} />
          <Text
            text={String(numero)}
            fontFamily={FONTE_MONO}
            fontSize={11}
            fill={CORES_CANVAS.pillMedidaTexto}
            padding={4}
          />
        </Label>
      )}
    </Group>
  );
}

const noRetangulo = (p: Pt, larguraPx: number, alturaPx: number): Pt => ({
  x: Math.min(Math.max(p.x, 0), larguraPx),
  y: Math.min(Math.max(p.y, 0), alturaPx),
});

// Setas movem a alça ativa 1 px da imagem; com Shift, 10 px (A-10).
function useSetasNaAlcaAtiva(ativa: number | null, mover: (indice: number, dx: number, dy: number) => void) {
  const moverAtual = useRef(mover);
  useEffect(() => {
    moverAtual.current = mover;
  });
  useEffect(() => {
    if (ativa === null) return undefined;
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      const passo = evento.shiftKey ? 10 : 1;
      const deslocamento: Record<string, [number, number]> = {
        ArrowLeft: [-passo, 0],
        ArrowRight: [passo, 0],
        ArrowUp: [0, -passo],
        ArrowDown: [0, passo],
      };
      const d = deslocamento[evento.key];
      if (!d) return;
      evento.preventDefault();
      moverAtual.current(ativa, d[0], d[1]);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [ativa]);
}

function AlcasPerspectiva({
  cena,
  vp,
  tela,
}: {
  cena: CenaPerspectiva;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const imagem = useImagem(cena.imagemUrl);

  useSetasNaAlcaAtiva(ativa, (indice, dx, dy) => {
    const novos = cena.cantos.map((c, i) =>
      i === indice ? noRetangulo({ x: c.x + dx, y: c.y + dy }, cena.larguraPx, cena.alturaPx) : c,
    );
    cena.onCantosChange(novos, true);
  });

  const emTela = cena.cantos.map((c) => aTela(vp, c));
  return (
    <>
      <Line
        listening={false}
        closed
        points={emTela.flatMap((p) => [p.x, p.y])}
        stroke={CORES_CANVAS.selecao}
        strokeWidth={2}
        fill="rgba(181, 83, 47, 0.12)"
      />
      {cena.cantos.map((canto, i) => (
        <AlcaRedonda
          key={i}
          posicao={emTela[i]!}
          ativa={ativa === i}
          numero={i + 1}
          onIniciar={() => {
            setAtiva(i);
            setArrastando(i);
          }}
          onMover={(pontoTela) => {
            const novo = noRetangulo(deTela(vp, pontoTela), cena.larguraPx, cena.alturaPx);
            cena.onCantosChange(
              cena.cantos.map((c, j) => (j === i ? novo : c)),
              false,
            );
            return aTela(vp, novo);
          }}
          onSoltar={() => {
            setArrastando(null);
            cena.onCantosChange(cena.cantos, true);
          }}
        />
      ))}
      {arrastando !== null && imagem && (
        <Lupa
          imagem={imagem}
          centro={cena.cantos[arrastando]!}
          vp={vp}
          tela={tela}
          cursorTela={emTela[arrastando]!}
        />
      )}
    </>
  );
}

function AlcasCalibracao({
  cena,
  vp,
  tela,
}: {
  cena: CenaCalibracao;
  vp: Viewport;
  tela: { largura: number; altura: number };
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const imagem = useImagem(cena.imagemUrl);
  const pontos = [cena.p1, cena.p2];

  // Mantém o segmento com ao menos 20 px da imagem (A-12).
  const aplicar = (indice: number, novo: Pt): boolean => {
    const outro = pontos[1 - indice]!;
    if (Math.hypot(novo.x - outro.x, novo.y - outro.y) < SEGMENTO_MIN_PX) return false;
    if (indice === 0) cena.onSegmentoChange(novo, cena.p2);
    else cena.onSegmentoChange(cena.p1, novo);
    return true;
  };

  useSetasNaAlcaAtiva(ativa, (indice, dx, dy) => {
    const p = pontos[indice]!;
    aplicar(indice, noRetangulo({ x: p.x + dx, y: p.y + dy }, cena.larguraPx, cena.alturaPx));
  });

  const [a, b] = pontos.map((p) => aTela(vp, p)) as [Pt, Pt];
  const comprimentoPx = Math.round(Math.hypot(cena.p2.x - cena.p1.x, cena.p2.y - cena.p1.y));
  return (
    <>
      <Line listening={false} points={[a.x, a.y, b.x, b.y]} stroke={CORES_CANVAS.selecao} strokeWidth={2.5} />
      <Label listening={false} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 28} offsetX={28}>
        <Tag fill={CORES_CANVAS.pillMedida} cornerRadius={9} />
        <Text
          text={`${comprimentoPx} px`}
          fontFamily={FONTE_MONO}
          fontSize={11}
          fill={CORES_CANVAS.pillMedidaTexto}
          padding={5}
        />
      </Label>
      {pontos.map((ponto, i) => (
        <AlcaRedonda
          key={i}
          posicao={aTela(vp, ponto)}
          ativa={ativa === i}
          onIniciar={() => {
            setAtiva(i);
            setArrastando(i);
          }}
          onMover={(pontoTela) => {
            const novo = noRetangulo(deTela(vp, pontoTela), cena.larguraPx, cena.alturaPx);
            return aplicar(i, novo) ? aTela(vp, novo) : aTela(vp, ponto);
          }}
          onSoltar={() => setArrastando(null)}
        />
      ))}
      {arrastando !== null && imagem && (
        <Lupa
          imagem={imagem}
          centro={pontos[arrastando]!}
          vp={vp}
          tela={tela}
          cursorTela={aTela(vp, pontos[arrastando]!)}
        />
      )}
    </>
  );
}

// Lupa de 160 px com zoom 4× (DESIGN §2.2), no canto da tela oposto ao ponto que está sendo arrastado.
function Lupa({
  imagem,
  centro,
  vp,
  tela,
  cursorTela,
}: {
  imagem: HTMLImageElement;
  centro: Pt;
  vp: Viewport;
  tela: { largura: number; altura: number };
  cursorTela: Pt;
}) {
  const diametro = MEDIDAS_CANVAS.lupaPx;
  const raio = diametro / 2;
  const margem = 16;
  const x = cursorTela.x > tela.largura / 2 ? margem : tela.largura - diametro - margem;
  const y = cursorTela.y > tela.altura / 2 ? margem : tela.altura - diametro - margem;
  // 4× a escala da tela, mas nunca menos que 1 px da foto por px da lupa.
  const escala = Math.max(vp.escala * MEDIDAS_CANVAS.lupaZoom, 1);

  return (
    <Group x={x} y={y} listening={false}>
      <Group
        clipFunc={(ctx) => {
          ctx.arc(raio, raio, raio, 0, Math.PI * 2);
        }}
      >
        <KonvaImage
          image={imagem}
          x={raio - centro.x * escala}
          y={raio - centro.y * escala}
          width={imagem.naturalWidth * escala}
          height={imagem.naturalHeight * escala}
        />
        <Line points={[raio - 14, raio, raio + 14, raio]} stroke={CORES_CANVAS.selecao} strokeWidth={1.5} />
        <Line points={[raio, raio - 14, raio, raio + 14]} stroke={CORES_CANVAS.selecao} strokeWidth={1.5} />
      </Group>
      <Circle
        x={raio}
        y={raio}
        radius={raio}
        stroke="#FFFFFF"
        strokeWidth={3}
        shadowColor="rgba(31, 27, 22, 0.5)"
        shadowBlur={14}
      />
    </Group>
  );
}
