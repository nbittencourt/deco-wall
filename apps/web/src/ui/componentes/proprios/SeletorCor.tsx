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

interface PropsSeletorCor {
  valor: string;
  onChange?: (hex: string) => void;
  // Padrão: as cores da borda (DV-08). O grid usa as suas (A-08).
  cores?: readonly { nome: string; hex: string }[];
  titulo?: string;
  // Nome acessível do botão (ex.: "Cor das linhas").
  rotulo?: string;
  // Função prevista e não implementada (DESIGN §7.1): aria-disabled e o popover não abre.
  inativo?: boolean;
}

export function SeletorCor({
  valor,
  onChange,
  cores = CORES_PRONTAS,
  titulo = 'Cor da borda',
  rotulo,
  inativo = false,
}: PropsSeletorCor) {
  const id = useId();
  const pronta = cores.find((cor) => cor.hex.toUpperCase() === valor.toUpperCase());
  const nomeCor = pronta ? pronta.nome : valor.toUpperCase();

  return (
    <Popover open={inativo ? false : undefined}>
      <PopoverTrigger
        aria-label={rotulo}
        aria-disabled={inativo || undefined}
        className={`inline-flex h-9 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm ${
          inativo ? 'cursor-default text-ink-disabled' : 'cursor-pointer text-ink'
        }`}
      >
        <span
          aria-hidden="true"
          className="size-4 rounded-sm ring-1 ring-line"
          style={{ backgroundColor: valor }}
        />
        <span>{nomeCor}</span>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <p className="text-label mb-2">{titulo}</p>
        <div role="group" aria-label="Cores prontas" className="grid grid-cols-6 gap-1.5">
          {cores.map((cor) => (
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
