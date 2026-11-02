import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useImperativeHandle } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  criarCenario,
  foto,
  ID_PROJETO,
  ID_V2,
  variante,
  vaga,
  type OpcoesCenario,
} from '../../../testes/cenario-m3';
import type { PropsPalco } from '../../canvas/Palco';
import { TooltipProvider } from '../../componentes/ui/tooltip';
import { Editor } from '../Editor';

// O Konva não roda no jsdom: o palco é um marcador que mostra o que recebeu (cena e viewport) e permite "mover"
// a vista, como o usuário faria com o mouse. O resto da tela é real.
const ajustarDosPalcos: Array<ReturnType<typeof vi.fn>> = [];
vi.mock('../../canvas/Palco', () => ({
  Palco: ({ cena, viewport, onViewport, ref }: PropsPalco) => {
    const ajustar = vi.fn();
    ajustarDosPalcos.push(ajustar);
    useImperativeHandle(ref, () => ({
      zoomMais: vi.fn(),
      zoomMenos: vi.fn(),
      ajustar,
      dePaginaParaConteudo: () => null,
    }));
    const parede = cena.tipo === 'parede' ? cena : null;
    return (
      <div
        data-testid="palco-comparacao"
        data-viewport={viewport ? JSON.stringify(viewport) : ''}
        data-grid={String(Boolean(parede?.grid?.visivel))}
        data-area-util={String(Boolean(parede?.areaUtil))}
        data-alertas={String(parede?.mostrarAlertas !== false)}
        data-interativa={String(parede?.interativa)}
        data-fotos={parede?.fotos.length}
      >
        {!viewport && (
          <button onClick={() => onViewport?.({ centro: { x: 100, y: 100 }, escala: 4 })}>
            iniciar vista
          </button>
        )}
        <button onClick={() => onViewport?.({ centro: { x: 50, y: 60 }, escala: 8 })}>mover vista</button>
      </div>
    );
  },
}));

// Comparação (RF-92, ADR-12, M3-10, A-16, A-17, A-26; protótipo 06;
// docs/specs/M3-variantes-templates-e-salvamento.md §3.9): duas variantes lado a lado, só leitura, com zoom e pan
// sempre sincronizados.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // O jsdom não implementa o que a lista do Select (Radix) usa para rolar até o item escolhido.
  Element.prototype.scrollIntoView ??= () => undefined;
});

afterEach(cleanup);

async function montar(opcoes: OpcoesCenario = {}) {
  ajustarDosPalcos.length = 0;
  const cenario = criarCenario(opcoes);
  const navegar = vi.fn();
  render(
    <TooltipProvider>
      <Editor projetoId={ID_PROJETO} api={cenario.api} navegar={navegar} tela="comparar" />
    </TooltipProvider>,
  );
  await screen.findByText('Somente visualização');
  return { ...cenario, navegar };
}

const palcos = () => screen.getAllByTestId('palco-comparacao');
const painel = (lado: 'esquerdo' | 'direito') => screen.getByRole('region', { name: `Painel ${lado}` });

describe('abertura (M3-10)', () => {
  it('a ativa fica à esquerda e a seguinte na ordem à direita', async () => {
    await montar();
    expect(
      within(painel('esquerdo')).getByRole('combobox', { name: 'Variante do painel esquerdo' }).textContent,
    ).toContain('Base');
    expect(
      within(painel('direito')).getByRole('combobox', { name: 'Variante do painel direito' }).textContent,
    ).toContain('Variante 2');
  });

  it('se a ativa é a última, a anterior fica à direita', async () => {
    await montar({ projeto: { ultimaVarianteId: ID_V2 } });
    expect(within(painel('esquerdo')).getByRole('combobox').textContent).toContain('Variante 2');
    expect(within(painel('direito')).getByRole('combobox').textContent).toContain('Base');
  });

  it('cabeçalho com selo de somente visualização e o aviso de zoom igual', async () => {
    await montar();
    expect(screen.getByText('Somente visualização')).toBeTruthy();
    expect(screen.getByText('Zoom e posição iguais nos dois lados')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voltar ao editor' })).toBeTruthy();
  });

  it('cada painel mostra "N fotos" (vagas incluídas) e a área total', async () => {
    await montar({
      variantes: [
        variante({ fotos: [foto(1), foto(2)] }),
        variante({ _id: ID_V2, nome: 'Variante 2', ordem: 1, fotos: [] }),
      ],
    });
    expect(within(painel('esquerdo')).getByText('2 fotos')).toBeTruthy();
    expect(within(painel('esquerdo')).getByText('25,0 × 30,0 cm')).toBeTruthy();
    expect(within(painel('direito')).getByText('0 fotos')).toBeTruthy();
    expect(within(painel('direito')).getByText('—')).toBeTruthy();
  });
});

describe('somente visualização e itens opcionais (A-16)', () => {
  it('os palcos não são interativos e começam limpos: sem grid, área útil nem alertas', async () => {
    await montar();
    for (const p of palcos()) {
      expect(p.getAttribute('data-interativa')).toBe('false');
      expect(p.getAttribute('data-grid')).toBe('false');
      expect(p.getAttribute('data-area-util')).toBe('false');
      expect(p.getAttribute('data-alertas')).toBe('false');
    }
  });

  it.each([
    ['Grid', 'data-grid'],
    ['Área útil', 'data-area-util'],
    ['Alertas', 'data-alertas'],
  ])('a chave %s liga o item nos dois painéis e desliga de novo', async (nome, atributo) => {
    await montar();
    const chave = screen.getByRole('switch', { name: nome });
    expect(chave.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(chave);
    expect(screen.getByRole('switch', { name: nome }).getAttribute('aria-checked')).toBe('true');
    for (const p of palcos()) expect(p.getAttribute(atributo)).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: nome }));
    for (const p of palcos()) expect(p.getAttribute(atributo)).toBe('false');
  });

  it('placeholders aparecem como vagas (fotos da cena incluem as vagas)', async () => {
    await montar({
      variantes: [
        variante({ fotos: [foto(1), vaga(2)] }),
        variante({ _id: ID_V2, nome: 'Variante 2', ordem: 1 }),
      ],
    });
    expect(palcos()[0]!.getAttribute('data-fotos')).toBe('2');
  });
});

describe('zoom e pan sincronizados (PRD aceite 11, A-17)', () => {
  it('mover a vista em um painel move o outro para o mesmo viewport', async () => {
    await montar();
    for (const botao of screen.queryAllByRole('button', { name: 'iniciar vista' }).slice(0, 1))
      fireEvent.click(botao);
    await waitFor(() => expect(palcos()[0]!.getAttribute('data-viewport')).not.toBe(''));
    expect(palcos()[1]!.getAttribute('data-viewport')).toBe(palcos()[0]!.getAttribute('data-viewport'));

    fireEvent.click(within(palcos()[1]!).getByRole('button', { name: 'mover vista' }));
    const esperado = JSON.stringify({ centro: { x: 50, y: 60 }, escala: 8 });
    await waitFor(() => expect(palcos()[0]!.getAttribute('data-viewport')).toBe(esperado));
    expect(palcos()[1]!.getAttribute('data-viewport')).toBe(esperado);
  });

  it('os botões − e + dão zoom nos dois lados e o percentual acompanha', async () => {
    await montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'iniciar vista' })[0]!);
    await waitFor(() => expect(palcos()[0]!.getAttribute('data-viewport')).not.toBe(''));
    const antes = JSON.parse(palcos()[0]!.getAttribute('data-viewport')!) as { escala: number };
    fireEvent.click(screen.getByRole('button', { name: 'Mais zoom' }));
    await waitFor(() => {
      const depois = JSON.parse(palcos()[0]!.getAttribute('data-viewport')!) as { escala: number };
      expect(depois.escala).toBeGreaterThan(antes.escala);
    });
    expect(palcos()[1]!.getAttribute('data-viewport')).toBe(palcos()[0]!.getAttribute('data-viewport'));
    fireEvent.click(screen.getByRole('button', { name: 'Menos zoom' }));
    await waitFor(() =>
      expect(JSON.parse(palcos()[0]!.getAttribute('data-viewport')!).escala).toBeCloseTo(antes.escala, 5),
    );
  });

  it('Parede inteira enquadra a parede (comando de ajuste do palco)', async () => {
    await montar();
    ajustarDosPalcos.forEach((f) => f.mockClear());
    fireEvent.click(screen.getByRole('button', { name: 'Parede inteira' }));
    expect(ajustarDosPalcos.some((f) => f.mock.calls.length > 0)).toBe(true);
  });
});

describe('trocar variantes e sair (M3-10, A-26, A-27)', () => {
  it('escolher no seletor a variante do outro lado troca os lados', async () => {
    await montar();
    fireEvent.click(within(painel('direito')).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: /^Base/ }));
    await waitFor(() =>
      expect(within(painel('esquerdo')).getByRole('combobox').textContent).toContain('Variante 2'),
    );
    expect(within(painel('direito')).getByRole('combobox').textContent).toContain('Base');
  });

  it('escolher uma terceira variante troca só aquele lado', async () => {
    await montar({
      variantes: [
        variante(),
        variante({ _id: ID_V2, nome: 'Variante 2', ordem: 1 }),
        variante({ _id: '0'.repeat(23) + '3', nome: 'Variante 3', ordem: 2 }),
      ],
    });
    fireEvent.click(within(painel('direito')).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: /^Variante 3/ }));
    await waitFor(() =>
      expect(within(painel('direito')).getByRole('combobox').textContent).toContain('Variante 3'),
    );
    expect(within(painel('esquerdo')).getByRole('combobox').textContent).toContain('Base');
  });

  it('Voltar ao editor leva ao editor do projeto, sem salvar nem zerar nada', async () => {
    const { navegar, api } = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao editor' }));
    expect(navegar).toHaveBeenCalledWith(`/projetos/${ID_PROJETO}`);
    expect(api.salvarVariante).not.toHaveBeenCalled();
    expect(api.salvarRascunho).not.toHaveBeenCalled();
  });

  it('Esc também volta ao editor', async () => {
    const { navegar } = await montar();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(navegar).toHaveBeenCalledWith(`/projetos/${ID_PROJETO}`);
  });

  it('com menos de 2 variantes, a comparação volta ao editor', async () => {
    ajustarDosPalcos.length = 0;
    const cenario = criarCenario({ variantes: [variante()] });
    const navegar = vi.fn();
    render(
      <TooltipProvider>
        <Editor projetoId={ID_PROJETO} api={cenario.api} navegar={navegar} tela="comparar" />
      </TooltipProvider>,
    );
    await waitFor(() => expect(navegar).toHaveBeenCalledWith(`/projetos/${ID_PROJETO}`));
  });

  it('Ctrl+S não salva na comparação (atalhos de edição inativos)', async () => {
    const { api } = await montar();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(api.salvarVariante).not.toHaveBeenCalled();
  });
});
