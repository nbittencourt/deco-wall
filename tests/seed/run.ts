import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBancoTesteLimpo, NOME_BANCO_TESTE } from '../fixtures/banco-teste';
import { executarMigracoes } from '../../apps/api/src/migracoes/executar';
import { semear } from './semear';

// Comando `npm run seed:test`: recria o banco parede-fotos-test, aplica as migrações e popula o seed.
// As fotos vão para uma pasta temporária (docs/specs/M0-setup.md §5.5).

const { client, db } = await abrirBancoTesteLimpo();
try {
  await executarMigracoes(db);
  const pastaFotos = await mkdtemp(join(tmpdir(), 'parede-fotos-teste-'));
  await semear(db, pastaFotos);
  console.log(`Banco ${NOME_BANCO_TESTE} populado.`);
  console.log(`Fotos de teste em ${pastaFotos}`);
} finally {
  await client.close();
}
