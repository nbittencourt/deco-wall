import type { Db } from 'mongodb';
import { aplicar0001Inicial } from './0001-inicial';

// Registro de migrações (§4.7). Ordem fixa; cada uma roda uma única vez.
const MIGRACOES: { id: string; aplicar: (db: Db) => Promise<void> }[] = [
  { id: '0001-inicial', aplicar: aplicar0001Inicial },
];

export async function executarMigracoes(db: Db): Promise<void> {
  const registro = db.collection('migracoes');
  for (const migracao of MIGRACOES) {
    const ja = await registro.findOne({ _id: migracao.id as never });
    if (ja) continue;
    await migracao.aplicar(db);
    await registro.updateOne(
      { _id: migracao.id as never },
      { $setOnInsert: { aplicadaEm: new Date() } },
      { upsert: true },
    );
  }
}
