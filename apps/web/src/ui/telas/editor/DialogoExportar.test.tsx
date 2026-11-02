import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import { ProvedorStore } from '../../../app/StoreContext';
import type { Exportador, ResultadoExportacao } from '../../../infra/exportacao';
import {
  abrirCenario,
  foto,
  ID_BASE,
  PAREDE_LINEAR,
  RETRATO,
  variante,
  vaga,
  type OpcoesCenario,
} from '../../../testes/cenario-m3';
import { TooltipProvider } from '../../componentes/ui/tooltip';
import { DialogoExportar } from './DialogoExportar';

// Diálogo "Exportar imagem" (RF-80, RN-12, RN-19, ADR-08, M4-10 a M4-12, M4-18, A-13 a A-19, A-28; protótipo 10;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §3.8).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  URL.createObjectURL = vi.fn(() => 'blob:previa');
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

const AGORA = new Date('2026-11-02T14:35:00-03:00');
const BLOB = new Blob(['x'], { type: 'image/png' });

type ExportadorFalso = { previa: Mock<Exportador['previa']>; exportar: Mock<Exportador['exportar']> };

function exportadorFalso(sobrescrita: Partial<ExportadorFalso> = {}): ExportadorFalso {
  return {
    previa: vi.fn<Exportador['previa']>(async () => ({ blob: BLOB, imagensIndisponiveis: 0 })),
    exportar: vi.fn<Exportador['exportar']>(async () => ({ blob: BLOB, imagensIndisponiveis: 0 })),
    ...sobrescrita,
  };
}

async function montar(opcoes: OpcoesCenario = {}, exportador = exportadorFalso()) {
  const c = await abrirCenario(opcoes);
  const baixar = vi.fn();
  render(
    <ProvedorStore store={c.store}>
      <TooltipProvider>
        <DialogoExportar exportador={exportador} baixar={baixar} agora={() => AGORA} />
      </TooltipProvider>
    </ProvedorStore>,
  );
  return { ...c, exportador, baixar };
}

async function abrir(c: Awaited<ReturnType<typeof montar>>) {
  await act(async () => {
    c.estado().abrirExportacao();
  });
  await screen.findByRole('dialog');
}

const VARIANTES = () => [variante({ fotos: [foto(1), vaga(2), foto(3)] })];
// Parede de 6144 × 4608 px (28 MP): o caso limite do perfil Alto (M4-18).
const PAREDE_ALTO = { ...PAREDE_LINEAR, larguraPx: 6144, alturaPx: 4608 };

describe('abertura (A-13)', () => {
  it('fechado por padrão', async () => {
    await montar();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mostra título, formato PNG por padrão, grid desligado, resolução e a nota', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    expect(screen.getByText('Exportar imagem')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'PNG' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'JPG' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: 'Incluir grid' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('1200 × 900 px')).toBeTruthy();
    expect(
      screen.getByText(
        'Espaços sem foto aparecem em vermelho hachurado. O que passar da parede é recortado.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Baixar PNG' })).toBeTruthy();
  });

  it('avisa que exporta o que está na tela só quando há alterações não salvas', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    expect(screen.queryByText('Exporta o que está na tela, inclusive alterações não salvas.')).toBeNull();
    cleanup();
    const sujo = await montar({ variantes: VARIANTES() });
    sujo.estado().alterarBordaPadrao({ larguraCm: 2 });
    await abrir(sujo);
    expect(screen.getByText('Exporta o que está na tela, inclusive alterações não salvas.')).toBeTruthy();
  });
});

describe('prévia (M4-12, A-17)', () => {
  it('é gerada ao abrir, em escala reduzida (lado maior 480 px), sem grid', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    await waitFor(() => expect(c.exportador.previa).toHaveBeenCalledTimes(1));
    const pedido = c.exportador.previa.mock.calls[0]![0];
    expect(Math.max(pedido.resolucao.larguraPx, pedido.resolucao.alturaPx)).toBe(480);
    expect(pedido.comandos.map((x) => x.tipo)).toEqual(['parede', 'foto', 'placeholder', 'foto']);
    expect(await screen.findByAltText('Prévia da exportação')).toBeTruthy();
  });

  it('é regenerada ao mudar "Incluir grid" (com a camada de grid abaixo das fotos)', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    await waitFor(() => expect(c.exportador.previa).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('switch', { name: 'Incluir grid' }));
    await waitFor(() => expect(c.exportador.previa).toHaveBeenCalledTimes(2));
    expect(c.exportador.previa.mock.calls[1]![0].comandos.map((x) => x.tipo)).toEqual([
      'parede',
      'grid',
      'foto',
      'placeholder',
      'foto',
    ]);
  });

  it('mudar o formato não regenera a prévia', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    await waitFor(() => expect(c.exportador.previa).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('radio', { name: 'JPG' }));
    await act(async () => undefined);
    expect(c.exportador.previa).toHaveBeenCalledTimes(1);
  });

  it('avisa quantas fotos saem como retângulo cinza (imagem indisponível)', async () => {
    const exportador = exportadorFalso({
      previa: vi.fn<Exportador['previa']>(async () => ({ blob: BLOB, imagensIndisponiveis: 2 })),
    });
    const c = await montar({ variantes: VARIANTES() }, exportador);
    await abrir(c);
    expect(
      await screen.findByText('2 fotos com imagem indisponível saem como retângulo cinza.'),
    ).toBeTruthy();
  });

  it('no singular', async () => {
    const exportador = exportadorFalso({
      previa: vi.fn<Exportador['previa']>(async () => ({ blob: BLOB, imagensIndisponiveis: 1 })),
    });
    const c = await montar({ variantes: VARIANTES() }, exportador);
    await abrir(c);
    expect(await screen.findByText('1 foto com imagem indisponível sai como retângulo cinza.')).toBeTruthy();
  });
});

describe('baixar (A-18, A-19)', () => {
  it('Baixar PNG gera na resolução da parede e baixa com o nome <projeto>-<variante>-AAAAMMDD-HHmm.png', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    await waitFor(() => expect(c.exportador.exportar).toHaveBeenCalledTimes(1));
    const pedido = c.exportador.exportar.mock.calls[0]![0];
    expect(pedido.formato).toBe('png');
    expect(pedido.resolucao).toEqual({ larguraPx: 1200, alturaPx: 900, pxPorCm: 4 });
    expect(pedido.comandos.map((x) => x.tipo)).toEqual(['parede', 'foto', 'placeholder', 'foto']);
    await waitFor(() => expect(c.baixar).toHaveBeenCalledWith(BLOB, 'sala-base-20261102-1435.png'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(c.estado().ui.exportacaoAberta).toBe(false);
  });

  it('JPG: o botão muda e o arquivo sai .jpg', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    fireEvent.click(screen.getByRole('radio', { name: 'JPG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Baixar JPG' }));
    await waitFor(() => expect(c.exportador.exportar).toHaveBeenCalled());
    expect(c.exportador.exportar.mock.calls[0]![0].formato).toBe('jpg');
    await waitFor(() => expect(c.baixar).toHaveBeenCalledWith(BLOB, 'sala-base-20261102-1435.jpg'));
  });

  it('com "Incluir grid" ligado, o pedido leva o comando de grid', async () => {
    const c = await montar({ variantes: VARIANTES() });
    await abrir(c);
    fireEvent.click(screen.getByRole('switch', { name: 'Incluir grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    await waitFor(() => expect(c.exportador.exportar).toHaveBeenCalled());
    expect(c.exportador.exportar.mock.calls[0]![0].comandos.map((x) => x.tipo)).toContain('grid');
  });

  it('exporta o estado em tela: a foto movida e não salva vai nos comandos', async () => {
    const c = await montar({ variantes: [variante({ fotos: [foto(1)] })] });
    c.estado().moverFoto(foto(1)._id, 100, 50);
    await abrir(c);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    await waitFor(() => expect(c.exportador.exportar).toHaveBeenCalled());
    const comando = c.exportador.exportar.mock.calls[0]![0].comandos.find((x) => x.tipo === 'foto');
    expect(comando).toMatchObject({ externo: { xCm: 100, yCm: 50 }, imagemId: RETRATO._id });
  });

  it('não grava nada no servidor', async () => {
    const c = await montar({ variantes: VARIANTES() });
    c.estado().alterarBordaPadrao({ larguraCm: 2 });
    await abrir(c);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    await waitFor(() => expect(c.baixar).toHaveBeenCalled());
    expect(c.api.salvarVariante).not.toHaveBeenCalled();
    expect(c.api.salvarRascunho).not.toHaveBeenCalled();
    expect(c.estado().documento.variante?._id).toBe(ID_BASE);
  });
});

describe('gerando, cancelar e erro (M4-12, A-19)', () => {
  it('enquanto gera: "Gerando…" desabilitado; Cancelar aborta e fecha', async () => {
    let sinal: AbortSignal | undefined;
    const exportador = exportadorFalso({
      exportar: vi.fn<Exportador['exportar']>(
        (pedido) =>
          new Promise<ResultadoExportacao>((_resolver, rejeitar) => {
            sinal = pedido.sinal;
            pedido.sinal?.addEventListener('abort', () =>
              rejeitar(new DOMException('Operação cancelada.', 'AbortError')),
            );
          }),
      ),
    });
    const c = await montar({ variantes: VARIANTES() }, exportador);
    await abrir(c);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    const gerando = await screen.findByRole('button', { name: 'Gerando…' });
    expect((gerando as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(sinal?.aborted).toBe(true);
    await waitFor(() => expect(c.estado().ui.exportacaoAberta).toBe(false));
    expect(c.baixar).not.toHaveBeenCalled();
  });

  it('fechar o diálogo (Esc) aborta a prévia em curso', async () => {
    let sinal: AbortSignal | undefined;
    const exportador = exportadorFalso({
      previa: vi.fn<Exportador['previa']>((pedido) => {
        sinal = pedido.sinal;
        return new Promise<ResultadoExportacao>(() => undefined);
      }),
    });
    const c = await montar({ variantes: VARIANTES() }, exportador);
    await abrir(c);
    await waitFor(() => expect(sinal).toBeDefined());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(sinal?.aborted).toBe(true));
  });

  it('falha vira Alert no diálogo e o botão passa a "Tentar de novo"', async () => {
    const exportar = vi
      .fn<Exportador['exportar']>()
      .mockRejectedValueOnce(new Error('sem memória'))
      .mockResolvedValueOnce({ blob: BLOB, imagensIndisponiveis: 0 });
    const c = await montar({ variantes: VARIANTES() }, exportadorFalso({ exportar }));
    await abrir(c);
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }));
    expect(await screen.findByText('Não foi possível gerar a imagem.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(c.baixar).toHaveBeenCalledWith(BLOB, 'sala-base-20261102-1435.png'));
    expect(exportar).toHaveBeenCalledTimes(2);
  });
});

describe('imagem grande: acima de 16 MP (M4-18, A-28)', () => {
  it('abre em JPG e informa a resolução', async () => {
    const c = await montar({ variantes: VARIANTES(), projeto: { parede: PAREDE_ALTO } });
    await abrir(c);
    expect(screen.getByRole('radio', { name: 'JPG' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('6144 × 4608 px')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Baixar JPG' })).toBeTruthy();
    expect(screen.queryByText(/Gerar PNG pode demorar/)).toBeNull();
  });

  it('escolher PNG mostra o aviso e o botão "Aceitar e baixar PNG"; nada é gerado antes do clique', async () => {
    const c = await montar({ variantes: VARIANTES(), projeto: { parede: PAREDE_ALTO } });
    await abrir(c);
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));
    expect(
      screen.getByText(
        'Esta imagem tem 28,3 MP. Gerar PNG pode demorar bastante e o arquivo fica grande. JPG é mais rápido e abre em qualquer computador.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Baixar PNG' })).toBeNull();
    expect(c.exportador.exportar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar e baixar PNG' }));
    await waitFor(() => expect(c.exportador.exportar).toHaveBeenCalledTimes(1));
    expect(c.exportador.exportar.mock.calls[0]![0].formato).toBe('png');
  });

  it('voltar a JPG desfaz o aviso', async () => {
    const c = await montar({ variantes: VARIANTES(), projeto: { parede: PAREDE_ALTO } });
    await abrir(c);
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));
    fireEvent.click(screen.getByRole('radio', { name: 'JPG' }));
    expect(screen.queryByText(/Gerar PNG pode demorar/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Baixar JPG' })).toBeTruthy();
  });

  it('Cancelar desfaz o aviso e fecha, sem gerar', async () => {
    const c = await montar({ variantes: VARIANTES(), projeto: { parede: PAREDE_ALTO } });
    await abrir(c);
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(c.estado().ui.exportacaoAberta).toBe(false);
    expect(c.exportador.exportar).not.toHaveBeenCalled();
  });
});
