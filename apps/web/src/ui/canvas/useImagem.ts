import { useEffect, useState } from 'react';

// Carrega uma imagem (mesma origem, sem CORS) para o Konva. Troca de URL descarta a anterior.
export function useImagem(url: string | null): HTMLImageElement | null {
  return useImagemComEstado(url).imagem;
}

// `falhou`: o arquivo não carregou (404, falha de decodificação) — a foto vira "Imagem indisponível" (A-16).
export function useImagemComEstado(url: string | null): { imagem: HTMLImageElement | null; falhou: boolean } {
  const [carregada, setCarregada] = useState<{ url: string; imagem: HTMLImageElement } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return undefined;
    let ativo = true;
    const imagem = new window.Image();
    imagem.onload = () => {
      if (ativo) setCarregada({ url, imagem });
    };
    imagem.onerror = () => {
      if (ativo) setFalha(url);
    };
    imagem.src = url;
    return () => {
      ativo = false;
    };
  }, [url]);

  return {
    imagem: carregada && carregada.url === url ? carregada.imagem : null,
    falhou: url !== null && falha === url,
  };
}
