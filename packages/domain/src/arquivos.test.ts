import { describe, expect, it } from 'vitest';
import { MENSAGEM_FORMATO_NAO_SUPORTADO, validarArquivoImagem } from './arquivos';

// RF-15 e spec M1 §3.3: JPG, PNG e WEBP até UPLOAD_MAX_MB; HEIC e demais são recusados antes do envio.

const MB = 1024 * 1024;

describe('validarArquivoImagem', () => {
  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.jpeg', 'image/jpeg'],
    ['foto.png', 'image/png'],
    ['foto.webp', 'image/webp'],
  ])('aceita %s', (nome, tipo) => {
    expect(validarArquivoImagem({ nome, tipo, tamanhoBytes: 1000 }, 50)).toBeNull();
  });

  it('sem tipo MIME (arrastar no Windows), decide pela extensão, sem diferenciar maiúsculas', () => {
    expect(validarArquivoImagem({ nome: 'FOTO.JPG', tipo: '', tamanhoBytes: 1000 }, 50)).toBeNull();
    expect(validarArquivoImagem({ nome: 'parede.docx', tipo: '', tamanhoBytes: 1000 }, 50)).toBe(
      'Formato não suportado. Use JPG, PNG ou WEBP.',
    );
  });

  it('recusa HEIC, GIF e outros formatos', () => {
    for (const [nome, tipo] of [
      ['foto.heic', 'image/heic'],
      ['foto.gif', 'image/gif'],
      ['doc.pdf', 'application/pdf'],
    ] as const) {
      expect(validarArquivoImagem({ nome, tipo, tamanhoBytes: 1000 }, 50)).toBe(
        MENSAGEM_FORMATO_NAO_SUPORTADO,
      );
    }
    expect(MENSAGEM_FORMATO_NAO_SUPORTADO).toBe('Formato não suportado. Use JPG, PNG ou WEBP.');
  });

  it('recusa arquivo acima do limite e aceita exatamente o limite', () => {
    expect(validarArquivoImagem({ nome: 'a.jpg', tipo: 'image/jpeg', tamanhoBytes: 50 * MB + 1 }, 50)).toBe(
      'Arquivo maior que 50 MB.',
    );
    expect(validarArquivoImagem({ nome: 'a.jpg', tipo: 'image/jpeg', tamanhoBytes: 50 * MB }, 50)).toBeNull();
  });

  it('o limite aparece na mensagem', () => {
    expect(validarArquivoImagem({ nome: 'a.png', tipo: 'image/png', tamanhoBytes: 3 * MB }, 2)).toBe(
      'Arquivo maior que 2 MB.',
    );
  });

  it('o formato inválido tem precedência sobre o tamanho', () => {
    expect(validarArquivoImagem({ nome: 'a.heic', tipo: 'image/heic', tamanhoBytes: 999 * MB }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
  });
});
