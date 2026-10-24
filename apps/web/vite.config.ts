import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// Variáveis do .env da raiz (WEB_PORT, API_PORT). Proxy /api mantém a origem única (ADR-11).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  const apiPort = env.API_PORT ?? '3001';
  const webPort = Number(env.WEB_PORT ?? '5173');

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        // Radix e Lucide trazem "use client"; é inofensivo fora de um bundle de servidor.
        onwarn(aviso, padrao) {
          if (aviso.code === 'MODULE_LEVEL_DIRECTIVE') return;
          padrao(aviso);
        },
      },
    },
  };
});
