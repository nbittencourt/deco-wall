import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  criarCenario,
  foto,
  hex,
  ID_BASE,
  ID_PROJETO,
  PAISAGEM,
  RETRATO,
  variante,
  vaga,
  type OpcoesCenario,
} from '../../testes/cenario-m3';
import type { PropsPalco } from '../canvas/Palco';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Editor } from './Editor';

// O Konva não roda no jsdom (ADR-10) e o Worker da exportação tampouco: o palco e o exportador são marcadores.
// O palco vira um conjunto de botões, um por foto, que selecionam como o clique no canvas faria.
vi.mock('../canvas/Palco', () => ({
  Palco: ({ cena }: PropsPalco) => (
    <div data-testid="palco">
      {cena.tipo === 'parede' &&
        cena.fotos.map((f) => (
          <button key={f.id} aria-label={`selecionar ${f.id}`} onClick={() => cena.onSelecionar?.(f.id)} />
        ))}
    </div>
  ),
}));
vi.mock('../../infra/exportacao', () => ({
  exportadorWorker: {
    previa: vi.fn(async () => ({ blob: new Blob(['x']), imagensIndisponiveis: 0 })),
    exportar: vi.fn(async () => ({ blob: new Blob(['x']), imagensIndisponiveis: 0 })),
  },
}));

// Editor no M4 (docs/specs/M4-ciclo-de-vida-e-exportacao.md §3): ligação do menu da miniatura, da decisão da A-12,
// do painel do placeholder e do botão Exportar.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

async function montar(opcoes: OpcoesCenario = {}) {
  const cenario = criarCenario(opcoes);
  const navegar = vi.fn();
  render(
    <TooltipProvider>
      <Editor projetoId={ID_PROJETO} api={cenario.api} navegar={navegar} />
    </TooltipProvider>,
  );
  await screen.findByRole('button', { name: /^Variante: /, hidden: true });
  return { ...cenario, navegar };
}

const abrirMenuDaMiniatura = async (nome: string) => {
  fireEvent.pointerDown(await screen.findByRole('button', { name: `Mais ações de ${nome}` }), {
    button: 0,
    ctrlKey: false,
  });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Remover ou excluir…' }));
};

const COM_USOS = () => [
  variante({ fotos: [foto(1), foto(2), foto(5, { imagemId: PAISAGEM._id })] }),
  variante({ _id: hex(202), nome: 'Variante 2', ordem: 1, fotos: [foto(3), vaga(4)] }),
];

describe('menu da miniatura → diálogo de imagem (M4-03, A-03)', () => {
  it('com a ativa salva, abre direto o diálogo com as associações', async () => {
    const { api } = await montar({ variantes: COM_USOS() });
    await abrirMenuDaMiniatura('foto-1.jpg');
    expect(await screen.findByText('O que deseja fazer com esta imagem?')).toBeTruthy();
    expect(api.associacoesDaImagem).toHaveBeenCalledWith(RETRATO._id);
    expect(await screen.findByText('Usada em 3 lugares')).toBeTruthy();
  });

  it('remover do projeto: a ativa é recarregada e o aviso aparece', async () => {
    const { api } = await montar({ variantes: COM_USOS() });
    await abrirMenuDaMiniatura('foto-1.jpg');
    fireEvent.click(await screen.findByRole('button', { name: 'Remover do projeto' }));
    await waitFor(() => expect(api.removerImagemDoProjeto).toHaveBeenCalledWith(ID_PROJETO, RETRATO._id));
    expect(await screen.findByText('“foto-1.jpg” removida do projeto: 3 fotos em 2 variantes.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com a ativa suja, a decisão da A-12 vem antes; Cancelar não abre o diálogo de imagem', async () => {
    const { api } = await montar({ variantes: COM_USOS() });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    await abrirMenuDaMiniatura('foto-1.jpg');
    expect(await screen.findByText('Salvar as alterações de “Base”?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Salvar as alterações de “Base”?')).toBeNull());
    expect(api.associacoesDaImagem).not.toHaveBeenCalled();
  });

  it('"Salvar e continuar" salva a ativa e abre o diálogo de imagem', async () => {
    const { api } = await montar({ variantes: COM_USOS() });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    await abrirMenuDaMiniatura('foto-1.jpg');
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar e continuar' }));
    await waitFor(() => expect(api.salvarVariante).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('O que deseja fazer com esta imagem?')).toBeTruthy();
  });

  it('"Descartar alterações" descarta e abre o diálogo de imagem', async () => {
    const { api } = await montar({ variantes: COM_USOS() });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    await abrirMenuDaMiniatura('foto-1.jpg');
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar alterações' }));
    expect(await screen.findByText('O que deseja fazer com esta imagem?')).toBeTruthy();
    expect(api.salvarVariante).not.toHaveBeenCalled();
  });
});

describe('painel do placeholder (RF-30a, M4-08)', () => {
  const comVaga = () => [
    variante({
      fotos: [vaga(1, { imagemAnteriorId: PAISAGEM._id }), vaga(2, { imagemAnteriorId: hex(77) })],
    }),
  ];

  async function selecionar(_c: Awaited<ReturnType<typeof montar>>, n: number) {
    fireEvent.click(await screen.findByRole('button', { name: `selecionar ${hex(1000 + n)}` }));
  }

  it('recomenda a imagem anterior ativa; Usar preenche mantendo formato e posição', async () => {
    const c = await montar({ variantes: comVaga() });
    await selecionar(c, 1);
    expect(await screen.findByText('Foto anterior, restaurada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    await waitFor(() => expect(screen.queryByText('Foto anterior, restaurada')).toBeNull());
    expect(screen.queryByText('Sem foto')).toBeNull();
  });

  it('sem recomendação (anterior ausente da biblioteca), o card não aparece', async () => {
    const c = await montar({ variantes: comVaga() });
    await selecionar(c, 2);
    await screen.findByText('Sem foto');
    expect(screen.queryByText('Foto anterior, restaurada')).toBeNull();
  });

  it('Escolher outra na biblioteca leva o foco à primeira miniatura', async () => {
    const c = await montar({ variantes: comVaga() });
    await selecionar(c, 1);
    fireEvent.click(await screen.findByRole('button', { name: 'Escolher outra na biblioteca' }));
    const biblioteca = screen.getByRole('complementary', { name: 'Biblioteca' });
    const primeira = within(biblioteca).getAllByRole('button', { name: /^foto-\d\.jpg, / })[0]!;
    expect(document.activeElement).toBe(primeira);
  });
});

describe('Exportar no header (A-13)', () => {
  it('abre o diálogo "Exportar imagem" com a escala definida', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Exportar imagem')).toBeTruthy();
  });

  it('sem escala, fica inativo e explica o motivo', async () => {
    await montar({ projeto: { parede: null } });
    const botao = screen.getByRole('button', { name: 'Exportar' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(botao);
    expect(screen.queryByText('Exportar imagem')).toBeNull();
  });

  it('fica inativo em qualquer modo (ex.: Área útil)', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Área útil' }));
    await screen.findByText('Ajuste onde as fotos podem ficar.');
    expect(screen.getByRole('button', { name: 'Exportar' }).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('aviso do ciclo de vida', () => {
  it('o aviso some ao ser dispensado e cobre o caso de salvar com imagem excluída em outra aba (A-11)', async () => {
    const { api } = await montar({
      excluirAoSalvar: [RETRATO._id],
      variantes: [variante({ fotos: [foto(1)] })],
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.salvarVariante).toHaveBeenCalled());
    expect(
      await screen.findByText('1 foto virou espaço sem foto porque a imagem foi excluída em outra aba.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }));
    await waitFor(() =>
      expect(
        screen.queryByText('1 foto virou espaço sem foto porque a imagem foi excluída em outra aba.'),
      ).toBeNull(),
    );
    expect(ID_BASE).toBeTruthy();
  });
});
