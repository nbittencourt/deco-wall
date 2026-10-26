import { request as requisicaoHttp } from 'node:http';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  criarAppTeste,
  criarProjetoApi,
  enviarImagemApi,
  jpegSintetico,
  lerImagem,
  type AppTeste,
  type ImagemJson,
} from '../../../../tests/fixtures/api';

// Biblioteca de imagens: upload, listagem e arquivos (docs/specs/M2-biblioteca-e-composicao.md §3.2, §5;
// RF-20, RF-22, RF-25, RF-26, RF-27, RN-04, RN-20, RN-21, RN-25, ADR-05).

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

async function projetoNovo() {
  return (await criarProjetoApi(t.app, 'Sala')).projeto;
}

const existe = (relativo: string) =>
  access(join(t.pasta, relativo)).then(
    () => true,
    () => false,
  );

describe('POST /api/imagens — upload (RF-20, RF-25)', () => {
  it('201 com o registro da imagem processada', async () => {
    const projeto = await projetoNovo();
    const res = await enviarImagemApi(t.app, { projetoId: projeto._id, nome: 'retrato.jpg' });
    expect(res.statusCode).toBe(201);
    const imagem = res.json() as ImagemJson;
    expect(imagem._id).toMatch(/^[0-9a-f]{24}$/);
    expect(imagem).toMatchObject({
      nomeOriginal: 'retrato.jpg',
      perfil: 'leve',
      larguraPx: 600,
      alturaPx: 800,
      orientacaoNatural: 'retrato',
      mime: 'image/webp',
      arquivos: { render: `imagens/${imagem._id}.webp`, thumb: `imagens/${imagem._id}.thumb.webp` },
      projetos: [projeto._id],
      excluidaEm: null,
      purgaEm: null,
      schemaVersion: 1,
    });
    expect(new Date(imagem.criadaEm).getTime()).not.toBeNaN();
  });

  it('grava o render e a miniatura de 256 px em PASTA_FOTOS e guarda o registro no banco (RF-26)', async () => {
    const projeto = await projetoNovo();
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;

    const render = await sharp(join(t.pasta, imagem.arquivos.render)).metadata();
    expect([render.format, render.width, render.height]).toEqual(['webp', 600, 800]);
    const thumb = await sharp(join(t.pasta, imagem.arquivos.thumb)).metadata();
    expect(thumb.format).toBe('webp');
    expect(Math.max(thumb.width!, thumb.height!)).toBe(256);

    const bytes = (await readFile(join(t.pasta, imagem.arquivos.render))).length;
    expect(imagem.bytes).toBe(bytes);
    const doc = await t.db.collection('imagens').findOne({ _id: new ObjectId(imagem._id) });
    expect(doc).toMatchObject({ nomeOriginal: 'foto.jpg', perfil: 'leve', excluidaEm: null });
    expect(doc!.projetos).toEqual([new ObjectId(projeto._id)]);
  });

  it('orientação natural: paisagem, retrato e quadrada (quadrada vale retrato — RN-04)', async () => {
    const projeto = await projetoNovo();
    const orientacao = async (arquivo: string) =>
      (
        (
          await enviarImagemApi(t.app, { projetoId: projeto._id, arquivo: await lerImagem(arquivo) })
        ).json() as ImagemJson
      ).orientacaoNatural;
    expect(await orientacao('paisagem.jpg')).toBe('paisagem');
    expect(await orientacao('retrato.jpg')).toBe('retrato');
    expect(await orientacao('quadrada.jpg')).toBe('retrato');
  });

  it('respeita a orientação EXIF (RF-02): o JPG rotacionado sai em retrato', async () => {
    const projeto = await projetoNovo();
    const res = await enviarImagemApi(t.app, {
      projetoId: projeto._id,
      arquivo: await lerImagem('exif-rotacionado.jpg'),
    });
    const imagem = res.json() as ImagemJson;
    expect([imagem.larguraPx, imagem.alturaPx]).toEqual([600, 800]);
    expect(imagem.orientacaoNatural).toBe('retrato');
    const gravada = await sharp(join(t.pasta, imagem.arquivos.render)).metadata();
    expect([gravada.width, gravada.height]).toEqual([600, 800]);
  });

  it('aceita PNG e WEBP', async () => {
    const projeto = await projetoNovo();
    const png = await enviarImagemApi(t.app, {
      projetoId: projeto._id,
      arquivo: await lerImagem('pequena.png'),
      nome: 'a.png',
      tipo: 'image/png',
    });
    const webp = await enviarImagemApi(t.app, {
      projetoId: projeto._id,
      arquivo: await lerImagem('pequena.webp'),
      nome: 'b.webp',
      tipo: 'image/webp',
    });
    expect([png.statusCode, webp.statusCode]).toEqual([201, 201]);
  });

  it('perfis reduzem o lado maior a 1024, 2048 e 3072 px, sem ampliar (ADR-05)', async () => {
    const projeto = await projetoNovo();
    const grande = await jpegSintetico(4000, 3000);
    const medidas = async (perfil: string) => {
      const imagem = (
        await enviarImagemApi(t.app, { projetoId: projeto._id, arquivo: grande, perfil })
      ).json() as ImagemJson;
      return { perfil: imagem.perfil, l: imagem.larguraPx, a: imagem.alturaPx };
    };
    expect(await medidas('leve')).toEqual({ perfil: 'leve', l: 1024, a: 768 });
    expect(await medidas('medio')).toEqual({ perfil: 'medio', l: 2048, a: 1536 });
    expect(await medidas('alto')).toEqual({ perfil: 'alto', l: 3072, a: 2304 });

    const pequena = (
      await enviarImagemApi(t.app, {
        projetoId: projeto._id,
        arquivo: await lerImagem('pequena.png'),
        nome: 'p.png',
        perfil: 'alto',
      })
    ).json() as ImagemJson;
    expect([pequena.larguraPx, pequena.alturaPx]).toEqual([400, 300]);
  });

  it('nomeOriginal é só o nome do arquivo, sem pasta (envio de pasta)', async () => {
    const projeto = await projetoNovo();
    const a = (
      await enviarImagemApi(t.app, { projetoId: projeto._id, nome: 'fotos/ferias/praia.jpg' })
    ).json() as ImagemJson;
    const b = (
      await enviarImagemApi(t.app, { projetoId: projeto._id, nome: 'fotos\\ferias\\serra.jpg' })
    ).json() as ImagemJson;
    expect(a.nomeOriginal).toBe('praia.jpg');
    expect(b.nomeOriginal).toBe('serra.jpg');
  });

  it('a mesma foto enviada duas vezes vira duas imagens (RN-25)', async () => {
    const projeto = await projetoNovo();
    const a = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const b = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    expect(a._id).not.toBe(b._id);
    expect(await t.db.collection('imagens').countDocuments()).toBe(2);
  });
});

describe('POST /api/imagens — recusas', () => {
  it('415 "Não foi possível ler a imagem." para texto renomeado para .jpg e para HEIC (RN-20, §5)', async () => {
    const projeto = await projetoNovo();
    for (const arquivo of ['texto-invalido.jpg', 'documento.heic']) {
      const res = await enviarImagemApi(t.app, {
        projetoId: projeto._id,
        arquivo: await lerImagem(arquivo),
        nome: arquivo,
      });
      expect(res.statusCode, arquivo).toBe(415);
      expect(res.json()).toEqual({ erro: 'Não foi possível ler a imagem.' });
    }
  });

  it('413 acima de UPLOAD_MAX_MB', async () => {
    const projeto = await projetoNovo();
    const res = await enviarImagemApi(t.app, {
      projetoId: projeto._id,
      arquivo: Buffer.alloc(1.5 * 1024 * 1024, 1),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ erro: 'Arquivo maior que 1 MB.' });
  });

  it('400 para perfil inválido, arquivo ausente ou projeto não informado', async () => {
    const projeto = await projetoNovo();
    expect((await enviarImagemApi(t.app, { projetoId: projeto._id, perfil: 'gigante' })).statusCode).toBe(
      400,
    );
    expect((await enviarImagemApi(t.app, { projetoId: projeto._id, arquivo: null })).statusCode).toBe(400);
    expect((await enviarImagemApi(t.app, {})).statusCode).toBe(400);
  });

  it('404 para projeto inexistente ou id malformado', async () => {
    expect((await enviarImagemApi(t.app, { projetoId: new ObjectId().toHexString() })).statusCode).toBe(404);
    expect((await enviarImagemApi(t.app, { projetoId: 'nao-e-id' })).statusCode).toBe(404);
  });

  it('recusa não deixa rastro: nada no banco, nada em imagens/ nem em tmp/', async () => {
    const projeto = await projetoNovo();
    // A pasta é compartilhada entre os testes: compara com o que já havia.
    const antes = await readdir(join(t.pasta, 'imagens'));
    await enviarImagemApi(t.app, { projetoId: projeto._id, arquivo: await lerImagem('texto-invalido.jpg') });
    await enviarImagemApi(t.app, { projetoId: projeto._id, arquivo: Buffer.alloc(2 * 1024 * 1024, 1) });
    expect(await t.db.collection('imagens').countDocuments()).toBe(0);
    expect(await readdir(join(t.pasta, 'imagens'))).toEqual(antes);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
  });
});

describe('POST /api/imagens — upload abortado pelo cliente (DV-10, §5)', () => {
  it('conexão cortada no meio do corpo: nenhum documento, nenhum arquivo, nada em tmp/', async () => {
    const projeto = await projetoNovo();
    const antes = await readdir(join(t.pasta, 'imagens'));
    await t.app.listen({ port: 0, host: '127.0.0.1' });
    try {
      const { port } = t.app.server.address() as { port: number };
      const limite = '----corte';
      const cabeca = Buffer.from(
        `--${limite}

Content-Disposition: form-data; name="perfil"



leve

` +
          `--${limite}

Content-Disposition: form-data; name="projetoId"



${projeto._id}

` +
          `--${limite}

Content-Disposition: form-data; name="arquivo"; filename="x.jpg"

` +
          `Content-Type: image/jpeg



`,
      );
      const metade = (await lerImagem('paisagem.jpg')).subarray(0, 2000);
      await new Promise<void>((resolve) => {
        const req = requisicaoHttp({
          host: '127.0.0.1',
          port,
          path: '/api/imagens',
          method: 'POST',
          headers: {
            'content-type': `multipart/form-data; boundary=${limite}`,
            'content-length': String(cabeca.length + metade.length + 50_000),
          },
        });
        req.on('error', () => undefined);
        req.on('close', () => resolve());
        req.write(Buffer.concat([cabeca, metade]), () => setTimeout(() => req.destroy(), 100));
      });
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      await t.app.server.close?.();
    }
    expect(await t.db.collection('imagens').countDocuments()).toBe(0);
    expect(await readdir(join(t.pasta, 'imagens'))).toEqual(antes);
    expect(await readdir(join(t.pasta, 'tmp'))).toEqual([]);
  });
});

describe('GET /api/imagens — biblioteca global (RF-27, RN-22)', () => {
  it('vazia: lista vazia', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/imagens' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('mais recentes primeiro, de qualquer projeto', async () => {
    const a = await projetoNovo();
    const b = await projetoNovo();
    const primeira = (
      await enviarImagemApi(t.app, { projetoId: a._id, nome: 'um.jpg' })
    ).json() as ImagemJson;
    const segunda = (
      await enviarImagemApi(t.app, { projetoId: b._id, nome: 'dois.jpg' })
    ).json() as ImagemJson;
    const lista = (await t.app.inject({ method: 'GET', url: '/api/imagens' })).json() as ImagemJson[];
    expect(lista.map((i) => i._id)).toEqual([segunda._id, primeira._id]);
    expect(lista[0]).toMatchObject({ nomeOriginal: 'dois.jpg', projetos: [b._id] });
  });

  it('imagens excluídas não aparecem (o fluxo de exclusão é do M4)', async () => {
    const projeto = await projetoNovo();
    const viva = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    const morta = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    await t.db
      .collection('imagens')
      .updateOne({ _id: new ObjectId(morta._id) }, { $set: { excluidaEm: new Date(), purgaEm: new Date() } });
    const lista = (await t.app.inject({ method: 'GET', url: '/api/imagens' })).json() as ImagemJson[];
    expect(lista.map((i) => i._id)).toEqual([viva._id]);
  });
});

describe('GET /api/imagens/:id/arquivo', () => {
  it('render e miniatura em WebP, imutáveis no cache', async () => {
    const projeto = await projetoNovo();
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    for (const tipo of ['render', 'thumb']) {
      const res = await t.app.inject({
        method: 'GET',
        url: `/api/imagens/${imagem._id}/arquivo?tipo=${tipo}`,
      });
      expect(res.statusCode, tipo).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect((await sharp(res.rawPayload).metadata()).format).toBe('webp');
    }
    expect(await existe(imagem.arquivos.render)).toBe(true);
  });

  it('tipo inválido: 400; imagem inexistente ou id malformado: 404', async () => {
    const projeto = await projetoNovo();
    const imagem = (await enviarImagemApi(t.app, { projetoId: projeto._id })).json() as ImagemJson;
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/imagens/${imagem._id}/arquivo?tipo=original` }))
        .statusCode,
    ).toBe(400);
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/imagens/${imagem._id}/arquivo` })).statusCode,
    ).toBe(400);
    const inexistente = new ObjectId().toHexString();
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/imagens/${inexistente}/arquivo?tipo=render` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await t.app.inject({ method: 'GET', url: '/api/imagens/xyz/arquivo?tipo=render' })).statusCode,
    ).toBe(404);
  });
});
