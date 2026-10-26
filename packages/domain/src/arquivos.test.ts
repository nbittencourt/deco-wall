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

  it('exige extensão E tipo (A-19): sem tipo MIME, recusa mesmo com extensão válida', () => {
    expect(validarArquivoImagem({ nome: 'FOTO.JPG', tipo: 'image/jpeg', tamanhoBytes: 1000 }, 50)).toBeNull();
    expect(validarArquivoImagem({ nome: 'FOTO.JPG', tipo: '', tamanhoBytes: 1000 }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
    expect(validarArquivoImagem({ nome: 'parede.docx', tipo: '', tamanhoBytes: 1000 }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
  });

  it('tipo válido com extensão inválida, e o contrário, são recusados', () => {
    expect(validarArquivoImagem({ nome: 'foto.gif', tipo: 'image/jpeg', tamanhoBytes: 1000 }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
    expect(validarArquivoImagem({ nome: 'foto.jpg', tipo: 'image/gif', tamanhoBytes: 1000 }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
    expect(validarArquivoImagem({ nome: 'foto', tipo: 'image/png', tamanhoBytes: 1000 }, 50)).toBe(
      MENSAGEM_FORMATO_NAO_SUPORTADO,
    );
  });

  it.each(['Thumbs.db', 'desktop.ini', '.DS_Store', '.oculto'])(
    'arquivo de sistema da pasta (%s) é recusado e conta como ignorado (A-19, RN-20)',
    (nome) => {
      expect(validarArquivoImagem({ nome, tipo: '', tamanhoBytes: 100 }, 50)).toBe(
        MENSAGEM_FORMATO_NAO_SUPORTADO,
      );
    },
  );

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
