import { describe, expect, it, vi } from 'vitest';
import { ErroApi, type ImagemDto } from '../infra/dto';
import { criarLoteUpload } from './uploadLote';

// Fila de upload (docs/specs/M2-biblioteca-e-composicao.md §3.2; DV-10, M2-07, B-10, B-11):
// 3 em paralelo, progresso por arquivo, falha sem parar o lote, cancelar restantes, tentar de novo.

const arquivo = (nome: string, tipo = 'image/jpeg', bytes = 1000) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

function imagemDe(nome: string): ImagemDto {
  return {
    _id: nome
      .padEnd(24, '0')
      .slice(0, 24)
      .replace(/[^0-9a-f]/g, 'a'),
    nomeOriginal: nome,
    perfil: 'leve',
    larguraPx: 100,
    alturaPx: 100,
    orientacaoNatural: 'retrato',
    bytes: 1,
    arquivos: { render: 'r', thumb: 't' },
    mime: 'image/webp',
    criadaEm: '2026-10-25T12:00:00.000Z',
    projetos: [],
    excluidaEm: null,
    purgaEm: null,
    schemaVersion: 1,
  };
}

interface Pendente {
  arquivo: File;
  perfil: string;
  sinal: AbortSignal | undefined;
  progresso: (fracao: number) => void;
  resolver: () => void;
  rejeitar: (erro: unknown) => void;
}

// Envio falso controlado à mão: cada chamada fica pendente até o teste resolver ou rejeitar.
function enviadorFalso() {
  const pendentes: Pendente[] = [];
  const enviar = vi.fn(
    (f: File, perfil: string, opcoes: { onProgresso?: (fracao: number) => void; sinal?: AbortSignal } = {}) =>
      new Promise<ImagemDto>((resolve, reject) => {
        const item: Pendente = {
          arquivo: f,
          perfil,
          sinal: opcoes.sinal,
          progresso: (fracao) => opcoes.onProgresso?.(fracao),
          resolver: () => resolve(imagemDe(f.name)),
          rejeitar: reject,
        };
        opcoes.sinal?.addEventListener('abort', () =>
          reject(new DOMException('Envio cancelado.', 'AbortError')),
        );
        pendentes.push(item);
      }),
  );
  return { enviar, pendentes };
}

const nomes = (lote: ReturnType<typeof criarLoteUpload>, status: string) =>
  lote
    .estado()
    .itens.filter((i) => i.status === status)
    .map((i) => i.nome);

describe('fila', () => {
  it('arquivos aceitos entram aguardando; os recusados vão para ignorados com o motivo (RN-20)', () => {
    const { enviar } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 1 });
    lote.adicionar([
      arquivo('a.jpg'),
      arquivo('b.png', 'image/png'),
      arquivo('c.heic', 'image/heic'),
      arquivo('d.jpg', 'image/jpeg', 2 * 1024 * 1024),
    ]);
    const estado = lote.estado();
    expect(estado.itens.map((i) => [i.nome, i.status])).toEqual([
      ['a.jpg', 'aguardando'],
      ['b.png', 'aguardando'],
    ]);
    expect(estado.ignorados).toEqual([
      { nome: 'c.heic', motivo: 'Formato não suportado. Use JPG, PNG ou WEBP.' },
      { nome: 'd.jpg', motivo: 'Arquivo maior que 1 MB.' },
    ]);
    expect(estado.iniciado).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });

  it('nada é enviado antes de iniciar (M2-07); o perfil pode mudar até lá', () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg')]);
    lote.definirPerfil('alto');
    expect(lote.estado().perfil).toBe('alto');
    lote.iniciar();
    expect(pendentes[0]!.perfil).toBe('alto');
  });

  it('depois de iniciar o perfil fica travado e não entram mais arquivos', () => {
    const { enviar } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg')]);
    lote.iniciar();
    lote.definirPerfil('alto');
    lote.adicionar([arquivo('b.jpg')]);
    const estado = lote.estado();
    expect(estado.perfil).toBe('leve');
    expect(estado.itens).toHaveLength(1);
    expect(estado.enviando).toBe(true);
  });
});

describe('envio (DV-10)', () => {
  it('no máximo 3 em paralelo; ao terminar um, entra o próximo', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar(['1', '2', '3', '4', '5'].map((n) => arquivo(`${n}.jpg`)));
    lote.iniciar();

    expect(nomes(lote, 'enviando')).toEqual(['1.jpg', '2.jpg', '3.jpg']);
    expect(nomes(lote, 'aguardando')).toEqual(['4.jpg', '5.jpg']);

    pendentes[0]!.resolver();
    await vi.waitFor(() => expect(nomes(lote, 'concluida')).toEqual(['1.jpg']));
    expect(nomes(lote, 'enviando')).toEqual(['2.jpg', '3.jpg', '4.jpg']);
    expect(enviar).toHaveBeenCalledTimes(4);
  });

  it('progresso por arquivo e aoConcluir a cada imagem pronta', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const aoConcluir = vi.fn();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50, aoConcluir });
    lote.adicionar([arquivo('a.jpg'), arquivo('b.jpg')]);
    lote.iniciar();

    pendentes[0]!.progresso(0.45);
    expect(lote.estado().itens[0]!.progresso).toBeCloseTo(0.45, 6);

    pendentes[1]!.resolver();
    await vi.waitFor(() => expect(aoConcluir).toHaveBeenCalledTimes(1));
    expect(aoConcluir.mock.calls[0]![0]).toMatchObject({ nomeOriginal: 'b.jpg' });
    expect(lote.estado().itens[1]).toMatchObject({ status: 'concluida', progresso: 1 });
    expect(lote.estado().concluidas).toBe(1);
    expect(lote.estado().total).toBe(2);
  });

  it('falha de um arquivo não interrompe o lote e mostra o motivo (B-11)', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg'), arquivo('d.jpg')]);
    lote.iniciar();

    pendentes[0]!.rejeitar(new ErroApi(415, { erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' }));
    await vi.waitFor(() => expect(nomes(lote, 'falhou')).toEqual(['a.jpg']));
    expect(lote.estado().itens[0]!.erro).toBe('Formato não suportado. Use JPG, PNG ou WEBP.');
    expect(nomes(lote, 'enviando')).toEqual(['b.jpg', 'c.jpg', 'd.jpg']);

    for (const p of pendentes.slice(1)) p.resolver();
    await vi.waitFor(() => expect(lote.estado().enviando).toBe(false));
    expect(lote.estado().concluidas).toBe(3);
  });

  it('o lote termina quando a fila esvazia e o perfil destrava', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg')]);
    lote.iniciar();
    pendentes[0]!.resolver();
    await vi.waitFor(() => expect(lote.estado().enviando).toBe(false));
    lote.definirPerfil('medio');
    expect(lote.estado().perfil).toBe('medio');
  });
});

describe('cancelar restantes e tentar de novo', () => {
  it('cancelarRestantes aborta o que está em envio, esvazia a fila e preserva o que terminou (B-11)', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar(['1', '2', '3', '4', '5'].map((n) => arquivo(`${n}.jpg`)));
    lote.iniciar();
    pendentes[0]!.resolver();
    await vi.waitFor(() => expect(nomes(lote, 'concluida')).toEqual(['1.jpg']));

    lote.cancelarRestantes();
    expect(pendentes[1]!.sinal!.aborted).toBe(true);
    await vi.waitFor(() => expect(lote.estado().enviando).toBe(false));
    expect(nomes(lote, 'concluida')).toEqual(['1.jpg']);
    expect(nomes(lote, 'cancelada')).toEqual(['2.jpg', '3.jpg', '4.jpg', '5.jpg']);
    expect(enviar).toHaveBeenCalledTimes(4);
  });

  it('tentarNovamente recoloca o arquivo que falhou ou foi cancelado na fila', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg'), arquivo('b.jpg')]);
    lote.iniciar();
    pendentes[0]!.rejeitar(new ErroApi(500, { erro: 'Erro interno do servidor.' }));
    pendentes[1]!.resolver();
    await vi.waitFor(() => expect(lote.estado().enviando).toBe(false));

    const idFalhou = lote.estado().itens[0]!.id;
    lote.tentarNovamente(idFalhou);
    expect(lote.estado().itens[0]).toMatchObject({ status: 'enviando', erro: undefined });
    expect(enviar).toHaveBeenCalledTimes(3);
    pendentes[2]!.resolver();
    await vi.waitFor(() => expect(lote.estado().concluidas).toBe(2));
  });

  it('tentarNovamente sem id repete todos os que falharam', async () => {
    const { enviar, pendentes } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    lote.adicionar([arquivo('a.jpg'), arquivo('b.jpg')]);
    lote.iniciar();
    pendentes[0]!.rejeitar(new Error('falhou'));
    pendentes[1]!.rejeitar(new Error('falhou'));
    await vi.waitFor(() => expect(lote.estado().enviando).toBe(false));
    lote.tentarNovamente();
    expect(nomes(lote, 'enviando')).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('assinatura', () => {
  it('avisa a cada mudança de estado e para de avisar ao cancelar a assinatura', () => {
    const { enviar } = enviadorFalso();
    const lote = criarLoteUpload({ enviar, perfil: 'leve', limiteMb: 50 });
    const ouvinte = vi.fn();
    const cancelar = lote.assinar(ouvinte);
    lote.adicionar([arquivo('a.jpg')]);
    expect(ouvinte).toHaveBeenCalled();
    cancelar();
    ouvinte.mockClear();
    lote.iniciar();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
