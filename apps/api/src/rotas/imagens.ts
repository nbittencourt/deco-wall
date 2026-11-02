import type { FastifyInstance } from 'fastify';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import {
  associacoesDaImagem,
  enviarImagem,
  excluirImagem,
  lerArquivoImagem,
  listarImagens,
  removerImagemDoProjeto,
  restaurarImagem,
  type SituacaoImagens,
  type TipoArquivoImagem,
} from '../servicos/imagens';
import { lerMultipart } from './multipart';

// Rotas da biblioteca de imagens (docs/specs/M2-biblioteca-e-composicao.md §5;
// docs/specs/M4-ciclo-de-vida-e-exportacao.md §5).
const TIPOS: readonly TipoArquivoImagem[] = ['render', 'thumb'];
const SITUACOES: readonly SituacaoImagens[] = ['ativas', 'excluidas'];

// Os arquivos têm o id no nome e nunca mudam: o navegador pode guardá-los para sempre.
const CACHE_IMUTAVEL = 'public, max-age=31536000, immutable';

export async function registrarImagens(app: FastifyInstance, ctx: ContextoApi): Promise<void> {
  app.post('/api/imagens', async (request, reply) => {
    const { campos, arquivos, nomes } = await lerMultipart(request, ctx.uploadMaxMb);
    const imagem = await enviarImagem(ctx, {
      perfil: campos.perfil,
      projetoId: campos.projetoId,
      nomeOriginal: nomes.arquivo,
      arquivo: arquivos.arquivo ?? null,
    });
    return reply.code(201).send(imagem);
  });

  app.get<{ Querystring: { situacao?: string } }>('/api/imagens', async (request) => {
    const situacao = request.query.situacao ?? 'ativas';
    if (!SITUACOES.includes(situacao as SituacaoImagens)) throw new ErroHttp(400, 'Situação inválida.');
    return listarImagens(ctx, situacao as SituacaoImagens);
  });

  app.get<{ Params: { id: string } }>('/api/imagens/:id/associacoes', async (request) =>
    associacoesDaImagem(ctx, request.params.id),
  );

  app.delete<{ Params: { id: string } }>('/api/imagens/:id', async (request) =>
    excluirImagem(ctx, request.params.id),
  );

  app.post<{ Params: { id: string } }>('/api/imagens/:id/restaurar', async (request) =>
    restaurarImagem(ctx, request.params.id),
  );

  app.delete<{ Params: { projetoId: string; id: string } }>(
    '/api/projetos/:projetoId/imagens/:id',
    async (request) => removerImagemDoProjeto(ctx, request.params.projetoId, request.params.id),
  );

  app.get<{ Params: { id: string }; Querystring: { tipo?: string } }>(
    '/api/imagens/:id/arquivo',
    async (request, reply) => {
      const tipo = request.query.tipo as TipoArquivoImagem;
      if (!TIPOS.includes(tipo)) throw new ErroHttp(400, 'Tipo de arquivo inválido.');
      const conteudo = await lerArquivoImagem(ctx, request.params.id, tipo);
      return reply.header('cache-control', CACHE_IMUTAVEL).type('image/webp').send(conteudo);
    },
  );
}
