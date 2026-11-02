import { join } from 'node:path';
import { INTERVALO_PURGA_HORAS } from '@deco-wall/domain';
import type { ObjectId } from 'mongodb';
import { apagarArquivo } from '../armazenamento/pasta';
import type { ContextoApi } from '../contexto';

// Purga das imagens excluídas (RN-24, M4-09, A-10; docs/specs/M4-ciclo-de-vida-e-exportacao.md §4.4).
// Sem transações, a ordem por imagem é a que deixa cada falha reparável na rodada seguinte:
// (1) zera `imagemAnteriorId` nas variantes e rascunhos (sem mudar revisão nem datas: não é edição),
// (2) apaga os arquivos (ausente = feito; outro erro mantém o documento), (3) apaga o documento.

export interface ResumoPurga {
  removidas: number;
  falhas: number;
  // true quando outra rodada já estava em andamento e esta não fez nada.
  ignorada: boolean;
}

let emAndamento = false;

async function purgarUma(ctx: ContextoApi, doc: Record<string, unknown>): Promise<void> {
  const _id = doc._id as ObjectId;
  await ctx.db
    .collection('variantes')
    .updateMany(
      { 'fotos.imagemAnteriorId': _id },
      { $set: { 'fotos.$[f].imagemAnteriorId': null } },
      { arrayFilters: [{ 'f.imagemAnteriorId': _id }] },
    );
  await ctx.db
    .collection('rascunhos')
    .updateMany(
      { 'conteudo.fotos.imagemAnteriorId': _id },
      { $set: { 'conteudo.fotos.$[f].imagemAnteriorId': null } },
      { arrayFilters: [{ 'f.imagemAnteriorId': _id }] },
    );
  const arquivos = doc.arquivos as { render: string; thumb: string };
  await apagarArquivo(join(ctx.pastaFotos, arquivos.render));
  await apagarArquivo(join(ctx.pastaFotos, arquivos.thumb));
  await ctx.db.collection('imagens').deleteOne({ _id });
}

export async function purgarImagens(ctx: ContextoApi): Promise<ResumoPurga> {
  if (emAndamento) return { removidas: 0, falhas: 0, ignorada: true };
  emAndamento = true;
  try {
    const vencidas = await ctx.db
      .collection('imagens')
      .find({ excluidaEm: { $ne: null }, purgaEm: { $lte: ctx.agora() } })
      .sort({ purgaEm: 1 })
      .toArray();
    let removidas = 0;
    let falhas = 0;
    for (const doc of vencidas) {
      try {
        await purgarUma(ctx, doc);
        removidas += 1;
      } catch (erro) {
        falhas += 1;
        ctx.log.error(erro, `Purga: não foi possível remover a imagem ${String(doc._id)}.`);
      }
    }
    return { removidas, falhas, ignorada: false };
  } finally {
    emAndamento = false;
  }
}

export type Agendador = (tarefa: () => Promise<unknown>, intervaloMs: number) => () => void;

// O `unref` deixa o processo encerrar normalmente mesmo com a purga agendada.
const agendadorPadrao: Agendador = (tarefa, intervaloMs) => {
  const intervalo = setInterval(() => void tarefa(), intervaloMs);
  intervalo.unref();
  return () => clearInterval(intervalo);
};

// A-10: uma rodada ao iniciar e outra a cada 24 h. O agendador é injetável nos testes.
export async function iniciarPurga(
  ctx: ContextoApi,
  opcoes: { agendador?: Agendador } = {},
): Promise<{ parar(): void }> {
  const rodada = async () => {
    try {
      const resumo = await purgarImagens(ctx);
      if (!resumo.ignorada) ctx.log.info(`Purga: ${resumo.removidas} imagens removidas`);
    } catch (erro) {
      ctx.log.error(erro, 'Purga: a rodada falhou.');
    }
  };
  await rodada();
  const cancelar = (opcoes.agendador ?? agendadorPadrao)(rodada, INTERVALO_PURGA_HORAS * 60 * 60 * 1000);
  return { parar: cancelar };
}
