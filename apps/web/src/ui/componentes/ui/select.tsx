import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useState, type ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

// DESIGN §6 (seletor de tamanho): gatilho 36 px; lista raio 10 com sombra lg; cabeçalho de grupo em label ink-3.
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'inline-flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 text-sm text-ink',
        'data-[placeholder]:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 text-ink-3" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

// Há itens abaixo da área visível da lista?
function temMaisAbaixo(viewport: HTMLElement): boolean {
  return viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1;
}

export function SelectContent({
  className,
  children,
  dicaRolagem = 'Role para ver mais opções',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content> & {
  // Texto exibido abaixo das opções enquanto houver itens escondidos mais abaixo.
  dicaRolagem?: string;
}) {
  const [maisAbaixo, setMaisAbaixo] = useState(false);
  // A lista só existe aberta; mede depois que o Radix posiciona o conteúdo.
  const aoMontarViewport = useCallback((viewport: HTMLDivElement | null) => {
    if (!viewport) return;
    setMaisAbaixo(temMaisAbaixo(viewport));
    requestAnimationFrame(() => setMaisAbaixo(temMaisAbaixo(viewport)));
  }, []);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn(
          'z-50 flex max-h-[min(220px,var(--radix-select-content-available-height,220px))] min-w-[200px] flex-col overflow-hidden rounded-[10px] border border-line-soft bg-surface p-1 shadow-lg',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          ref={aoMontarViewport}
          onScroll={(evento) => setMaisAbaixo(temMaisAbaixo(evento.currentTarget))}
          className="min-h-0 flex-1"
        >
          {children}
        </SelectPrimitive.Viewport>
        {maisAbaixo && (
          <div
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center gap-1 border-t border-line-faint px-2 pt-1.5 pb-1 text-xs text-ink-3"
          >
            <ChevronDown className="size-3.5" />
            {dicaRolagem}
          </div>
        )}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectGroup({ className, ...props }: ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group className={cn('py-1', className)} {...props} />;
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label className={cn('px-2 pt-2 pb-1 text-label text-ink-3', className)} {...props} />
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-ink outline-none',
        'data-[highlighted]:bg-sand data-[state=checked]:bg-accent-tint data-[state=checked]:text-accent-ink',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="size-4 text-accent" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
