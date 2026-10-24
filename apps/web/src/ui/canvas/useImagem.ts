import { useEffect, useState } from 'react';

// Carrega uma imagem (mesma origem, sem CORS) para o Konva. Troca de URL descarta a anterior.
export function useImagem(url: string | null): HTMLImageElement | null {
  const [carregada, setCarregada] = useState<{ url: string; imagem: HTMLImageElement } | null>(null);

  useEffect(() => {
    if (!url) return undefined;
    let ativo = true;
    const imagem = new window.Image();
    imagem.onload = () => {
      if (ativo) setCarregada({ url, imagem });
    };
    imagem.src = url;
    return () => {
      ativo = false;
    };
  }, [url]);

  return carregada && carregada.url === url ? carregada.imagem : null;
}
