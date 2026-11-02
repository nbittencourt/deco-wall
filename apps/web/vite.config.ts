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
      rolldownOptions: {
        // Radix e Lucide trazem "use client"; é inofensivo fora de um bundle de servidor.
        onwarn(aviso, padrao) {
          if (aviso.code === 'MODULE_LEVEL_DIRECTIVE') return;
          padrao(aviso);
        },
        output: {
          // M4-15, A-24: o pacote de entrada só leva o essencial da tela Projetos; o Konva e o bson ficam em
          // chunks próprios, baixados ao abrir o editor (as rotas do editor, da comparação e de /dev/ui são lazy).
          codeSplitting: {
            // Sem isto o grupo do Konva arrasta o React (dependência dele) e a entrada passa a baixar o Konva.
            includeDependenciesRecursively: false,
            groups: [
              { name: 'konva', test: /node_modules[/\\](konva|react-konva)[/\\]/ },
              { name: 'bson', test: /node_modules[/\\]bson[/\\]/ },
              { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ },
            ],
          },
        },
      },
    },
  };
});
