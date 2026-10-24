import { GRID_PADRAO, BORDA_PADRAO } from '@deco-wall/domain';
import { describe, expect, it, vi } from 'vitest';
import { ErroApi, type ClienteApi, type ProjetoDto, type VarianteDto } from '../infra/dto';
import { criarStoreEditor } from './store';

// Store do editor (ADR-03, docs/specs/M1-parede-e-escala.md §3.8, §6): fatias `documento` e `ui`,
// ações nomeadas. O cliente HTTP entra por injeção (porta), então não há rede nos testes.

const hex24 = (n: number) => n.toString(16).padStart(24, '0');
const ID_PROJETO = hex24(301);
const ID_VARIANTE = hex24(201);
const SALVA_EM = '2026-10-24T17:35:00.000Z'; // 14:35 em Brasília

function variante(sobrescrita: Partial<VarianteDto> = {}): VarianteDto {
  return {
    _id: ID_VARIANTE,
    projetoId: ID_PROJETO,
    nome: 'Base',
    ordem: 0,
    criadaEm: SALVA_EM,
    revisao: 1,
    salvaEm: SALVA_EM,
    salvaPorSessao: 'sistema',
    grid: { ...GRID_PADRAO, principalACada: 5 },
    bordaPadrao: { ...BORDA_PADRAO },
    areaUtil: null,
    fotos: [],
    schemaVersion: 1,
    ...sobrescrita,
  };
}

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

function projeto(sobrescrita: Partial<ProjetoDto> = {}): ProjetoDto {
  return {
    _id: ID_PROJETO,
    nome: 'Sala',
    criadoEm: SALVA_EM,
    atualizadoEm: SALVA_EM,
    revisao: 1,
    ultimaVarianteId: ID_VARIANTE,
    parede: null,
    schemaVersion: 1,
    ...sobrescrita,
  };
}

function apiFalsa(
  inicial: { projeto: ProjetoDto; variantes: VarianteDto[] },
  sobrescrita: Partial<ClienteApi> = {},
): ClienteApi {
  return {
    listarProjetos: vi.fn(async () => []),
    criarProjeto: vi.fn(async () => inicial),
    obterProjeto: vi.fn(async () => inicial),
    renomearProjeto: vi.fn(async (_id: string, nome: string) => ({ ...inicial.projeto, nome })),
    excluirProjeto: vi.fn(async () => undefined),
    enviarParede: vi.fn(),
    aplicarCalibracao: vi.fn(),
    aplicarPerspectiva: vi.fn(),
    salvarVariante: vi.fn(async () => ({ revisao: 2, salvaEm: SALVA_EM })),
    ...sobrescrita,
  } as ClienteApi;
}

async function aberto(
  inicial = { projeto: projeto(), variantes: [variante()] },
  sobrescrita: Partial<ClienteApi> = {},
) {
  const api = apiFalsa(inicial, sobrescrita);
  const store = criarStoreEditor(api);
  await store.getState().abrirProjeto(ID_PROJETO);
  return { api, store };
}

describe('abrirProjeto', () => {
  it('carrega projeto e variante ativa, sem alterações e com sessão própria', async () => {
    const { store, api } = await aberto();
    const { documento, ui } = store.getState();
    expect(api.obterProjeto).toHaveBeenCalledWith(ID_PROJETO);
    expect(documento.projeto?._id).toBe(ID_PROJETO);
    expect(documento.variante?._id).toBe(ID_VARIANTE);
    expect(documento.revisaoBase).toBe(1);
    expect(documento.sujo).toBe(false);
    expect(documento.salvamento.tipo).toBe('salvo');
    expect(documento.sessaoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ui.modo).toBe('editor');
  });

  it('abre na ultimaVarianteId', async () => {
    const outra = variante({ _id: hex24(202), nome: 'Outra', ordem: 1 });
    const { store } = await aberto({
      projeto: projeto({ ultimaVarianteId: outra._id }),
      variantes: [variante(), outra],
    });
    expect(store.getState().documento.variante?.nome).toBe('Outra');
  });

  it('cada store (aba) tem o seu sessaoId', async () => {
    const a = (await aberto()).store.getState().documento.sessaoId;
    const b = (await aberto()).store.getState().documento.sessaoId;
    expect(a).not.toBe(b);
  });
});

describe('alterações da variante (M1-01)', () => {
  it('alterarGrid altera a variante e marca "Alterações não salvas"', async () => {
    const { store } = await aberto();
    store.getState().alterarGrid({ passoCm: 10, opacidade: 0.2 });
    const { documento } = store.getState();
    expect(documento.variante?.grid).toMatchObject({ passoCm: 10, opacidade: 0.2, visivel: true });
    expect(documento.sujo).toBe(true);
    expect(documento.salvamento.tipo).toBe('alteracoes');
  });

  it('definirAreaUtil limita à parede inteira (A-13) e marca como alterado', async () => {
    const { store } = await aberto({
      projeto: projeto({ parede: PAREDE_LINEAR }),
      variantes: [variante({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 } })],
    });
    store.getState().definirAreaUtil({ xCm: -10, yCm: 0, larguraCm: 999, alturaCm: 100 });
    const { documento } = store.getState();
    expect(documento.variante?.areaUtil).toEqual({ xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 100 });
    expect(documento.sujo).toBe(true);
  });

  it('usarParedeInteira volta a área útil à parede inteira', async () => {
    const { store } = await aberto({
      projeto: projeto({ parede: PAREDE_LINEAR }),
      variantes: [variante({ areaUtil: { xCm: 10, yCm: 10, larguraCm: 50, alturaCm: 50 } })],
    });
    store.getState().usarParedeInteira();
    expect(store.getState().documento.variante?.areaUtil).toEqual({
      xCm: 0,
      yCm: 0,
      larguraCm: 300,
      alturaCm: 225,
    });
  });

  it('confirmarAreaUtil aplica a área e volta ao modo editor', async () => {
    const { store } = await aberto({
      projeto: projeto({ parede: PAREDE_LINEAR }),
      variantes: [variante({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 } })],
    });
    store.getState().definirModo('area-util');
    store.getState().confirmarAreaUtil({ xCm: 5, yCm: 5, larguraCm: 100, alturaCm: 100 });
    expect(store.getState().ui.modo).toBe('editor');
    expect(store.getState().documento.variante?.areaUtil).toEqual({
      xCm: 5,
      yCm: 5,
      larguraCm: 100,
      alturaCm: 100,
    });
    expect(store.getState().documento.sujo).toBe(true);
  });

  it('cancelar o modo Área útil mantém a área (M1-08) e não suja o documento', async () => {
    const area = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
    const { store } = await aberto({
      projeto: projeto({ parede: PAREDE_LINEAR }),
      variantes: [variante({ areaUtil: area })],
    });
    store.getState().definirModo('area-util');
    store.getState().definirModo('editor');
    expect(store.getState().documento.variante?.areaUtil).toEqual(area);
    expect(store.getState().documento.sujo).toBe(false);
  });
});

describe('salvarVariante (hard save, §3.8)', () => {
  it('envia sessão, revisão base e o conteúdo da variante, e adota a revisão devolvida', async () => {
    const { store, api } = await aberto();
    store.getState().alterarGrid({ passoCm: 10 });
    await store.getState().salvarVariante();

    expect(api.salvarVariante).toHaveBeenCalledWith(ID_PROJETO, ID_VARIANTE, {
      sessaoId: store.getState().documento.sessaoId,
      revisaoBase: 1,
      grid: expect.objectContaining({ passoCm: 10 }),
      bordaPadrao: BORDA_PADRAO,
      areaUtil: null,
      fotos: [],
    });
    const { documento } = store.getState();
    expect(documento.sujo).toBe(false);
    expect(documento.revisaoBase).toBe(2);
    expect(documento.variante?.revisao).toBe(2);
    expect(documento.salvamento).toEqual({ tipo: 'salvo', em: new Date(SALVA_EM) });
  });

  it('mostra "salvando" enquanto a requisição não termina', async () => {
    let concluir!: (v: { revisao: number; salvaEm: string }) => void;
    const { store } = await aberto(undefined, {
      salvarVariante: vi.fn(
        () => new Promise<{ revisao: number; salvaEm: string }>((resolve) => (concluir = resolve)),
      ),
    });
    store.getState().alterarGrid({ passoCm: 10 });
    const salvando = store.getState().salvarVariante();
    expect(store.getState().documento.salvamento.tipo).toBe('salvando');
    concluir({ revisao: 2, salvaEm: SALVA_EM });
    await salvando;
    expect(store.getState().documento.salvamento.tipo).toBe('salvo');
  });

  it('sem alterações não chama a API', async () => {
    const { store, api } = await aberto();
    await store.getState().salvarVariante();
    expect(api.salvarVariante).not.toHaveBeenCalled();
  });

  it('não dispara dois salvamentos ao mesmo tempo', async () => {
    let concluir!: (v: { revisao: number; salvaEm: string }) => void;
    const { store, api } = await aberto(undefined, {
      salvarVariante: vi.fn(
        () => new Promise<{ revisao: number; salvaEm: string }>((resolve) => (concluir = resolve)),
      ),
    });
    store.getState().alterarGrid({ passoCm: 10 });
    const a = store.getState().salvarVariante();
    const b = store.getState().salvarVariante();
    concluir({ revisao: 2, salvaEm: SALVA_EM });
    await Promise.all([a, b]);
    expect(api.salvarVariante).toHaveBeenCalledTimes(1);
  });

  it('409: status "conflito", alterações preservadas e dados de quem salvou', async () => {
    const corpo = { revisao: 3, salvaEm: SALVA_EM, salvaPorSessao: 'outra-aba' };
    const { store } = await aberto(undefined, {
      salvarVariante: vi.fn(async () => {
        throw new ErroApi(409, corpo);
      }),
    });
    store.getState().alterarGrid({ passoCm: 10 });
    await expect(store.getState().salvarVariante()).rejects.toBeInstanceOf(ErroApi);

    const { documento } = store.getState();
    expect(documento.salvamento.tipo).toBe('conflito');
    expect(documento.conflito).toEqual({ origem: 'variante', salvaEm: new Date(SALVA_EM) });
    expect(documento.sujo).toBe(true);
    expect(documento.variante?.grid.passoCm).toBe(10);
  });

  it('outro erro: volta a "alterações não salvas" e guarda a mensagem', async () => {
    const { store } = await aberto(undefined, {
      salvarVariante: vi.fn(async () => {
        throw new ErroApi(500, { erro: 'Falha ao salvar.' });
      }),
    });
    store.getState().alterarGrid({ passoCm: 10 });
    await expect(store.getState().salvarVariante()).rejects.toBeInstanceOf(ErroApi);
    expect(store.getState().documento.salvamento.tipo).toBe('alteracoes');
    expect(store.getState().documento.erroSalvamento).toBe('Falha ao salvar.');
  });

  it('recarregar descarta as alterações locais e adota a versão salva', async () => {
    const salva = variante({ revisao: 3, grid: { ...GRID_PADRAO, principalACada: 5, passoCm: 2 } });
    const obterProjeto = vi
      .fn()
      .mockResolvedValueOnce({ projeto: projeto(), variantes: [variante()] })
      .mockResolvedValue({ projeto: projeto(), variantes: [salva] });
    const { store } = await aberto(undefined, {
      obterProjeto,
      salvarVariante: vi.fn(async () => {
        throw new ErroApi(409, { revisao: 3, salvaEm: SALVA_EM, salvaPorSessao: 'outra' });
      }),
    });
    store.getState().alterarGrid({ passoCm: 10 });
    await store
      .getState()
      .salvarVariante()
      .catch(() => undefined);

    await store.getState().recarregar();
    const { documento } = store.getState();
    expect(documento.variante?.grid.passoCm).toBe(2);
    expect(documento.revisaoBase).toBe(3);
    expect(documento.sujo).toBe(false);
    expect(documento.conflito).toBeNull();
    expect(documento.salvamento.tipo).toBe('salvo');
  });
});

describe('alterações da parede (SV-09, M1-04): gravam ao confirmar e entregam as novas revisões', () => {
  it('enviarParede: adota projeto e revisões das variantes e abre o modo Perspectiva (M1-06)', async () => {
    const arquivo = new File(['x'], 'parede.jpg', { type: 'image/jpeg' });
    const resposta = {
      projeto: projeto({ revisao: 2, parede: PAREDE_SEM_ESCALA }),
      variantesAlteradas: [{ _id: ID_VARIANTE, revisao: 3, areaUtil: null }],
    };
    const { store, api } = await aberto(undefined, { enviarParede: vi.fn(async () => resposta) });

    await store.getState().enviarParede(arquivo, 'medio');

    expect(api.enviarParede).toHaveBeenCalledWith(
      ID_PROJETO,
      { arquivo, perfil: 'medio', revisaoBase: 1 },
      expect.anything(),
    );
    const { documento, ui } = store.getState();
    expect(documento.projeto?.parede?.escala.metodo).toBeNull();
    expect(documento.projeto?.revisao).toBe(2);
    expect(documento.variante?.revisao).toBe(3);
    expect(documento.revisaoBase).toBe(3);
    expect(documento.sujo).toBe(false);
    expect(ui.modo).toBe('perspectiva');
  });

  it('aplicarCalibracao (primeira escala): grava a área útil recebida, adota a revisão e abre o modo Área útil', async () => {
    const area = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
    const resposta = {
      projeto: projeto({ revisao: 3, parede: PAREDE_LINEAR }),
      variantesAlteradas: [{ _id: ID_VARIANTE, revisao: 2, areaUtil: area }],
    };
    const { store, api } = await aberto(
      { projeto: projeto({ revisao: 2, parede: PAREDE_SEM_ESCALA }), variantes: [variante()] },
      { aplicarCalibracao: vi.fn(async () => resposta) },
    );
    const linear = PAREDE_LINEAR.escala.linear!;

    await store.getState().aplicarCalibracao(linear);

    expect(api.aplicarCalibracao).toHaveBeenCalledWith(ID_PROJETO, { revisaoBase: 2, linear });
    const { documento, ui } = store.getState();
    expect(documento.variante?.areaUtil).toEqual(area);
    expect(documento.variante?.revisao).toBe(2);
    expect(documento.revisaoBase).toBe(2);
    expect(documento.sujo).toBe(false);
    expect(ui.modo).toBe('area-util');
  });

  it('o próximo salvamento usa a revisão adotada (sem 409 contra si mesmo)', async () => {
    const area = { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 };
    const resposta = {
      projeto: projeto({ revisao: 3, parede: PAREDE_LINEAR }),
      variantesAlteradas: [{ _id: ID_VARIANTE, revisao: 2, areaUtil: area }],
    };
    const { store, api } = await aberto(
      { projeto: projeto({ revisao: 2, parede: PAREDE_SEM_ESCALA }), variantes: [variante()] },
      { aplicarCalibracao: vi.fn(async () => resposta) },
    );
    await store.getState().aplicarCalibracao(PAREDE_LINEAR.escala.linear!);
    store.getState().confirmarAreaUtil({ xCm: 5, yCm: 5, larguraCm: 100, alturaCm: 100 });

    await store.getState().salvarVariante();

    expect(api.salvarVariante).toHaveBeenCalledWith(
      ID_PROJETO,
      ID_VARIANTE,
      expect.objectContaining({ revisaoBase: 2 }),
    );
  });

  it('recalibrar (nenhuma variante alterada) volta ao editor e mantém a área útil', async () => {
    const area = { xCm: 10, yCm: 10, larguraCm: 100, alturaCm: 100 };
    const resposta = { projeto: projeto({ revisao: 4, parede: PAREDE_LINEAR }), variantesAlteradas: [] };
    const { store } = await aberto(
      { projeto: projeto({ revisao: 3, parede: PAREDE_LINEAR }), variantes: [variante({ areaUtil: area })] },
      { aplicarCalibracao: vi.fn(async () => resposta) },
    );
    store.getState().definirModo('calibracao');
    await store.getState().aplicarCalibracao(PAREDE_LINEAR.escala.linear!);
    expect(store.getState().ui.modo).toBe('editor');
    expect(store.getState().documento.variante?.areaUtil).toEqual(area);
    expect(store.getState().documento.projeto?.revisao).toBe(4);
  });

  it('aplicarPerspectiva envia o bitmap e avisa quando a área útil fica fora da parede (RN-35)', async () => {
    const retificada = new Blob(['bitmap'], { type: 'image/webp' });
    const perspectiva = {
      cantosPx: [
        { x: 200, y: 150 },
        { x: 1400, y: 250 },
        { x: 1400, y: 1050 },
        { x: 200, y: 1150 },
      ],
      larguraCm: 300,
      alturaCm: 200,
    };
    const paredePersp: NonNullable<ProjetoDto['parede']> = {
      ...PAREDE_LINEAR,
      escala: { metodo: 'perspectiva', perspectiva, homografia: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      // Parede inteira de 100 × 100 cm.
      retificada: {
        arquivo: `paredes/${ID_PROJETO}.retificada.webp`,
        larguraPx: 400,
        alturaPx: 400,
        pxPorCm: 4,
        origemCm: { x: 0, y: 0 },
      },
    };
    const { store, api } = await aberto(
      {
        projeto: projeto({ revisao: 3, parede: PAREDE_LINEAR }),
        variantes: [variante({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 300, alturaCm: 225 } })],
      },
      {
        aplicarPerspectiva: vi.fn(async () => ({
          projeto: projeto({ revisao: 4, parede: paredePersp }),
          variantesAlteradas: [],
        })),
      },
    );

    await store.getState().aplicarPerspectiva(perspectiva, retificada);

    expect(api.aplicarPerspectiva).toHaveBeenCalledWith(
      ID_PROJETO,
      { revisaoBase: 3, perspectiva },
      retificada,
      expect.anything(),
    );
    expect(store.getState().ui.avisoAreaUtilFora).toBe(true);
    expect(store.getState().ui.modo).toBe('editor');
  });

  it('409 da parede: marca conflito do projeto e rejeita', async () => {
    const { store } = await aberto(undefined, {
      enviarParede: vi.fn(async () => {
        throw new ErroApi(409, { erro: 'Este projeto foi alterado em outra aba.' });
      }),
    });
    await expect(
      store.getState().enviarParede(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 'leve'),
    ).rejects.toBeInstanceOf(ErroApi);
    expect(store.getState().documento.conflito).toEqual({ origem: 'projeto' });
    expect(store.getState().documento.salvamento.tipo).toBe('conflito');
  });

  it('outros erros da parede (413, 415, 422) só rejeitam, sem alterar o documento', async () => {
    const { store } = await aberto(undefined, {
      enviarParede: vi.fn(async () => {
        throw new ErroApi(415, { erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' });
      }),
    });
    await expect(
      store.getState().enviarParede(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 'leve'),
    ).rejects.toThrow('Formato não suportado. Use JPG, PNG ou WEBP.');
    expect(store.getState().documento.conflito).toBeNull();
    expect(store.getState().documento.projeto?.parede).toBeNull();
  });
});

describe('renomearProjeto (A-02, A-05)', () => {
  it('grava o nome na API e atualiza o projeto, sem sujar a variante', async () => {
    const { store, api } = await aberto();
    await store.getState().renomearProjeto('  Corredor  ');
    expect(api.renomearProjeto).toHaveBeenCalledWith(ID_PROJETO, 'Corredor');
    expect(store.getState().documento.projeto?.nome).toBe('Corredor');
    expect(store.getState().documento.sujo).toBe(false);
  });
});

describe('modos', () => {
  it('definirModo troca o modo; o aviso de área fora some ao dispensar', async () => {
    const { store } = await aberto();
    store.getState().definirModo('calibracao');
    expect(store.getState().ui.modo).toBe('calibracao');
    store.getState().definirModo('editor');
    expect(store.getState().ui.modo).toBe('editor');
  });
});
