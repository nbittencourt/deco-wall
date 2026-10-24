import { defineConfig } from 'vitest/config';

// Testes do M0 (docs/specs/M0-setup.md §5.5). API e seed compartilham o banco
// `parede-fotos-test`: o projeto `api` roda em série. O `web` usa jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          include: ['packages/domain/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['apps/api/src/**/*.test.ts', 'tests/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        test: {
          name: 'web',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
