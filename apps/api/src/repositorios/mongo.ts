import { MongoClient } from 'mongodb';

// Conexão única com o MongoDB local (§5.3). Falha com mensagem clara, sem expor senha.
export interface OpcoesConexao {
  timeoutMs?: number;
}

export async function conectarMongo(uri: string, opcoes: OpcoesConexao = {}): Promise<MongoClient> {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: opcoes.timeoutMs ?? 5000,
  });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return client;
  } catch (erro) {
    await client.close().catch(() => undefined);
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`Não foi possível conectar ao MongoDB em ${ocultarSenha(uri)}: ${motivo}`, {
      cause: erro,
    });
  }
}

function ocultarSenha(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, '//***@');
}
