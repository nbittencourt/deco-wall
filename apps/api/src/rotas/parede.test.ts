import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  aplicarLinearApi,
  aplicarPerspectivaApi,
  criarAppTeste,
  criarProjetoApi,
  enviarParedeApi,
  montarMultipart,
  salvarVarianteApi,
  type AppTeste,
  type ProjetoJson,
  type VarianteJson,
} from '../../../../tests/fixtures/api';
import { foto, id as idFixture } from '../../../../tests/fixtures/dominio';
import { CAMINHO_FRONTAL } from '../../../../tests/fixtures/paredes';

// Parede: upload, troca e arquivos (docs/specs/M1-parede-e-escala.md §3.3, §5, A-19, M1-05, RF-01, RF-02, RF-25).

const IMAGENS = fileURLToPath(new URL('../../../../tests/fixtures/imagens/', import.meta.url));
const lerImagem = (nome: string) => readFile(join(IMAGENS, nome));

let t: AppTeste;

beforeAll(async () => {
  t = await criarAppTeste({ uploadMaxMb: 1 });
});

afterAll(async () => {
  await t.fechar();
});

beforeEach(async () => {
  await Promise.all(
    ['projetos', 'variantes', 'rascunhos', 'imagens'].map((c) => t.db.collection(c).deleteMany({})),
  );
});

async function novoProjeto() {
  const { projeto, variantes } = await criarProjetoApi(t.app, 'Sala');
  return { projeto, base: variantes[0]! };
}

async function existe(relativo: string): Promise<boolean> {
  try {
    await access(join(t.pasta, relativo));
    return true;
  } catch {
    return false;
  }
}

async function jpegSintetico(largura: number, altura: number): Promise<Buffer> {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

async function buscarProjeto(id: string) {
  const res = await t.app.inject({ method: 'GET', url: `/api/projetos/${id}` });
  return res.json() as { projeto: ProjetoJson; variantes: VarianteJson[] };
}

describe('PUT /api/projetos/:id/parede — upload (RF-01)', () => {
  it('processa a foto, grava os arquivos e zera a escala', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    expect(res.statusCode).toBe(200);

    const corpo = res.json() as { projeto: ProjetoJson; variantesAlteradas: unknown[] };
    expect(corpo.projeto.revisao).toBe(projeto.revisao + 1);
    expect(corpo.projeto.parede).toEqual({
      perfil: 'leve',
      arquivo: `paredes/${projeto._id}.webp`,
      thumb: `paredes/${projeto._id}.thumb.webp`,
      larguraPx: 1600,
      alturaPx: 1200,
      escala: { metodo: null },
    });
    expect(corpo.variantesAlteradas).toEqual([]);

    const gravada = await sharp(join(t.pasta, `paredes/${projeto._id}.webp`)).metadata();
    expect(gravada.format).toBe('webp');
    expect([gravada.width, gravada.height]).toEqual([1600, 1200]);
  });

  it('gera a miniatura de 400 px no lado maior (A-17)', async () => {
    const { projeto } = await novoProjeto();
    await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    const thumb = await sharp(join(t.pasta, `paredes/${projeto._id}.thumb.webp`)).metadata();
    expect(thumb.format).toBe('webp');
    expect([thumb.width, thumb.height]).toEqual([400, 300]);
  });

  it('aplica a orientação EXIF e informa as dimensões depois da rotação (RF-02)', async () => {
    const { projeto } = await novoProjeto();
    // exif-rotacionado.jpg: 800 × 600 gravado, orientação 6 → exibida em pé, 600 × 800.
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await lerImagem('exif-rotacionado.jpg'),
    });
    expect(res.statusCode).toBe(200);
    const { parede } = (res.json() as { projeto: ProjetoJson }).projeto;
    expect([parede!.larguraPx, parede!.alturaPx]).toEqual([600, 800]);

    const gravada = await sharp(join(t.pasta, `paredes/${projeto._id}.webp`)).metadata();
    expect([gravada.width, gravada.height]).toEqual([600, 800]);
    expect(gravada.orientation ?? 1).toBe(1);
  });

  it('aceita PNG e WEBP', async () => {
    const { projeto } = await novoProjeto();
    const png = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await lerImagem('pequena.png'),
      nome: 'parede.png',
      tipo: 'image/png',
    });
    expect(png.statusCode).toBe(200);
    const revisao = (png.json() as { projeto: ProjetoJson }).projeto.revisao;
    const webp = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: revisao,
      arquivo: await lerImagem('pequena.webp'),
      nome: 'parede.webp',
      tipo: 'image/webp',
    });
    expect(webp.statusCode).toBe(200);
  });

  it('decide o formato pelo conteúdo, não pela extensão: JPG que é texto → 415', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await lerImagem('texto-invalido.jpg'),
      nome: 'parede.jpg',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' });
  });

  it('recusa HEIC (RF-15) com 415', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await lerImagem('documento.heic'),
      nome: 'parede.heic',
      tipo: 'image/heic',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ erro: 'Formato não suportado. Use JPG, PNG ou WEBP.' });
  });

  it('recusa arquivo acima de UPLOAD_MAX_MB com 413', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: Buffer.alloc(1.5 * 1024 * 1024, 1),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ erro: 'Arquivo maior que 1 MB.' });
  });

  it('upload recusado não deixa rastro: nada gravado, revisão e parede intactas', async () => {
    const { projeto } = await novoProjeto();
    await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await lerImagem('texto-invalido.jpg'),
    });
    await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: Buffer.alloc(2 * 1024 * 1024, 1),
    });

    expect(await existe(`paredes/${projeto._id}.webp`)).toBe(false);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
    const { projeto: atual } = await buscarProjeto(projeto._id);
    expect(atual.revisao).toBe(projeto.revisao);
    expect(atual.parede).toBeNull();
  });

  it('409 quando a revisão do projeto mudou em outra aba (SV-09)', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao + 5 });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'Este projeto foi alterado em outra aba.' });
    expect(await existe(`paredes/${projeto._id}.webp`)).toBe(false);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
  });

  it('404 para projeto inexistente', async () => {
    const res = await enviarParedeApi(t.app, idFixture(999), { revisaoBase: 1 });
    expect(res.statusCode).toBe(404);
  });

  it('400 para perfil inválido ou arquivo ausente', async () => {
    const { projeto } = await novoProjeto();
    const perfil = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      perfil: 'gigante',
    });
    expect(perfil.statusCode).toBe(400);

    const semArquivo = await montarMultipart({ perfil: 'leve', revisaoBase: String(projeto.revisao) });
    const res = await t.app.inject({
      method: 'PUT',
      url: `/api/projetos/${projeto._id}/parede`,
      payload: semArquivo.payload,
      headers: semArquivo.headers,
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /api/projetos/:id/parede — perfis (RF-25, ADR-05)', () => {
  it('Leve reduz o lado maior a 3072 px, mantendo a proporção', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await jpegSintetico(4000, 3000),
      perfil: 'leve',
    });
    const { parede } = (res.json() as { projeto: ProjetoJson }).projeto;
    expect(parede).toMatchObject({ perfil: 'leve', larguraPx: 3072, alturaPx: 2304 });
  });

  it('Alto mantém 4000 × 3000 (abaixo de 6144) e não amplia fotos pequenas', async () => {
    const { projeto } = await novoProjeto();
    const grande = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await jpegSintetico(4000, 3000),
      perfil: 'alto',
    });
    const p1 = (grande.json() as { projeto: ProjetoJson }).projeto;
    expect(p1.parede).toMatchObject({ perfil: 'alto', larguraPx: 4000, alturaPx: 3000 });

    const pequena = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: p1.revisao,
      arquivo: await lerImagem('pequena.png'),
      perfil: 'alto',
    });
    const p2 = (pequena.json() as { projeto: ProjetoJson }).projeto;
    expect(p2.parede).toMatchObject({ larguraPx: 400, alturaPx: 300 });
  });

  it('Médio reduz a 4096 no lado maior', async () => {
    const { projeto } = await novoProjeto();
    const res = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await jpegSintetico(6000, 4000),
      perfil: 'medio',
    });
    const { parede } = (res.json() as { projeto: ProjetoJson }).projeto;
    expect(parede).toMatchObject({ perfil: 'medio', larguraPx: 4096, alturaPx: 2731 });
  });
});

describe('PUT /api/projetos/:id/parede — troca (M1-05, RF-07)', () => {
  async function comEscalaEAreaUtil() {
    const { projeto, base } = await novoProjeto();
    const up = await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: projeto.revisao,
      arquivo: await readFile(CAMINHO_FRONTAL),
    });
    const revisao = (up.json() as { projeto: ProjetoJson }).projeto.revisao;
    const cal = await aplicarLinearApi(t.app, projeto._id, { revisaoBase: revisao });
    expect(cal.statusCode).toBe(200);
    return { projeto, base, revisaoProjeto: (cal.json() as { projeto: ProjetoJson }).projeto.revisao };
  }

  it('sem fotos: troca a parede, descarta a escala e zera a área útil das variantes', async () => {
    const { projeto, base, revisaoProjeto } = await comEscalaEAreaUtil();
    const antes = (await buscarProjeto(projeto._id)).variantes[0]!;
    expect(antes.areaUtil).not.toBeNull();

    const res = await enviarParedeApi(t.app, projeto._id, { revisaoBase: revisaoProjeto });
    expect(res.statusCode).toBe(200);
    const corpo = res.json() as {
      projeto: ProjetoJson;
      variantesAlteradas: { _id: string; revisao: number; areaUtil: unknown }[];
    };
    expect(corpo.projeto.parede).toMatchObject({ larguraPx: 1600, alturaPx: 1200, escala: { metodo: null } });
    expect(corpo.projeto.parede!.retificada).toBeUndefined();
    expect(corpo.variantesAlteradas).toEqual([{ _id: base._id, revisao: antes.revisao + 1, areaUtil: null }]);

    const depois = (await buscarProjeto(projeto._id)).variantes[0]!;
    expect(depois).toMatchObject({ areaUtil: null, revisao: antes.revisao + 1 });
  });

  it('apaga a imagem retificada da parede anterior', async () => {
    const { projeto } = await novoProjeto();
    const up = await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    const persp = await aplicarPerspectivaApi(t.app, projeto._id, {
      revisaoBase: (up.json() as { projeto: ProjetoJson }).projeto.revisao,
    });
    expect(persp.statusCode).toBe(200);
    expect(await existe(`paredes/${projeto._id}.retificada.webp`)).toBe(true);

    const revisao = (persp.json() as { projeto: ProjetoJson }).projeto.revisao;
    const troca = await enviarParedeApi(t.app, projeto._id, { revisaoBase: revisao });
    expect(troca.statusCode).toBe(200);
    expect(await existe(`paredes/${projeto._id}.retificada.webp`)).toBe(false);
  });

  it('com fotos posicionadas em alguma variante: 409 e nada muda (RF-04 segue futuro)', async () => {
    const { projeto, base, revisaoProjeto } = await comEscalaEAreaUtil();
    const atual = (await buscarProjeto(projeto._id)).variantes[0]!;
    const salvo = await salvarVarianteApi(t.app, projeto._id, base._id, {
      sessaoId: 'sessao-a',
      revisaoBase: atual.revisao,
      grid: atual.grid,
      bordaPadrao: atual.bordaPadrao,
      areaUtil: atual.areaUtil,
      fotos: [foto()],
    });
    expect(salvo.statusCode).toBe(200);

    const res = await enviarParedeApi(t.app, projeto._id, { revisaoBase: revisaoProjeto });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ erro: 'Não é possível trocar a parede: há fotos posicionadas.' });

    const depois = await buscarProjeto(projeto._id);
    expect(depois.projeto.revisao).toBe(revisaoProjeto);
    expect(depois.projeto.parede!.larguraPx).toBe(1200);
    expect(depois.variantes[0]!.areaUtil).not.toBeNull();
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
  });
});

describe('GET /api/projetos/:id/parede/arquivo (A-19)', () => {
  async function comParede() {
    const { projeto } = await novoProjeto();
    await enviarParedeApi(t.app, projeto._id, { revisaoBase: projeto.revisao });
    return projeto;
  }

  it.each(['original', 'thumb'])('serve %s como image/webp com ETag e no-cache', async (tipo) => {
    const projeto = await comParede();
    const res = await t.app.inject({
      method: 'GET',
      url: `/api/projetos/${projeto._id}/parede/arquivo?tipo=${tipo}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/webp');
    expect(res.headers.etag).toBeTruthy();
    expect(String(res.headers['cache-control'])).toContain('no-cache');
    const meta = await sharp(res.rawPayload).metadata();
    expect(meta.format).toBe('webp');
  });

  it('responde 304 quando o ETag não mudou', async () => {
    const projeto = await comParede();
    const url = `/api/projetos/${projeto._id}/parede/arquivo?tipo=original`;
    const primeira = await t.app.inject({ method: 'GET', url });
    const segunda = await t.app.inject({
      method: 'GET',
      url,
      headers: { 'if-none-match': String(primeira.headers.etag) },
    });
    expect(segunda.statusCode).toBe(304);
  });

  it('o ETag muda quando a parede é trocada (mesmo nome de arquivo)', async () => {
    const projeto = await comParede();
    const url = `/api/projetos/${projeto._id}/parede/arquivo?tipo=original`;
    const antes = await t.app.inject({ method: 'GET', url });
    const revisao = (await buscarProjeto(projeto._id)).projeto.revisao;
    await enviarParedeApi(t.app, projeto._id, {
      revisaoBase: revisao,
      arquivo: await readFile(CAMINHO_FRONTAL),
    });
    const depois = await t.app.inject({
      method: 'GET',
      url,
      headers: { 'if-none-match': String(antes.headers.etag) },
    });
    expect(depois.statusCode).toBe(200);
    expect(depois.headers.etag).not.toBe(antes.headers.etag);
  });

  it('retificada: 404 sem perspectiva, 200 depois de aplicada', async () => {
    const projeto = await comParede();
    const url = `/api/projetos/${projeto._id}/parede/arquivo?tipo=retificada`;
    expect((await t.app.inject({ method: 'GET', url })).statusCode).toBe(404);

    const revisao = (await buscarProjeto(projeto._id)).projeto.revisao;
    await aplicarPerspectivaApi(t.app, projeto._id, { revisaoBase: revisao });
    const res = await t.app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/webp');
  });

  it('404 sem parede e 400 para tipo inválido', async () => {
    const { projeto } = await novoProjeto();
    expect(
      (
        await t.app.inject({
          method: 'GET',
          url: `/api/projetos/${projeto._id}/parede/arquivo?tipo=original`,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/projetos/${projeto._id}/parede/arquivo?tipo=outro` }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await t.app.inject({
          method: 'GET',
          url: `/api/projetos/${idFixture(999)}/parede/arquivo?tipo=thumb`,
        })
      ).statusCode,
    ).toBe(404);
  });
});
