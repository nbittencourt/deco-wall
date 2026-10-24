import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utilitário padrão do shadcn/ui: junta classes e resolve conflitos do Tailwind.
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
