import { describe, expect, it } from 'vitest';
import {
  abrirCenario,
  foto,
  hex,
  ID_BASE,
  ID_PROJETO,
  ID_V2,
  imagem,
  PAISAGEM,
  RETRATO,
  variante,
  vaga,
} from '../testes/cenario-m3';
import { ErroApi } from '../infra/dto';

// Ciclo de vida das imagens na store (RF-28, RF-29, RF-30a, RN-24, M4-03 a M4-08, A-03, A-04, A-08, A-11;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §3, §6).

// Base: duas fotos do RETRATO e uma da PAISAGEM (um deles em cada ponto). V2: uma do RETRATO e uma vaga que
// recomendava a PAISAGEM.
const variantesComUsos = () => [
  variante({ fotos: [foto(1), foto(2), foto(5, { imagemId: PAISAGEM._id })] }),
  variante({
    _id: ID_V2,
    nome: 'Variante 2',
    ordem: 1,
    fotos: [foto(3), vaga(4, { imagemAnteriorId: PAISAGEM._id })],
  }),
];

describe('abrirDialogoImagem e fecharDialogoImagem (A-02, A-06)', () => {
  it('carrega as associações e abre o diálogo', async () => {
    const { api, estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().abrirDialogoImagem(RETRATO._id);
    expect(api.associacoesDaImagem).toHaveBeenCalledWith(RETRATO._id);
    const d = estado().ui.dialogoImagem!;
    expect(d.imagemId).toBe(RETRATO._id);
    expect(d.associacoes?.usos.map((u) => [u.varianteId, u.vezes])).toEqual([
      [ID_BASE, 2],
      [ID_V2, 1],
    ]);
    expect(d.erro).toBeNull();
  });

  it('se as associações falham, o diálogo abre com a mensagem de erro', async () => {
    const { api, estado } = await abrirCenario();
    api.associacoesDaImagem.mockRejectedValueOnce(new ErroApi(404, { erro: 'Imagem não encontrada.' }));
    await estado().abrirDialogoImagem(RETRATO._id);
    expect(estado().ui.dialogoImagem).toMatchObject({ associacoes: null, erro: 'Imagem não encontrada.' });
  });

  it('fechar limpa o estado', async () => {
    const { estado } = await abrirCenario();
    await estado().abrirDialogoImagem(RETRATO._id);
    estado().fecharDialogoImagem();
    expect(estado().ui.dialogoImagem).toBeNull();
  });
});

describe('removerImagemDoProjeto (RF-29, M4-04, A-03, A-04)', () => {
  it('recusa com alterações não salvas, sem chamar a API (a decisão da A-12 vem antes)', async () => {
    const { api, estado } = await abrirCenario({ variantes: variantesComUsos() });
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await expect(estado().removerImagemDoProjeto(RETRATO._id)).rejects.toThrow('Há alterações não salvas.');
    expect(api.removerImagemDoProjeto).not.toHaveBeenCalled();
  });

  it('a ativa afetada é recarregada: as fotos somem, a pilha zera e o status volta a "salvo"', async () => {
    const { api, estado } = await abrirCenario({ variantes: variantesComUsos() });
    estado().selecionarFoto(hex(1001));
    await estado().removerImagemDoProjeto(RETRATO._id);
    expect(api.removerImagemDoProjeto).toHaveBeenCalledWith(ID_PROJETO, RETRATO._id);
    expect(estado().conteudo?.fotos.map((f) => f._id)).toEqual([hex(1005)]);
    expect(estado().ui.selecaoId).toBeNull();
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(estado().documento).toMatchObject({ sujo: false, revisaoBase: 2 });
    expect(estado().documento.salvamento.tipo).toBe('salvo');
  });

  it('outra variante afetada vem recarregada e com a pilha zerada ao alternar; a não afetada mantém a pilha', async () => {
    const { estado } = await abrirCenario({
      variantes: [
        ...variantesComUsos(),
        variante({ _id: hex(203), nome: 'Terceira', ordem: 2, fotos: [foto(6, { imagemId: PAISAGEM._id })] }),
      ],
    });
    // A pilha da Terceira (não afetada): uma alteração salva e depois desfeita não é o ponto; basta ter 1 passo.
    await estado().alternarVariante(hex(203));
    estado().alterarBordaPadrao({ larguraCm: 1 });
    await estado().salvarVariante();
    expect(estado().passos.desfazer).toBe(1);
    await estado().alternarVariante(ID_BASE);

    await estado().removerImagemDoProjeto(RETRATO._id);

    await estado().alternarVariante(ID_V2);
    expect(estado().conteudo?.fotos.map((f) => f._id)).toEqual([hex(1004)]);
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    await estado().alternarVariante(hex(203));
    expect(estado().passos.desfazer).toBe(1);
  });

  it('atualiza a lista do seletor (quantidade de fotos)', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().removerImagemDoProjeto(RETRATO._id);
    const lista = estado().documento.lista;
    expect(lista.find((i) => i._id === ID_BASE)?.qtdFotos).toBe(1);
    expect(lista.find((i) => i._id === ID_V2)).toMatchObject({ qtdFotos: 1, semFoto: 1 });
  });

  it('mostra o aviso por 6 s, fecha o diálogo e recarrega a biblioteca', async () => {
    const { api, estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().abrirDialogoImagem(RETRATO._id);
    const chamadas = api.listarImagens.mock.calls.length;
    await estado().removerImagemDoProjeto(RETRATO._id);
    expect(estado().ui.avisoCiclo).toBe('“foto-1.jpg” removida do projeto: 3 fotos em 2 variantes.');
    expect(estado().ui.dialogoImagem).toBeNull();
    expect(api.listarImagens.mock.calls.length).toBeGreaterThan(chamadas);
    estado().dispensarAvisoCiclo();
    expect(estado().ui.avisoCiclo).toBeNull();
  });

  it('sem usos, o aviso é só "removida do projeto"', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().removerImagemDoProjeto(PAISAGEM._id);
    // a PAISAGEM tem 1 foto na Base (foto 5); remove, e depois a segunda remoção não encontra mais usos
    await estado().removerImagemDoProjeto(PAISAGEM._id);
    expect(estado().ui.avisoCiclo).toBe('“foto-2.jpg” removida do projeto.');
  });

  it('o erro da API mantém o diálogo aberto com a mensagem e relança', async () => {
    const { api, estado } = await abrirCenario();
    await estado().abrirDialogoImagem(RETRATO._id);
    api.removerImagemDoProjeto.mockRejectedValueOnce(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    await expect(estado().removerImagemDoProjeto(RETRATO._id)).rejects.toThrow('Erro interno do servidor.');
    expect(estado().ui.dialogoImagem).not.toBeNull();
  });
});

describe('excluirImagem (RF-29, RN-24, M4-05, A-04)', () => {
  it('recusa com alterações não salvas', async () => {
    const { api, estado } = await abrirCenario({ variantes: variantesComUsos() });
    estado().alterarBordaPadrao({ larguraCm: 2 });
    await expect(estado().excluirImagem(RETRATO._id)).rejects.toThrow('Há alterações não salvas.');
    expect(api.excluirImagem).not.toHaveBeenCalled();
  });

  it('as fotos viram placeholder na ativa e nas outras, com o selo "sem foto" subindo', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().excluirImagem(RETRATO._id);
    expect(estado().conteudo?.fotos[0]).toMatchObject({
      _id: hex(1001),
      imagemId: null,
      imagemAnteriorId: RETRATO._id,
      xCm: 45,
    });
    expect(estado().documento.lista.find((i) => i._id === ID_BASE)).toMatchObject({
      qtdFotos: 3,
      semFoto: 2,
    });
    expect(estado().documento.lista.find((i) => i._id === ID_V2)).toMatchObject({ qtdFotos: 2, semFoto: 2 });
    await estado().alternarVariante(ID_V2);
    expect(estado().conteudo?.fotos[0]).toMatchObject({ imagemId: null, imagemAnteriorId: RETRATO._id });
  });

  it('zera a pilha da ativa, não deixa sujo e limpa a seleção', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    estado().selecionarFoto(hex(1001));
    await estado().excluirImagem(RETRATO._id);
    expect(estado().ui.selecaoId).toBeNull();
    expect(estado().passos).toEqual({ desfazer: 0, refazer: 0 });
    expect(estado().documento.sujo).toBe(false);
  });

  it('avisa quantas fotos viraram espaço sem foto e em quantas variantes', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    await estado().excluirImagem(RETRATO._id);
    expect(estado().ui.avisoCiclo).toBe(
      '“foto-1.jpg” excluída. 3 fotos viraram espaço sem foto em 2 variantes.',
    );
  });

  it('a imagem sai da biblioteca ativa e a seleção dela cai', async () => {
    const { estado } = await abrirCenario({ variantes: variantesComUsos() });
    estado().selecionarImagemDaBiblioteca(RETRATO._id);
    await estado().excluirImagem(RETRATO._id);
    expect(estado().biblioteca.imagens.map((i) => i._id)).toEqual([PAISAGEM._id]);
    expect(estado().ui.bibliotecaSelecaoId).toBeNull();
  });
});

describe('excluídas e restauração (RF-28, M4-07, A-07, A-12)', () => {
  const excluida = (n: number, diasRestantes: number) => ({
    ...imagem(n),
    excluidaEm: '2026-10-20T12:00:00.000Z',
    purgaEm: '2026-11-20T12:00:00.000Z',
    diasRestantes,
  });

  it('carregarExcluidas preenche a lista com os dias restantes', async () => {
    const { api, estado } = await abrirCenario({ excluidas: [excluida(7, 25), excluida(8, 2)] });
    await estado().carregarExcluidas();
    expect(api.listarImagensExcluidas).toHaveBeenCalled();
    expect(estado().biblioteca.excluidas.map((i) => [i._id, i.diasRestantes])).toEqual([
      [hex(7), 25],
      [hex(8), 2],
    ]);
  });

  it('restaurar tira da lista, devolve à biblioteca e avisa; não repõe placeholders', async () => {
    const { api, estado } = await abrirCenario({
      excluidas: [excluida(7, 25)],
      variantes: [variante({ fotos: [vaga(1, { imagemAnteriorId: hex(7) })] })],
    });
    await estado().carregarExcluidas();
    await estado().restaurarImagem(hex(7));
    expect(api.restaurarImagem).toHaveBeenCalledWith(hex(7));
    expect(estado().biblioteca.excluidas).toEqual([]);
    expect(estado().biblioteca.imagens.map((i) => i._id)).toContain(hex(7));
    expect(estado().ui.avisoCiclo).toBe('“foto-7.jpg” restaurada.');
    expect(estado().conteudo?.fotos[0]).toMatchObject({ imagemId: null, imagemAnteriorId: hex(7) });
  });

  it('prazo vencido (410): relê a lista e relança com a mensagem da API', async () => {
    const { api, estado } = await abrirCenario({ excluidas: [excluida(7, 0)] });
    await estado().carregarExcluidas();
    api.listarImagensExcluidas.mockResolvedValueOnce([]);
    await expect(estado().restaurarImagem(hex(7))).rejects.toThrow(
      'Esta imagem passou do prazo de 30 dias e será removida.',
    );
    expect(estado().biblioteca.excluidas).toEqual([]);
  });
});

describe('usarFotoAnterior e recomendação (RF-30a, M4-08, A-08, A-09)', () => {
  it('recomendaçãoDaFoto devolve a imagem anterior só quando ela está ativa', async () => {
    const { estado } = await abrirCenario({
      variantes: [
        variante({
          fotos: [vaga(1, { imagemAnteriorId: PAISAGEM._id }), vaga(2, { imagemAnteriorId: hex(77) })],
        }),
      ],
    });
    expect(estado().recomendacaoDaFoto(hex(1001))?._id).toBe(PAISAGEM._id);
    expect(estado().recomendacaoDaFoto(hex(1002))).toBeNull();
    expect(estado().recomendacaoDaFoto(hex(9999))).toBeNull();
  });

  it('usarFotoAnterior preenche mantendo formato e posição, com 1 passo de desfazer', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ fotos: [vaga(1, { imagemAnteriorId: PAISAGEM._id, xCm: 33, yCm: 44 })] })],
    });
    estado().usarFotoAnterior(hex(1001));
    expect(estado().conteudo?.fotos[0]).toMatchObject({
      _id: hex(1001),
      imagemId: PAISAGEM._id,
      xCm: 33,
      yCm: 44,
      tamanho: { sugeridoId: '20x30', larguraCm: 20, alturaCm: 30 },
      recorte: { offsetX: 0, offsetY: 0 },
    });
    expect(estado().passos.desfazer).toBe(1);
    estado().desfazer();
    expect(estado().conteudo?.fotos[0]?.imagemId).toBeNull();
  });

  it('sem recomendação (anterior ausente da biblioteca ativa), não faz nada', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ fotos: [vaga(1, { imagemAnteriorId: hex(77) })] })],
    });
    estado().usarFotoAnterior(hex(1001));
    expect(estado().conteudo?.fotos[0]?.imagemId).toBeNull();
    expect(estado().passos.desfazer).toBe(0);
  });
});

describe('salvar com imagem excluída em outra aba (M4-06, A-11)', () => {
  it('o servidor converte; a tela e o último salvo acompanham, sem passo de desfazer e sem ficar sujo', async () => {
    const { estado } = await abrirCenario({ excluirAoSalvar: [PAISAGEM._id] });
    estado().alterarBordaPadrao({ larguraCm: 1 });
    estado().adicionarFoto(PAISAGEM._id);
    expect(estado().passos.desfazer).toBe(2);
    const adicionada = estado().conteudo!.fotos.at(-1)!;
    await estado().salvarVariante();

    const convertida = estado().conteudo!.fotos.find((f) => f._id === adicionada._id)!;
    expect(convertida).toMatchObject({ imagemId: null, imagemAnteriorId: PAISAGEM._id });
    expect(estado().documento.salvo?.conteudo.fotos.find((f) => f._id === adicionada._id)).toMatchObject({
      imagemId: null,
    });
    expect(estado().documento.sujo).toBe(false);
    expect(estado().passos.desfazer).toBe(2);
    expect(estado().ui.avisoCiclo).toBe(
      '1 foto virou espaço sem foto porque a imagem foi excluída em outra aba.',
    );
  });

  it('plural quando são várias fotos', async () => {
    const { estado } = await abrirCenario({
      excluirAoSalvar: [RETRATO._id],
      variantes: [variante({ fotos: [foto(1), foto(2)] })],
    });
    estado().moverFoto(hex(1001), 100, 50);
    await estado().salvarVariante();
    expect(estado().ui.avisoCiclo).toBe(
      '2 fotos viraram espaço sem foto porque a imagem foi excluída em outra aba.',
    );
  });

  it('sem imagens excluídas, nenhum aviso', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 1 });
    await estado().salvarVariante();
    expect(estado().ui.avisoCiclo).toBeNull();
  });
});

describe('exportação (RF-80, A-13)', () => {
  it('abrirExportacao liga o diálogo com a escala definida; fechar desliga', async () => {
    const { estado } = await abrirCenario();
    estado().abrirExportacao();
    expect(estado().ui.exportacaoAberta).toBe(true);
    estado().fecharExportacao();
    expect(estado().ui.exportacaoAberta).toBe(false);
  });

  it('sem escala, não abre', async () => {
    const { estado } = await abrirCenario({
      projeto: { parede: null },
    });
    estado().abrirExportacao();
    expect(estado().ui.exportacaoAberta).toBe(false);
  });
});
