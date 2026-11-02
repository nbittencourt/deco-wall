import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// M4-16: as utilidades de tipografia do tema (`@utility` em theme.css) são tamanhos de fonte. Sem registrá-las,
// o tailwind-merge as toma por cores de texto e descarta `text-display-md` quando vem junto de `text-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-xl',
            'display-lg',
            'display-md',
            'display-sm',
            'body',
            'body-sm',
            'label',
            'medida',
          ],
        },
      ],
    },
  },
});

// Utilitário padrão do shadcn/ui: junta classes e resolve conflitos do Tailwind.
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
