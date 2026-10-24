// `npm run dev`: sobe a API (com recarga) e o Vite em paralelo (ADR-11).
// Sem dependência extra: dois processos filhos, encerrados juntos com Ctrl+C.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const tsx = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const processos = [
  spawn(process.execPath, [tsx, 'watch', 'apps/api/src/main.ts'], { cwd: raiz, stdio: 'inherit' }),
  spawn(process.execPath, [vite, '--config', 'apps/web/vite.config.ts'], { cwd: raiz, stdio: 'inherit' }),
];

let encerrando = false;
function encerrar(codigo) {
  if (encerrando) return;
  encerrando = true;
  for (const processo of processos) processo.kill();
  process.exit(codigo);
}

for (const processo of processos) {
  processo.on('exit', (codigo) => encerrar(codigo ?? 0));
}
process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));
