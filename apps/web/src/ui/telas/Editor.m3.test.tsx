import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  criarCenario,
  foto,
  ID_BASE,
  ID_PROJETO,
  ID_V2,
  variante,
  type OpcoesCenario,
} from '../../testes/cenario-m3';
import { agendador } from '../../app/autosave';
import { ErroApi } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Editor } from './Editor';

// O Konva não roda no jsdom (ADR-10): o palco é trocado por um marcador. O resto do editor é real.
vi.mock('../canvas/Palco', () => ({ Palco: () => <div data-testid="palco" /> }));

// Editor no M3 (docs/specs/M3-variantes-templates-e-salvamento.md §3): seletor de variante, decisão ao deixar a ativa
// suja, galeria e posicionamento de template, comparação, salvamento automático, recuperação e conflito.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// O temporizador do salvamento automático passa pelo `agendador`: o teste o captura e dispara os "ticks" à mão,
// sem relógio falso (que atrapalharia a espera do Testing Library).
function interceptarAgendador() {
  const ativos = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  vi.spyOn(agendador, 'periodico').mockImplementation((fn, ms) => {
    const id = (n += 1);
    ativos.set(id, { fn, ms });
    return () => ativos.delete(id);
  });
  return {
    intervaloMs: () => [...ativos.values()].at(-1)?.ms,
    tick: async () => {
      await act(async () => {
        for (const { fn } of ativos.values()) fn();
      });
    },
  };
}

async function montar(opcoes: OpcoesCenario = {}) {
  const cenario = criarCenario(opcoes);
  const navegar = vi.fn();
  render(
    <TooltipProvider>
      <Editor projetoId={ID_PROJETO} api={cenario.api} navegar={navegar} />
    </TooltipProvider>,
  );
  // Com um diálogo aberto ao carregar (recuperação), o resto da tela fica oculto para o leitor de tela.
  await screen.findByRole('button', { name: /^Variante: /, hidden: true });
  return { ...cenario, navegar };
}

const gatilho = () => screen.getByRole('button', { name: /^Variante: /, hidden: true });
const abrirSeletor = () => fireEvent.click(gatilho());
const lista = () => screen.getByRole('dialog');

// Alterar o grid marca a variante como alterada (M1) sem depender do canvas.
function sujarAAtiva() {
  fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
}

describe('seletor de variante no header (A-01)', () => {
  it('mostra a variante aberta e a lista com todas', async () => {
    await montar();
    expect(gatilho().textContent).toContain('Base');
    abrirSeletor();
    expect(within(lista()).getByRole('button', { name: /^Base/ })).toBeTruthy();
    expect(within(lista()).getByRole('button', { name: /^Variante 2/ })).toBeTruthy();
    expect(within(lista()).getByText('1 sem foto')).toBeTruthy();
  });

  it('alternar entre variantes salvas troca a ativa e grava a última aberta', async () => {
    const { api } = await montar();
    abrirSeletor();
    fireEvent.click(within(lista()).getByRole('button', { name: /^Variante 2/ }));
    await waitFor(() => expect(gatilho().textContent).toContain('Variante 2'));
    expect(api.definirUltimaVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2);
    // O selo da ativa passou a ser o da variante 2 (1 vaga).
    expect(gatilho().textContent).toContain('1 sem foto');
  });
});

describe('decisão ao deixar a variante com alterações (A-12, M3-03)', () => {
  async function comAlteracoes() {
    const c = await montar();
    sujarAAtiva();
    expect(screen.getByRole('img', { name: 'Alterações não salvas' })).toBeTruthy();
    abrirSeletor();
    fireEvent.click(within(lista()).getByRole('button', { name: /^Variante 2/ }));
    return c;
  }

  it('trocar com alterações pergunta antes: Cancelar mantém tudo como está', async () => {
    const { api } = await comAlteracoes();
    const dialogo = await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gatilho().textContent).toContain('Base');
    expect(api.salvarVariante).not.toHaveBeenCalled();
  });

  it('Salvar e continuar grava a ativa e troca', async () => {
    const { api } = await comAlteracoes();
    const dialogo = await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar e continuar' }));
    await waitFor(() => expect(gatilho().textContent).toContain('Variante 2'));
    expect(api.salvarVariante).toHaveBeenCalledTimes(1);
    expect(api.salvarVariante.mock.calls[0]![1]).toBe(ID_BASE);
  });

  it('Descartar alterações troca sem salvar e apaga o rascunho da sessão', async () => {
    const { api } = await comAlteracoes();
    const dialogo = await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar alterações' }));
    await waitFor(() => expect(gatilho().textContent).toContain('Variante 2'));
    expect(api.salvarVariante).not.toHaveBeenCalled();
    expect(api.apagarRascunho).toHaveBeenCalled();
    // Voltando a Base, o grid alterado não ficou.
    abrirSeletor();
    fireEvent.click(within(lista()).getByRole('button', { name: /^Base/ }));
    await waitFor(() => expect(gatilho().textContent).toContain('Base'));
    expect(screen.queryByRole('img', { name: 'Alterações não salvas' })).toBeNull();
  });

  it('Salvar e continuar com conflito interrompe a ação e abre o diálogo de conflito', async () => {
    const { servidor } = await comAlteracoes();
    servidor.get(ID_BASE)!.revisao = 2;
    const dialogo = await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar e continuar' }));
    expect(await screen.findByText('Esta variante foi salva em outra aba')).toBeTruthy();
    expect(gatilho().textContent).toContain('Base');
  });

  it('nova variante, duplicar e template também pedem a decisão', async () => {
    await montar();
    sujarAAtiva();
    abrirSeletor();
    fireEvent.click(screen.getByRole('button', { name: 'Nova variante em branco…' }));
    expect(await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(await screen.findByRole('dialog', { name: /Salvar as alterações de “Base”\?/ })).toBeTruthy();
  });
});

describe('criar, duplicar, renomear e excluir (M3-04, A-02)', () => {
  it('Nova variante em branco: o nome sugerido é "Variante 3"; criar abre a nova', async () => {
    const { api } = await montar();
    abrirSeletor();
    fireEvent.click(screen.getByRole('button', { name: 'Nova variante em branco…' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nova variante' });
    expect((within(dialogo).getByRole('textbox') as HTMLInputElement).value).toBe('Variante 3');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar variante' }));
    await waitFor(() => expect(gatilho().textContent).toContain('Variante 3'));
    expect(api.criarVariante).toHaveBeenCalledWith(
      ID_PROJETO,
      expect.objectContaining({ nome: 'Variante 3', origem: { tipo: 'vazia' } }),
    );
  });

  it('Duplicar: sugere "<nome> (cópia)" e copia as fotos em tela', async () => {
    const { api } = await montar();
    abrirSeletor();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar “Base”…' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Duplicar variante' });
    expect((within(dialogo).getByRole('textbox') as HTMLInputElement).value).toBe('Base (cópia)');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Duplicar' }));
    await waitFor(() => expect(gatilho().textContent).toContain('Base (cópia)'));
    expect(api.criarVariante.mock.calls[0]![1].origem).toEqual({ tipo: 'copia', fotos: [foto(1), foto(2)] });
  });

  it('Renomear pelo menu ⋯', async () => {
    const { api } = await montar();
    abrirSeletor();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações de Variante 2' }), { button: 0 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Renomear' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Renomear variante' });
    fireEvent.change(within(dialogo).getByRole('textbox'), { target: { value: 'Sala escura' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Renomear' }));
    await waitFor(() => expect(api.renomearVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2, 'Sala escura'));
  });

  it('Excluir pede confirmação e a última variante não se exclui', async () => {
    const { api } = await montar();
    abrirSeletor();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações de Variante 2' }), { button: 0 });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Excluir variante' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir variante' }));
    await waitFor(() => expect(api.excluirVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    abrirSeletor();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações de Base' }), { button: 0 });
    expect((await screen.findByRole('menuitem', { name: 'Excluir' })).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});

describe('Comparar e Templates no header (A-25)', () => {
  it('Comparar fica inativo com menos de 2 variantes e Exportar continua inativo', async () => {
    await montar({ variantes: [variante()] });
    expect(screen.getByRole('button', { name: 'Comparar' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Exportar' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Templates' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('Comparar abre a tela de comparação com 2 variantes', async () => {
    const { navegar } = await montar();
    const botao = screen.getByRole('button', { name: 'Comparar' });
    expect(botao.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(botao);
    expect(navegar).toHaveBeenCalledWith(`/projetos/${ID_PROJETO}/comparar`);
  });
});

describe('templates: galeria e posicionamento (RF-93, RN-32)', () => {
  async function abrirGaleria() {
    const c = await montar();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    const dialogo = await screen.findByRole('dialog', { name: /Escolher template/ });
    return { ...c, dialogo };
  }

  it('a galeria mostra os 12 modelos com a Pirâmide pré-selecionada', async () => {
    const { dialogo } = await abrirGaleria();
    expect(within(dialogo).getAllByRole('radio')).toHaveLength(12);
    expect(within(dialogo).getByText('Área útil da variante: 200,0 × 150,0 cm')).toBeTruthy();
  });

  it('Posicionar na parede entra no modo com o painel do conjunto; Cancelar volta à galeria', async () => {
    const { dialogo } = await abrirGaleria();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    expect(await screen.findByText('Posicionar template · Pirâmide')).toBeTruthy();
    expect(screen.getByText('6 vagas · nova variante “Pirâmide”')).toBeTruthy();
    expect(screen.getByText('Arraste para posicionar · Enter confirma · Esc cancela')).toBeTruthy();
    // Painel direito (A-22): posição editável e Centralizar.
    expect(screen.getByRole('textbox', { name: 'X' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Y' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Centralizar na área útil' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('dialog', { name: /Escolher template/ })).toBeTruthy();
  });

  it('digitar X e Y move o conjunto; Centralizar volta ao centro', async () => {
    const { dialogo } = await abrirGaleria();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    await screen.findByText('Posicionar template · Pirâmide');
    const x = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;
    const inicial = x.value;
    fireEvent.change(x, { target: { value: '40' } });
    fireEvent.keyDown(x, { key: 'Enter' });
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value).toBe('40,0'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Centralizar na área útil' }));
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value).toBe(inicial),
    );
  });

  it('as setas movem o conjunto por passos do grid; Shift anda 5 passos (A-21)', async () => {
    const { dialogo } = await abrirGaleria();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    await screen.findByText('Posicionar template · Pirâmide');
    const valorX = () =>
      Number((screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement).value.replace(',', '.'));
    const inicial = valorX();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    const depois = valorX();
    expect(depois).toBeGreaterThan(inicial);
    expect(depois % 5).toBeCloseTo(0, 5);
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    expect(valorX()).toBe(depois + 25);
  });

  it('Confirmar posição cria a variante com o nome do modelo, avisa e mostra "6 sem foto"', async () => {
    const { api, dialogo } = await abrirGaleria();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    await screen.findByText('Posicionar template · Pirâmide');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar posição' }));
    await waitFor(() => expect(gatilho().textContent).toContain('Pirâmide'));
    expect(api.criarVariante.mock.calls[0]![1].origem).toMatchObject({
      tipo: 'template',
      templateId: 'piramide',
    });
    expect(gatilho().textContent).toContain('6 sem foto');
    expect(screen.getByText('Variante “Pirâmide” criada com 6 vagas.')).toBeTruthy();
  });

  it('template maior que a área útil: avisa, mas deixa confirmar', async () => {
    await montar({ variantes: [variante({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 100, alturaCm: 60 } })] });
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    const dialogo = await screen.findByRole('dialog', { name: /Escolher template/ });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    await screen.findByText('Posicionar template · Pirâmide');
    expect(screen.getAllByText(/O template é maior que a área útil/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Confirmar posição' }).getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('falha ao criar: continua no modo, com a mensagem', async () => {
    const { api, dialogo } = await abrirGaleria();
    api.criarVariante.mockRejectedValueOnce(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Posicionar na parede' }));
    await screen.findByText('Posicionar template · Pirâmide');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar posição' }));
    expect(await screen.findByText('Erro interno do servidor.')).toBeTruthy();
    expect(screen.getByText('Posicionar template · Pirâmide')).toBeTruthy();
  });
});

describe('salvamento automático (RF-71, SV-01, A-06, A-07)', () => {
  it('a cada AUTOSAVE_MINUTOS grava o rascunho se houve alteração; o status vira "Rascunho salvo"', async () => {
    const relogio = interceptarAgendador();
    const { api } = await montar({ autosaveMinutos: 5 });
    expect(relogio.intervaloMs()).toBe(5 * 60_000);
    await relogio.tick();
    expect(api.salvarRascunho).not.toHaveBeenCalled();

    sujarAAtiva();
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
    await relogio.tick();
    await waitFor(() => expect(screen.getByText('Rascunho salvo às 10:10')).toBeTruthy());
    expect(api.salvarRascunho).toHaveBeenCalledTimes(1);
    expect(api.salvarVariante).not.toHaveBeenCalled();

    // Sem nova alteração, o tick seguinte não grava de novo.
    await relogio.tick();
    expect(api.salvarRascunho).toHaveBeenCalledTimes(1);

    // O hard save volta o status a "Salvo".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByText(/^Salvo às/)).toBeTruthy());
  });

  it('usa o intervalo vindo de /api/config', async () => {
    const relogio = interceptarAgendador();
    await montar({ autosaveMinutos: 2 });
    await waitFor(() => expect(relogio.intervaloMs()).toBe(2 * 60_000));
  });

  it('duas falhas seguidas mostram o aviso dispensável', async () => {
    const relogio = interceptarAgendador();
    const { api } = await montar({ autosaveMinutos: 1 });
    api.salvarRascunho.mockRejectedValue(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    sujarAAtiva();
    await relogio.tick();
    expect(screen.queryByText('Não foi possível salvar o rascunho automático. Use Salvar.')).toBeNull();
    await relogio.tick();
    const aviso = await screen.findByText('Não foi possível salvar o rascunho automático. Use Salvar.');
    fireEvent.click(
      within(aviso.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'Dispensar' }),
    );
    expect(screen.queryByText('Não foi possível salvar o rascunho automático. Use Salvar.')).toBeNull();
  });

  it('conflito no rascunho: Alert com "Resolver…", sem abrir o diálogo; Resolver… abre', async () => {
    const relogio = interceptarAgendador();
    const { servidor } = await montar({ autosaveMinutos: 1 });
    sujarAAtiva();
    servidor.get(ID_BASE)!.revisao = 2;
    await relogio.tick();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('Esta variante foi salva em outra aba às');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Conflito')).toBeTruthy();
    fireEvent.click(within(alerta).getByRole('button', { name: 'Resolver…' }));
    expect(await screen.findByText('Esta variante foi salva em outra aba')).toBeTruthy();
  });
});

describe('conflito no Salvar (RF-73, A-14)', () => {
  it('abre o diálogo; só a palavra digitada libera a saída; Manter a minha grava e fecha', async () => {
    const { api, servidor } = await montar();
    sujarAAtiva();
    servidor.get(ID_BASE)!.revisao = 2;
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Esta variante foi salva em outra aba')).toBeTruthy();
    const manter = within(dialogo).getByRole('button', { name: 'Manter a minha' });
    expect(manter.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(manter);
    expect(api.salvarVariante).toHaveBeenCalledTimes(1);

    fireEvent.change(
      within(dialogo).getByRole('textbox', { name: 'Para confirmar, digite a palavra da opção' }),
      {
        target: { value: 'minha' },
      },
    );
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Manter a minha' }));
    await waitFor(() => expect(api.salvarVariante).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByText(/^Salvo às/)).toBeTruthy());
  });

  it('Esc deixa o conflito para depois: o Alert com Resolver… fica', async () => {
    const { servidor } = await montar();
    sujarAAtiva();
    servidor.get(ID_BASE)!.revisao = 2;
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Resolver…' })).toBeTruthy();
    // Salvar de novo reabre o diálogo.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('recuperação de rascunho (SV-07, M3-08)', () => {
  const resumo = {
    varianteId: ID_BASE,
    sessaoId: 'aba-fechada',
    salvoEm: '2026-11-02T13:20:00.000Z',
    revisaoBase: 1,
    qtdFotos: 1,
  };
  const guardado = {
    [`${ID_BASE}:aba-fechada`]: {
      sessaoId: 'aba-fechada',
      revisaoBase: 1,
      conteudo: {
        grid: variante().grid,
        bordaPadrao: { larguraCm: 3, cor: '#FFFFFF' },
        areaUtil: variante().areaUtil,
        fotos: [foto(1)],
      },
      salvoEm: resumo.salvoEm,
    },
  };

  it('oferece ao abrir; Recuperar deixa a variante com alterações não salvas', async () => {
    await montar({ rascunhos: [resumo], rascunhosGuardados: guardado });
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Recuperar alterações não salvas de 10:20?')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Recuperar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
  });

  it('Descartar apaga o rascunho; fechar mantém', async () => {
    const { api } = await montar({ rascunhos: [resumo], rascunhosGuardados: guardado });
    let dialogo = await screen.findByRole('dialog');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.apagarRascunho).not.toHaveBeenCalled();

    cleanup();
    const c2 = await montar({ rascunhos: [resumo], rascunhosGuardados: guardado });
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }));
    await waitFor(() =>
      expect(c2.api.apagarRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, 'aba-fechada'),
    );
  });
});

describe('barra de status e Salvar (A-13)', () => {
  it('o tooltip do Salvar nomeia a variante', async () => {
    await montar();
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.focus(salvar);
    expect(await screen.findAllByText('Salvar “Base” (Ctrl+S)')).toBeTruthy();
  });
});
