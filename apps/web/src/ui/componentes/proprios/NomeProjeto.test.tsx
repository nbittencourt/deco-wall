import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NomeProjeto } from './NomeProjeto';
import { TooltipProvider } from '../ui/tooltip';

// A-02: o nome do projeto no header é editável no lugar (Enter grava, Esc cancela).

afterEach(cleanup);

function montar(nome = 'Sala de estar', onRenomear = vi.fn()) {
  render(
    <TooltipProvider>
      <NomeProjeto nome={nome} onRenomear={onRenomear} />
    </TooltipProvider>,
  );
  return onRenomear;
}

function editar() {
  fireEvent.click(screen.getByRole('button', { name: 'Sala de estar' }));
  return screen.getByRole('textbox', { name: 'Nome do projeto' }) as HTMLInputElement;
}

describe('NomeProjeto', () => {
  it('mostra o nome como título de nível 1', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Sala de estar' })).toBeTruthy();
  });

  it('clicar abre o campo com o nome atual', () => {
    montar();
    const campo = editar();
    expect(campo.value).toBe('Sala de estar');
  });

  it('Enter grava o nome sem os espaços das pontas', () => {
    const onRenomear = montar();
    const campo = editar();
    fireEvent.change(campo, { target: { value: '  Corredor  ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRenomear).toHaveBeenCalledWith('Corredor');
  });

  it('Esc cancela e volta ao nome anterior', () => {
    const onRenomear = montar();
    const campo = editar();
    fireEvent.change(campo, { target: { value: 'Outro nome' } });
    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(onRenomear).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sala de estar' })).toBeTruthy();
  });

  it('nome vazio mostra o erro e continua editando, sem chamar a API', () => {
    const onRenomear = montar();
    const campo = editar();
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRenomear).not.toHaveBeenCalled();
    expect(screen.getByText('Informe um nome para o projeto.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Nome do projeto' })).toBeTruthy();
  });

  it('nome com mais de 100 caracteres é recusado', () => {
    const onRenomear = montar();
    const campo = editar();
    fireEvent.change(campo, { target: { value: 'a'.repeat(101) } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRenomear).not.toHaveBeenCalled();
    expect(screen.getByText('O nome pode ter no máximo 100 caracteres.')).toBeTruthy();
  });

  it('Enter sem mudar o nome só fecha o campo', () => {
    const onRenomear = montar();
    const campo = editar();
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onRenomear).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sala de estar' })).toBeTruthy();
  });
});
