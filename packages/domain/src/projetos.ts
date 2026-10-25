import { LIMITE_NOME_PROJETO } from './constantes';

// A-02: nome de projeto de 1 a 100 caracteres, sem espaços nas pontas; nome repetido é permitido.

export type ResultadoNome = { ok: true; nome: string } | { ok: false; erro: string };

export function validarNomeProjeto(valor: unknown): ResultadoNome {
  const nome = typeof valor === 'string' ? valor.trim() : '';
  if (nome === '') return { ok: false, erro: 'Informe um nome para o projeto.' };
  if (nome.length > LIMITE_NOME_PROJETO) {
    return { ok: false, erro: `O nome pode ter no máximo ${LIMITE_NOME_PROJETO} caracteres.` };
  }
  return { ok: true, nome };
}
