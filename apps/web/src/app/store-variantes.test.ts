import { describe, expect, it } from 'vitest';
import {
  abrirCenario,
  AREA_UTIL,
  foto,
  hex,
  ID_BASE,
  ID_PROJETO,
  ID_V2,
  ID_V3,
  variante,
  vaga,
} from '../testes/cenario-m3';
import { resumoDasVariantes } from './store';

// Variantes na store (RF-91, RN-18, RN-23, M3-03 a M3-05, A-05; docs/specs/M3-variantes-templates-e-salvamento.md
// §3.1, §3.2, §6): só a ativa tem estado de trabalho; as salvas ficam em cache com a pilha de desfazer.

describe('abrirProjeto com várias variantes', () => {
  it('abre na ultimaVarianteId', async () => {
    const { estado } = await abrirCenario({ projeto: { ultimaVarianteId: ID_V2 } });
    expect(estado().documento.variante?._id).toBe(ID_V2);
    expect(estado().conteudo?.fotos).toHaveLength(2);
  });

  it('resumoDasVariantes lista todas na ordem, com fotos, "sem foto" e a ativa marcada', async () => {
    const { estado } = await abrirCenario();
    expect(resumoDasVariantes(estado())).toEqual([
      { _id: ID_BASE, nome: 'Base', ordem: 0, qtdFotos: 2, semFoto: 0, ativa: true, naoSalva: false },
      { _id: ID_V2, nome: 'Variante 2', ordem: 1, qtdFotos: 2, semFoto: 1, ativa: false, naoSalva: false },
    ]);
  });

  it('o resumo da ativa acompanha o conteúdo em tela (M3-02)', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ fotos: [vaga(1), vaga(2), foto(3)] })],
    });
    expect(resumoDasVariantes(estado())[0]).toMatchObject({ qtdFotos: 3, semFoto: 2 });
    estado().selecionarFoto(hex(1001));
    estado().removerFoto(hex(1001));
    expect(resumoDasVariantes(estado())[0]).toMatchObject({ qtdFotos: 2, semFoto: 1, naoSalva: true });
  });
});

describe('alternarVariante (M3-03, A-05)', () => {
  it('troca conteúdo, status e seleção; mantém o projeto; grava a última variante aberta', async () => {
    const { api, estado } = await abrirCenario();
    estado().selecionarFoto(hex(1001));
    await expect(estado().alternarVariante(ID_V2)).resolves.toBe(true);
    expect(estado().documento.variante?._id).toBe(ID_V2);
    expect(estado().conteudo?.fotos.map((f) => f._id)).toEqual([hex(1003), hex(1004)]);
    expect(estado().ui.selecaoId).toBeNull();
    expect(estado().documento.sujo).toBe(false);
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().documento.revisaoBase).toBe(1);
    expect(api.definirUltimaVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2);
  });

  it('alternar para a própria ativa não faz nada', async () => {
    const { api, estado } = await abrirCenario();
    await expect(estado().alternarVariante(ID_BASE)).resolves.toBe(false);
    expect(api.definirUltimaVariante).not.toHaveBeenCalled();
  });

  it('com alterações não salvas, recusa: a decisão (A-12) vem antes', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    expect(estado().documento.sujo).toBe(true);
    await expect(estado().alternarVariante(ID_V2)).resolves.toBe(false);
    expect(estado().documento.variante?._id).toBe(ID_BASE);
  });

  it('fora do modo editor, recusa (o seletor é inativo nos modos)', async () => {
    const { estado } = await abrirCenario();
    estado().definirModo('area-util');
    await expect(estado().alternarVariante(ID_V2)).resolves.toBe(false);
  });

  it('variante inexistente: recusa', async () => {
    const { estado } = await abrirCenario();
    await expect(estado().alternarVariante(hex(999))).resolves.toBe(false);
  });

  it('PRD aceite 12: desfazer em uma variante não altera a outra, e a pilha da salva sobrevive à troca', async () => {
    const { estado } = await abrirCenario();
    // A (Base): move uma foto e salva.
    estado().moverFoto(hex(1001), 100, 50);
    await estado().salvarVariante();
    expect(estado().passos.desfazer).toBe(1);

    // B (Variante 2): altera a borda padrão.
    await estado().alternarVariante(ID_V2);
    expect(estado().passos.desfazer).toBe(0);
    estado().alterarBordaPadrao({ larguraCm: 3 });
    expect(estado().passos.desfazer).toBe(1);
    estado().desfazer();
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 1 });

    // B não deixou rastro em A: voltar a A mostra a foto movida e a pilha de A.
    await estado().alternarVariante(ID_BASE);
    expect(estado().conteudo?.fotos[0]).toMatchObject({ xCm: 100, yCm: 50 });
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
    expect(estado().passos).toEqual({ desfazer: 1, refazer: 0 });

    // Desfazer em A volta a posição de A e não toca B.
    estado().desfazer();
    expect(estado().conteudo?.fotos[0]).toMatchObject({ xCm: 45, yCm: 30 });
    await estado().alternarVariante(ID_V2);
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 1 });
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
  });

  it('a troca não cria passo de desfazer e a pilha da ativa vem completa na volta', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 1 });
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarVariante();
    await estado().alternarVariante(ID_V2);
    await estado().alternarVariante(ID_BASE);
    expect(estado().passos.desfazer).toBe(2);
  });
});

describe('descartarAlteracoes (A-12)', () => {
  it('volta ao salvo, zera a pilha e apaga o rascunho da sessão', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 4 });
    estado().moverFoto(hex(1001), 100, 50);
    await estado().descartarAlteracoes();
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
    expect(estado().conteudo?.fotos[0]).toMatchObject({ xCm: 45 });
    expect(estado().documento.sujo).toBe(false);
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(api.apagarRascunho).toHaveBeenCalledWith(ID_PROJETO, ID_BASE, estado().documento.sessaoId);
  });

  it('o grid também volta ao salvo', async () => {
    const { estado } = await abrirCenario();
    estado().alterarGrid({ passoCm: 10 });
    await estado().descartarAlteracoes();
    expect(estado().documento.variante?.grid.passoCm).toBe(5);
  });
});

describe('criar, duplicar, renomear e excluir (M3-04, M3-05, RN-23)', () => {
  it('criarVarianteEmBranco: herda grid, borda padrão e área útil da ativa, fica ativa e já salva', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarGrid({ passoCm: 10 });
    await estado().salvarVariante();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().salvarVariante();
    await estado().criarVarianteEmBranco('Variante 3');

    const [pid, corpo] = api.criarVariante.mock.calls[0]!;
    expect(pid).toBe(ID_PROJETO);
    expect(corpo).toMatchObject({
      nome: 'Variante 3',
      sessaoId: estado().documento.sessaoId,
      grid: { passoCm: 10 },
      bordaPadrao: { larguraCm: 2 },
      areaUtil: AREA_UTIL,
      origem: { tipo: 'vazia' },
    });
    expect(estado().documento.variante?.nome).toBe('Variante 3');
    expect(estado().conteudo?.fotos).toEqual([]);
    expect(estado().documento.sujo).toBe(false);
    expect(estado().documento.salvamento.tipo).toBe('salvo');
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(resumoDasVariantes(estado()).map((v) => v.nome)).toEqual(['Base', 'Variante 2', 'Variante 3']);
  });

  it('com alterações não salvas, criar recusa (decisão primeiro)', async () => {
    const { api, estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await expect(estado().criarVarianteEmBranco('X')).rejects.toThrow();
    expect(api.criarVariante).not.toHaveBeenCalled();
  });

  it('duplicarVariante: copia o estado em tela (fotos incluídas) e a cópia fica ativa', async () => {
    const { api, estado } = await abrirCenario();
    await estado().duplicarVariante('Base (cópia)');
    const [, corpo] = api.criarVariante.mock.calls[0]!;
    expect(corpo.origem).toEqual({ tipo: 'copia', fotos: [foto(1), foto(2)] });
    expect(estado().documento.variante?.nome).toBe('Base (cópia)');
    expect(estado().conteudo?.fotos).toHaveLength(2);
    expect(estado().conteudo?.fotos.map((f) => f._id)).not.toContain(hex(1001));
    // A origem não mudou.
    await estado().alternarVariante(ID_BASE);
    expect(estado().conteudo?.fotos.map((f) => f._id)).toEqual([hex(1001), hex(1002)]);
  });

  it('renomearVariante: PATCH, lista e ativa atualizadas, sem alterações não salvas', async () => {
    const { api, estado } = await abrirCenario();
    await estado().renomearVariante(ID_V2, 'Sala escura');
    expect(api.renomearVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2, 'Sala escura');
    expect(resumoDasVariantes(estado()).map((v) => v.nome)).toEqual(['Base', 'Sala escura']);
    await estado().renomearVariante(ID_BASE, 'Principal');
    expect(estado().documento.variante?.nome).toBe('Principal');
    expect(estado().documento.sujo).toBe(false);
  });

  it('excluirVariante de outra variante: some da lista e a ativa não muda', async () => {
    const { api, estado } = await abrirCenario();
    await estado().excluirVariante(ID_V2);
    expect(api.excluirVariante).toHaveBeenCalledWith(ID_PROJETO, ID_V2);
    expect(resumoDasVariantes(estado()).map((v) => v._id)).toEqual([ID_BASE]);
    expect(estado().documento.variante?._id).toBe(ID_BASE);
  });

  it('excluir a ativa passa para a anterior na ordem (ou a seguinte, se era a primeira)', async () => {
    const { estado } = await abrirCenario({
      variantes: [
        variante({ fotos: [foto(1)] }),
        variante({ _id: ID_V2, nome: 'V2', ordem: 1 }),
        variante({ _id: ID_V3, nome: 'V3', ordem: 2 }),
      ],
      projeto: { ultimaVarianteId: ID_V2 },
    });
    await estado().excluirVariante(ID_V2);
    expect(estado().documento.variante?._id).toBe(ID_BASE);

    await estado().excluirVariante(ID_BASE);
    expect(estado().documento.variante?._id).toBe(ID_V3);
    expect(resumoDasVariantes(estado()).map((v) => v._id)).toEqual([ID_V3]);
  });

  it('excluir a ativa com alterações não salvas as descarta', async () => {
    const { estado } = await abrirCenario({ projeto: { ultimaVarianteId: ID_V2 } });
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await estado().excluirVariante(ID_V2);
    expect(estado().documento.variante?._id).toBe(ID_BASE);
    expect(estado().documento.sujo).toBe(false);
    expect(estado().conteudo?.bordaPadrao.larguraCm).toBe(0);
  });

  it('a última variante não se exclui (RN-23): nenhuma chamada à API', async () => {
    const { api, estado } = await abrirCenario({ variantes: [variante()] });
    await expect(estado().excluirVariante(ID_BASE)).rejects.toThrow(
      'Todo projeto precisa de ao menos uma variante.',
    );
    expect(api.excluirVariante).not.toHaveBeenCalled();
  });
});

describe('salvar a ativa atualiza o resumo e não mexe nas outras (A-13)', () => {
  it('o hard save grava só a ativa', async () => {
    const { api, estado } = await abrirCenario();
    estado().removerFoto(hex(1002));
    await estado().salvarVariante();
    expect(api.salvarVariante).toHaveBeenCalledTimes(1);
    expect(api.salvarVariante.mock.calls[0]![1]).toBe(ID_BASE);
    expect(resumoDasVariantes(estado())[0]).toMatchObject({ qtdFotos: 1, naoSalva: false });
  });
});
