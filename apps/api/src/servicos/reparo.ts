import type { Db, ObjectId } from 'mongodb';
import { paraMongo } from '../repositorios/conversao';
import { montarVarianteBase } from './projetos';

// A-18: sem transações, uma falha entre duas gravações pode deixar restos. Na inicialização a API corrige:
// projeto sem variante ganha a "Base"; variantes e rascunhos de projeto inexistente são apagados.
export interface ResumoReparo {
  variantesCriadas: number;
  variantesApagadas: number;
  rascunhosApagados: number;
}

export async function repararInconsistencias(db: Db, agora: Date): Promise<ResumoReparo> {
  const projetos = db.collection('projetos');
  const variantes = db.collection('variantes');
  const rascunhos = db.collection('rascunhos');

  const idsProjetos = (await projetos.find({}, { projection: { _id: 1 } }).toArray()).map(
    (p) => p._id as ObjectId,
  );
  const comVariante = new Set(
    (await variantes.distinct('projetoId')).map((id: ObjectId) => id.toHexString()),
  );

  let variantesCriadas = 0;
  for (const id of idsProjetos) {
    if (comVariante.has(id.toHexString())) continue;
    const base = montarVarianteBase(id, agora);
    await variantes.insertOne(paraMongo(base) as never);
    await projetos.updateOne({ _id: id }, { $set: { ultimaVarianteId: paraMongo(base._id, '_id') } });
    variantesCriadas += 1;
  }

  const orfaos = { projetoId: { $nin: idsProjetos } };
  const variantesApagadas = (await variantes.deleteMany(orfaos)).deletedCount;
  const rascunhosApagados = (await rascunhos.deleteMany(orfaos)).deletedCount;
  return { variantesCriadas, variantesApagadas, rascunhosApagados };
}
