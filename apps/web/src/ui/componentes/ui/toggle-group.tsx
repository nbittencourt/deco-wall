import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

// DESIGN §6: trilho sand com padding 3 e gap 2; colunas de largura igual (auto-cols-fr).
// A largura fixa de cada uso (152 px, 160 px, 240 px) vem por className.
// O fundo branco do item ativo é um indicador único que desliza até a opção escolhida.
export function ToggleGroup({
  className,
  children,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  const raiz = useRef<HTMLDivElement>(null);
  const [indicador, setIndicador] = useState<Retangulo | null>(null);
  // Só desliza quando a opção muda de uma para outra. Na primeira pintura, ou vindo de "nenhuma"
  // (ex.: filtro "Excluídas" escolhido fora do grupo), o indicador já aparece no lugar.
  const [deslizar, setDeslizar] = useState(false);

  useLayoutEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;

    let ultimo: Retangulo | null = null;
    const medir = () => {
      const ativo = elemento.querySelector<HTMLElement>(':scope > [data-state="on"]');
      ultimo = ativo
        ? { x: ativo.offsetLeft, y: ativo.offsetTop, largura: ativo.offsetWidth, altura: ativo.offsetHeight }
        : null;
      setIndicador(ultimo);
    };
    medir();

    const aoMudarOpcao = new MutationObserver(() => {
      const antes = ultimo;
      medir();
      setDeslizar(antes !== null && ultimo !== null);
    });
    aoMudarOpcao.observe(elemento, { subtree: true, attributes: true, attributeFilter: ['data-state'] });

    // jsdom não tem ResizeObserver.
    const aoRedimensionar = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    aoRedimensionar?.observe(elemento);

    return () => {
      aoMudarOpcao.disconnect();
      aoRedimensionar?.disconnect();
    };
  }, []);

  return (
    <ToggleGroupPrimitive.Root
      ref={raiz}
      className={cn('relative grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-sand p-[3px]', className)}
      {...props}
    >
      {indicador && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0 left-0 rounded-sm bg-surface shadow-xs',
            deslizar && 'transition-[translate,width] duration-200 ease-out motion-reduce:transition-none',
          )}
          style={{
            translate: `${indicador.x}px ${indicador.y}px`,
            width: indicador.largura,
            height: indicador.altura,
          }}
        />
      )}
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        'relative inline-flex h-7 cursor-pointer items-center justify-center rounded-sm px-2 text-[13px] text-ink-2 transition-colors',
        'data-[state=on]:text-ink',
        className,
      )}
      {...props}
    />
  );
}
