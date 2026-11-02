import { describe, expect, it, vi } from 'vitest';
import { ErroApi } from '../infra/dto';
import {
  abrirCenario,
  foto,
  ID_BASE,
  ID_PROJETO,
  ID_V2,
  RASCUNHO_EM,
  SALVA_EM_2,
  variante,
  variantesPadrao,
  type OpcoesCenario,
} from '../testes/cenario-m3';
import { resumoDasVariantes } from './store';

// Salvamento automático, recuperação e conflito (RF-71, RF-73, RN-26, SV-01 a SV-08, M3-07 a M3-09, A-06 a A-09, A-14;
// docs/specs/M3-variantes-templates-e-salvamento.md §3.2 a §3.5).

describe('configuração', () => {
  it('carregarConfig lê o intervalo do salvamento automático (M3-07)', async () => {
    const { estado } = await abrirCenario({ autosaveMinutos: 3 });
    expect(estado().config).toEqual({ uploadMaxMb: 50, autosaveMinutos: 3 });
  });
});

describe('salvarRascunho — um tick do salvamento automático (SV-01, A-07)', () => {
  it('com alterações, grava só o rascunho (nunca a versão oficial) e o status vira "Rascunho salvo"', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');

    await estado().salvarRascunho();

    expect(api.salvarRascunho).toHaveBeenCalledTimes(1);
    expect(api.salvarVariante).not.toHaveBeenCalled();
    const [pid, vid, corpo] = api.salvarRascunho.mock.calls[0]!;
    expect([pid, vid]).toEqual([ID_PROJETO, ID_BASE]);
    expect(corpo).toMatchObject({
      sessaoId: estado().documento.sessaoId,
      revisaoBase: 1,
      conteudo: { bordaPadrao: { larguraCm: 2 }, fotos: [foto(1), foto(2)] },
    });
    expect(estado().documento.salvamento).toEqual({ tipo: 'rascunho', em: new Date(RASCUNHO_EM) });
    expect(estado().documento.sujo).toBe(true);
  });

  it('nova alteração depois do rascunho: volta a "Alterações não salvas"', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    estado().alterarBordaPadrao({ larguraCm: 3 });
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');
  });

  it('desfazer até o conteúdo oficial vale "Salvo", mesmo com rascunho gravado (A-06)', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    estado().desfazer();
    expect(estado().documento.salvamento.tipo).toBe('salvo');
  });

  it('sem alterações, não grava nada', async () => {
    const { api, estado } = await abrirCenario();
    await estado().salvarRascunho();
    expect(api.salvarRascunho).not.toHaveBeenCalled();
  });

  it('sem mudança desde o último rascunho, não grava de novo', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    await estado().salvarRascunho();
    expect(api.salvarRascunho).toHaveBeenCalledTimes(1);
  });

  it('grid também conta como alteração do rascunho', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarGrid({ passoCm: 10 });
    await estado().salvarRascunho();
    expect(api.salvarRascunho.mock.calls[0]![2].conteudo.grid.passoCm).toBe(10);
  });

  it('adia o tick enquanto um Salvar manual está em andamento', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    const salvando = estado().salvarVariante();
    await estado().salvarRascunho();
    await salvando;
    expect(api.salvarRascunho).not.toHaveBeenCalled();
  });

  it('o hard save depois do rascunho volta o status para "Salvo"', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    await estado().salvarVariante();
    expect(estado().documento.salvamento).toEqual({ tipo: 'salvo', em: new Date(SALVA_EM_2) });
  });
});

describe('falhas do rascunho (A-07)', () => {
  it('uma falha não avisa; duas seguidas mostram o aviso; um sucesso zera', async () => {
    const { api, estado } = await abrirCenario();
    api.salvarRascunho.mockRejectedValue(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    expect(estado().documento.avisoRascunho).toBe(false);
    await estado().salvarRascunho();
    expect(estado().documento.avisoRascunho).toBe(true);
    // A falha mantém o status "Alterações não salvas".
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');

    api.salvarRascunho.mockReset();
    api.salvarRascunho.mockResolvedValue({ salvoEm: RASCUNHO_EM });
    await estado().salvarRascunho();
    expect(estado().documento.avisoRascunho).toBe(false);
    expect(estado().documento.salvamento.tipo).toBe('rascunho');
  });

  it('dispensarAvisoRascunho esconde o aviso', async () => {
    const { api, estado } = await abrirCenario();
    api.salvarRascunho.mockRejectedValue(new Error('x'));
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarRascunho();
    await estado().salvarRascunho();
    estado().dispensarAvisoRascunho();
    expect(estado().documento.avisoRascunho).toBe(false);
  });
});

describe('conflito no rascunho (M3-07, SV-06)', () => {
  async function comConflitoNoRascunho() {
    const c = await abrirCenario();
    c.estado().alterarBordaPadrao({ larguraCm: 2 });
    // Outra aba salvou a variante.
    c.servidor.get(ID_BASE)!.revisao = 2;
    c.servidor.get(ID_BASE)!.salvaPorSessao = 'outra-aba';
    await c.estado().salvarRascunho();
    return c;
  }

  it('marca o conflito sem abrir o diálogo e suspende o autosave', async () => {
    const { api, estado } = await comConflitoNoRascunho();
    expect(estado().documento.conflito).toMatchObject({ origem: 'variante', deRascunho: true });
    expect(estado().documento.salvamento.tipo).toBe('conflito');
    expect(estado().ui.dialogoConflito).toBe(false);

    estado().alterarBordaPadrao({ larguraCm: 3 });
    await estado().salvarRascunho();
    expect(api.salvarRascunho).toHaveBeenCalledTimes(1);
  });

  it('abrirDialogoConflito busca a versão salva para os cartões', async () => {
    const { api, estado } = await comConflitoNoRascunho();
    await estado().abrirDialogoConflito();
    expect(estado().ui.dialogoConflito).toBe(true);
    expect(api.obterVariante).toHaveBeenCalledWith(ID_PROJETO, ID_BASE);
    const conflito = estado().documento.conflito;
    expect(conflito?.origem === 'variante' && conflito.salva?.revisao).toBe(2);
  });

  it('fecharDialogoConflito deixa a decisão para depois: o conflito continua', async () => {
    const { estado } = await comConflitoNoRascunho();
    await estado().abrirDialogoConflito();
    estado().fecharDialogoConflito();
    expect(estado().ui.dialogoConflito).toBe(false);
    expect(estado().documento.conflito).not.toBeNull();
    expect(estado().documento.salvamento.tipo).toBe('conflito');
  });
});

describe('conflito no hard save (RF-73, SV-05, M3-09)', () => {
  async function comConflito() {
    const c = await abrirCenario();
    c.estado().alterarBordaPadrao({ larguraCm: 2 });
    // Outra aba salvou antes, com uma foto a menos.
    const salvo = c.servidor.get(ID_BASE)!;
    salvo.revisao = 2;
    salvo.salvaPorSessao = 'outra-aba';
    salvo.salvaEm = SALVA_EM_2;
    salvo.fotos = [foto(1)];
    await c
      .estado()
      .salvarVariante()
      .catch(() => undefined);
    return c;
  }

  it('o 409 abre o diálogo na hora, com a versão salva carregada', async () => {
    const { estado } = await comConflito();
    expect(estado().documento.salvamento.tipo).toBe('conflito');
    expect(estado().ui.dialogoConflito).toBe(true);
    const conflito = estado().documento.conflito;
    expect(conflito).toMatchObject({ origem: 'variante', deRascunho: false });
    await Promise.resolve();
    expect(conflito?.origem === 'variante' && conflito.salva).toBeTruthy();
  });

  it('Manter a minha: grava com a revisão atual do servidor e segue salvo', async () => {
    const { api, servidor, estado } = await comConflito();
    await estado().resolverConflito('manter');
    expect(api.salvarVariante).toHaveBeenLastCalledWith(
      ID_PROJETO,
      ID_BASE,
      expect.objectContaining({ revisaoBase: 2 }),
    );
    expect(servidor.get(ID_BASE)!.revisao).toBe(3);
    expect(servidor.get(ID_BASE)!.bordaPadrao.larguraCm).toBe(2);
    expect(estado().documento.conflito).toBeNull();
    expect(estado().ui.dialogoConflito).toBe(false);
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().documento.revisaoBase).toBe(3);
  });

  it('Manter a minha com novo 409: o diálogo volta', async () => {
    const { servidor, api, estado } = await comConflito();
    api.salvarVariante.mockImplementationOnce(async () => {
      servidor.get(ID_BASE)!.revisao = 3;
      throw new ErroApi(409, {
        erro: 'Esta variante foi salva em outra aba.',
        revisao: 3,
        salvaEm: SALVA_EM_2,
      });
    });
    await estado()
      .resolverConflito('manter')
      .catch(() => undefined);
    expect(estado().documento.salvamento.tipo).toBe('conflito');
    expect(estado().ui.dialogoConflito).toBe(true);
  });

  it('Usar a salva: adota a versão salva, zera a pilha, apaga o rascunho da sessão e volta o autosave', async () => {
    const { api, estado } = await comConflito();
    await estado().resolverConflito('usar-salva');
    expect(estado().conteudo?.fotos).toEqual([foto(1)]);
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
    expect(estado().documento.revisaoBase).toBe(2);
    expect(estado().documento.sujo).toBe(false);
    expect(estado().documento.conflito).toBeNull();
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(api.apagarRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, estado().documento.sessaoId);
    expect(estado().ui.dialogoConflito).toBe(false);
  });

  it('Salvar a minha como nova variante: cria "<nome> (cópia hh:mm)", ativa a nova e a original adota a salva', async () => {
    const { api, estado } = await comConflito();
    await estado().resolverConflito('nova-variante');
    const [, corpo] = api.criarVariante.mock.calls[0]!;
    expect(corpo.nome).toMatch(/^Base \(cópia \d{2}:\d{2}\)$/);
    expect(corpo.origem).toMatchObject({ tipo: 'copia' });
    expect(corpo.bordaPadrao.larguraCm).toBe(2);
    expect(estado().documento.variante?.nome).toBe(corpo.nome);
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(2);
    expect(estado().documento.conflito).toBeNull();
    expect(estado().documento.sujo).toBe(false);

    // A original mostra a versão salva (como em "Usar a salva").
    await estado().alternarVariante(ID_BASE);
    expect(estado().conteudo?.fotos).toEqual([foto(1)]);
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
    expect(estado().documento.revisaoBase).toBe(2);
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
  });

  it('variante excluída em outra aba (404): Salvar como nova variante', async () => {
    const c = await abrirCenario({ projeto: { ultimaVarianteId: ID_V2 } });
    c.estado().alterarBordaPadrao({ larguraCm: 2 });
    c.servidor.delete(ID_V2);
    await c
      .estado()
      .salvarVariante()
      .catch(() => undefined);
    expect(c.estado().documento.conflito).toMatchObject({ origem: 'variante', excluida: true });
    expect(c.estado().ui.dialogoConflito).toBe(true);

    await c.estado().resolverVarianteExcluida('nova');
    expect(c.api.criarVariante).toHaveBeenCalledTimes(1);
    expect(c.estado().documento.variante?.nome).toMatch(/^Variante 2 \(cópia \d{2}:\d{2}\)$/);
    expect(c.estado().documento.conflito).toBeNull();
    expect(resumoDasVariantes(c.estado()).map((v) => v._id)).not.toContain(ID_V2);
  });

  it('variante excluída em outra aba (404): Descartar abre outra variante', async () => {
    const c = await abrirCenario({ projeto: { ultimaVarianteId: ID_V2 } });
    c.estado().alterarBordaPadrao({ larguraCm: 2 });
    c.servidor.delete(ID_V2);
    await c
      .estado()
      .salvarVariante()
      .catch(() => undefined);
    await c.estado().resolverVarianteExcluida('descartar');
    expect(c.estado().documento.variante?._id).toBe(ID_BASE);
    expect(c.estado().documento.conflito).toBeNull();
    expect(c.estado().documento.sujo).toBe(false);
  });
});

describe('recuperação de rascunho (SV-03, SV-07, M3-08, A-08, A-09)', () => {
  const resumo = (sobrescrita = {}) => ({
    varianteId: ID_BASE,
    sessaoId: 'aba-fechada',
    salvoEm: '2026-11-02T13:20:00.000Z',
    revisaoBase: 1,
    qtdFotos: 1,
    ...sobrescrita,
  });

  async function comRascunhoGuardado(resumoDoRascunho = resumo(), opcoes: OpcoesCenario = {}) {
    const base = (opcoes.variantes ?? variantesPadrao()).find((v) => v._id === ID_BASE)!;
    return abrirCenario({
      rascunhos: [resumoDoRascunho],
      rascunhosGuardados: {
        [`${resumoDoRascunho.varianteId}:aba-fechada`]: {
          sessaoId: 'aba-fechada',
          revisaoBase: resumoDoRascunho.revisaoBase,
          conteudo: {
            grid: { ...base.grid, passoCm: 10 },
            bordaPadrao: { larguraCm: 3, cor: '#FFFFFF' },
            areaUtil: base.areaUtil,
            fotos: [foto(1)],
          },
          salvoEm: resumoDoRascunho.salvoEm,
        },
      },
      ...opcoes,
    });
  }

  it('o rascunho elegível da variante aberta vira uma oferta ao abrir o projeto', async () => {
    const { estado } = await comRascunhoGuardado();
    expect(estado().ui.recuperacao).toMatchObject({
      varianteId: ID_BASE,
      sessaoId: 'aba-fechada',
      qtdFotos: 1,
      desatualizado: false,
    });
    // A variante já aberta mostra a versão salva por baixo (A-08).
    expect(estado().conteudo?.fotos).toHaveLength(2);
    expect(estado().documento.sujo).toBe(false);
  });

  it('base antiga (revisaoBase < revisão): marca desatualizado', async () => {
    const { estado } = await comRascunhoGuardado(resumo({ revisaoBase: 1 }), {
      variantes: [variante({ revisao: 4 })],
    });
    expect(estado().ui.recuperacao).toMatchObject({ desatualizado: true });
  });

  it('base antiga: busca o conteúdo do rascunho para o diálogo mostrar as duas versões (A-09)', async () => {
    const { api, estado } = await comRascunhoGuardado(resumo({ revisaoBase: 1 }), {
      variantes: [variante({ revisao: 4 })],
    });
    await vi.waitFor(() => expect(estado().ui.recuperacao?.previa).not.toBeNull());
    expect(api.obterRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, 'aba-fechada');
    expect(estado().ui.recuperacao?.previa?.fotos).toEqual([foto(1)]);
  });

  it('base atual: não busca o rascunho antes da escolha', async () => {
    const { api, estado } = await comRascunhoGuardado();
    expect(estado().ui.recuperacao?.previa).toBeNull();
    expect(api.obterRascunho).not.toHaveBeenCalled();
  });

  it('sem rascunho elegível, nenhuma oferta', async () => {
    const { estado } = await abrirCenario();
    expect(estado().ui.recuperacao).toBeNull();
  });

  it('Recuperar: carrega como alteração não salva, com a revisão atual como base e a pilha vazia', async () => {
    const { api, estado } = await comRascunhoGuardado();
    await estado().recuperarRascunho();
    expect(api.obterRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, 'aba-fechada');
    expect(estado().conteudo?.fotos).toEqual([foto(1)]);
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(3);
    expect(estado().documento.variante?.grid.passoCm).toBe(10);
    expect(estado().documento.sujo).toBe(true);
    expect(estado().documento.salvamento.tipo).toBe('alteracoes');
    expect(estado().documento.revisaoBase).toBe(1);
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(estado().ui.recuperacao).toBeNull();
  });

  it('Recuperar com base antiga usa a revisão oficial atual como base (A-09)', async () => {
    const { estado } = await comRascunhoGuardado(resumo({ revisaoBase: 1 }), {
      variantes: [variante({ revisao: 4 })],
    });
    await estado().recuperarRascunho();
    expect(estado().documento.revisaoBase).toBe(4);
  });

  it('Descartar: apaga só aquele rascunho e fecha a oferta', async () => {
    const { api, rascunhos, estado } = await comRascunhoGuardado();
    await estado().descartarRascunhoOferecido();
    expect(api.apagarRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, 'aba-fechada');
    expect(rascunhos.size).toBe(0);
    expect(estado().ui.recuperacao).toBeNull();
    expect(estado().documento.sujo).toBe(false);
  });

  it('Fechar (×/Esc): mantém o rascunho no servidor', async () => {
    const { api, rascunhos, estado } = await comRascunhoGuardado();
    estado().fecharRecuperacao();
    expect(estado().ui.recuperacao).toBeNull();
    expect(api.apagarRascunho).not.toHaveBeenCalled();
    expect(rascunhos.size).toBe(1);
  });

  it('a pergunta aparece na primeira ativação da variante na sessão, de outra variante', async () => {
    const { estado } = await comRascunhoGuardado(resumo({ varianteId: ID_V2 }));
    expect(estado().ui.recuperacao).toBeNull();
    await estado().alternarVariante(ID_V2);
    expect(estado().ui.recuperacao).toMatchObject({ varianteId: ID_V2 });
  });

  it('depois de fechada, a oferta não volta na mesma sessão ao reativar a variante', async () => {
    const { estado } = await comRascunhoGuardado(resumo({ varianteId: ID_V2 }));
    await estado().alternarVariante(ID_V2);
    estado().fecharRecuperacao();
    await estado().alternarVariante(ID_BASE);
    await estado().alternarVariante(ID_V2);
    expect(estado().ui.recuperacao).toBeNull();
  });

  it('recuperarComoNovaVariante: cria "<nome> (rascunho hh:mm)" com o conteúdo do rascunho', async () => {
    const { api, estado } = await comRascunhoGuardado(resumo({ revisaoBase: 1 }), {
      variantes: [variante({ revisao: 4 })],
    });
    await estado().recuperarComoNovaVariante();
    const [, corpo] = api.criarVariante.mock.calls[0]!;
    expect(corpo.nome).toMatch(/^Base \(rascunho \d{2}:\d{2}\)$/);
    expect(corpo.bordaPadrao.larguraCm).toBe(3);
    expect(corpo.origem).toMatchObject({ tipo: 'copia', fotos: [foto(1)] });
    expect(estado().documento.variante?.nome).toBe(corpo.nome);
    expect(estado().ui.recuperacao).toBeNull();
  });
});
