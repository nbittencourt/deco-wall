import type { FastifyInstance } from 'fastify';
import type { ContextoApi } from '../contexto';
import { ErroHttp } from '../erros';
import { enviarImagem, lerArquivoImagem, listarImagens, type TipoArquivoImagem } from '../servicos/imagens';
import { lerMultipart } from './multipart';

// Rotas da biblioteca de imagens (docs/specs/M2-biblioteca-e-composicao.md §5).
const TIPOS: readonly TipoArquivoImagem[] = ['render', 'thumb'];

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

  app.get('/api/imagens', async () => listarImagens(ctx));

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
