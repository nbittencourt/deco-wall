# CLAUDE.md — Simulador de Parede de Fotos

> **Objetivo deste arquivo:** instruções operacionais para o Claude trabalhar neste repositório — o que é o projeto, como está organizado, comandos, convenções e regras. Conteúdo estável; muda quando a forma de trabalhar muda.
> Contexto, decisões e histórico ficam em `MEMORY.md`. Requisitos ficam em `docs/PRD.md`.

## Projeto

App web local (browser + servidor Node + MongoDB, tudo na mesma máquina) para simular a decoração de uma parede com fotos: o usuário carrega uma foto da parede, calibra a escala em cm (perspectiva), faz upload de fotos para uma biblioteca global e posiciona fotos em tamanhos sugeridos ou personalizados (retrato ou paisagem) com apoio de grid, snap e medidas.

## Leitura obrigatória antes de implementar

1. `docs/PRD.md` — requisitos (RF/RNF), regras de negócio (RN), critérios de aceite.
2. `docs/DESIGN.md` + `docs/design/` — decisões visuais e protótipos.
3. `docs/ARCHITECTURE.md` — camadas, sistemas de coordenadas, ADRs. Nova biblioteca só entra após ADR registrada.
   - `docs/specs/` — especificação de cada marco (M0, M1…), incluindo modelo de dados (M0).
4. `MEMORY.md` — decisões tomadas, questões em aberto, status atual.

## Stack (ver `docs/ARCHITECTURE.md`)

Monorepo npm workspaces: `apps/web` (Vite + React 19 + TS + react-konva + Zustand/zundo + shadcn/ui/Tailwind) · `apps/api` (Node + Fastify + sharp + driver oficial MongoDB) · `packages/domain` (TS puro + Zod). MongoDB instalado localmente no Windows.

## Comandos (após setup)

```bash
npm install
cp .env.example .env   # ajustar PASTA_FOTOS e MONGODB_URI
npm run dev            # web + api
npm run build && npm start   # uso diário (api serve o build)
npm run test
npm run lint
npm run e2e
```

## Estrutura de pastas

`docs/ARCHITECTURE.md` §6 é a **fonte única de caminhos de arquivos**; em divergência com DESIGN ou specs, vale a ARCHITECTURE. Novo arquivo/pasta fora do previsto → atualizar a §6 antes. Regra de dependência: `apps/web` e `apps/api` dependem de `packages/domain`; `domain` não importa React, Konva, Node nem APIs do browser.

## Convenções

- **Unidade de verdade = cm.** O estado guarda posições e tamanhos em cm; conversão para px só na camada `canvas/` via `pxPorCm`. Nunca persistir px de fotos.
- Regras de negócio (RN-xx), geometria e schemas Zod em `packages/domain/` como funções puras, com teste unitário obrigatório.
- Referenciar IDs do PRD em commits e PRs (ex.: `feat(grid): snap to grid [RF-53]`).
- Código e identificadores de domínio podem usar termos em português do PRD (`Parede`, `FotoNaParede`, `Tamanho`); comentários breves, só em partes-chave.
- UI em pt-BR.
- Nenhuma chamada para fora de `localhost` (RNF-01). API escuta só em `127.0.0.1`.
- `.env` nunca versionado; manter `.env.example` atualizado.

## Regras de trabalho

- Responder em português, direto, sem preâmbulo.
- **Nunca** alterar, mover ou excluir arquivos fora do escopo pedido sem autorização explícita.
- Ao tomar ou confirmar uma decisão relevante (stack, escopo, mudança de requisito), registrar em `MEMORY.md` (seção Decisões) e, se mudar requisito, atualizar `docs/PRD.md`.
- Ao concluir uma etapa do roadmap, atualizar o Status em `MEMORY.md`.
- Em dúvida de requisito, consultar o PRD; se ambíguo, perguntar antes de implementar.
- Priorizar documentação oficial das libs (Konva, React, MDN para File System Access API).
