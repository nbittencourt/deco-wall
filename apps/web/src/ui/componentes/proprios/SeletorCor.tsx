import { useId } from 'react';
import { PopoverContent, Popover, PopoverTrigger } from '../ui/popover';

// DESIGN §6 / DV-08: 6 cores prontas + "Outra cor…" (seletor nativo).
export const CORES_PRONTAS = [
  { nome: 'Branco', hex: '#FFFFFF' },
  { nome: 'Off-white', hex: '#F5F1E8' },
  { nome: 'Preto', hex: '#1A1A1A' },
  { nome: 'Cinza', hex: '#8C8C8C' },
  { nome: 'Madeira clara', hex: '#C8A27A' },
  { nome: 'Madeira escura', hex: '#5C3A21' },
] as const;

export function SeletorCor({ valor, onChange }: { valor: string; onChange?: (hex: string) => void }) {
  const id = useId();
  const pronta = CORES_PRONTAS.find((cor) => cor.hex.toUpperCase() === valor.toUpperCase());
  const rotulo = pronta ? pronta.nome : valor.toUpperCase();

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-ink">
        <span
          aria-hidden="true"
          className="size-4 rounded-sm ring-1 ring-line"
          style={{ backgroundColor: valor }}
        />
        <span>{rotulo}</span>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <p className="text-label mb-2">Cor da borda</p>
        <div role="group" aria-label="Cores prontas" className="grid grid-cols-6 gap-1.5">
          {CORES_PRONTAS.map((cor) => (
            <button
              key={cor.hex}
              type="button"
              aria-label={cor.nome}
              aria-pressed={pronta?.hex === cor.hex}
              title={cor.nome}
              onClick={() => onChange?.(cor.hex)}
              className="size-7 cursor-pointer rounded-sm ring-1 ring-line aria-pressed:ring-2 aria-pressed:ring-accent"
              style={{ backgroundColor: cor.hex }}
            />
          ))}
        </div>
        <label htmlFor={id} className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            id={id}
            type="color"
            value={valor}
            onChange={(evento) => onChange?.(evento.target.value)}
            className="size-6 cursor-pointer rounded-sm border-0 bg-transparent p-0"
          />
          Outra cor…
        </label>
      </PopoverContent>
    </Popover>
  );
}
