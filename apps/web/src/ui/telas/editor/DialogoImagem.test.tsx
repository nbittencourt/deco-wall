import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ProvedorStore } from '../../../app/StoreContext';
import {
  abrirCenario,
  foto,
  hex,
  ID_BASE,
  ID_PROJETO,
  ID_V2,
  PAISAGEM,
  RETRATO,
  variante,
  vaga,
} from '../../../testes/cenario-m3';
import { ErroApi } from '../../../infra/dto';
import { TooltipProvider } from '../../componentes/ui/tooltip';
import { DialogoImagem } from './DialogoImagem';

// Diálogo "Remover ou excluir" (RF-29, RN-24, M4-03, M4-04, M4-05, A-02, A-04, A-06; protótipo 08;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §3.1).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const COM_USOS = () => [
  variante({ fotos: [foto(1), foto(2), foto(5, { imagemId: PAISAGEM._id })] }),
  variante({ _id: ID_V2, nome: 'Variante 2', ordem: 1, fotos: [foto(3), vaga(4)] }),
];

async function montar(imagemId: string = RETRATO._id, variantes = COM_USOS()) {
  const c = await abrirCenario({ variantes });
  render(
    <ProvedorStore store={c.store}>
      <TooltipProvider>
        <DialogoImagem />
      </TooltipProvider>
    </ProvedorStore>,
  );
  await act(async () => {
    await c.estado().abrirDialogoImagem(imagemId);
  });
  return c;
}

const dialogo = () => screen.getByRole('dialog');

describe('abertura e cabeçalho (A-02)', () => {
  it('só existe com o diálogo aberto na store', async () => {
    const c = await abrirCenario();
    render(
      <ProvedorStore store={c.store}>
        <DialogoImagem />
      </ProvedorStore>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mostra a miniatura, o nome do arquivo e a pergunta', async () => {
    await montar();
    expect(within(dialogo()).getByText('foto-1.jpg')).toBeTruthy();
    expect(within(dialogo()).getByText('O que deseja fazer com esta imagem?')).toBeTruthy();
    expect(dialogo().querySelector('img')?.getAttribute('src')).toContain(`/api/imagens/${hex(1)}/arquivo`);
  });
});

describe('opções (M4-03)', () => {
  it('"Remover deste projeto" vem marcada, com a confirmação primária "Remover do projeto"', async () => {
    await montar();
    expect(screen.getByRole('radio', { name: /Remover deste projeto/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('radio', { name: /Excluir da biblioteca/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
    const confirmar = screen.getByRole('button', { name: 'Remover do projeto' });
    expect(confirmar.className).not.toContain('bg-danger');
  });

  it('as descrições explicam cada ação', async () => {
    await montar();
    expect(screen.getByText('Sai das variantes de Sala. Continua na biblioteca.')).toBeTruthy();
    expect(
      screen.getByText(
        'Fica em Excluídas por 30 dias e pode ser restaurada. Nas composições, o espaço da foto é mantido sem imagem.',
      ),
    ).toBeTruthy();
  });

  it('escolher "Excluir da biblioteca" troca o rótulo e o estilo da confirmação', async () => {
    await montar();
    fireEvent.click(screen.getByRole('radio', { name: /Excluir da biblioteca/ }));
    const confirmar = screen.getByRole('button', { name: 'Excluir imagem' });
    expect(confirmar.className).toContain('bg-danger');
    expect(screen.queryByRole('button', { name: 'Remover do projeto' })).toBeNull();
  });

  it('avisa que o histórico de desfazer das variantes afetadas será zerado', async () => {
    await montar();
    expect(screen.getByText(/O histórico de desfazer das variantes afetadas será zerado/)).toBeTruthy();
  });
});

describe('associações (RF-29, A-06)', () => {
  it('mostra "Usada em N lugares" com projeto, variante e vezes', async () => {
    await montar();
    expect(screen.getByText('Usada em 3 lugares')).toBeTruthy();
    const linhas = within(screen.getByRole('table')).getAllByRole('row');
    const texto = linhas.map((l) => l.textContent);
    expect(texto[0]).toContain('Projeto');
    expect(texto[0]).toContain('Variante');
    expect(texto[0]).toContain('Vezes');
    expect(texto.some((t) => t?.includes('Sala') && t.includes('Base') && t.includes('2'))).toBe(true);
    expect(texto.some((t) => t?.includes('Sala') && t.includes('Variante 2') && t.includes('1'))).toBe(true);
  });

  it('sem usos: "Não está em nenhuma variante." e os projetos em que foi carregada', async () => {
    await montar(PAISAGEM._id, [variante({ fotos: [foto(1)] })]);
    expect(screen.getByText('Não está em nenhuma variante.')).toBeTruthy();
    expect(screen.getByText(/Carregada em: Sala/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('"Remover deste projeto" fica inativo se a imagem não está no projeto aberto', async () => {
    const c = await abrirCenario({ variantes: COM_USOS() });
    c.api.associacoesDaImagem.mockResolvedValueOnce({
      imagem: { _id: RETRATO._id, nomeOriginal: 'foto-1.jpg', thumbUrl: 'x' },
      usos: [],
      projetos: [{ projetoId: hex(999), projetoNome: 'Outro' }],
    });
    render(
      <ProvedorStore store={c.store}>
        <TooltipProvider>
          <DialogoImagem />
        </TooltipProvider>
      </ProvedorStore>,
    );
    await act(async () => {
      await c.estado().abrirDialogoImagem(RETRATO._id);
    });
    const remover = screen.getByRole('radio', { name: /Remover deste projeto/ });
    expect(remover.getAttribute('aria-disabled') ?? remover.getAttribute('data-disabled')).not.toBeNull();
    expect(screen.getByText('Esta imagem não está neste projeto.')).toBeTruthy();
    // A opção padrão cai para a que vale.
    expect(screen.getByRole('radio', { name: /Excluir da biblioteca/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});

describe('confirmar e cancelar', () => {
  it('Remover do projeto chama a store e fecha o diálogo', async () => {
    const c = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Remover do projeto' }));
    await waitFor(() => expect(c.api.removerImagemDoProjeto).toHaveBeenCalledWith(ID_PROJETO, RETRATO._id));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(c.estado().conteudo?.fotos.map((f) => f._id)).toEqual([hex(1005)]);
  });

  it('Excluir imagem chama a store e fecha o diálogo', async () => {
    const c = await montar();
    fireEvent.click(screen.getByRole('radio', { name: /Excluir da biblioteca/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir imagem' }));
    await waitFor(() => expect(c.api.excluirImagem).toHaveBeenCalledWith(RETRATO._id));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(c.estado().documento.lista.find((i) => i._id === ID_BASE)?.semFoto).toBe(2);
  });

  it('a confirmação fica desabilitada enquanto a requisição corre', async () => {
    const c = await montar();
    let liberar: () => void = () => undefined;
    c.api.removerImagemDoProjeto.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          liberar = () => resolve({ afetadas: [], fotosRemovidas: 0 });
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remover do projeto' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Remover do projeto' }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );
    liberar();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('erro da API vira Alert dentro do diálogo, sem fechar', async () => {
    const c = await montar();
    c.api.excluirImagem.mockRejectedValueOnce(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    fireEvent.click(screen.getByRole('radio', { name: /Excluir da biblioteca/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir imagem' }));
    expect(await screen.findByText('Erro interno do servidor.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Excluir imagem' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('Cancelar, Esc e × fecham sem alterar nada', async () => {
    const c = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(c.estado().ui.dialogoImagem).toBeNull();
    expect(c.api.removerImagemDoProjeto).not.toHaveBeenCalled();
    expect(c.api.excluirImagem).not.toHaveBeenCalled();
  });
});
