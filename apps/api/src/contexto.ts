import type { Db } from 'mongodb';

// Dependências compartilhadas por serviços e rotas.
export interface ContextoApi {
  db: Db;
  pastaFotos: string;
  uploadMaxMb: number;
  agora: () => Date;
}
