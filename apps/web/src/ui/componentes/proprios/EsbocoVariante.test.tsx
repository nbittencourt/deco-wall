import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { foto, vaga } from '../../../testes/cenario-m3';
import { EsbocoVariante } from './EsbocoVariante';

// Esboço da variante em SVG (A-15): sem Konva e sem imagens; um retângulo por foto, placeholders tracejados.

afterEach(cleanup);

const CAIXA = { xCm: 0, yCm: 0, larguraCm: 200, alturaCm: 100 };

describe('EsbocoVariante', () => {
  it('desenha um retângulo por foto, na ordem da pilha, com o tipo em data-tipo', () => {
    const { container } = render(
      <EsbocoVariante fotos={[foto(1), vaga(2), foto(3)]} caixaCm={CAIXA} rotulo="Esboço da minha versão" />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Esboço da minha versão');
    const retangulos = [...svg.querySelectorAll('rect[data-tipo]')];
    expect(retangulos.map((r) => r.getAttribute('data-tipo'))).toEqual(['foto', 'placeholder', 'foto']);
  });

  it('o viewBox segue a proporção da caixa', () => {
    const { container } = render(<EsbocoVariante fotos={[]} caixaCm={CAIXA} rotulo="Vazio" />);
    const [, , largura, altura] = (container.querySelector('svg')!.getAttribute('viewBox') ?? '')
      .split(' ')
      .map(Number);
    expect(largura! / altura!).toBeCloseTo(2, 5);
  });

  it('o placeholder é tracejado e a foto não', () => {
    const { container } = render(<EsbocoVariante fotos={[foto(1), vaga(2)]} caixaCm={CAIXA} rotulo="x" />);
    const [umaFoto, umaVaga] = [...container.querySelectorAll('rect[data-tipo]')];
    expect(umaFoto!.getAttribute('stroke-dasharray')).toBeNull();
    expect(umaVaga!.getAttribute('stroke-dasharray')).not.toBeNull();
  });
});
