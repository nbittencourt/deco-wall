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

// Devolve a mensagem de recusa (pt-BR) ou null quando o arquivo pode ser enviado. A-19: vale a extensão E o tipo
// (jpg, jpeg, png ou webp e image/jpeg, image/png ou image/webp). Arquivo sem tipo, ou de sistema da pasta
// (Thumbs.db, desktop.ini, ocultos), é recusado como qualquer outro formato e conta nos ignorados (RN-20).
export function validarArquivoImagem(arquivo: ArquivoImagem, limiteMb: number): string | null {
  const extensao = arquivo.nome.includes('.') ? arquivo.nome.split('.').pop()!.toLowerCase() : '';
  if (!EXTENSOES_ACEITAS.has(extensao) || !TIPOS_ACEITOS.has(arquivo.tipo)) {
    return MENSAGEM_FORMATO_NAO_SUPORTADO;
  }
  if (arquivo.tamanhoBytes > limiteMb * 1024 * 1024) return `Arquivo maior que ${limiteMb} MB.`;
  return null;
}
