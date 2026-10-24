// Arquivos de imagem aceitos no upload (RF-15, docs/specs/M1-parede-e-escala.md §3.3): JPG, PNG e WEBP.
// HEIC não é suportado: o usuário converte antes. Estrutura mínima de arquivo, para valer no browser
// (File) e em testes sem depender de APIs do browser.

export const MENSAGEM_FORMATO_NAO_SUPORTADO = 'Formato não suportado. Use JPG, PNG ou WEBP.';

const TIPOS_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSOES_ACEITAS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export interface ArquivoImagem {
  nome: string;
  tipo: string;
  tamanhoBytes: number;
}

// Devolve a mensagem de recusa (pt-BR) ou null quando o arquivo pode ser enviado.
export function validarArquivoImagem(arquivo: ArquivoImagem, limiteMb: number): string | null {
  const extensao = arquivo.nome.includes('.') ? arquivo.nome.split('.').pop()!.toLowerCase() : '';
  // Alguns sistemas não informam o tipo ao arrastar o arquivo: nesse caso vale a extensão.
  const formatoOk =
    TIPOS_ACEITOS.has(arquivo.tipo) || (arquivo.tipo === '' && EXTENSOES_ACEITAS.has(extensao));
  if (!formatoOk) return MENSAGEM_FORMATO_NAO_SUPORTADO;
  if (arquivo.tamanhoBytes > limiteMb * 1024 * 1024) return `Arquivo maior que ${limiteMb} MB.`;
  return null;
}
