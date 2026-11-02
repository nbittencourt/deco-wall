import { describe, expect, it } from 'vitest';
import { cn } from './utils';

// M4-16: o tailwind-merge não conhece as utilidades de tipografia do tema (`text-display-*` e afins) e as
// tratava como cor de texto, descartando-as quando vinham junto de `text-ink`. Os diálogos perdiam a serifa.

describe('cn com as utilidades de tipografia do tema (M4-16)', () => {
  it.each(['text-display-xl', 'text-display-lg', 'text-display-md', 'text-display-sm'])(
    '%s convive com uma cor de texto',
    (utilidade) => {
      expect(cn(`${utilidade} text-ink`)).toBe(`${utilidade} text-ink`);
      expect(cn(utilidade, 'text-danger-ink')).toBe(`${utilidade} text-danger-ink`);
    },
  );

  it.each(['text-body', 'text-body-sm', 'text-label', 'text-medida'])(
    '%s convive com uma cor de texto',
    (u) => {
      expect(cn(`${u} text-ink-2`)).toBe(`${u} text-ink-2`);
    },
  );

  it('dois tamanhos do tema ainda conflitam: vale o último', () => {
    expect(cn('text-display-md', 'text-display-sm')).toBe('text-display-sm');
    expect(cn('text-body-sm', 'text-label')).toBe('text-label');
  });

  it('o tamanho do tema também é substituído por um tamanho padrão do Tailwind', () => {
    expect(cn('text-display-md', 'text-lg')).toBe('text-lg');
  });

  it('uma cor posterior substitui só a cor, não o tamanho', () => {
    expect(cn('text-display-md text-ink', 'text-accent')).toBe('text-display-md text-accent');
  });
});
