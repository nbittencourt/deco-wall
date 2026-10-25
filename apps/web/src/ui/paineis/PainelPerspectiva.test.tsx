import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelPerspectiva, type PropsPainelPerspectiva } from './PainelPerspectiva';

// Painel do modo Perspectiva (spec M1 §3.4, A-09, A-10, A-11, RF-06, RF-14, DV-06; protótipos 04 e 04a).

afterEach(cleanup);

const CANTOS = [
  { x: 200, y: 150 },
  { x: 1400, y: 250 },
  { x: 1400, y: 1050 },
  { x: 200, y: 1150 },
];

function montar(sobrescrita: Partial<PropsPainelPerspectiva> = {}) {
  const props: PropsPainelPerspectiva = {
    cantos: CANTOS,
    motivoInvalido: null,
    medidas: { larguraCm: '300', alturaCm: '200' },
    onMedidasChange: vi.fn(),
    previa: { tipo: 'vazia' },
    onGerarPrevia: vi.fn(),
    permitirPular: true,
    onPular: vi.fn(),
    ...sobrescrita,
  };
  render(<PainelPerspectiva {...props} />);
  return props;
}

describe('cantos', () => {
  it('lista "Cantos 4 de 4" com os quatro nomes', () => {
    montar();
    expect(screen.getByText('Cantos 4 de 4')).toBeTruthy();
    for (const nome of ['Superior esq.', 'Superior dir.', 'Inferior dir.', 'Inferior esq.']) {
      expect(screen.getByText(nome)).toBeTruthy();
    }
  });

  it('dica de uso e nota da origem (RN-07)', () => {
    montar();
    expect(screen.getByText('Arraste as alças para ajustar. Use a roda do mouse para zoom.')).toBeTruthy();
    expect(
      screen.getByText('A origem das medidas é o canto superior esquerdo do retângulo marcado.'),
    ).toBeTruthy();
  });

  it('quadrilátero inválido mostra a mensagem em alerta (A-11)', () => {
    montar({ motivoInvalido: 'nao-convexo' });
    expect(screen.getByRole('alert').textContent).toContain('Os cantos precisam formar um quadrilátero.');
  });

  it('quadrilátero válido não mostra alerta de cantos', () => {
    montar();
    expect(screen.queryByText('Os cantos precisam formar um quadrilátero.')).toBeNull();
  });
});

describe('medidas reais (A-09, RF-14)', () => {
  it('campos Largura e Altura em cm', () => {
    montar();
    expect((screen.getByLabelText('Largura') as HTMLInputElement).value).toBe('300');
    expect((screen.getByLabelText('Altura') as HTMLInputElement).value).toBe('200');
  });

  it('digitar avisa o pai com o texto novo', () => {
    const props = montar();
    fireEvent.change(screen.getByLabelText('Largura'), { target: { value: '310' } });
    expect(props.onMedidasChange).toHaveBeenCalledWith({ larguraCm: '310', alturaCm: '200' });
    fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '210' } });
    expect(props.onMedidasChange).toHaveBeenLastCalledWith({ larguraCm: '300', alturaCm: '210' });
  });

  it('o aviso de parede plana está sempre visível', () => {
    montar();
    expect(
      screen.getByText('Medidas assumem parede plana. Prefira referências com 1 m ou mais.'),
    ).toBeTruthy();
  });

  it('referência menor que 1 m ganha a frase extra de precisão', () => {
    montar({ medidas: { larguraCm: '80', alturaCm: '200' } });
    expect(screen.getByText('Referência menor que 1 m: a precisão diminui.')).toBeTruthy();
  });

  it('a partir de 1 m não há a frase extra', () => {
    montar();
    expect(screen.queryByText('Referência menor que 1 m: a precisão diminui.')).toBeNull();
  });

  it('medida fora de 10 a 2000 cm mostra a faixa no campo', () => {
    montar({ medidas: { larguraCm: '5', alturaCm: '200' } });
    expect(screen.getByText('Informe de 10 a 2000 cm.')).toBeTruthy();
  });
});

describe('prévia frontal (RF-06, DV-06)', () => {
  it('vazia: botão "Gerar prévia"', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    expect(props.onGerarPrevia).toHaveBeenCalledTimes(1);
  });

  it('gerando: indicador e sem botão', () => {
    montar({ previa: { tipo: 'gerando' } });
    expect(screen.getByText('Gerando prévia…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gerar prévia' })).toBeNull();
  });

  it('pronta: imagem, hora de Brasília e as medidas do retângulo de referência', () => {
    montar({
      previa: {
        tipo: 'pronta',
        url: 'blob:previa',
        geradaEm: new Date('2026-10-24T17:35:00Z'),
        larguraCm: 300,
        alturaCm: 200,
      },
    });
    const imagem = screen.getByRole('img', { name: 'Prévia frontal' });
    expect(imagem.getAttribute('src')).toBe('blob:previa');
    expect(screen.getByText('Gerada às 14:35 · 300,0 × 200,0 cm')).toBeTruthy();
  });

  it('desatualizada: prévia esmaecida, aviso e novo botão', () => {
    const props = montar({ previa: { tipo: 'desatualizada', url: 'blob:antiga' } });
    const imagem = screen.getByRole('img', { name: 'Prévia frontal' });
    expect(imagem.getAttribute('data-estado')).toBe('desatualizada');
    expect(screen.getByText('Os cantos mudaram')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }));
    expect(props.onGerarPrevia).toHaveBeenCalledTimes(1);
  });
});

describe('pular para a calibração linear (M1-02)', () => {
  it('mostra o link quando a escala atual não é de perspectiva', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Pular e usar calibração linear' }));
    expect(props.onPular).toHaveBeenCalledTimes(1);
  });

  it('esconde o link quando já há perspectiva aplicada', () => {
    montar({ permitirPular: false });
    expect(screen.queryByRole('button', { name: 'Pular e usar calibração linear' })).toBeNull();
  });
});
