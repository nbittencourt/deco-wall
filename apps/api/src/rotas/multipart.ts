import type { FastifyRequest } from 'fastify';
import { ErroHttp } from '../erros';

// Lê um corpo multipart inteiro: campos de texto e arquivos (em memória; o limite por arquivo é UPLOAD_MAX_MB).
export interface CorpoMultipart {
  campos: Record<string, string>;
  arquivos: Record<string, Buffer>;
}

export async function lerMultipart(request: FastifyRequest, uploadMaxMb: number): Promise<CorpoMultipart> {
  if (!request.isMultipart()) {
    throw new ErroHttp(400, 'Requisição inválida: envie os dados como multipart/form-data.');
  }
  const campos: Record<string, string> = {};
  const arquivos: Record<string, Buffer> = {};
  try {
    for await (const parte of request.parts()) {
      if (parte.type === 'file') {
        const conteudo = await parte.toBuffer();
        // Navegadores mandam uma parte vazia quando nenhum arquivo foi escolhido.
        if (conteudo.length > 0) arquivos[parte.fieldname] = conteudo;
      } else {
        campos[parte.fieldname] = String(parte.value);
      }
    }
  } catch (erro) {
    if ((erro as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      throw new ErroHttp(413, `Arquivo maior que ${uploadMaxMb} MB.`);
    }
    throw erro;
  }
  return { campos, arquivos };
}
