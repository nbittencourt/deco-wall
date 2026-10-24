import { describe, expect, it } from 'vitest';
import { conectarMongo } from './mongo';
import { uriBancoTeste } from '../../../../tests/fixtures/banco-teste';

describe('conectarMongo (§5.3 — conexão única)', () => {
  it('conecta no banco de teste e responde ping', async () => {
    const client = await conectarMongo(uriBancoTeste());
    try {
      const resposta = await client.db('admin').command({ ping: 1 });
      expect(resposta.ok).toBe(1);
    } finally {
      await client.close();
    }
  });

  it('falha com mensagem que cita o MongoDB quando não está acessível', async () => {
    await expect(conectarMongo('mongodb://127.0.0.1:1/parede-fotos', { timeoutMs: 500 })).rejects.toThrow(
      /MongoDB/,
    );
  });
});
