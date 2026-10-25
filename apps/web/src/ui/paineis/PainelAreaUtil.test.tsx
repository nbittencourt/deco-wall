import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelAreaUtil, type PropsPainelAreaUtil } from './PainelAreaUtil';
import { BarraModo } from './BarraModo';

// Painel e barra do modo Área útil (spec M1 §3.6, A-13, M1-07; protótipo 13) e a barra comum dos modos.

afterEach(cleanup);

const PAREDE = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 };
const AREA = { xCm: 20, yCm: 10, larguraCm: 100, alturaCm: 80 };

function montar(sobrescrita: Partial<PropsPainelAreaUtil> = {}) {
  const props: PropsPainelAreaUtil = {
    area: AREA,
    paredeInteira: PAREDE,
    onAreaChange: vi.fn(),
    onUsarParedeInteira: vi.fn(),
    ...sobrescrita,
  };
  render(<PainelAreaUtil {...props} />);
  return props;
}

describe('PainelAreaUtil', () => {
  it('mostra Largura, Altura, X e Y', () => {
    montar();
    expect((screen.getByLabelText('Largura') as HTMLInputElement).value).toBe('100,0');
    expect((screen.getByLabelText('Altura') as HTMLInputElement).value).toBe('80,0');
    expect((screen.getByLabelText('X') as HTMLInputElement).value).toBe('20,0');
    expect((screen.getByLabelText('Y') as HTMLInputElement).value).toBe('10,0');
  });

  it('editar um campo e confirmar com Enter avisa o pai', () => {
    const props = montar();
    const campo = screen.getByLabelText('Y');
    fireEvent.change(campo, { target: { value: '25,5' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAreaChange).toHaveBeenCalledWith({ ...AREA, yCm: 25.5 });
  });

  it('valor fora da parede não aplica e mostra a faixa (A-13)', () => {
    const props = montar();
    const campo = screen.getByLabelText('X');
    fireEvent.change(campo, { target: { value: '250' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onAreaChange).not.toHaveBeenCalled();
    expect(screen.getByText('Faixa válida: 0,0 a 200,0 cm.')).toBeTruthy();
  });

  it('"Usar a parede inteira"', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Usar a parede inteira' }));
    expect(props.onUsarParedeInteira).toHaveBeenCalledTimes(1);
  });

  it('notas: origem das medidas (IC-01) e área por variante', () => {
    montar();
    expect(
      screen.getByText('Medido a partir da origem 0,0 (canto do retângulo de referência).'),
    ).toBeTruthy();
    expect(screen.getByText('Cada variante tem a sua área útil.')).toBeTruthy();
    expect(screen.getByText('Arraste os cantos ou os lados · Enter confirma · Esc cancela')).toBeTruthy();
  });

  it('com escala linear, a origem é o canto da foto', () => {
    montar({ origem: 'foto' });
    expect(screen.getByText('Medido a partir da origem 0,0 (canto superior esquerdo da foto).')).toBeTruthy();
  });
});

describe('BarraModo', () => {
  function barra(sobrescrita = {}) {
    const props = {
      titulo: 'Área útil',
      subtitulo: 'Ajuste onde as fotos podem ficar.',
      rotuloConfirmar: 'Confirmar área',
      onCancelar: vi.fn(),
      onConfirmar: vi.fn(),
      ...sobrescrita,
    };
    render(<BarraModo {...props} />);
    return props;
  }

  it('título, subtítulo, Cancelar e o botão de confirmar', () => {
    const props = barra();
    expect(screen.getByText('Área útil')).toBeTruthy();
    expect(screen.getByText('Ajuste onde as fotos podem ficar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar área' }));
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
    expect(props.onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('confirmar desabilitado não dispara', () => {
    const props = barra({ confirmarDesabilitado: true });
    const botao = screen.getByRole('button', { name: 'Confirmar área' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.click(botao);
    expect(props.onConfirmar).not.toHaveBeenCalled();
  });

  it('ocupado mostra o texto de andamento e bloqueia a confirmação', () => {
    barra({ ocupado: 'Aplicando perspectiva…' });
    expect(screen.getByText('Aplicando perspectiva…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirmar área' }) as HTMLButtonElement).disabled).toBe(true);
    // Cancelar continua disponível (aborta o Worker).
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
