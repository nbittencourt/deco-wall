import { useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';

// Spike de risco (docs/specs/M0-setup.md §5.6): um Stage com um retângulo arrastável renderiza.
// Página de desenvolvimento, sem função de usuário. Removível depois do M1.
export function SpikeKonva() {
  const [posicao, setPosicao] = useState({ x: 100, y: 80 });

  return (
    <main className="mx-auto flex max-w-[700px] flex-col gap-4 p-8">
      <h1 className="text-display-md text-ink">Spike react-konva</h1>
      <p data-testid="posicao" className="text-medida text-ink-2">
        x: {posicao.x.toFixed(1)} · y: {posicao.y.toFixed(1)}
      </p>
      <div className="bg-surface ring-1 ring-line">
        <Stage width={600} height={400}>
          <Layer>
            <Rect
              x={posicao.x}
              y={posicao.y}
              width={150}
              height={100}
              fill="#B5532F"
              draggable
              onDragEnd={(evento) => setPosicao({ x: evento.target.x(), y: evento.target.y() })}
            />
          </Layer>
        </Stage>
      </div>
    </main>
  );
}
