import { formatarDimensao, formatarTamanho } from '@deco-wall/domain';
import { ImageOff, Info, TriangleAlert, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { BotaoEmBreve, CampoEmBreve } from '../componentes/proprios/BotaoEmBreve';
import { ChipEscala } from '../componentes/proprios/ChipEscala';
import { Miniatura } from '../componentes/proprios/Miniatura';
import { SeletorCor } from '../componentes/proprios/SeletorCor';
import { StatusSalvamento, type EstadoSalvamento } from '../componentes/proprios/StatusSalvamento';
import { Alert } from '../componentes/ui/alert';
import { Badge } from '../componentes/ui/badge';
import { Button } from '../componentes/ui/button';
import { Input } from '../componentes/ui/input';
import { RadioCard, RadioGroup } from '../componentes/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../componentes/ui/select';
import { Switch } from '../componentes/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../componentes/ui/toggle-group';

// Páginas de referência para validação visual (docs/specs/M0-setup.md §5.4, T6d).
// Pranchas 00 (Identidade) e 17 (Componentes), conforme docs/DESIGN.md §6 e §10.

const CORES: { grupo: string; itens: [string, string][] }[] = [
  {
    grupo: 'Superfícies',
    itens: [
      ['paper', '#F7F4EE'],
      ['surface', '#FFFFFF'],
      ['surface-muted', '#FBF9F5'],
      ['sand', '#EFEAE1'],
      ['stage', '#ECE6DC'],
      ['stage-dark', '#2A2520'],
    ],
  },
  {
    grupo: 'Linhas',
    itens: [
      ['line', '#DDD5C8'],
      ['line-soft', '#E6DFD3'],
      ['line-faint', '#F0EBE3'],
      ['sketch', '#E6DFD3'],
    ],
  },
  {
    grupo: 'Texto',
    itens: [
      ['ink', '#1F1B16'],
      ['ink-2', '#5A5248'],
      ['ink-3', '#6E655A'],
      ['ink-disabled', '#8E8579'],
    ],
  },
  {
    grupo: 'Ação',
    itens: [
      ['accent', '#B5532F'],
      ['accent-hover', '#9A4426'],
      ['accent-ink', '#7A361E'],
      ['accent-tint', '#F3E1D8'],
      ['accent-wash', '#FBF4F0'],
      ['accent-on-dark', '#E8A487'],
    ],
  },
  {
    grupo: 'Alerta',
    itens: [
      ['danger', '#B42318'],
      ['danger-ink', '#9F1D14'],
      ['danger-ink-strong', '#8A1A12'],
      ['danger-tint', '#FBE9E6'],
      ['danger-wash', '#FDF5F3'],
    ],
  },
  {
    grupo: 'Aviso e sinais',
    itens: [
      ['warning-ink', '#6B4A12'],
      ['warning-tint', '#FBF1DE'],
      ['warning-dot', '#B7791F'],
      ['success', '#5E7A44'],
      ['success-ink', '#4A6336'],
    ],
  },
];

function Prancha({ numero, titulo, children }: { numero: string; titulo: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`prancha-${numero}`}
      className="flex flex-col gap-6 rounded-xl bg-surface p-8 shadow-xs"
    >
      <header className="flex flex-col gap-1">
        <span className="text-label uppercase">Prancha {numero}</span>
        <h2 id={`prancha-${numero}`} className="text-display-lg text-ink">
          {titulo}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-label">{titulo}</h3>
      {children}
    </div>
  );
}

function Identidade() {
  return (
    <Prancha numero="00" titulo="Identidade visual">
      <Bloco titulo="Cores">
        <div className="grid gap-5">
          {CORES.map((grupo) => (
            <div key={grupo.grupo} className="flex flex-col gap-2">
              <span className="text-body-sm text-ink-3">{grupo.grupo}</span>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {grupo.itens.map(([nome, hex]) => (
                  <li key={nome} className="flex items-center gap-3 rounded-lg border border-line-soft p-2">
                    <span
                      aria-hidden="true"
                      className="size-9 shrink-0 rounded-md ring-1 ring-line"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="flex flex-col">
                      <span className="text-body-sm text-ink">{nome}</span>
                      <span className="text-medida text-ink-3">{hex}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Tipografia">
        <div className="flex flex-col gap-3">
          <p className="text-display-xl text-ink">Projetos</p>
          <p className="text-display-lg text-ink">Comece pela parede</p>
          <p className="text-display-md text-ink">Composição</p>
          <p className="text-display-sm text-ink">Biblioteca</p>
          <p className="text-body text-ink">Texto padrão da interface, em Instrument Sans.</p>
          <p className="text-body-sm text-ink-2">Descrição e status, 13 px.</p>
          <p className="text-label">Label de campo</p>
          <p className="text-medida text-ink">24,0 × 34,0 cm · 4,0 px/cm</p>
        </div>
      </Bloco>

      <Bloco titulo="Sinais na parede">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative size-24 rounded-sm bg-accent-tint ring-2 ring-accent ring-offset-2 ring-offset-stage" />
          <div className="relative size-24 border-2 border-dashed border-danger bg-danger-tint/60" />
          <div className="relative flex size-24 flex-col items-center justify-center gap-1 border-[1.5px] border-dashed border-danger bg-[repeating-linear-gradient(45deg,rgba(180,35,24,0.2)_0_6px,transparent_6px_12px)] bg-danger-tint text-danger-ink">
            <ImageOff className="size-5" aria-hidden="true" />
            <span className="text-medida">20 × 30</span>
          </div>
          <Badge variant="alerta">Sem foto</Badge>
          <span className="inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-xs text-white">
            <Info className="mr-1 size-3" aria-hidden="true" />
            Fora da parede
          </span>
        </div>
      </Bloco>
    </Prancha>
  );
}

function Componentes() {
  const [orientacao, setOrientacao] = useState('retrato');
  const [formato, setFormato] = useState('jpg');
  const [qualidade, setQualidade] = useState('alta');
  const [tamanho, setTamanho] = useState('20x30');
  const [cor, setCor] = useState('#FFFFFF');
  const [template, setTemplate] = useState('piramide');
  const [estadoPrevia, setEstadoPrevia] = useState<'pronta' | 'desatualizada'>('pronta');
  const [ligado, setLigado] = useState(true);

  const estados: EstadoSalvamento[] = [
    { tipo: 'salvo' },
    { tipo: 'alteracoes' },
    { tipo: 'rascunho', em: new Date('2026-10-12T17:35:00Z') },
    { tipo: 'conflito' },
  ];

  return (
    <Prancha numero="17" titulo="Componentes">
      <Bloco titulo="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Adicionar</Button>
          <Button variant="outline">Salvar</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="destructive">Excluir</Button>
          <Button size="icon" aria-label="Mais ações">
            <Info aria-hidden="true" />
          </Button>
          <BotaoEmBreve variant="outline">Parede</BotaoEmBreve>
        </div>
      </Bloco>

      <Bloco titulo="Segmented control (colunas iguais)">
        <div className="flex flex-wrap items-start gap-4">
          <ToggleGroup
            type="single"
            value={orientacao}
            onValueChange={(v) => v && setOrientacao(v)}
            aria-label="Orientação"
            className="w-[152px]"
          >
            <ToggleGroupItem value="retrato">Retrato</ToggleGroupItem>
            <ToggleGroupItem value="paisagem">Paisagem</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={formato}
            onValueChange={(v) => v && setFormato(v)}
            aria-label="Formato"
            className="w-[160px]"
          >
            <ToggleGroupItem value="jpg">JPG</ToggleGroupItem>
            <ToggleGroupItem value="png">PNG</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={qualidade}
            onValueChange={(v) => v && setQualidade(v)}
            aria-label="Qualidade"
            className="w-[240px]"
          >
            <ToggleGroupItem value="alta">Alta</ToggleGroupItem>
            <ToggleGroupItem value="media">Média</ToggleGroupItem>
            <ToggleGroupItem value="baixa">Baixa</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </Bloco>

      <Bloco titulo="Seletor de tamanho (FMT-02)">
        <Select value={tamanho} onValueChange={setTamanho}>
          <SelectTrigger aria-label="Tamanho da foto" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Padrão</SelectLabel>
              <SelectItem value="10x15">
                {formatarTamanho({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 })} cm
              </SelectItem>
              <SelectItem value="20x30">
                {formatarTamanho({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 })} cm
              </SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Quadrados</SelectLabel>
              <SelectItem value="13x13">13 × 13 cm</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Grandes</SelectLabel>
              <SelectItem value="30x40">30 × 40 cm</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectItem value="personalizado">Personalizado…</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Bloco>

      <Bloco titulo="Cor da borda (DV-08)">
        <div className="flex items-center gap-3">
          <SeletorCor valor={cor} onChange={setCor} />
          <span className="text-body-sm text-ink-3">
            Clique para escolher uma cor pronta ou “Outra cor…”.
          </span>
        </div>
      </Bloco>

      <Bloco titulo="Campos e controle inativo (§7.1)">
        <div className="grid max-w-md gap-3">
          <Input aria-label="Campo de exemplo" defaultValue="21,0" className="w-40 font-mono text-medida" />
          <CampoEmBreve rotulo="Buscar por nome" placeholder="Buscar por nome" />
          <div className="flex items-center gap-3">
            <Switch checked={ligado} onCheckedChange={setLigado} aria-label="Exemplo de alternância" />
            <span className="text-body-sm text-ink-2">Ligado = accent</span>
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Área útil (RN-33)">
        <div className="relative h-40 w-72 bg-stage">
          <div className="absolute inset-4 border border-dashed border-ink-2" />
          <span className="absolute -top-5 left-0 text-medida text-ink-2">Área útil · 180,0 × 110,0 cm</span>
        </div>
      </Bloco>

      <Bloco titulo="Vaga de template (RN-31, TPL-05)">
        <div className="flex h-28 w-44 flex-col items-center justify-center gap-1 border-[1.5px] border-dashed border-danger bg-[repeating-linear-gradient(45deg,rgba(180,35,24,0.2)_0_6px,transparent_6px_12px)] bg-danger-tint text-danger-ink">
          <ImageOff className="size-5" aria-hidden="true" />
          <span className="rounded-sm bg-white/80 px-1 text-medida">15 × 21</span>
        </div>
      </Bloco>

      <Bloco titulo="Card de template (RN-32)">
        <RadioGroup value={template} onValueChange={setTemplate} className="grid max-w-xs grid-cols-2 gap-3">
          <RadioCard value="piramide" className="p-3">
            <div className="flex h-[116px] items-center justify-center rounded-md bg-paper">
              <div className="grid grid-cols-2 gap-2">
                <span className="h-8 w-6 rounded-[2px] bg-sketch ring-1 ring-sketch-line" />
                <span className="h-8 w-6 rounded-[2px] bg-sketch ring-1 ring-sketch-line" />
                <span className="col-span-2 mx-auto h-8 w-6 rounded-[2px] bg-sketch ring-1 ring-sketch-line" />
              </div>
            </div>
            <span className="mt-2 block font-display text-[17px] text-ink">Pirâmide</span>
            <span className="text-medida text-ink-2">151,0 × 70,6 cm · 4 fotos</span>
          </RadioCard>
          <RadioCard value="grade" className="p-3">
            <div className="flex h-[116px] items-center justify-center rounded-md bg-paper">
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="h-7 w-5 rounded-[2px] bg-sketch ring-1 ring-sketch-line" />
                ))}
              </div>
            </div>
            <span className="mt-2 block font-display text-[17px] text-ink">Grade</span>
            <span className="text-medida text-ink-2">120,0 × 90,0 cm · 6 fotos</span>
          </RadioCard>
        </RadioGroup>
        <Alert variant="aviso" className="max-w-xs">
          <span className="flex items-center gap-1.5 text-warning-ink">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Maior que a área útil
          </span>
        </Alert>
      </Bloco>

      <Bloco titulo="Status da prévia frontal (DV-06)">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEstadoPrevia('pronta')}>
              Prévia pronta
            </Button>
            <Button variant="outline" onClick={() => setEstadoPrevia('desatualizada')}>
              Cantos mudaram
            </Button>
          </div>
          <div
            className={
              estadoPrevia === 'desatualizada'
                ? 'flex h-24 w-48 items-center justify-center rounded-md bg-sand opacity-50'
                : 'flex h-24 w-48 items-center justify-center rounded-md bg-sand'
            }
          >
            <span className="flex items-center gap-1 text-body-sm text-ink-2">
              <Check className="size-4" aria-hidden="true" />
              {estadoPrevia === 'pronta' ? 'Prévia pronta' : 'Prévia desatualizada'}
            </span>
          </div>
          {estadoPrevia === 'desatualizada' && (
            <Alert variant="aviso" className="max-w-xs">
              Os cantos mudaram
            </Alert>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Alertas e status">
        <div className="grid max-w-md gap-3">
          <Alert variant="alerta">Sobreposição entre duas fotos (RN-11).</Alert>
          <div className="flex flex-wrap gap-4">
            {estados.map((estado) => (
              <StatusSalvamento key={estado.tipo} estado={estado} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ChipEscala pxPorCm={4} />
            <Miniatura rotulo="Foto selecionada" selecionada>
              <span className="text-body-sm text-ink-2">Miniatura</span>
            </Miniatura>
          </div>
        </div>
      </Bloco>
    </Prancha>
  );
}

export function DevUi() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <span className="text-label">Desenvolvimento</span>
        <h1 className="text-display-xl text-ink">Fundação de design</h1>
        <p className="text-body-sm text-ink-2">
          Referência para validação visual. Medidas e textos: {formatarDimensao(24, 34)}.
        </p>
      </header>
      <Identidade />
      <Componentes />
    </main>
  );
}
