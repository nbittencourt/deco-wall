import { tamanhoSugerido } from '@deco-wall/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { PainelRecorte, type PropsPainelRecorte } from './PainelRecorte';

// Painel do modo de recorte (spec M2 §3.5; RN-14, RN-28; protótipo 16).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

function montar(sobrescrita: Partial<PropsPainelRecorte> = {}) {
  const props: PropsPainelRecorte = {
    tamanho: { sugeridoId: null, larguraCm: 30, alturaCm: 30 },
    borda: { larguraCm: 2, cor: '#FFFFFF' },
    personalizado: true,
    onTamanho: vi.fn(),
    onPersonalizado: vi.fn(),
    onConcluir: vi.fn(),
    onCancelar: vi.fn(),
    ...sobrescrita,
  };
  render(
    <TooltipProvider>
      <PainelRecorte {...props} />
    </TooltipProvider>,
  );
  return props;
}

const campo = (nome: string) => screen.getByLabelText(nome, { selector: 'input' }) as HTMLInputElement;

describe('tamanho personalizado (RN-28)', () => {
  it('mostra largura × altura com a faixa válida e o tamanho externo', () => {
    montar();
    expect(screen.getByRole('heading', { name: 'Ajustar recorte' })).toBeTruthy();
    expect(campo('Largura').value).toBe('30,0');
    expect(campo('Altura').value).toBe('30,0');
    expect(screen.getByText(/em cada lado\./).textContent).toBe('Entre 5,0 e 150,0 cm em cada lado.');
    expect(screen.getByText('34,0 × 34,0 cm')).toBeTruthy(); // 30 × 30 + 2 × 2 cm de borda
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toContain('Personalizado');
  });

  it('largura válida vira o novo tamanho, mantendo a altura (21,0 × 29,7 — aceite 2a)', () => {
    const props = montar();
    fireEvent.change(campo('Largura'), { target: { value: '21' } });
    fireEvent.keyDown(campo('Largura'), { key: 'Enter' });
    expect(props.onTamanho).toHaveBeenCalledWith({ sugeridoId: null, larguraCm: 21, alturaCm: 30 });
  });

  it('4,9 e 150,1 são rejeitados com a faixa válida (aceite 2a)', () => {
    const props = montar();
    fireEvent.change(campo('Largura'), { target: { value: '4,9' } });
    fireEvent.keyDown(campo('Largura'), { key: 'Enter' });
    fireEvent.change(campo('Altura'), { target: { value: '150,1' } });
    fireEvent.keyDown(campo('Altura'), { key: 'Enter' });
    expect(screen.getAllByText('Entre 5,0 e 150,0 cm em cada lado.').length).toBeGreaterThanOrEqual(2);
    expect(props.onTamanho).not.toHaveBeenCalled();
  });

  it('medida igual a um sugerido vira o sugerido (RN-28)', () => {
    const props = montar({ tamanho: { sugeridoId: null, larguraCm: 20, alturaCm: 31 } });
    fireEvent.change(campo('Altura'), { target: { value: '30' } });
    fireEvent.keyDown(campo('Altura'), { key: 'Enter' });
    expect(props.onTamanho).toHaveBeenCalledWith({ sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 });
  });

  it('tamanho sugerido sem a opção "Personalizado…": sem campos de largura e altura', () => {
    montar({ tamanho: tamanhoSugerido('20x30'), personalizado: false });
    expect(screen.queryByLabelText('Largura')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toContain('20 × 30 cm');
  });
});

describe('ações', () => {
  it('Concluir e Cancelar', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onConcluir).toHaveBeenCalledTimes(1);
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
  });

  it('explica o enquadramento', () => {
    montar();
    expect(
      screen.getByText(
        'A foto sempre preenche o quadro. Arraste a imagem para escolher a parte que aparece.',
      ),
    ).toBeTruthy();
  });
});
