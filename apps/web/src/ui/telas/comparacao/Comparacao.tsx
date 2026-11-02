import { boundingBox, formatarDimensao, ZOOM } from '@deco-wall/domain';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { caminhoDoProjeto } from '../../../app/navegacao';
import { useEditor, useStoreEditor } from '../../../app/StoreContext';
import { Palco } from '../../canvas/Palco';
import type { PalcoApi, ViewportCompartilhado } from '../../canvas/cena';
import { ComDica } from '../../componentes/proprios/ComDica';
import { Badge } from '../../componentes/ui/badge';
import { Button } from '../../componentes/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../componentes/ui/select';
import { Switch } from '../../componentes/ui/switch';
import { cenaDaParede, dadosDaParede } from '../editor/cenas';

// Comparação lado a lado (RF-92, ADR-12, M3-10, A-16, A-17, A-26; protótipo 06; spec M3 §3.9): duas variantes
// em memória, só para leitura, com zoom e pan sempre sincronizados (um viewport só, em cm, para os dois palcos).

const PASSO_ZOOM = 1.25;

type Lado = 'esquerdo' | 'direito';

export function Comparacao({ navegar }: { navegar: (caminho: string) => void }) {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const lista = useEditor((s) => s.documento.lista);
  const ativa = useEditor((s) => s.documento.variante);
  const sujo = useEditor((s) => s.documento.sujo);
  const imagens = useEditor((s) => s.biblioteca.imagens);

  // M3-10: a ativa à esquerda e a seguinte na ordem à direita (a anterior, se a ativa for a última).
  const [par, setPar] = useState<[string, string] | null>(() => {
    const i = lista.findIndex((item) => item._id === ativa?._id);
    const outra = lista[i + 1] ?? lista[i - 1];
    return i >= 0 && outra ? [lista[i]!._id, outra._id] : null;
  });
  const [mostrar, setMostrar] = useState({ grid: false, areaUtil: false, alertas: false });
  const [viewport, setViewport] = useState<ViewportCompartilhado | null>(null);
  const esquerdo = useRef<PalcoApi>(null);
  const direito = useRef<PalcoApi>(null);

  const voltar = () => navegar(caminhoDoProjeto(projeto._id));

  // Menos de 2 variantes (ou sem par): não há o que comparar, volta ao editor.
  const semPar = par === null;
  useEffect(() => {
    if (semPar) navegar(caminhoDoProjeto(projeto._id));
  }, [semPar, navegar, projeto._id]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented || evento.key !== 'Escape') return;
      if (document.querySelector('[role="listbox"], [role="menu"], [role="dialog"]')) return;
      navegar(caminhoDoProjeto(projeto._id));
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [navegar, projeto._id]);

  if (!par) return null;
  const dados = dadosDaParede(projeto);
  const base = dados.pxPorCm ?? 1;
  const percentual = viewport ? Math.round((viewport.escala / base) * 100) : 100;

  // Escolher no seletor a variante que está no outro lado troca os lados (M3-10).
  const escolher = (lado: Lado, id: string) => {
    const [esq, dir] = par;
    if (lado === 'esquerdo') setPar(id === dir ? [dir, esq] : [id, dir]);
    else setPar(id === esq ? [dir, esq] : [esq, id]);
  };

  const zoom = (fator: number) =>
    setViewport((atual) =>
      atual
        ? { ...atual, escala: Math.min(Math.max(atual.escala * fator, base * ZOOM.min), base * ZOOM.max) }
        : atual,
    );

  const painel = (lado: Lado, id: string, palco: React.RefObject<PalcoApi | null>) => {
    const visao = store.getState().visaoDaVariante(id);
    if (!visao) return null;
    const cenaBase = cenaDaParede(
      projeto,
      { grid: visao.grid, fotos: visao.conteudo.fotos, areaUtil: visao.conteudo.areaUtil },
      imagens,
      { interativa: false, mostrarAreaTotal: false },
    );
    const cena = {
      ...cenaBase,
      grid: mostrar.grid ? cenaBase.grid : null,
      areaUtil: mostrar.areaUtil ? cenaBase.areaUtil : null,
      mostrarAlertas: mostrar.alertas,
    };
    const caixa = boundingBox(visao.conteudo.fotos);
    const rotuloLado = lado === 'esquerdo' ? 'Variante do painel esquerdo' : 'Variante do painel direito';
    return (
      <section
        aria-label={`Painel ${lado}`}
        className="flex min-w-0 flex-1 flex-col border-line-soft first:border-r"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-4">
          <Select value={id} onValueChange={(novo) => escolher(lado, novo)}>
            <SelectTrigger
              aria-label={rotuloLado}
              className="h-9 w-auto max-w-[260px] gap-2 font-serif text-[17px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lista.map((item) => (
                <SelectItem key={item._id} value={item._id}>
                  {item._id === ativa?._id && sujo ? `${item.nome} · não salva` : item.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {visao.naoSalva && (
            <span
              role="img"
              aria-label="Alterações não salvas"
              className="size-[7px] shrink-0 rounded-full bg-warning-dot"
            />
          )}
          <span className="text-body-sm text-ink-2">
            {visao.conteudo.fotos.length} {visao.conteudo.fotos.length === 1 ? 'foto' : 'fotos'}
          </span>
          <span className="flex-1" />
          <span className="font-mono text-medida text-ink-2">
            {caixa ? formatarDimensao(caixa.larguraCm, caixa.alturaCm) : '—'}
          </span>
        </div>
        <div className="relative min-h-0 flex-1 bg-stage">
          <Palco ref={palco} cena={cena} viewport={viewport} onViewport={setViewport} />
        </div>
      </section>
    );
  };

  const chave = (rotulo: string, campo: keyof typeof mostrar) => (
    <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink-2">
      {rotulo}
      <Switch
        aria-label={rotulo}
        checked={mostrar[campo]}
        onCheckedChange={(ligado) => setMostrar((atual) => ({ ...atual, [campo]: ligado }))}
      />
    </label>
  );

  return (
    <div className="flex h-dvh min-w-[1280px] flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line-soft bg-surface px-3 whitespace-nowrap">
        <Button variant="ghost" onClick={voltar}>
          <ArrowLeft aria-hidden="true" />
          Voltar ao editor
        </Button>
        <span className="text-display-sm text-[18px] text-ink">Comparar variantes</span>
        <Badge variant="neutro">Somente visualização</Badge>
        {/* Abaixo de 1440 px a frase não cabe junto das chaves e do zoom. */}
        <span className="hidden text-body-sm text-ink-3 min-[1440px]:inline">
          Zoom e posição iguais nos dois lados
        </span>
        <span className="flex-1" />
        {chave('Grid', 'grid')}
        {chave('Área útil', 'areaUtil')}
        {chave('Alertas', 'alertas')}
        <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-line" />
        <ComDica texto="Menos zoom">
          <Button size="icon" variant="ghost" aria-label="Menos zoom" onClick={() => zoom(1 / PASSO_ZOOM)}>
            <Minus aria-hidden="true" />
          </Button>
        </ComDica>
        <span className="min-w-12 text-center font-mono text-medida text-ink-2">{percentual}%</span>
        <ComDica texto="Mais zoom">
          <Button size="icon" variant="ghost" aria-label="Mais zoom" onClick={() => zoom(PASSO_ZOOM)}>
            <Plus aria-hidden="true" />
          </Button>
        </ComDica>
        <Button
          variant="outline"
          onClick={() => {
            esquerdo.current?.ajustar();
            direito.current?.ajustar();
          }}
        >
          Parede inteira
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {painel('esquerdo', par[0], esquerdo)}
        {painel('direito', par[1], direito)}
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-line-soft bg-surface px-4">
        <span className="text-body-sm text-ink-2">Arraste para mover · Roda para zoom</span>
        <span className="flex-1" />
        <span className="text-xs text-ink-3">Medidas aproximadas, parede considerada plana</span>
      </footer>
    </div>
  );
}
