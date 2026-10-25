import { describe, expect, it } from 'vitest';
import type { ImagemDto } from '../infra/dto';
import { filtrarImagens } from './biblioteca';

// Filtros da biblioteca (RF-28, B-08): Todas · Projeto (carregadas no projeto OU usadas na variante, inclusive
// o que ainda não foi salvo) · Variante (usadas na variante aberta).

const hex = (n: number) => n.toString(16).padStart(24, '0');
const PROJETO = hex(301);

const imagem = (n: number, projetos: string[] = []): ImagemDto => ({
  _id: hex(n),
  nomeOriginal: `foto-${n}.jpg`,
  perfil: 'leve',
  larguraPx: 100,
  alturaPx: 100,
  orientacaoNatural: 'retrato',
  bytes: 1,
  arquivos: { render: 'r', thumb: 't' },
  mime: 'image/webp',
  criadaEm: '2026-10-25T12:00:00.000Z',
  projetos,
  excluidaEm: null,
  purgaEm: null,
  schemaVersion: 1,
});

const IMAGENS = [
  imagem(1, [PROJETO]), // carregada neste projeto
  imagem(2, [hex(302)]), // de outro projeto
  imagem(3, [hex(302)]), // de outro projeto, mas usada numa foto desta variante (ainda não salva)
  imagem(4, []),
];
const FOTOS = [{ imagemId: hex(3) }, { imagemId: hex(3) }, { imagemId: null }];

describe('filtrarImagens', () => {
  it('"todas" devolve a biblioteca inteira, na ordem recebida', () => {
    expect(filtrarImagens(IMAGENS, 'todas', PROJETO, FOTOS).map((i) => i._id)).toEqual([
      hex(1),
      hex(2),
      hex(3),
      hex(4),
    ]);
  });

  it('"projeto": carregadas no projeto ou usadas na variante', () => {
    expect(filtrarImagens(IMAGENS, 'projeto', PROJETO, FOTOS).map((i) => i._id)).toEqual([hex(1), hex(3)]);
  });

  it('"variante": só as usadas na variante aberta, sem repetir', () => {
    expect(filtrarImagens(IMAGENS, 'variante', PROJETO, FOTOS).map((i) => i._id)).toEqual([hex(3)]);
  });

  it('variante vazia: filtro "variante" não devolve nada', () => {
    expect(filtrarImagens(IMAGENS, 'variante', PROJETO, [])).toEqual([]);
  });
});
