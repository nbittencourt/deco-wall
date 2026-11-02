import {
  aplicarTemplate,
  centralizarNaAreaUtil,
  GRID_PADRAO,
  templatePorId,
  totalDoTemplate,
} from '@deco-wall/domain';
import { describe, expect, it } from 'vitest';
import { ErroApi } from '../infra/dto';
import {
  abrirCenario,
  AREA_UTIL,
  foto,
  hex,
  ID_BASE,
  ID_PROJETO,
  PAREDE_LINEAR,
  PAISAGEM,
  RETRATO,
  vaga,
  variante,
} from '../testes/cenario-m3';
import { resumoDasVariantes } from './store';

// Templates e vagas (RF-93, RN-29 a RN-32, M3-01, M3-06, A-18 a A-23; docs/specs/M3-variantes-templates-e-salvamento.md
// §3.6 a §3.8).

const BORDA = { larguraCm: 2, cor: '#F5F1E8' };

describe('preencherVaga (M3-01, A-23)', () => {
  async function comVagas() {
    return abrirCenario({ variantes: [variante({ fotos: [foto(1), vaga(2), vaga(3)] })] });
  }

  it('a vaga vira foto: mantém id, tamanho, posição e borda; recorte centralizado; 1 passo de desfazer', async () => {
    const { estado } = await comVagas();
    const antes = estado().conteudo!.fotos[1]!;
    estado().preencherVaga(antes._id, PAISAGEM._id);
    const depois = estado().conteudo!.fotos[1]!;
    expect(depois).toEqual({ ...antes, imagemId: PAISAGEM._id, recorte: { offsetX: 0, offsetY: 0 } });
    expect(estado().passos.desfazer).toBe(1);
    expect(estado().documento.sujo).toBe(true);
    expect(resumoDasVariantes(estado())[0]).toMatchObject({ semFoto: 1 });
    estado().desfazer();
    expect(estado().conteudo!.fotos[1]!.imagemId).toBeNull();
  });

  it('foto que já tem imagem não aceita outra', async () => {
    const { estado } = await comVagas();
    estado().preencherVaga(hex(1001), PAISAGEM._id);
    expect(estado().conteudo!.fotos[0]!.imagemId).toBe(RETRATO._id);
    expect(estado().passos.desfazer).toBe(0);
  });

  it('imagem fora da biblioteca: não faz nada', async () => {
    const { estado } = await comVagas();
    estado().preencherVaga(hex(1002), hex(777));
    expect(estado().conteudo!.fotos[1]!.imagemId).toBeNull();
  });

  it('preencherVagaSelecionada usa a vaga selecionada na parede e a miniatura selecionada na biblioteca', async () => {
    const { estado } = await comVagas();
    estado().selecionarFoto(hex(1003));
    estado().selecionarImagemDaBiblioteca(PAISAGEM._id);
    estado().preencherVagaSelecionada();
    expect(estado().conteudo!.fotos[2]!.imagemId).toBe(PAISAGEM._id);
  });

  it('preencherVagaSelecionada sem miniatura ou sem vaga selecionada: não faz nada', async () => {
    const { estado } = await comVagas();
    estado().selecionarFoto(hex(1002));
    estado().preencherVagaSelecionada();
    expect(estado().conteudo!.fotos[1]!.imagemId).toBeNull();
    estado().selecionarImagemDaBiblioteca(RETRATO._id);
    estado().selecionarFoto(null);
    estado().preencherVagaSelecionada();
    expect(estado().conteudo!.fotos[1]!.imagemId).toBeNull();
  });
});

describe('galeria de templates (A-18)', () => {
  it('abrirGaleria e fecharGaleria', async () => {
    const { estado } = await abrirCenario();
    expect(estado().ui.galeriaAberta).toBe(false);
    estado().abrirGaleria();
    expect(estado().ui.galeriaAberta).toBe(true);
    estado().fecharGaleria();
    expect(estado().ui.galeriaAberta).toBe(false);
  });
});

describe('posicionar template (RN-32, TPL-06, M3-06, A-21, A-22)', () => {
  const piramide = templatePorId('piramide')!;

  it('entra no modo com o conjunto centralizado na área útil', async () => {
    const { estado } = await abrirCenario();
    estado().abrirGaleria();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    expect(estado().ui.modo).toBe('template');
    expect(estado().ui.galeriaAberta).toBe(false);

    const esperado = aplicarTemplate({
      template: piramide,
      posicaoCm: { xCm: 0, yCm: 0 },
      borda: BORDA,
      novoId: () => hex(1),
    });
    const t = estado().ui.template!;
    expect(t.templateId).toBe('piramide');
    expect(t.nome).toBe('Pirâmide');
    expect(t.borda).toEqual(BORDA);
    expect(t.conjunto.larguraCm).toBe(esperado.conjunto.larguraCm);
    expect(t.conjunto.alturaCm).toBe(esperado.conjunto.alturaCm);
    const centro = centralizarNaAreaUtil(esperado.conjunto, AREA_UTIL);
    expect({ xCm: t.conjunto.xCm, yCm: t.conjunto.yCm }).toEqual(centro);
    expect(t.fotos).toHaveLength(6);
    expect(t.maiorQueAreaUtil).toBe(false);
    expect(t.vagasMaiores).toBe(0);
  });

  it('não entra sem escala (a galeria já avisa)', async () => {
    const { estado } = await abrirCenario({
      projeto: { parede: { ...PAREDE_LINEAR, escala: { metodo: null } } },
    });
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    expect(estado().ui.modo).toBe('editor');
    expect(estado().ui.template).toBeNull();
  });

  it('template desconhecido: não entra', async () => {
    const { estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'nao-existe', borda: BORDA });
    expect(estado().ui.modo).toBe('editor');
  });

  it('maior que a área útil: avisa, mas deixa confirmar', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ areaUtil: { xCm: 0, yCm: 0, larguraCm: 100, alturaCm: 60 } })],
    });
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    expect(estado().ui.template!.maiorQueAreaUtil).toBe(true);
  });

  it('borda grande: conta as vagas que cresceram', async () => {
    const { estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'mondrian', borda: { larguraCm: 8, cor: '#FFFFFF' } });
    expect(estado().ui.template!.vagasMaiores).toBeGreaterThan(0);
  });

  it('moverConjunto encaixa o canto no grid (snap) e mantém 1 cm dentro da parede inteira', async () => {
    const { estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    estado().moverConjunto(42.3, 33.1);
    expect(estado().ui.template!.conjunto).toMatchObject({ xCm: 40, yCm: 35 });
    estado().moverConjunto(-900, 9000);
    const c = estado().ui.template!.conjunto;
    expect(c.xCm).toBe(-(c.larguraCm - 1));
    expect(c.yCm).toBe(224);
  });

  it('sem snap, move a 0,1 cm', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ grid: { ...GRID_PADRAO, snap: false } })],
    });
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    estado().moverConjunto(42.34, 33.16);
    expect(estado().ui.template!.conjunto).toMatchObject({ xCm: 42.3, yCm: 33.2 });
  });

  it('as vagas acompanham o conjunto', async () => {
    const { estado } = await abrirCenario({
      variantes: [variante({ grid: { ...GRID_PADRAO, snap: false } })],
    });
    estado().abrirPosicionarTemplate({ templateId: 'trio', borda: BORDA });
    const antes = estado().ui.template!.fotos.map((f) => ({ x: f.xCm, y: f.yCm }));
    const c0 = { ...estado().ui.template!.conjunto };
    estado().moverConjunto(c0.xCm + 10, c0.yCm - 5);
    const depois = estado().ui.template!.fotos;
    depois.forEach((f, i) => {
      expect(f.xCm).toBeCloseTo(antes[i]!.x + 10, 5);
      expect(f.yCm).toBeCloseTo(antes[i]!.y - 5, 5);
    });
  });

  it('centralizarConjunto volta ao centro da área útil', async () => {
    const { estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    const inicial = { ...estado().ui.template!.conjunto };
    estado().moverConjunto(0, 0);
    estado().centralizarConjunto();
    expect(estado().ui.template!.conjunto).toEqual(inicial);
  });

  it('cancelarTemplate volta à galeria e não cria nada', async () => {
    const { api, estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    estado().cancelarTemplate();
    expect(estado().ui.modo).toBe('editor');
    expect(estado().ui.template).toBeNull();
    expect(estado().ui.galeriaAberta).toBe(true);
    expect(api.criarVariante).not.toHaveBeenCalled();
  });

  it('confirmarTemplate cria a variante com o nome do modelo, copia a área útil e a ativa', async () => {
    const { api, estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    estado().moverConjunto(40, 35);
    await estado().confirmarTemplate();

    const [pid, corpo] = api.criarVariante.mock.calls[0]!;
    expect(pid).toBe(ID_PROJETO);
    expect(corpo).toMatchObject({
      nome: 'Pirâmide',
      areaUtil: AREA_UTIL,
      origem: { tipo: 'template', templateId: 'piramide', posicaoCm: { xCm: 40, yCm: 35 }, borda: BORDA },
    });
    expect(estado().ui.modo).toBe('editor');
    expect(estado().ui.template).toBeNull();
    expect(estado().documento.variante?.nome).toBe('Pirâmide');
    expect(estado().conteudo?.fotos).toHaveLength(6);
    expect(estado().conteudo?.bordaPadrao).toEqual(BORDA);
    expect(estado().documento.sujo).toBe(false);
    expect(resumoDasVariantes(estado()).find((v) => v.ativa)).toMatchObject({ qtdFotos: 6, semFoto: 6 });
    expect(estado().ui.avisoCriacao).toBe('Variante “Pirâmide” criada com 6 vagas.');
  });

  it('nome repetido ganha número: "Pirâmide 2"', async () => {
    const { api, estado } = await abrirCenario();
    for (let i = 0; i < 2; i += 1) {
      estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
      await estado().confirmarTemplate();
    }
    expect(api.criarVariante.mock.calls.map(([, c]) => c.nome)).toEqual(['Pirâmide', 'Pirâmide 2']);
  });

  it('falha da API: continua no modo, com a mensagem, sem perder a posição (A-20)', async () => {
    const { api, estado } = await abrirCenario();
    api.criarVariante.mockRejectedValueOnce(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    estado().moverConjunto(40, 35);
    await estado().confirmarTemplate();
    expect(estado().ui.modo).toBe('template');
    expect(estado().ui.template).toMatchObject({ erro: 'Erro interno do servidor.', criando: false });
    expect(estado().ui.template!.conjunto).toMatchObject({ xCm: 40, yCm: 35 });
    expect(estado().documento.variante?._id).toBe(ID_BASE);
  });

  it('com alterações não salvas, confirmar recusa: a decisão (A-12) vem antes de iniciar o template', async () => {
    const { estado } = await abrirCenario();
    estado().alterarBordaPadrao({ larguraCm: 1 });
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: BORDA });
    expect(estado().ui.modo).toBe('editor');
  });

  it('o total do conjunto confere com o catálogo sem borda', async () => {
    const { estado } = await abrirCenario();
    estado().abrirPosicionarTemplate({ templateId: 'piramide', borda: { larguraCm: 0, cor: '#FFFFFF' } });
    const total = totalDoTemplate(piramide);
    expect(estado().ui.template!.conjunto.larguraCm).toBeCloseTo(total.larguraCm, 1);
  });
});
