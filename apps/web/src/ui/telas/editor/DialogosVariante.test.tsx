import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DialogoDecisao, DialogoExcluirVariante, DialogoNomeVariante } from './DialogosVariante';

// Diálogos de variante (A-02, A-12; docs/specs/M3-variantes-templates-e-salvamento.md §3.1, §3.2). 640 px,
// rodapé fantasma → secundário → primário (DESIGN §6).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe('DialogoNomeVariante (Nova variante, Duplicar, Renomear — A-02)', () => {
  const montar = (extra = {}) => {
    const props = {
      aberto: true,
      titulo: 'Nova variante',
      rotuloConfirmar: 'Criar variante',
      nomeInicial: 'Variante 2',
      onConfirmar: vi.fn(),
      onCancelar: vi.fn(),
      ...extra,
    };
    render(<DialogoNomeVariante {...props} />);
    return { props, dialogo: screen.getByRole('dialog') };
  };

  it('abre com o nome sugerido já selecionado no campo', () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByText('Nova variante')).toBeTruthy();
    const campo = within(dialogo).getByRole('textbox', { name: 'Nome da variante' }) as HTMLInputElement;
    expect(campo.value).toBe('Variante 2');
    expect(document.activeElement).toBe(campo);
    expect(campo.selectionStart).toBe(0);
    expect(campo.selectionEnd).toBe('Variante 2'.length);
  });

  it('confirma com o nome sem os espaços das pontas', () => {
    const { dialogo, props } = montar();
    fireEvent.change(within(dialogo).getByRole('textbox'), { target: { value: '  Sala escura  ' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar variante' }));
    expect(props.onConfirmar).toHaveBeenCalledWith('Sala escura');
  });

  it('Enter confirma', () => {
    const { dialogo, props } = montar();
    const campo = within(dialogo).getByRole('textbox');
    fireEvent.change(campo, { target: { value: 'Outra' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(props.onConfirmar).toHaveBeenCalledWith('Outra');
  });

  it('nome vazio ou com mais de 60 caracteres mostra o erro e não confirma', () => {
    const { dialogo, props } = montar();
    const campo = within(dialogo).getByRole('textbox');
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar variante' }));
    expect(within(dialogo).getByText('Informe um nome para a variante.')).toBeTruthy();
    fireEvent.change(campo, { target: { value: 'a'.repeat(61) } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar variante' }));
    expect(within(dialogo).getByText('O nome pode ter até 60 caracteres.')).toBeTruthy();
    expect(props.onConfirmar).not.toHaveBeenCalled();
  });

  it('falha ao confirmar vira mensagem dentro do diálogo', async () => {
    const onConfirmar = vi.fn().mockRejectedValue(new Error('Servidor local indisponível.'));
    const { dialogo } = montar({ onConfirmar });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar variante' }));
    expect(await within(dialogo).findByText('Servidor local indisponível.')).toBeTruthy();
  });

  it('Cancelar chama onCancelar; o título e o botão mudam para Duplicar e Renomear', () => {
    const { dialogo, props } = montar({
      titulo: 'Duplicar variante',
      rotuloConfirmar: 'Duplicar',
      nomeInicial: 'Base (cópia)',
    });
    expect(within(dialogo).getByText('Duplicar variante')).toBeTruthy();
    expect((within(dialogo).getByRole('textbox') as HTMLInputElement).value).toBe('Base (cópia)');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelar).toHaveBeenCalled();
  });
});

describe('DialogoExcluirVariante (A-02, RN-23)', () => {
  it('explica o que se perde e que a biblioteca continua; botão destrutivo "Excluir variante"', () => {
    const onConfirmar = vi.fn();
    render(
      <DialogoExcluirVariante
        aberto
        nome="Sala escura"
        naoSalva={false}
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
      />,
    );
    const dialogo = screen.getByRole('dialog');
    expect(
      within(dialogo).getByText(
        'A variante “Sala escura” e as fotos posicionadas nela serão apagadas. As imagens da biblioteca continuam disponíveis.',
      ),
    ).toBeTruthy();
    expect(within(dialogo).queryByText('Ela tem alterações não salvas.')).toBeNull();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir variante' }));
    expect(onConfirmar).toHaveBeenCalled();
  });

  it('avisa quando a variante tem alterações não salvas', () => {
    render(<DialogoExcluirVariante aberto nome="Base" naoSalva onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    expect(within(screen.getByRole('dialog')).getByText('Ela tem alterações não salvas.')).toBeTruthy();
  });

  it('Cancelar não exclui', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(
      <DialogoExcluirVariante
        aberto
        nome="Base"
        naoSalva={false}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe('DialogoDecisao — deixar a variante com alterações (A-12, M3-03)', () => {
  const montar = (extra = {}) => {
    const props = {
      aberto: true,
      nome: 'Base',
      onSalvar: vi.fn(),
      onDescartar: vi.fn(),
      onCancelar: vi.fn(),
      ...extra,
    };
    render(<DialogoDecisao {...props} />);
    return { props, dialogo: screen.getByRole('dialog') };
  };

  it('pergunta pelo nome e oferece Cancelar, Descartar alterações e Salvar e continuar', () => {
    const { dialogo } = montar();
    expect(within(dialogo).getByText('Salvar as alterações de “Base”?')).toBeTruthy();
    for (const nome of ['Cancelar', 'Descartar alterações', 'Salvar e continuar']) {
      expect(within(dialogo).getByRole('button', { name: nome })).toBeTruthy();
    }
  });

  it('cada botão chama a sua saída', () => {
    const { dialogo, props } = montar();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar e continuar' }));
    expect(props.onSalvar).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar alterações' }));
    expect(props.onDescartar).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
  });

  it('Esc cancela', async () => {
    const { props } = montar();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(props.onCancelar).toHaveBeenCalled());
  });

  it('com a ação em andamento, os botões ficam inativos', () => {
    const { dialogo } = montar({ ocupado: true });
    for (const nome of ['Descartar alterações', 'Salvar e continuar']) {
      expect((within(dialogo).getByRole('button', { name: nome }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
