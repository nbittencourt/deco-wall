// Arquivos soltos com o mouse (RF-20): arquivos e também pastas, que o navegador entrega como entradas de
// sistema de arquivos. As entradas precisam ser pegas de forma síncrona, dentro do evento de soltura.

async function arquivosDe(entrada: FileSystemEntry): Promise<File[]> {
  if (entrada.isFile) {
    const arquivo = await new Promise<File>((resolver, rejeitar) =>
      (entrada as FileSystemFileEntry).file(resolver, rejeitar),
    );
    return [arquivo];
  }
  const leitor = (entrada as FileSystemDirectoryEntry).createReader();
  const filhos: FileSystemEntry[] = [];
  // readEntries devolve em lotes; uma lista vazia marca o fim.
  for (;;) {
    const lote = await new Promise<FileSystemEntry[]>((resolver, rejeitar) =>
      leitor.readEntries(resolver, rejeitar),
    );
    if (lote.length === 0) break;
    filhos.push(...lote);
  }
  return (await Promise.all(filhos.map(arquivosDe))).flat();
}

export function lerArquivosSoltos(dados: DataTransfer): Promise<File[]> {
  const entradas = Array.from(dados.items ?? []).flatMap((item) => {
    const entrada = item.kind === 'file' ? item.webkitGetAsEntry?.() : null;
    return entrada ? [entrada] : [];
  });
  const soltos = Array.from(dados.files);
  if (entradas.length === 0) return Promise.resolve(soltos);
  return Promise.all(entradas.map(arquivosDe)).then((listas) => listas.flat());
}

// O arrasto traz arquivos do sistema (e não, por exemplo, uma miniatura da própria biblioteca)?
export function arrastandoArquivos(dados: DataTransfer | null): boolean {
  return Boolean(dados && Array.from(dados.types).includes('Files'));
}
