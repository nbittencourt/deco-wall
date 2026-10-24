import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E do M0 (docs/specs/M0-setup.md §5.5, §6). Sobe a API já com a build da web.
// Usa a instância local de MongoDB e uma pasta de fotos temporária, separadas do uso diário.
const PORTA = 3101;
const PASTA_FOTOS = join(tmpdir(), 'parede-fotos-e2e');
mkdirSync(PASTA_FOTOS, { recursive: true });

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npx tsx apps/api/src/main.ts',
    url: `http://127.0.0.1:${PORTA}/api/saude`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PASTA_FOTOS,
      API_PORT: String(PORTA),
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/parede-fotos-test',
    },
  },
});
