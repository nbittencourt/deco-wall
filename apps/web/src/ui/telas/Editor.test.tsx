import { BORDA_PADRAO, GRID_PADRAO } from '@deco-wall/domain';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ErroApi, type ClienteApi, type ProjetoDto, type VarianteDto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { Editor } from './Editor';

// O Konva não roda no jsdom (ADR-10): o palco é trocado por um marcador. Todo o resto do editor
// (header, painéis, barras dos modos, diálogos, store) é real.
vi.mock('../canvas/Palco', () => ({ Palco: () => <div data-testid="palco" /> }));

// Editor: estados, header, salvamento e navegação (spec M1 §3.2, §3.3, §3.8, A-15, A-16, A-20, M1-02, M1-05).

const hex24 = (n: number) => n.toString(16).padStart(24, '0');
const ID_PROJETO = hex24(301);
const ID_VARIANTE = hex24(201);
const SALVA_EM = '2026-10-24T17:35:00.000Z'; // 14:35 em Brasília

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const PAREDE_SEM_ESCALA: NonNullable<ProjetoDto['parede']> = {
  perfil: 'leve',
  arquivo: `paredes/${ID_PROJETO}.webp`,
  thumb: `paredes/${ID_PROJETO}.thumb.webp`,
  larguraPx: 1200,
  alturaPx: 900,
  escala: { metodo: null },
};

const PAREDE_LINEAR: NonNullable<ProjetoDto['parede']> = {
  ...PAREDE_SEM_ESCALA,
  escala: {
    metodo: 'linear',
    linear: { p1: { x: 100, y: 100 }, p2: { x: 700, y: 100 }, comprimentoCm: 150 },
    homografia: [0.25, 0, 0, 0, 0.25, 0, 0, 0, 1],
  },
};

const PAREDE_PERSPECTIVA: NonNullable<ProjetoDto['parede']> = {
  ...PAREDE_SEM_ESCALA,
  escala: {
    metodo: 'perspectiva',
    perspectiva: {
      cantosPx: [
        { x: 200, y: 150 },
        { x: 1400, y: 250 },
        { x: 1400, y: 1050 },
        { x: 200, y: 1150 },
      ],
      larguraCm: 300,
      alturaCm: 200,
    },
    homografia: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  },
  retificada: {
    arquivo: `paredes/${ID_PROJETO}.retificada.webp`,
    larguraPx: 1200,
    alturaPx: 800,
    pxPorCm: 4,
    origemCm: { x: 0, y: 0 },
  },
};

const AREA_LINEAR = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };

function projeto(parede: ProjetoDto['parede'], nome = 'Sala'): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome,
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 2,
    ultimaVarianteId: ID_VARIANTE,
    parede,
    schemaVersion: 1,
  };
}

function variante(areaUtil: VarianteDto['areaUtil'], fotos: VarianteDto['fotos'] = []): VarianteDto {
  return {
    _id: ID_VARIANTE,
    projetoId: ID_PROJETO,
    nome: 'Base',
    ordem: 0,
    criadaEm: SALVA_EM,
    revisao: 1,
    salvaEm: SALVA_EM,
    salvaPorSessao: 'sistema',
    grid: { ...GRID_PADRAO },
    bordaPadrao: { ...BORDA_PADRAO },
    areaUtil,
    fotos,
    schemaVersion: 1,
  };
}

interface Cenario {
  parede: ProjetoDto['parede'];
  areaUtil?: VarianteDto['areaUtil'];
  fotos?: VarianteDto['fotos'];
  api?: Partial<ClienteApi>;
}

async function montar({ parede, areaUtil = null, fotos = [], api = {} }: Cenario) {
  const inicial = { projeto: projeto(parede), variantes: [variante(areaUtil, fotos)] };
  const cliente = {
    listarProjetos: vi.fn(),
    criarProjeto: vi.fn(),
    obterProjeto: vi.fn(async () => inicial),
    renomearProjeto: vi.fn(async (_id: string, nome: string) => ({ ...inicial.projeto, nome })),
    excluirProjeto: vi.fn(),
    enviarParede: vi.fn(),
    aplicarCalibracao: vi.fn(),
    aplicarPerspectiva: vi.fn(),
    salvarVariante: vi.fn(async () => ({ revisao: 2, salvaEm: SALVA_EM })),
    ...api,
  } as unknown as ClienteApi;
  const navegar = vi.fn();
  render(
    <TooltipProvider>
      <Editor projetoId={ID_PROJETO} api={cliente} navegar={navegar} />
    </TooltipProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return { api: cliente, navegar };
}

async function dicaDe(nome: string) {
  const botao = screen.getByRole('button', { name: nome });
  act(() => botao.focus());
  return botao;
}

describe('projeto sem parede (protótipo 02)', () => {
  it('mostra o título, o convite e a qualidade Leve marcada (RF-25)', async () => {
    await montar({ parede: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Sala' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Comece pela parede' })).toBeTruthy();
    expect(screen.getByText('Arraste a foto da parede aqui · JPG, PNG ou WEBP')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeTruthy();
    const qualidade = screen.getByRole('radiogroup', { name: 'Qualidade' });
    expect(within(qualidade).getByRole('radio', { name: 'Leve' }).getAttribute('aria-checked')).toBe('true');
    expect(
      within(qualidade)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Leve', 'Médio', 'Alto']);
  });

  it('Perspectiva, Calibrar e Área útil ficam inativos (A-16)', async () => {
    await montar({ parede: null });
    for (const nome of ['Perspectiva', 'Calibrar', 'Área útil']) {
      expect(screen.getByRole('button', { name: nome }).getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('Perspectiva e Calibrar explicam o motivo na dica', async () => {
    await montar({ parede: null });
    await dicaDe('Perspectiva');
    expect((await screen.findAllByText('Carregue a foto da parede primeiro.')).length).toBeGreaterThan(0);
  });

  it('Área útil sem escala explica o motivo', async () => {
    await montar({ parede: null });
    await dicaDe('Área útil');
    expect((await screen.findAllByText('Defina a escala primeiro.')).length).toBeGreaterThan(0);
  });

  it('arquivo HEIC é recusado no browser, sem chamar a API (RF-15)', async () => {
    const { api } = await montar({ parede: null });
    const entrada = screen.getByLabelText('Foto da parede');
    fireEvent.change(entrada, {
      target: { files: [new File(['x'], 'parede.heic', { type: 'image/heic' })] },
    });
    expect(await screen.findByText('Formato não suportado. Use JPG, PNG ou WEBP.')).toBeTruthy();
    expect(api.enviarParede).not.toHaveBeenCalled();
  });

  it('arquivo acima de 50 MB é recusado no browser', async () => {
    const { api } = await montar({ parede: null });
    const grande = new File(['x'], 'parede.jpg', { type: 'image/jpeg' });
    Object.defineProperty(grande, 'size', { value: 51 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText('Foto da parede'), { target: { files: [grande] } });
    expect(await screen.findByText('Arquivo maior que 50 MB.')).toBeTruthy();
    expect(api.enviarParede).not.toHaveBeenCalled();
  });

  it('envia a foto com a qualidade escolhida e abre o modo Perspectiva (M1-06)', async () => {
    const resposta = {
      projeto: { ...projeto(PAREDE_SEM_ESCALA), revisao: 3 },
      variantesAlteradas: [],
    };
    const { api } = await montar({ parede: null, api: { enviarParede: vi.fn(async () => resposta) } });

    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Qualidade' })).getByRole('radio', { name: 'Alto' }),
    );
    const arquivo = new File(['x'], 'parede.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Foto da parede'), { target: { files: [arquivo] } });

    await waitFor(() =>
      expect(api.enviarParede).toHaveBeenCalledWith(
        ID_PROJETO,
        { arquivo, perfil: 'alto', revisaoBase: 2 },
        expect.anything(),
      ),
    );
    expect(await screen.findByText('Correção de perspectiva')).toBeTruthy();
    expect(screen.getByText('Marque os quatro cantos de um retângulo real da parede')).toBeTruthy();
  });

  it('erro do servidor (ex.: 415) aparece como mensagem, sem sair do estado vazio', async () => {
    await montar({
      parede: null,
      api: {
        enviarParede: vi.fn(async () => {
          throw new ErroApi(415, { erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' });
        }),
      },
    });
    fireEvent.change(screen.getByLabelText('Foto da parede'), {
      target: { files: [new File(['x'], 'parede.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('Formato não suportado. Use JPG, PNG ou WEBP.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Comece pela parede' })).toBeTruthy();
  });
});

describe('parede sem escala', () => {
  it('mostra o aviso e os dois caminhos para definir a escala', async () => {
    await montar({ parede: PAREDE_SEM_ESCALA });
    expect(screen.getByText('Defina a escala da parede para posicionar fotos.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Corrigir perspectiva' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Calibrar com uma medida' })).toBeTruthy();
    expect(screen.getByTestId('palco')).toBeTruthy();
  });

  it('painel Escala: "Não definida"; Área útil continua inativa', async () => {
    await montar({ parede: PAREDE_SEM_ESCALA });
    expect(within(screen.getByRole('region', { name: 'Escala' })).getByText('Não definida')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Área útil' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('"Corrigir perspectiva" abre o modo e Cancelar volta com o aviso', async () => {
    await montar({ parede: PAREDE_SEM_ESCALA });
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir perspectiva' }));
    expect(await screen.findByText('Correção de perspectiva')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Defina a escala da parede para posicionar fotos.')).toBeTruthy();
  });

  it('"Calibrar com uma medida" abre o modo Calibração linear', async () => {
    await montar({ parede: PAREDE_SEM_ESCALA });
    fireEvent.click(screen.getByRole('button', { name: 'Calibrar com uma medida' }));
    expect(await screen.findByText('Calibração linear')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar escala' })).toBeTruthy();
  });

  it('no modo Perspectiva, o link "Pular" leva à calibração linear', async () => {
    await montar({ parede: PAREDE_SEM_ESCALA });
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir perspectiva' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pular e usar calibração linear' }));
    expect(await screen.findByText('Calibração linear')).toBeTruthy();
  });
});

describe('parede com escala', () => {
  it('chip de escala no header e painel Composição completo', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    expect(screen.queryByText('Defina a escala da parede para posicionar fotos.')).toBeNull();
    // Header e painel Escala mostram a mesma escala.
    expect(screen.getAllByText('4,0 px/cm').length).toBeGreaterThanOrEqual(2);
    const area = within(screen.getByRole('region', { name: 'Área útil desta variante' }));
    expect((area.getByLabelText('Largura') as HTMLInputElement).value).toBe('300,0');
    expect((area.getByLabelText('Altura') as HTMLInputElement).value).toBe('225,0');
  });

  it('com a perspectiva aplicada, "Calibrar" fica inativo e explica (M1-02)', async () => {
    await montar({ parede: PAREDE_PERSPECTIVA, areaUtil: { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 200 } });
    expect(screen.getByRole('button', { name: 'Calibrar' }).getAttribute('aria-disabled')).toBe('true');
    await dicaDe('Calibrar');
    expect(
      (await screen.findAllByText('Com a perspectiva aplicada, use Perspectiva para refazer a escala.'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('com escala linear, "Calibrar" e "Perspectiva" estão ativos', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    expect(screen.getByRole('button', { name: 'Calibrar' }).getAttribute('aria-disabled')).toBeNull();
    expect(screen.getByRole('button', { name: 'Perspectiva' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('"Recalibrar" do painel abre o modo do método atual', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Escala' })).getByRole('button', { name: 'Recalibrar' }),
    );
    expect(await screen.findByText('Calibração linear')).toBeTruthy();
  });

  it('"Área útil" abre o modo com a barra de confirmação (M1-08)', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('button', { name: 'Área útil' }));
    expect(await screen.findByText('Ajuste onde as fotos podem ficar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar área' }));
    await waitFor(() => expect(screen.queryByText('Ajuste onde as fotos podem ficar.')).toBeNull());
  });

  it('controles do M2 em diante continuam visíveis e inativos (A-15)', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    for (const nome of [
      'Exportar',
      'Comparar',
      'Templates',
      'Desfazer',
      'Refazer',
      'Adicionar',
      'Carregar fotos',
    ]) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-disabled'), nome).toBe('true');
    }
  });
});

describe('salvamento manual (M1-01)', () => {
  it('alterar o grid marca "Alterações não salvas"; Salvar grava e mostra a hora', async () => {
    const { api } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    expect(screen.getByText('Salvo')).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.salvarVariante).toHaveBeenCalledWith(
        ID_PROJETO,
        ID_VARIANTE,
        expect.objectContaining({ revisaoBase: 1, grid: expect.objectContaining({ visivel: false }) }),
      ),
    );
    expect(await screen.findByText('Salvo às 14:35')).toBeTruthy();
  });

  it('Ctrl+S salva, inclusive com o foco num campo, e bloqueia o "salvar página" do browser', async () => {
    const { api } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));

    const campo = within(screen.getByRole('region', { name: 'Área útil desta variante' })).getByLabelText(
      'X',
    );
    campo.focus();
    const naoCancelado = fireEvent.keyDown(campo, { key: 's', ctrlKey: true });

    expect(naoCancelado).toBe(false);
    await waitFor(() => expect(api.salvarVariante).toHaveBeenCalledTimes(1));
  });

  it('409 mostra o aviso com a hora e o botão Recarregar (descarta as alterações locais)', async () => {
    const { api } = await montar({
      parede: PAREDE_LINEAR,
      areaUtil: AREA_LINEAR,
      api: {
        salvarVariante: vi.fn(async () => {
          throw new ErroApi(409, { revisao: 3, salvaEm: SALVA_EM, salvaPorSessao: 'outra-aba' });
        }),
      },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain(
      'Esta variante foi salva em outra aba às 14:35. Recarregue para ver a versão salva.',
    );
    expect(screen.getByText('Conflito')).toBeTruthy();

    fireEvent.click(within(aviso).getByRole('button', { name: 'Recarregar' }));
    await waitFor(() => expect(api.obterProjeto).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('Salvo')).toBeTruthy();
  });
});

describe('nome do projeto no header (A-02)', () => {
  it('clicar no nome edita no lugar e Enter grava', async () => {
    const { api } = await montar({ parede: null });
    fireEvent.click(screen.getByRole('button', { name: 'Sala' }));
    const campo = screen.getByRole('textbox', { name: 'Nome do projeto' });
    fireEvent.change(campo, { target: { value: 'Corredor' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(api.renomearProjeto).toHaveBeenCalledWith(ID_PROJETO, 'Corredor'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Corredor' })).toBeTruthy();
  });
});

describe('voltar para Projetos (A-20)', () => {
  it('sem alterações, volta direto', async () => {
    const { navegar } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('link', { name: 'Voltar aos projetos' }));
    expect(navegar).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com alterações, pergunta; "Sair sem salvar" descarta e volta', async () => {
    const { navegar, api } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('link', { name: 'Voltar aos projetos' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Sair sem salvar?' });
    expect(navegar).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sair sem salvar' }));
    expect(navegar).toHaveBeenCalledWith('/');
    expect(api.salvarVariante).not.toHaveBeenCalled();
  });

  it('"Salvar e sair" grava primeiro e só então volta', async () => {
    const { navegar, api } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('link', { name: 'Voltar aos projetos' }));

    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salvar e sair' }));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/'));
    expect(api.salvarVariante).toHaveBeenCalledTimes(1);
  });

  it('"Cancelar" fica no editor', async () => {
    const { navegar } = await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('link', { name: 'Voltar aos projetos' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(navegar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('trocar a parede (M1-05)', () => {
  it('sem fotos: o botão "Parede" está ativo e pede confirmação', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    const botao = screen.getByRole('button', { name: 'Parede' });
    expect(botao.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(botao);
    const dialogo = await screen.findByRole('dialog', { name: 'Trocar a foto da parede?' });
    expect(within(dialogo).getByText('A escala e a área útil serão descartadas.')).toBeTruthy();
  });

  it('confirmar leva ao envio de uma nova foto', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('button', { name: 'Parede' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Trocar parede' }));
    expect(await screen.findByRole('heading', { name: 'Comece pela parede' })).toBeTruthy();
  });

  it('com alterações não salvas, pede para salvar antes', async () => {
    await montar({ parede: PAREDE_LINEAR, areaUtil: AREA_LINEAR });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Parede' }));
    expect(await screen.findByText('Salve as alterações antes de trocar a parede.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('com fotos em alguma variante, o botão fica inativo (RF-04 segue futuro)', async () => {
    await montar({
      parede: PAREDE_LINEAR,
      areaUtil: AREA_LINEAR,
      fotos: [
        {
          _id: hex24(101),
          imagemId: hex24(1),
          imagemAnteriorId: null,
          tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
          xCm: 40,
          yCm: 30,
          recorte: { offsetX: 0, offsetY: 0 },
          borda: { larguraCm: 0, cor: '#FFFFFF' },
        },
      ],
    });
    const botao = screen.getByRole('button', { name: 'Parede' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(botao);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
