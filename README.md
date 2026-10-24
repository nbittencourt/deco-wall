# Simulador de Parede de Fotos

App web local para simular a decoração de uma parede com fotos: carrega uma foto da parede, calibra a escala em cm, envia fotos para uma biblioteca e posiciona as fotos com grid, snap e medidas. Tudo roda na sua máquina (navegador, servidor Node e MongoDB local).

Requisitos em `docs/PRD.md`; arquitetura em `docs/ARCHITECTURE.md`; especificação do marco atual em `docs/specs/M0-setup.md`.

## Pré-requisitos

- Windows, Node.js 24.15 ou superior
- MongoDB Community 8.x rodando localmente (serviço padrão, porta 27017)

## Setup

```bash
npm install
```

Copie o arquivo de exemplo e ajuste os caminhos:

```bash
copy .env.example .env
```

Variáveis (`.env`, não versionado):

| Variável | Padrão | Uso |
|---|---|---|
| `PASTA_FOTOS` | — (obrigatória) | Pasta onde ficam as fotos processadas |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/parede-fotos` | Conexão com o MongoDB local |
| `API_PORT` | `3001` | Porta da API (escuta só em `127.0.0.1`) |
| `WEB_PORT` | `5173` | Porta do Vite em desenvolvimento |
| `AUTOSAVE_MINUTOS` | `5` | Intervalo do salvamento automático |
| `UPLOAD_MAX_MB` | `50` | Tamanho máximo por arquivo no upload |

Se a pasta de fotos não existir ou o MongoDB estiver fora do ar, a API não sobe e informa o motivo.

## Comandos

```bash
npm run dev           # API (com recarga) e web (Vite) em paralelo: http://127.0.0.1:5173
npm run build         # gera a interface em apps/web/dist
npm run start         # API serve a interface já gerada: http://127.0.0.1:3001
npm run test          # testes unitários e de integração (Vitest)
npm run e2e           # build + testes end-to-end (Playwright)
npm run typecheck     # tsc --noEmit em todo o monorepo
npm run lint          # ESLint
npm run format        # Prettier (grava)
npm run format:check  # Prettier (só verifica)
npm run seed:test     # recria o banco parede-fotos-test com dados de teste
```

`npm run e2e` precisa do Chromium do Playwright, instalado uma vez com `npx playwright install chromium`.

`npm run start` precisa de `npm run build` antes, senão a API sobe mas não serve a interface.

`npm run seed:test` usa o mesmo servidor de `MONGODB_URI`, mas grava no banco `parede-fotos-test` (apagado e recriado a cada execução). As fotos de teste vão para uma pasta temporária, cujo caminho é impresso no fim.

Páginas de desenvolvimento: `/dev/ui` (fundação de design, pranchas 00 e 17) e `/dev/spike-konva` (spike do canvas).

## Estrutura

```
apps/api        servidor Fastify, MongoDB e armazenamento de arquivos
apps/web        interface (Vite, React, Tailwind, shadcn/ui)
packages/domain regras, geometria e schemas Zod (TypeScript puro, sem React/Node)
tests/          fixtures de imagem e parede, seed do banco de teste, E2E e spikes
docs/           PRD, arquitetura, design e especificações por marco
scripts/        orquestração do `npm run dev`
```

A estrutura completa de pastas está em `docs/ARCHITECTURE.md` §6.
