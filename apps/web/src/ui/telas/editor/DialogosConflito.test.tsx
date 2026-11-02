import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { foto, vaga } from '../../../testes/cenario-m3';
import { DialogoConflito, DialogoVarianteExcluida } from './DialogoConflito';
import { DialogoRecuperar } from './DialogoRecuperar';

// Diálogo de conflito (RF-73, SV-05, M3-09, A-14), de variante excluída e de recuperação (SV-07, M3-08, A-09);
// docs/specs/M3-variantes-templates-e-salvamento.md §3.4, §3.5. Protótipo 09.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const CAIXA = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
const minha = {
  rotuloHora: 'às 14:35',
  qtdFotos: 3,
  revisao: 1,
  fotos: [foto(1), foto(2), vaga(3)],
  caixa: CAIXA,
};
const salva = { rotuloHora: 'às 14:41', qtdFotos: 2, revisao: 2, fotos: [foto(1), foto(2)], caixa: CAIXA };

function montarConflito(extra: Record<string, unknown> = {}) {
  const props = {
    aberto: true,
    nome: 'Base',
    minha,
    salva,
    onManter: vi.fn(),
    onUsarSalva: vi.fn(),
    onNovaVariante: vi.fn(),
    onFechar: vi.fn(),
    ...extra,
  };
  render(<DialogoConflito {...props} />);
  const dialogo = screen.getByRole('dialog');
  const botao = (nome: string) => within(dialogo).getByRole('button', { name: nome });
  const campo = within(dialogo).getByRole('textbox', { name: 'Para confirmar, digite a palavra da opção' });
  return { props, dialogo, botao, campo };
}

const MANTER = 'Manter a minha';
const USAR = 'Usar a salva';
const NOVA = 'Salvar a minha como nova variante';

describe('DialogoConflito — conteúdo (A-14)', () => {
  it('título, subtítulo e o aviso do salvamento automático pausado', () => {
    const { dialogo } = montarConflito();
    expect(within(dialogo).getByText('Esta variante foi salva em outra aba')).toBeTruthy();
    expect(
      within(dialogo).getByText(
        '“Base” mudou desde que você a abriu. Escolha qual versão manter. O salvamento automático está pausado.',
      ),
    ).toBeTruthy();
  });

  it('dois cartões: A minha (esta aba) e A salva (outra aba), com fotos e revisão', () => {
    const { dialogo } = montarConflito();
    expect(within(dialogo).getByText('A minha')).toBeTruthy();
    expect(within(dialogo).getByText('A salva')).toBeTruthy();
    expect(within(dialogo).getByText('às 14:35 · esta aba')).toBeTruthy();
    expect(within(dialogo).getByText('às 14:41 · outra aba')).toBeTruthy();
    expect(within(dialogo).getByText('3 fotos · baseada na revisão 1')).toBeTruthy();
    expect(within(dialogo).getByText('2 fotos · revisão 2')).toBeTruthy();
    // Esboços em retângulos, sem imagens (M3-09).
    expect(within(dialogo).getAllByRole('img').length).toBe(2);
  });

  it('enquanto a versão salva não chega, os botões ficam inativos', () => {
    const { botao } = montarConflito({ salva: null });
    for (const nome of [MANTER, USAR, NOVA]) expect(botao(nome).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Carregando a versão salva…')).toBeTruthy();
  });
});

describe('DialogoConflito — confirmação digitada (A-14)', () => {
  it('todos os botões começam inativos', () => {
    const { botao } = montarConflito();
    for (const nome of [MANTER, USAR, NOVA]) expect(botao(nome).getAttribute('aria-disabled')).toBe('true');
  });

  it.each([
    ['minha', MANTER, 'onManter'],
    ['salva', USAR, 'onUsarSalva'],
    ['nova', NOVA, 'onNovaVariante'],
  ])('digitar "%s" habilita só "%s"', (palavra, nomeBotao, callback) => {
    const { botao, campo, props } = montarConflito();
    fireEvent.change(campo, { target: { value: palavra } });
    for (const nome of [MANTER, USAR, NOVA]) {
      expect(botao(nome).getAttribute('aria-disabled')).toBe(nome === nomeBotao ? null : 'true');
    }
    fireEvent.click(botao(nomeBotao));
    expect((props as unknown as Record<string, ReturnType<typeof vi.fn>>)[callback]).toHaveBeenCalledTimes(1);
  });

  it('ignora maiúsculas e espaços nas pontas', () => {
    const { botao, campo } = montarConflito();
    fireEvent.change(campo, { target: { value: '  MiNhA ' } });
    expect(botao(MANTER).getAttribute('aria-disabled')).toBeNull();
  });

  it('palavra errada ou parcial não habilita nada, e clicar num botão inativo não faz nada', () => {
    const { botao, campo, props } = montarConflito();
    for (const texto of ['min', 'minhas', 'sim', 'manter']) {
      fireEvent.change(campo, { target: { value: texto } });
      for (const nome of [MANTER, USAR, NOVA]) expect(botao(nome).getAttribute('aria-disabled')).toBe('true');
    }
    fireEvent.click(botao(MANTER));
    fireEvent.click(botao(USAR));
    fireEvent.click(botao(NOVA));
    expect(props.onManter).not.toHaveBeenCalled();
    expect(props.onUsarSalva).not.toHaveBeenCalled();
    expect(props.onNovaVariante).not.toHaveBeenCalled();
  });

  it('Enter no campo aciona a opção da palavra digitada', () => {
    const { campo, props } = montarConflito();
    fireEvent.change(campo, { target: { value: 'salva' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onUsarSalva).toHaveBeenCalledTimes(1);
    expect(props.onManter).not.toHaveBeenCalled();
  });

  it('Enter com palavra errada não aciona nada', () => {
    const { campo, props } = montarConflito();
    fireEvent.change(campo, { target: { value: 'xyz' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onManter).not.toHaveBeenCalled();
    expect(props.onUsarSalva).not.toHaveBeenCalled();
    expect(props.onNovaVariante).not.toHaveBeenCalled();
  });

  it('Esc deixa a decisão para depois', async () => {
    const { props } = montarConflito();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(props.onFechar).toHaveBeenCalled());
  });
});

describe('DialogoVarianteExcluida (M3-09)', () => {
  it('oferece Salvar como nova variante e Descartar', () => {
    const onNova = vi.fn();
    const onDescartar = vi.fn();
    render(<DialogoVarianteExcluida aberto nome="Base" onNova={onNova} onDescartar={onDescartar} />);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Esta variante foi excluída em outra aba.')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar como nova variante' }));
    expect(onNova).toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    expect(onDescartar).toHaveBeenCalled();
  });
});

describe('DialogoRecuperar (SV-07, M3-08, A-09)', () => {
  const salvaRec = { rotuloHora: 'às 14:41', qtdFotos: 2, revisao: 4, fotos: [foto(1)], caixa: CAIXA };
  const rascunho = { rotuloHora: 'às 14:30', qtdFotos: 1, revisao: 1, fotos: [foto(1)], caixa: CAIXA };

  function montar(extra: Record<string, unknown> = {}) {
    const props = {
      aberto: true,
      rotuloHora: 'às 14:30',
      desatualizado: false,
      revisaoRascunho: 1,
      revisaoSalva: 1,
      salva: salvaRec,
      rascunho: null,
      onRecuperar: vi.fn(),
      onDescartar: vi.fn(),
      onNovaVariante: vi.fn(),
      onFechar: vi.fn(),
      ...extra,
    };
    render(<DialogoRecuperar {...props} />);
    return { props, dialogo: screen.getByRole('dialog') };
  }

  it('pergunta "Recuperar alterações não salvas de hh:mm?" com Recuperar e Descartar', () => {
    const { dialogo, props } = montar();
    expect(within(dialogo).getByText('Recuperar alterações não salvas de 14:30?')).toBeTruthy();
    expect(within(dialogo).queryByRole('button', { name: 'Salvar como nova variante' })).toBeNull();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Recuperar' }));
    expect(props.onRecuperar).toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    expect(props.onDescartar).toHaveBeenCalled();
  });

  it('× ou Esc fecha sem descartar', async () => {
    const { props } = montar();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(props.onFechar).toHaveBeenCalled());
    expect(props.onDescartar).not.toHaveBeenCalled();
  });

  it('base antiga: avisa as revisões, mostra as duas versões e oferece "Salvar como nova variante"', () => {
    const { dialogo, props } = montar({
      desatualizado: true,
      revisaoRascunho: 1,
      revisaoSalva: 4,
      rascunho,
    });
    expect(
      within(dialogo).getByText(
        'Estas alterações foram feitas sobre a revisão 1; a versão salva já está na revisão 4.',
      ),
    ).toBeTruthy();
    expect(within(dialogo).getAllByRole('img').length).toBe(2);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar como nova variante' }));
    expect(props.onNovaVariante).toHaveBeenCalled();
  });
});
