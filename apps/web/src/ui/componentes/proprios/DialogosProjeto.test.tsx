import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DialogoExcluirProjeto,
  DialogoRenomearProjeto,
  DialogoSairSemSalvar,
  DialogoTrocarParede,
} from './DialogosProjeto';

// Diálogos do M1: renomear e excluir projeto (§3.1), sair sem salvar (A-20), trocar a parede (M1-05).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe('DialogoRenomearProjeto', () => {
  it('abre com o nome atual no campo', () => {
    render(<DialogoRenomearProjeto aberto nomeAtual="Sala" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    const campo = within(dialogo).getByRole('textbox', { name: 'Nome do projeto' }) as HTMLInputElement;
    expect(campo.value).toBe('Sala');
  });

  it('confirma com o nome novo, sem os espaços das pontas', () => {
    const onConfirmar = vi.fn();
    render(<DialogoRenomearProjeto aberto nomeAtual="Sala" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    fireEvent.change(within(dialogo).getByRole('textbox'), { target: { value: '  Quarto  ' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Renomear' }));
    expect(onConfirmar).toHaveBeenCalledWith('Quarto');
  });

  it('Enter no campo também confirma', () => {
    const onConfirmar = vi.fn();
    render(<DialogoRenomearProjeto aberto nomeAtual="Sala" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    const campo = within(screen.getByRole('dialog')).getByRole('textbox');
    fireEvent.change(campo, { target: { value: 'Quarto' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onConfirmar).toHaveBeenCalledWith('Quarto');
  });

  it('nome vazio mostra o erro e não confirma', () => {
    const onConfirmar = vi.fn();
    render(<DialogoRenomearProjeto aberto nomeAtual="Sala" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    fireEvent.change(within(dialogo).getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Renomear' }));
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(within(dialogo).getByText('Informe um nome para o projeto.')).toBeTruthy();
  });

  it('Cancelar chama onCancelar', () => {
    const onCancelar = vi.fn();
    render(<DialogoRenomearProjeto aberto nomeAtual="Sala" onConfirmar={vi.fn()} onCancelar={onCancelar} />);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalled();
  });

  it('fechado, não renderiza nada', () => {
    render(
      <DialogoRenomearProjeto aberto={false} nomeAtual="Sala" onConfirmar={vi.fn()} onCancelar={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DialogoExcluirProjeto (RN-17)', () => {
  it('explica o que será apagado e o que continua', () => {
    render(<DialogoExcluirProjeto aberto nome="Sala" onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog', { name: 'Excluir “Sala”?' });
    expect(
      within(dialogo).getByText(
        'As variantes e a foto da parede deste projeto serão apagadas. As fotos da biblioteca continuam disponíveis.',
      ),
    ).toBeTruthy();
  });

  it('o botão destrutivo "Excluir projeto" confirma', () => {
    const onConfirmar = vi.fn();
    render(<DialogoExcluirProjeto aberto nome="Sala" onConfirmar={onConfirmar} onCancelar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir projeto' }));
    expect(onConfirmar).toHaveBeenCalled();
  });

  it('Cancelar não confirma', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<DialogoExcluirProjeto aberto nome="Sala" onConfirmar={onConfirmar} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe('DialogoSairSemSalvar (A-20)', () => {
  function montar() {
    const props = { onSalvarESair: vi.fn(), onSairSemSalvar: vi.fn(), onCancelar: vi.fn() };
    render(<DialogoSairSemSalvar aberto {...props} />);
    return props;
  }

  it('pergunta "Sair sem salvar?" e oferece as três saídas', () => {
    montar();
    const dialogo = screen.getByRole('dialog', { name: 'Sair sem salvar?' });
    for (const nome of ['Salvar e sair', 'Sair sem salvar', 'Cancelar']) {
      expect(within(dialogo).getByRole('button', { name: nome })).toBeTruthy();
    }
  });

  it('cada botão chama a sua ação', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sair' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onSalvarESair).toHaveBeenCalledTimes(1);
    expect(props.onSairSemSalvar).toHaveBeenCalledTimes(1);
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
  });

  it('"Salvar e sair" é o primário (primeiro na ordem do foco)', async () => {
    montar();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Salvar e sair' })),
    );
  });
});

describe('DialogoTrocarParede (M1-05)', () => {
  it('avisa que escala e área útil serão descartadas', () => {
    render(<DialogoTrocarParede aberto onConfirmar={vi.fn()} onCancelar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog', { name: 'Trocar a foto da parede?' });
    expect(within(dialogo).getByText('A escala e a área útil serão descartadas.')).toBeTruthy();
  });

  it('confirma e cancela', () => {
    const onConfirmar = vi.fn();
    const onCancelar = vi.fn();
    render(<DialogoTrocarParede aberto onConfirmar={onConfirmar} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trocar parede' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});
