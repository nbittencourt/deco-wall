import type { FastifyInstance } from 'fastify';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import {
  aplicarCalibracao,
  aplicarPerspectiva,
  enviarParede,
  lerArquivoParede,
  type TipoArquivoParede,
} from '../servicos/parede';
import { lerMultipart } from './multipart';

// Rotas da parede (docs/specs/M1-parede-e-escala.md §5).
const TIPOS: readonly TipoArquivoParede[] = ['original', 'retificada', 'thumb'];

function coincideEtag(cabecalho: string | undefined, etag: string): boolean {
  if (!cabecalho) return false;
  return cabecalho
    .split(',')
    .map((valor) => valor.trim().replace(/^W\//, ''))
    .some((valor) => valor === '*' || valor === etag);
}

export async function registrarParede(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  app.put<{ Params: { id: string } }>('/api/projetos/:id/parede', async (request) => {
    const { campos, arquivos } = await lerMultipart(request, ctx.uploadMaxMb);
    return enviarParede(ctx, request.params.id, {
      perfil: campos.perfil,
      revisaoBase: campos.revisaoBase,
      arquivo: arquivos.arquivo ?? null,
    });
  });

  // Linear: JSON. Perspectiva: multipart com `dados` (JSON) e o bitmap `retificada`.
  app.put<{ Params: { id: string } }>('/api/projetos/:id/parede/escala', async (request) => {
    if (!request.isMultipart()) return aplicarCalibracao(ctx, request.params.id, request.body);

    const { campos, arquivos } = await lerMultipart(request, ctx.uploadMaxMb);
    let dados: unknown;
    try {
      dados = JSON.parse(campos.dados ?? '');
    } catch {
      throw new ErroHttp(422, 'Dados da perspectiva inválidos.');
    }
    return aplicarPerspectiva(ctx, request.params.id, { dados, retificada: arquivos.retificada ?? null });
  });

  app.get<{ Params: { id: string }; Querystring: { tipo?: string } }>(
    '/api/projetos/:id/parede/arquivo',
    async (request, reply) => {
      const tipo = request.query.tipo as TipoArquivoParede;
      if (!TIPOS.includes(tipo)) throw new ErroHttp(400, 'Tipo de arquivo inválido.');
      const { conteudo, etag } = await lerArquivoParede(ctx, request.params.id, tipo);

      // A-19: o nome do arquivo não muda; o navegador revalida a cada carga e recebe 304 se nada mudou.
      reply.header('etag', etag).header('cache-control', 'no-cache');
      if (coincideEtag(request.headers['if-none-match'], etag)) return reply.code(304).send();
      return reply.type('image/webp').send(conteudo);
    },
  );
}
