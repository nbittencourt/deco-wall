import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DialogoTemplates } from './DialogoTemplates';

// Galeria de templates (RF-93, RN-29, RN-30, TPL-01 a TPL-08, A-18, A-19; protótipo 14; DESIGN §7.3;
// docs/specs/M3-variantes-templates-e-salvamento.md §3.6).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

function montar(extra: Record<string, unknown> = {}) {
  const props = {
    aberto: true,
    areaUtil: { xCm: 0, yCm: 0, larguraCm: 180, alturaCm: 110 },
    bordaPadrao: { larguraCm: 0, cor: '#FFFFFF' },
    temEscala: true,
    nomesExistentes: ['Base'],
    onCancelar: vi.fn(),
    onPosicionar: vi.fn(),
    ...extra,
  };
  render(<DialogoTemplates {...props} />);
  return { props, dialogo: screen.getByRole('dialog') };
}

describe('DialogoTemplates — cartões', () => {
  it('mostra os 12 modelos, com a Pirâmide pré-selecionada', () => {
    const { dialogo } = montar();
    const cartoes = within(dialogo).getAllByRole('radio');
    expect(cartoes).toHaveLength(12);
    expect(
      within(dialogo)
        .getByRole('radio', { name: /^Pirâmide/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(cartoes.filter((c) => c.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('cada cartão traz o nome, o total do conjunto e o número de fotos', () => {
    const { dialogo } = montar();
    const piramide = within(dialogo).getByRole('radio', { name: /^Pirâmide/ });
    expect(within(piramide).getByText('151,0 × 70,6 cm')).toBeTruthy();
    expect(within(piramide).getByText('6 fotos')).toBeTruthy();
    const trio = within(dialogo).getByRole('radio', { name: /^Trio/ });
    expect(within(trio).getByText('77,2 × 42,0 cm')).toBeTruthy();
    expect(within(trio).getByText('3 fotos')).toBeTruthy();
  });

  it('o subtítulo informa a área útil da variante', () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByText('Área útil da variante: 180,0 × 110,0 cm')).toBeTruthy();
  });

  it('avisa "Maior que a área útil" nos modelos que não cabem, sem bloquear a escolha', () => {
    const { dialogo, props } = montar({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 140, alturaCm: 90 } });
    const piramide = within(dialogo).getByRole('radio', { name: /^Pirâmide/ });
    expect(within(piramide).getByText('Maior que a área útil')).toBeTruthy();
    const trio = within(dialogo).getByRole('radio', { name: /^Trio/ });
    expect(within(trio).queryByText('Maior que a área útil')).toBeNull();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    expect(props.onPosicionar).toHaveBeenCalled();
  });

  it('escolher outro cartão muda o nome da variante que será criada', () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByText('Será criada a variante “Pirâmide”.')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('radio', { name: /^Trio/ }));
    expect(within(dialogo).getByText('Será criada a variante “Trio”.')).toBeTruthy();
  });

  it('nome já usado ganha número (A-03)', () => {
    const { dialogo } = montar({ nomesExistentes: ['Base', 'Pirâmide'] });
    expect(within(dialogo).getByText('Será criada a variante “Pirâmide 2”.')).toBeTruthy();
  });
});

describe('DialogoTemplates — borda e confirmação (RN-30)', () => {
  it('o campo Borda das fotos começa na borda padrão da variante', () => {
    const { dialogo } = montar({ bordaPadrao: { larguraCm: 2, cor: '#F5F1E8' } });
    const campo = within(dialogo).getByRole('textbox', { name: 'Borda das fotos' }) as HTMLInputElement;
    expect(campo.value).toBe('2,0');
  });

  it('Posicionar na parede envia o modelo e a borda única escolhida', () => {
    const { dialogo, props } = montar();
    fireEvent.click(within(dialogo).getByRole('radio', { name: /^Escada/ }));
    const campo = within(dialogo).getByRole('textbox', { name: 'Borda das fotos' });
    fireEvent.change(campo, { target: { value: '1,5' } });
    fireEvent.blur(campo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    expect(props.onPosicionar).toHaveBeenCalledWith({
      templateId: 'escada',
      borda: { larguraCm: 1.5, cor: '#FFFFFF' },
    });
  });

  it('avisa, sem bloquear, quando a borda faz vagas ficarem maiores que o espaço (A-19)', () => {
    const { dialogo, props } = montar();
    fireEvent.click(within(dialogo).getByRole('radio', { name: /^Mondrian/ }));
    expect(within(dialogo).queryByText(/ficam maiores que o espaço do modelo/)).toBeNull();
    const campo = within(dialogo).getByRole('textbox', { name: 'Borda das fotos' });
    fireEvent.change(campo, { target: { value: '8' } });
    fireEvent.blur(campo);
    expect(
      within(dialogo).getByText(
        /Com esta borda, \d+ vagas? ficam? maiores que o espaço do modelo e as vizinhas serão afastadas\./,
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    expect(props.onPosicionar).toHaveBeenCalled();
  });

  it('a borda é limitada de 0 a 20 cm', () => {
    const { dialogo, props } = montar();
    const campo = within(dialogo).getByRole('textbox', { name: 'Borda das fotos' });
    fireEvent.change(campo, { target: { value: '50' } });
    fireEvent.blur(campo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    expect(props.onPosicionar).toHaveBeenCalledWith(
      expect.objectContaining({ borda: expect.objectContaining({ larguraCm: 20 }) }),
    );
  });

  it('sem escala, Posicionar na parede fica inativo com o motivo', () => {
    const { dialogo, props } = montar({ temEscala: false, areaUtil: null });
    const botao = within(dialogo).getByRole('button', { name: 'Posicionar na parede' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(botao);
    expect(props.onPosicionar).not.toHaveBeenCalled();
    expect(within(dialogo).getByText('Defina a escala primeiro.')).toBeTruthy();
  });

  it('Cancelar fecha sem criar nada', () => {
    const { dialogo, props } = montar();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelar).toHaveBeenCalled();
    expect(props.onPosicionar).not.toHaveBeenCalled();
  });
});
