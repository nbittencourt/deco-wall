import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarAppTeste, type AppTeste } from '../../../../tests/fixtures/api';

// GET /api/config (docs/specs/M2-biblioteca-e-composicao.md §5, A-28): o browser lê o limite real de upload.

let t: AppTeste;

beforeAll(async () => {
  t = await criarAppTeste({ uploadMaxMb: 12 });
});

afterAll(async () => {
  await t.fechar();
});

describe('GET /api/config (A-28)', () => {
  it('devolve o limite de upload configurado (UPLOAD_MAX_MB)', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ uploadMaxMb: 12 });
  });
});
