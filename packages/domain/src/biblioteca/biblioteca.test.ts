import { describe, expect, it } from 'vitest';
import { filtrarBiblioteca, orientacaoNatural } from './biblioteca';

// Biblioteca (RF-22, RF-28, RN-04, M2-05; §4.1).

describe('orientacaoNatural (RN-04)', () => {
  it('largura > altura: paisagem; senão, retrato (a quadrada vale retrato)', () => {
    expect(orientacaoNatural(1024, 768)).toBe('paisagem');
    expect(orientacaoNatural(768, 1024)).toBe('retrato');
    expect(orientacaoNatural(500, 500)).toBe('retrato');
  });
});

describe('filtrarBiblioteca (M2-05: só o estado salvo)', () => {
  const imagens = [
    { _id: 'a', projetos: ['p1'] },
    { _id: 'b', projetos: ['p2'] },
    { _id: 'c', projetos: ['p1', 'p2'] },
    { _id: 'd', projetos: [] as string[] },
  ];
  const contexto = {
    projetoId: 'p1',
    fotosSalvas: [{ imagemId: 'a' }, { imagemId: null }, { imagemId: 'b' }],
  };

  it('Todas: todas, na ordem recebida', () => {
    expect(filtrarBiblioteca(imagens, 'todas', contexto).map((i) => i._id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Projeto: só as imagens com o projeto em `projetos` — foto usada e não associada não entra', () => {
    expect(filtrarBiblioteca(imagens, 'projeto', contexto).map((i) => i._id)).toEqual(['a', 'c']);
  });

  it('Variante: só as imagens das fotos da última versão salva; placeholder não conta', () => {
    expect(filtrarBiblioteca(imagens, 'variante', contexto).map((i) => i._id)).toEqual(['a', 'b']);
  });

  it('variante sem fotos salvas: vazia', () => {
    expect(filtrarBiblioteca(imagens, 'variante', { projetoId: 'p1', fotosSalvas: [] })).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const copia = [...imagens];
    filtrarBiblioteca(imagens, 'todas', contexto).pop();
    expect(imagens).toEqual(copia);
  });
});
