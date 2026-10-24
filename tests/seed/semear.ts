import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from 'mongodb';
import sharp from 'sharp';
import { gravarAtomico, prepararPastaFotos } from '../../apps/api/src/armazenamento/pasta';
import { paraMongo } from '../fixtures/banco-teste';
import { areaUtil, foto, id, imagem, projeto, rascunho, tamanho, variante } from '../fixtures/dominio';

// Seed do banco de teste (docs/specs/M0-setup.md §5.5). Substitui o conteúdo das coleções
// de dados e grava os arquivos das imagens ativas em PASTA_FOTOS.

const DIA_MS = 86_400_000;
const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

// Imagens (§4.10): 5 ativas (uma restaurada), 1 excluída com purga não vencida, 1 com purga vencida.
type SeedImagem = {
  n: number;
  arquivo: string;
  projetos: number[];
  excluidaEm: (agora: Date) => Date | null;
  purgaEm: (agora: Date) => Date | null;
  gravaArquivos: boolean;
};

const IMAGENS: SeedImagem[] = [
  {
    n: 1,
    arquivo: 'retrato.jpg',
    projetos: [301],
    excluidaEm: () => null,
    purgaEm: () => null,
    gravaArquivos: true,
  },
  {
    n: 2,
    arquivo: 'paisagem.jpg',
    projetos: [301],
    excluidaEm: () => null,
    purgaEm: () => null,
    gravaArquivos: true,
  },
  {
    n: 3,
    arquivo: 'quadrada.jpg',
    projetos: [301],
    excluidaEm: () => null,
    purgaEm: () => null,
    gravaArquivos: true,
  },
  // restaurada: ativa de novo, mas ainda recomendada no placeholder da variante "Alternativa"
  {
    n: 4,
    arquivo: 'exif-rotacionado.jpg',
    projetos: [301],
    excluidaEm: () => null,
    purgaEm: () => null,
    gravaArquivos: true,
  },
  {
    n: 5,
    arquivo: 'pequena.png',
    projetos: [302],
    excluidaEm: () => null,
    purgaEm: () => null,
    gravaArquivos: true,
  },
  // excluída há 5 dias: purga em 25 dias
  {
    n: 6,
    arquivo: 'pequena.webp',
    projetos: [301],
    excluidaEm: (a) => new Date(a.getTime() - 5 * DIA_MS),
    purgaEm: (a) => new Date(a.getTime() + 25 * DIA_MS),
    gravaArquivos: true,
  },
  // excluída há 40 dias: purga vencida há 10 dias (arquivos já removidos)
  {
    n: 7,
    arquivo: 'quadrada.jpg',
    projetos: [],
    excluidaEm: (a) => new Date(a.getTime() - 40 * DIA_MS),
    purgaEm: (a) => new Date(a.getTime() - 10 * DIA_MS),
    gravaArquivos: false,
  },
];

export async function semear(db: Db, pastaFotos: string): Promise<void> {
  const agora = new Date();
  await prepararPastaFotos(pastaFotos);

  const imagens = [];
  for (const spec of IMAGENS) {
    const render = await sharp(join(FIXTURES, 'imagens', spec.arquivo))
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(render.data)
      .resize({ width: 256, height: 256, fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();

    const hex = id(spec.n);
    const arquivos = { render: `imagens/${hex}.webp`, thumb: `imagens/${hex}.thumb.webp` };
    if (spec.gravaArquivos) {
      await gravarAtomico(pastaFotos, join(pastaFotos, arquivos.render), render.data);
      await gravarAtomico(pastaFotos, join(pastaFotos, arquivos.thumb), thumb);
    }

    const { width, height } = render.info;
    imagens.push(
      imagem({
        _id: hex,
        nomeOriginal: spec.arquivo,
        larguraPx: width,
        alturaPx: height,
        orientacaoNatural: width > height ? 'paisagem' : 'retrato',
        bytes: render.data.length,
        arquivos,
        criadaEm: agora,
        projetos: spec.projetos.map(id),
        excluidaEm: spec.excluidaEm(agora),
        purgaEm: spec.purgaEm(agora),
      }),
    );
  }

  // Parede em perspectiva: a imagem processada fica em paredes/ (a retificada não é usada pelos testes).
  const paredeRender = await sharp(join(FIXTURES, 'paredes', 'perspectiva.jpg'))
    .webp({ quality: 80 })
    .toBuffer();
  await gravarAtomico(pastaFotos, join(pastaFotos, `paredes/${id(301)}.webp`), paredeRender);
  await gravarAtomico(pastaFotos, join(pastaFotos, `paredes/${id(301)}.thumb.webp`), paredeRender);

  const projetos = [
    projeto({
      _id: id(301),
      nome: 'Sala de estar',
      criadoEm: agora,
      atualizadoEm: agora,
      ultimaVarianteId: id(201),
    }),
    projeto({
      _id: id(302),
      nome: 'Quarto',
      criadoEm: agora,
      atualizadoEm: agora,
      ultimaVarianteId: id(205),
      parede: null,
    }),
  ];

  const variantes = [
    // "Base": 5 fotos, 1 placeholder com recomendação (imagem excluída, ainda na purga) e 1 foto personalizada.
    variante({
      _id: id(201),
      projetoId: id(301),
      nome: 'Base',
      ordem: 0,
      revisao: 3,
      criadaEm: agora,
      salvaEm: agora,
      fotos: [
        foto({ _id: id(1001), imagemId: id(1), tamanho: tamanho(), xCm: 40, yCm: 30 }),
        foto({
          _id: id(1002),
          imagemId: id(2),
          tamanho: tamanho({ larguraCm: 30, alturaCm: 20 }),
          xCm: 80,
          yCm: 30,
        }),
        foto({
          _id: id(1003),
          imagemId: id(3),
          tamanho: tamanho({ sugeridoId: '15x15', larguraCm: 15, alturaCm: 15 }),
          xCm: 40,
          yCm: 80,
        }),
        foto({
          _id: id(1004),
          imagemId: null,
          imagemAnteriorId: id(6),
          tamanho: tamanho({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 }),
          xCm: 80,
          yCm: 80,
        }),
        foto({
          _id: id(1005),
          imagemId: id(1),
          tamanho: tamanho({ sugeridoId: null, larguraCm: 21, alturaCm: 29.7 }),
          xCm: 130,
          yCm: 30,
        }),
      ],
    }),
    // "Alternativa": compartilha a imagem 1 com a Base, outra área útil e um placeholder recomendando a imagem 4 restaurada.
    variante({
      _id: id(202),
      projetoId: id(301),
      nome: 'Alternativa',
      ordem: 1,
      revisao: 1,
      criadaEm: agora,
      salvaEm: agora,
      areaUtil: areaUtil({ xCm: 20, yCm: 10, larguraCm: 140, alturaCm: 90 }),
      fotos: [
        foto({
          _id: id(1101),
          imagemId: id(1),
          tamanho: tamanho({ sugeridoId: '10x15', larguraCm: 10, alturaCm: 15 }),
          xCm: 30,
          yCm: 20,
        }),
        foto({
          _id: id(1102),
          imagemId: null,
          imagemAnteriorId: id(4),
          tamanho: tamanho({ sugeridoId: '13x18', larguraCm: 13, alturaCm: 18 }),
          xCm: 60,
          yCm: 20,
        }),
      ],
    }),
    // "Pirâmide": criada de template, só com vagas (sem recomendação).
    variante({
      _id: id(203),
      projetoId: id(301),
      nome: 'Pirâmide',
      ordem: 2,
      revisao: 1,
      criadaEm: agora,
      salvaEm: agora,
      templateOrigem: 'piramide',
      areaUtil: areaUtil({ xCm: 10, yCm: 10, larguraCm: 160, alturaCm: 100 }),
      fotos: [
        foto({ _id: id(1201), imagemId: null, imagemAnteriorId: null, tamanho: tamanho(), xCm: 20, yCm: 20 }),
        foto({ _id: id(1202), imagemId: null, imagemAnteriorId: null, tamanho: tamanho(), xCm: 60, yCm: 20 }),
        foto({
          _id: id(1203),
          imagemId: null,
          imagemAnteriorId: null,
          tamanho: tamanho({ sugeridoId: '15x21', larguraCm: 15, alturaCm: 21 }),
          xCm: 20,
          yCm: 60,
        }),
        foto({
          _id: id(1204),
          imagemId: null,
          imagemAnteriorId: null,
          tamanho: tamanho({ sugeridoId: '15x21', larguraCm: 15, alturaCm: 21 }),
          xCm: 60,
          yCm: 60,
        }),
      ],
    }),
    // "Base" do segundo projeto: sem parede, sem área útil, sem fotos (RN-08).
    variante({
      _id: id(205),
      projetoId: id(302),
      nome: 'Base',
      ordem: 0,
      criadaEm: agora,
      salvaEm: agora,
      areaUtil: null,
      fotos: [],
    }),
  ];

  // Rascunho de sessão "sessao-b", feito sobre a revisão 2; a oficial já está na 3 (conflito, SV-04).
  const rascunhos = [
    rascunho({
      _id: id(401),
      varianteId: id(201),
      projetoId: id(301),
      sessaoId: 'sessao-b',
      revisaoBase: 2,
      salvoEm: agora,
    }),
  ];

  const dados: [string, Record<string, unknown>[]][] = [
    ['imagens', imagens],
    ['projetos', projetos],
    ['variantes', variantes],
    ['rascunhos', rascunhos],
  ];
  for (const [colecao, docs] of dados) {
    await db.collection(colecao).deleteMany({});
    await db.collection(colecao).insertMany(docs.map((d) => paraMongo(d) as Record<string, unknown>));
  }
}
