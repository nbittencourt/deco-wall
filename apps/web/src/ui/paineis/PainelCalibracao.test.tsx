import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelCalibracao, type PropsPainelCalibracao } from './PainelCalibracao';

// Painel do modo Calibração linear (spec M1 §3.5, A-09, A-12, RF-12, RN-10; protótipo 05).

afterEach(cleanup);

function montar(sobrescrita: Partial<PropsPainelCalibracao> = {}) {
  const props: PropsPainelCalibracao = {
    comprimentoCm: '130',
    onComprimentoChange: vi.fn(),
    segmentoPx: 520,
    onUsarPerspectiva: vi.fn(),
    ...sobrescrita,
  };
  render(<PainelCalibracao {...props} />);
  return props;
}

describe('PainelCalibracao', () => {
  it('mostra o comprimento do segmento em px e o campo de comprimento real', () => {
    montar();
    expect(screen.getByText('520 px')).toBeTruthy();
    expect((screen.getByLabelText('Comprimento real') as HTMLInputElement).value).toBe('130');
  });

  it('calcula a escala resultante ao vivo (RF-12)', () => {
    montar();
    // 520 px ÷ 130 cm
    expect(screen.getByText('Escala resultante')).toBeTruthy();
    expect(screen.getByText('4,0 px/cm')).toBeTruthy();
  });

  it('a escala acompanha o comprimento digitado', () => {
    const { rerender } = render(
      <PainelCalibracao
        comprimentoCm="130"
        onComprimentoChange={vi.fn()}
        segmentoPx={520}
        onUsarPerspectiva={vi.fn()}
      />,
    );
    rerender(
      <PainelCalibracao
        comprimentoCm="260"
        onComprimentoChange={vi.fn()}
        segmentoPx={520}
        onUsarPerspectiva={vi.fn()}
      />,
    );
    expect(screen.getByText('2,0 px/cm')).toBeTruthy();
  });

  it('digitar avisa o pai', () => {
    const props = montar();
    fireEvent.change(screen.getByLabelText('Comprimento real'), { target: { value: '150' } });
    expect(props.onComprimentoChange).toHaveBeenCalledWith('150');
  });

  it('comprimento inválido mostra a faixa e não mostra escala', () => {
    montar({ comprimentoCm: '5' });
    expect(screen.getByText('Informe de 10 a 2000 cm.')).toBeTruthy();
    expect(screen.queryByText(/px\/cm/)).toBeNull();
  });

  it('avisos: sem perspectiva a precisão é só no plano do segmento; RF-14; nota do RN-10', () => {
    montar();
    expect(
      screen.getByText('Sem correção de perspectiva, a escala só é precisa no plano do segmento.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Medidas assumem parede plana. Prefira referências com 1 m ou mais.'),
    ).toBeTruthy();
    expect(screen.getByText('Recalibrar mantém posição e tamanho das fotos em centímetros.')).toBeTruthy();
  });

  it('referência menor que 1 m ganha a frase de precisão', () => {
    montar({ comprimentoCm: '80' });
    expect(screen.getByText('Referência menor que 1 m: a precisão diminui.')).toBeTruthy();
  });

  it('link "Usar correção de perspectiva"', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Usar correção de perspectiva' }));
    expect(props.onUsarPerspectiva).toHaveBeenCalledTimes(1);
  });
});
