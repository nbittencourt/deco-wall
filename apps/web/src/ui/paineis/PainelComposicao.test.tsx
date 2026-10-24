import { GRID_PADRAO } from '@deco-wall/domain';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { PainelComposicao, type PropsPainelComposicao } from './PainelComposicao';

// Painel direito "Composição" no M1 (spec M1 §3.7, A-08, A-13 a A-15; protótipo 11).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const AREA = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };
const GRID = { ...GRID_PADRAO };

function montar(sobrescrita: Partial<PropsPainelComposicao> = {}) {
  const props: PropsPainelComposicao = {
    escala: { metodo: 'perspectiva', pxPorCm: 4 },
    areaUtil: AREA,
    paredeInteira: PAREDE,
    grid: GRID,
    onRecalibrar: vi.fn(),
    onAjustarAreaUtil: vi.fn(),
    onAlterarAreaUtil: vi.fn(),
    onAlterarGrid: vi.fn(),
    ...sobrescrita,
  };
  render(
    <TooltipProvider>
      <PainelComposicao {...props} />
    </TooltipProvider>,
  );
  return props;
}

const secao = (nome: string) => within(screen.getByRole('region', { name: nome }));

describe('seções', () => {
  it('título e as quatro seções do M1', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Composição' })).toBeTruthy();
    for (const nome of ['Escala', 'Área útil desta variante', 'Borda padrão', 'Grid']) {
      expect(screen.getByRole('region', { name: nome })).toBeTruthy();
    }
  });

  it('resumo: 0 fotos e área total "—" (fotos entram no M2)', () => {
    montar();
    expect(screen.getByText('Fotos')).toBeTruthy();
    expect(screen.getByText('Área total')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('Escala', () => {
  it('perspectiva: método, chip e Recalibrar', () => {
    const props = montar();
    const escala = secao('Escala');
    expect(escala.getByText('Perspectiva')).toBeTruthy();
    expect(escala.getByText('4,0 px/cm')).toBeTruthy();
    fireEvent.click(escala.getByRole('button', { name: 'Recalibrar' }));
    expect(props.onRecalibrar).toHaveBeenCalledTimes(1);
  });

  it('linear', () => {
    montar({ escala: { metodo: 'linear', pxPorCm: 4.25 } });
    const escala = secao('Escala');
    expect(escala.getByText('Linear')).toBeTruthy();
    expect(escala.getByText('4,3 px/cm')).toBeTruthy();
  });

  it('sem escala: "Não definida" e sem Recalibrar', () => {
    montar({ escala: { metodo: null, pxPorCm: null }, areaUtil: null, paredeInteira: null });
    const escala = secao('Escala');
    expect(escala.getByText('Não definida')).toBeTruthy();
    expect(escala.queryByRole('button', { name: 'Recalibrar' })).toBeNull();
  });
});

describe('Área útil desta variante (A-13, A-14)', () => {
  it('mostra Largura, Altura, X e Y com vírgula decimal', () => {
    montar();
    const area = secao('Área útil desta variante');
    expect((area.getByLabelText('Largura') as HTMLInputElement).value).toBe('100,0');
    expect((area.getByLabelText('Altura') as HTMLInputElement).value).toBe('80,0');
    expect((area.getByLabelText('X') as HTMLInputElement).value).toBe('20,0');
    expect((area.getByLabelText('Y') as HTMLInputElement).value).toBe('10,0');
  });

  it('Enter aplica o valor digitado', () => {
    const props = montar();
    const campo = secao('Área útil desta variante').getByLabelText('Largura');
    fireEvent.change(campo, { target: { value: '150,5' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAlterarAreaUtil).toHaveBeenCalledWith({ ...AREA, larguraCm: 150.5 });
  });

  it('sair do campo também aplica', () => {
    const props = montar();
    const campo = secao('Área útil desta variante').getByLabelText('X');
    fireEvent.change(campo, { target: { value: '30' } });
    fireEvent.blur(campo);
    expect(props.onAlterarAreaUtil).toHaveBeenCalledWith({ ...AREA, xCm: 30 });
  });

  it('valor fora da faixa não aplica e mostra a faixa válida', () => {
    const props = montar();
    const area = secao('Área útil desta variante');
    const campo = area.getByLabelText('Largura');
    fireEvent.change(campo, { target: { value: '999' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAlterarAreaUtil).not.toHaveBeenCalled();
    expect(area.getByText('Faixa válida: 5,0 a 280,0 cm.')).toBeTruthy();
  });

  it('texto que não é número não aplica', () => {
    const props = montar();
    const area = secao('Área útil desta variante');
    const campo = area.getByLabelText('Altura');
    fireEvent.change(campo, { target: { value: 'abc' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAlterarAreaUtil).not.toHaveBeenCalled();
    expect(area.getByText('Digite um número em cm.')).toBeTruthy();
  });

  it('"Ajustar" abre o modo Área útil', () => {
    const props = montar();
    fireEvent.click(secao('Área útil desta variante').getByRole('button', { name: 'Ajustar' }));
    expect(props.onAjustarAreaUtil).toHaveBeenCalledTimes(1);
  });

  it('sem área útil (sem escala), campos e botão ficam inativos', () => {
    const props = montar({ escala: { metodo: null, pxPorCm: null }, areaUtil: null, paredeInteira: null });
    const area = secao('Área útil desta variante');
    expect(area.getByLabelText('Largura').getAttribute('aria-disabled')).toBe('true');
    const ajustar = area.getByRole('button', { name: 'Ajustar' });
    expect(ajustar.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(ajustar);
    expect(props.onAjustarAreaUtil).not.toHaveBeenCalled();
  });
});

describe('Borda padrão (M2)', () => {
  it('visível e inativa até o M2 (DESIGN §7.1)', () => {
    montar();
    expect(secao('Borda padrão').getByLabelText('Largura').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Grid (A-08, A-15)', () => {
  it('"Mostrar grid" liga e desliga a visibilidade', () => {
    const props = montar();
    const alternador = secao('Grid').getByRole('switch', { name: 'Mostrar grid' });
    expect(alternador.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(alternador);
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ visivel: false });
  });

  it('"Encaixar no grid" liga e desliga o snap', () => {
    const props = montar();
    fireEvent.click(secao('Grid').getByRole('switch', { name: 'Encaixar no grid' }));
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ snap: false });
  });

  it('passo: 1 · 2 · 5 · 10 · Outro, com o atual marcado', () => {
    const props = montar();
    const passos = secao('Grid').getByRole('radiogroup', { name: 'Passo do grid' });
    const nomes = within(passos)
      .getAllByRole('radio')
      .map((r) => r.textContent);
    expect(nomes).toEqual(['1', '2', '5', '10', 'Outro']);
    expect(within(passos).getByRole('radio', { name: '5' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(passos).getByRole('radio', { name: '10' }));
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ passoCm: 10 });
  });

  it('"Outro" mostra o campo de passo personalizado (0,5 a 100 cm)', () => {
    const props = montar();
    const grid = secao('Grid');
    fireEvent.click(grid.getByRole('radio', { name: 'Outro' }));
    const campo = grid.getByLabelText('Passo personalizado');
    fireEvent.change(campo, { target: { value: '2,5' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ passoCm: 2.5 });
  });

  it('passo personalizado fora da faixa não aplica', () => {
    const props = montar();
    const grid = secao('Grid');
    fireEvent.click(grid.getByRole('radio', { name: 'Outro' }));
    const campo = grid.getByLabelText('Passo personalizado');
    fireEvent.change(campo, { target: { value: '0,4' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAlterarGrid).not.toHaveBeenCalled();
    expect(grid.getByText('Faixa válida: 0,5 a 100,0 cm.')).toBeTruthy();
  });

  it('passo que não é um dos prontos aparece como "Outro", com o valor no campo', () => {
    montar({ grid: { ...GRID, passoCm: 2.5 } });
    const grid = secao('Grid');
    expect(grid.getByRole('radio', { name: 'Outro' }).getAttribute('aria-checked')).toBe('true');
    expect((grid.getByLabelText('Passo personalizado') as HTMLInputElement).value).toBe('2,5');
  });

  it('opacidade de 0 a 100%, de 1 em 1', () => {
    const props = montar();
    const grid = secao('Grid');
    const controle = grid.getByRole('slider', { name: 'Opacidade' }) as HTMLInputElement;
    expect(controle.value).toBe('8');
    expect(controle.min).toBe('0');
    expect(controle.max).toBe('100');
    expect(controle.step).toBe('1');
    expect(grid.getByText('8%')).toBeTruthy();
    fireEvent.change(controle, { target: { value: '20' } });
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ opacidade: 0.2 });
  });

  it('cor das linhas: Tinta, Branco e Cinza + "Outra cor…"', () => {
    const props = montar();
    fireEvent.click(secao('Grid').getByRole('button', { name: 'Cor das linhas' }));
    const cores = within(screen.getByRole('group', { name: 'Cores prontas' }));
    expect(cores.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Tinta',
      'Branco',
      'Cinza',
    ]);
    fireEvent.click(cores.getByRole('button', { name: 'Branco' }));
    expect(props.onAlterarGrid).toHaveBeenCalledWith({ cor: '#FFFFFF' });
    expect(screen.getByText('Outra cor…')).toBeTruthy();
  });

  it('"Linha forte a cada" fica inativa até o M5 (DV-05)', () => {
    montar();
    expect(secao('Grid').getByLabelText('Linha forte a cada').getAttribute('aria-disabled')).toBe('true');
  });
});
