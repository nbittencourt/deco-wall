import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

// M4-16: o título de todo diálogo usa Newsreader (`text-display-md`) na cor de tinta (`text-ink`); as duas classes
// precisam sobreviver ao `cn`.

afterEach(cleanup);

describe('DialogTitle (M4-16)', () => {
  it('mantém text-display-md e text-ink', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir variante</DialogTitle>
            <DialogDescription>Texto.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const titulo = screen.getByText('Excluir variante');
    expect(titulo.className).toContain('text-display-md');
    expect(titulo.className).toContain('text-ink');
  });
});
