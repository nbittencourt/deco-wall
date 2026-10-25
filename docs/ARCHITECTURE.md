# ARCHITECTURE — Simulador de Parede de Fotos

| Campo | Valor |
|---|---|
| Versão | 0.7 |
| Data | 2026-10-24 |
| Base | `docs/PRD.md` v0.11 |
| Status | Decisões fechadas; modelo de dados em `docs/specs/M0-setup.md` §4 |

> **Objetivo deste arquivo:** registrar a arquitetura e cada decisão técnica (ADR) com critérios, alternativas avaliadas e consequências. Toda escolha de biblioteca ou componente nova entra aqui antes de entrar no código.

## 1. Princípios e restrições

| # | Princípio | Origem |
|---|---|---|
| P1 | **100% local**: browser + servidor local + MongoDB local. Nada sai da máquina; sem autenticação (usuário único). | RNF-01/02 |
| P2 | **cm é a unidade de verdade**; px existe só em render, entrada de mouse e arquivos de imagem. | RNF-04 |
| P3 | Domínio puro: regras (RN-xx) e geometria em TypeScript sem React, Konva, Node ou APIs do browser — compartilhado entre web e API. | RNF-07 |
| P4 | Mínimo de dependências: só entra biblioteca que economize complexidade real e tenha manutenção ativa. | — |
| P5 | Alvo: Chrome/Edge desktop atuais. | RNF-02 |
| P6 | Operações pesadas fora da thread principal da UI (processamento de imagem no servidor; retificação em Web Worker). | RNF-03 |
| P7 | Configuração local por `.env` (pasta de fotos, conexão Mongo, portas). | Decisão 17/10 |

## 2. Critérios de avaliação de bibliotecas

| Critério | O que avalia |
|---|---|
| Aderência (alto) | Resolve o requisito sem contorno. |
| Manutenção (alto) | Releases no último ano, compatibilidade com Node/React/TS atuais. |
| Complexidade evitada (alto) | Quanto código próprio substitui vs. quanto acoplamento traz. |
| Tamanho/performance (médio) | Peso e custo em runtime. |
| Tipagem TS (médio) | Tipos nativos e corretos. |
| Documentação (médio) | Docs oficiais e exemplos para o caso de uso. |
| Lock-in (baixo) | Custo de trocar depois. |

## 3. Visão geral

```
┌──────────────────────────── Browser (apps/web) ────────────────────────────┐
│ UI React: Toolbar · Biblioteca global · Propriedades · Projetos · Variantes  │
│ Canvas react-konva (1 ou 2 viewports sincronizados)                          │
│ Store Zustand: documento (histórico por variante) · ui · biblioteca          │
│ Workers: retificação de perspectiva                                          │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ HTTP JSON + multipart (mesma origem: /api)
┌───────────────▼──────────────── Servidor local (apps/api) ─────────────────┐
│ Rotas REST · validação (schemas compartilhados) · processamento de imagem   │
│ Repositórios ──► MongoDB local          Armazenamento ──► PASTA_FOTOS (.env)│
└─────────────────────────────────────────────────────────────────────────────┘
          ▲ ambos importam
┌─────────┴──────── packages/domain (TS puro) ────────┐
│ tipos · RN · geometria · homografia · snap · desenho │
└──────────────────────────────────────────────────────┘
```

**Regra de dependência:** `web` e `api` dependem de `domain`; `domain` não depende de nada. Na web: UI → aplicação (store/ações) → domínio; infraestrutura (cliente HTTP, workers) implementa portas da aplicação.

## 4. Sistemas de coordenadas

| Espaço | Unidade | Origem | Uso |
|---|---|---|---|
| Imagem da parede | px | canto sup.-esq. da parede processada (EXIF aplicado) | marcar cantos da perspectiva / segmento linear |
| Mundo | cm | canto sup.-esq. do retângulo de referência (RN-07); X → direita, Y → baixo | **todo o estado persistido** |
| Bitmap retificado | px | canto sup.-esq. da área retificada | textura de fundo do canvas |
| Tela | px | canto do elemento canvas | eventos de mouse, zoom/pan |

- **Imagem → Mundo:** homografia `H` (3×3). Com perspectiva: 4 cantos ↔ retângulo `(0,0)–(L,A)` cm. Só calibração linear: `H = escala(1/pxPorCm)`.
- **Mundo → Bitmap retificado:** afim `(x − x0) · r` (r = px/cm do bitmap).
- **Mundo → Tela:** afim do viewport `cm · zoom + pan` (`scale`/`position` do Stage).

## 5. Decisões (ADRs)

### ADR-01 — Plataforma: monorepo TypeScript (web + api + domain) · **Decidido**

- Web: Vite 8 + React 19 + TS `strict` (SPA).
- API: Node LTS + TS (ADR-13).
- `packages/domain`: TS puro compartilhado — tipos, regras, geometria e schemas de validação usados nos dois lados.
- Monorepo com **npm workspaces** (sem ferramenta extra tipo Nx/Turborepo — P4).
- `react-konva` 19.3 exige React ≥ 19.3 — fixar versões juntas no M0.

### ADR-02 — Renderização do canvas: Konva + react-konva · **Decidido**

| Opção | Aderência | Integração React | Observação |
|---|---|---|---|
| **Konva** | Drag, hit-test, camadas, `Konva.Image.crop` (*cover* nativo) | `react-konva` oficial | Canvas 2D; adequado a dezenas de objetos |
| Fabric.js | Forte em editores | Sem binding oficial | Recursos (resize/rotação livre) que o PRD não usa |
| PixiJS | WebGL | `@pixi/react` | Orientado a jogos |
| SVG/DOM | Simples | Nativa | Fundo grande e export ficam caros |

Consequências:
- Nós Konva em cm; `Stage.scale = zoom`; linhas de UI com `strokeScaleEnabled = false`.
- Camadas: Parede (estática, cacheada) · Grid (1 `Shape` com `sceneFunc`, só linhas visíveis) · Fotos (1 `Group` por foto: `Rect` borda + `Image` com `crop`; snap em `dragBoundFunc`) · Overlay (seleção, destaques RN-11/12, ferramentas; nunca exportada).
- Comparação (ADR-12): dois `Stage` lado a lado compartilhando o mesmo estado de viewport.

### ADR-03 — Estado no cliente: Zustand + Immer + zundo · **Decidido**

- Fatias: `documento` (projeto aberto), `ui` (seleção, ferramenta, viewport, variantes em comparação), `biblioteca` (lista global de imagens, vinda da API).
- **Histórico por variante** (ADR-12): uma pilha de desfazer/refazer por variante, mantida em memória enquanto o projeto está aberto; não persistida; limite 100 passos por variante.
- Um passo por intenção do usuário: arrastar grava só no `dragend`; campos numéricos com debounce.
- Mutações só por ações nomeadas (casos de uso) que delegam às regras do domínio.

### ADR-04 — Perspectiva: homografia própria + retificação em Web Worker · **Decidido**

| Opção | Prós | Contras |
|---|---|---|
| **Homografia própria (DLT) + warp CPU em Worker** | ~100 linhas testáveis, zero deps | Medido no M1: warp de 0,9 s em 28 MP (ver ADR-16) |
| Warp em WebGL | Rápido | Mais código |
| OpenCV.js | Pronto | WASM de vários MB |
| sharp no servidor | Já presente (ADR-05) | Só faz transformações afins — **não** faz perspectiva |

Prévia sob demanda (RF-06): mesmo warp do Worker sobre a parede reduzida, saída ~320 px de largura; não é persistida nem enviada à API.

Pipeline: 4 alças com lupa sobre a parede → validação (convexo, ordem, área) → `H` → resolução limitada pelo perfil da parede → recorte na margem **+100%** do retângulo de referência → warp bilinear no Worker → bitmap retificado enviado à API e salvo em `PASTA_FOTOS` (evita reprocessar). Plano B (WebGL) descartado: o warp não é o gargalo (ADR-16).

Margem e parede inteira (M1-03, 24/10): retifica-se a **foto inteira** projetada por `H`, cortada em até +100% de L e +100% de A **em cada lado** do retângulo de referência (no máximo 3L × 3A); fora da foto o bitmap é transparente. **Parede inteira** = retângulo envolvente da região com pixels da foto, em cm (base da área útil padrão, RN-33). O servidor recalcula `H` e a geometria com as funções do domínio (fonte da verdade) e confere as dimensões do bitmap recebido. Detalhes: `docs/specs/M1-parede-e-escala.md` §4.2.

### ADR-05 — Processamento de imagens no upload: servidor com sharp · **Decidido**

Regras (PRD RF-25, RN-21):
- O **upload define o peso final**: o perfil é escolhido no momento do upload e o arquivo processado é definitivo. O original não é guardado; para outro peso, novo upload.
- Upload individual ou em lote (arquivos, pasta ou drag-and-drop): 1 requisição por arquivo, 3 em paralelo, cancelamento por `AbortController` (servidor descarta processamento interrompido); formatos inválidos descartados no browser; HEIC não suportado (RF-15 futuro).
- Arquivos processados ficam em `PASTA_FOTOS` (`.env`).

Perfis (padrão **Leve**):

| Perfil | Fotos — lado maior | Parede — lado maior | WebP qualidade | Peso estimado* |
|---|---|---|---|---|
| **Leve** | 1024 px | 3072 px | 0,80 | ~100–250 kB |
| Médio | 2048 px | 4096 px | 0,85 | ~300–700 kB |
| Alto | 3072 px | 6144 px | 0,90 | ~0,8–2 MB |

\* Estimativa; validar no M1.

Onde processar:

| Opção | Prós | Contras |
|---|---|---|
| **Servidor com `sharp`** (libvips) | Rápido, alta qualidade de redimensionamento, `rotate()` aplica EXIF, WebP nativo, tira o trabalho do browser | Dependência nativa (binários pré-compilados para Windows) |
| Browser (Worker + `OffscreenCanvas`) | Envia menos bytes ao servidor | Encoder WebP do browser; código de redimensionamento próprio; servidor vira só depósito |

Decidido: **sharp no servidor**. Upload envia o original via localhost (custo irrelevante), servidor gera `render` (perfil) + `thumb` (256 px), grava e responde com metadados.

Detecção de duplicatas: **não** será feita (decidido 17/10).

### ADR-06 — Entrada de arquivos · **Decidido**

`<input type="file" multiple>`, `<input webkitdirectory>` e drag-and-drop, enviando via `multipart/form-data` com progresso por arquivo. A File System Access API **deixa de ser necessária** (as fotos passam a viver em `PASTA_FOTOS`, servidas pela API).

### ADR-07 — Persistência: MongoDB local · **Decidido** (modelo de dados: `docs/specs/M0-setup.md` §4)

- Dados estruturados (projetos, paredes, variantes, fotos posicionadas, metadados de imagens) → MongoDB local.
- Binários (imagens) → arquivos em `PASTA_FOTOS`; no Mongo só metadados e caminho relativo.
- Biblioteca de imagens **global**: toda imagem carregada fica disponível em todos os projetos (RN-22).
- Salvamento: *soft save* periódico em `rascunhos` + *hard save* manual na variante, com detecção de conflito por revisão — ver `docs/specs/M0-setup.md` §4.9.
- Ids: `ObjectId` (string hex no domínio); web usa a lib oficial `bson` para gerar ids no cliente.

Pendências desta ADR:

| Tema | Opções | Recomendação |
|---|---|---|
| Acesso ao Mongo | **Decidido: driver oficial `mongodb` + schemas Zod compartilhados** | Schema único em `packages/domain` valida API e cliente |
| Validação no banco | **Decidido: validador `$jsonSchema` gerado a partir do Zod** | Segunda camada contra gravações por fora da API (ex.: Compass) |
| Execução do Mongo | **Decidido: MongoDB já instalado no Windows** (serviço local) | Testes de API usam `mongodb-memory-server` ou database separado |
| Granularidade do autosave | Documento inteiro da variante · operações (patch) | Definir junto do modelo de dados |
| Modelo | Coleções, embutir vs. referenciar, índices | Etapa própria |

Layout proposto de `PASTA_FOTOS`:

```
<PASTA_FOTOS>/
  imagens/<id>.webp          # versão do perfil
  imagens/<id>.thumb.webp
  paredes/<id>.webp          # parede processada
  paredes/<id>.retificada.webp
  paredes/<id>.thumb.webp      # miniatura do card de projeto (400 px)
```

Nomes por id (o nome original fica no Mongo). Gravação atômica (arquivo temporário + rename). Coleta de lixo de arquivos sem referência: regra a definir com o modelo (ex.: excluir imagem usada em projetos).

### ADR-08 — Exportação: compositor 2D próprio no cliente · **Decidido**

- Domínio gera **lista de comandos de desenho** a partir da variante; a mesma lista alimenta Konva e exportador.
- Exportador desenha em `OffscreenCanvas` na resolução da parede retificada, uma imagem por vez; com/sem grid; sem overlay (RN-19). Download PNG/JPG.
- Imagens servidas na **mesma origem** (`/api`) para não "contaminar" o canvas por CORS e bloquear a exportação.

### ADR-09 — UI: shadcn/ui + Tailwind 4 · **Decidido**

Componentes copiados para o projeto (Radix). Cor da borda: cores prontas em `Popover` + "Outra cor…" com `<input type="color">` nativo (DESIGN §6).

### ADR-10 — Qualidade · **Decidido**

| Item | Escolha |
|---|---|
| Unitários | Vitest — `packages/domain` cobertura ≥ 90% |
| Componentes | Testing Library (painéis/formulários; Konva fora do jsdom) |
| API | Vitest + Fastify `inject` + Mongo em memória ou container de teste (`mongodb-memory-server` — Proposta) |
| E2E | Playwright (Chromium) com fixture sintética de parede em perspectiva |
| Lint/format | ESLint (flat) + typescript-eslint + react-hooks + Prettier |
| Gerenciador | npm workspaces |

### ADR-11 — Execução local e configuração · **Decidido** (detalhes: Proposta)

- Um comando para subir tudo: `npm run dev` (web + api em paralelo).
- Dev: Vite faz proxy de `/api` para a API (mesma origem). Uso diário: API serve também o build da web (`npm run build && npm start`) — uma porta só.
- `.env` (não versionado) + `.env.example` (versionado):

| Variável | Exemplo | Uso |
|---|---|---|
| `PASTA_FOTOS` | `C:\Users\nbitt\Pictures\ParedeFotos` | Raiz dos arquivos processados |
| `MONGODB_URI` | `mongodb://localhost:27017/parede-fotos` | Conexão |
| `API_PORT` | `3001` | Porta da API |
| `WEB_PORT` | `5173` | Porta do Vite (dev) |
| `AUTOSAVE_MINUTOS` | `5` | Intervalo do *soft save* |
| `UPLOAD_MAX_MB` | `50` | Tamanho máximo por arquivo no upload |

- Validação do `.env` na inicialização (Zod): pasta existe e é gravável, Mongo acessível — senão, erro claro e o servidor não sobe.
- API escuta só em `127.0.0.1`.

### ADR-12 — Variantes e comparação · **Decidido**

- Projeto tem uma Parede (foto, perspectiva, escala) e N Variantes (fotos posicionadas, grid, borda padrão). Mínimo 1 variante.
- Ações: criar (vazia ou duplicando), renomear, excluir, alternar.
- **Comparação lado a lado**: 2 viewports com **zoom e pan sincronizados**, podendo enquadrar um recorte da parede. **Modo comparação é somente visualização**: nenhuma edição em nenhuma das duas variantes; sair da comparação volta à edição da variante ativa.
- **Desfazer por variante** (ADR-03).

### ADR-13 — Servidor local: Node + Fastify · **Decidido**

| Opção | Prós | Contras |
|---|---|---|
| **Fastify** | TS de primeira, validação por schema, `@fastify/multipart` (stream de upload), `@fastify/static`, `inject` para testes | Plugins próprios do ecossistema |
| Express | Mais conhecido | Tipagem e validação por fora; multipart via `multer` |
| Hono | Leve, moderno | Ecossistema de upload/estático para Node menos maduro |

Rotas iniciais (detalhar com o modelo de dados):

| Recurso | Operações |
|---|---|
| `/api/imagens` | upload (lote, com perfil), listar, obter metadados, excluir |
| `/api/imagens/:id/arquivo` | render / thumb |
| `/api/projetos` | listar, criar, obter, renomear, excluir |
| `/api/projetos/:id/parede` | upload da parede, salvar calibração/perspectiva, upload do bitmap retificado |
| `/api/projetos/:id/variantes` | criar, duplicar, renomear, excluir, salvar (autosave) |

### ADR-14 — Fontes empacotadas com `@fontsource` · **Decidido**

| Opção | Prós | Contras |
|---|---|---|
| **`@fontsource`** (`@fontsource-variable/newsreader`, `@fontsource/instrument-sans`, `@fontsource/ibm-plex-mono`) | Versionado no `package.json`, import simples, arquivos incluídos no build | 3 dependências |
| `.woff2` copiados + `@font-face` | Zero dependências | Atualização manual |
| Fontes do sistema | Nada novo | Foge da identidade (DESIGN §3) |

Consequências: importar só os pesos usados (Newsreader 500 variável com `opsz`; Instrument Sans 400/500/600; IBM Plex Mono 400/500) e só o subconjunto `latin`; nenhuma requisição externa (RNF-01, verificado em E2E).

### ADR-15 — Ícones com `lucide-react` · **Decidido**

| Opção | Prós | Contras |
|---|---|---|
| **`lucide-react`** | Padrão do shadcn/ui; traço configurável; *tree-shaking* | 1 dependência |
| SVGs próprios | Zero dependências | Desenho e manutenção manuais; adaptar shadcn |
| Phosphor / Tabler | Estilo semelhante | Fora do padrão do shadcn |

Consequências: `strokeWidth` 1,6–1,8 e tamanho 16–18 px por padrão (DESIGN §6); ícone sem texto exige `aria-label`; ícones ausentes na biblioteca (ex.: imagem-cortada do placeholder) podem ser SVG próprio no mesmo estilo.

### ADR-16 — Desempenho da retificação: o gargalo é a codificação WebP · **Proposta** (24/10, medição do M1; aguarda a decisão do Nicholas)

Medição no Chromium (Worker com warp + codificação WebP; `performance.measure('deco:retificacao')`; máquina de desenvolvimento do Nicholas; E2E `tests/e2e/desempenho.spec.ts`):

| Perfil / foto | Warp | Codificação WebP | Total |
|---|---|---|---|
| **Leve** (3072 px, 7 MP) | 0,19 s | 0,44 s | **0,7 s** ✓ |
| **Alto** (6144 × 4608, 28 MP), foto sintética com gradiente | 0,9 s | 2,0 s | **3,0–3,2 s** (meta: 3 s) |
| Alto, imagem com ruído forte (só encode, `convertToBlob`) | — | até 7 s (q 0,9) | > 7 s |

- O warp (a parte que a ADR-04 previa como risco) custa ~0,9 s em 28 MP: **o plano B (WebGL) não resolve nada** — o que domina é o encoder WebP (libwebp), igual no Chromium e no `sharp` (7 s em Node para a mesma imagem ruidosa). Mover a codificação para o servidor não ajuda.
- Leve e Médio (o uso normal; Leve é o padrão) cumprem os 3 s com folga. **Só o perfil Alto, com foto de 28 MP, fica no limite (≈ 3 s) ou acima dele (fotos com textura).**
- Otimizações aplicadas: laço do warp sem alocações e com saída em `Uint8Array` (de 0,97 para ~0,78 s em Node).
- **Decisão provisória (até o Nicholas decidir):** manter o pipeline da ADR-04 (Worker → WebP, servidor confere e grava) e a qualidade da ADR-05; o orçamento de 3 s (§8) vale para Leve e Médio. Para o Alto, o E2E guarda contra regressões com teto de 4,5 s na foto sintética e imprime o tempo; o app já mostra "Aplicando perspectiva…" com **Cancelar** (aborta o Worker).
- **Opções para reduzir o Alto, se o Nicholas quiser** (cada uma muda a ADR-05 ou a arquitetura): (a) limitar o lado maior da retificada a 4096 px em qualquer perfil (÷2,25 nos dois custos); (b) qualidade WebP 0,8 só na retificada (de 3 a 5× mais rápido em imagens com ruído, arquivos 2× menores); (c) dividir o warp em 2–4 Workers (−0,6 s; exige `SharedArrayBuffer`, logo cabeçalhos COOP/COEP na API); (d) JPEG quando a retificada não tem transparência (0,2 s, mas fora do `.webp` do modelo de dados).

## 6. Estrutura do repositório

> **Fonte única de caminhos de arquivos e pastas do projeto.** Outros documentos (DESIGN, specs) não definem caminhos; quando mencionarem um, vale o que está aqui. Em divergência, prevalece esta seção.

Raiz: `C:\Desenvolvimento\deco-wall`

```
deco-wall/
  CLAUDE.md                 # instruções de trabalho
  MEMORY.md                 # memória do projeto
  README.md                 # setup e comandos
  .env.example              # .env não versionado
  package.json              # npm workspaces
  vitest.config.ts          # projetos Vitest: domain, api e web (M0 §5.5)
  playwright.config.ts      # E2E (tests/e2e), sobe a API com a build da web
  scripts/dev.mjs           # npm run dev: API (tsx watch) e Vite em paralelo
  tsconfig.base.json
  tsconfig.json             # typecheck do monorepo (estende tsconfig.base.json)
  eslint.config.js  .prettierrc  .prettierignore  .editorconfig  .gitignore
  .claude/launch.json       # servidores do painel do Claude: dev (Vite + API) e start (build servido pela API)
  docs/
    PRD.md                  # requisitos e regras
    ARCHITECTURE.md         # este arquivo
    DESIGN.md               # decisões visuais e de interação
    design/                 # protótipos .dc.html + canvas.json
      referencias/
        templates-referencia.webp   # infográfico de origem dos templates
    specs/                  # especificação por marco (M0-setup.md, …)
      templates.md          # catálogo de templates (transcrição para revisão)
      templates/<id>.svg    # esboço de cada modelo
  apps/
    web/
      src/
        main.tsx
        styles/
          theme.css         # tokens (@theme) + variáveis do shadcn — DESIGN §2.1, §3–5
          fonts.ts          # imports @fontsource (ADR-14)
        app/                # store do editor (zustand + immer), contexto, navegação, aviso ao sair
          store.ts          # fatias `documento` e `ui`; ações nomeadas (ADR-03)
          StoreContext.tsx  avisoAoSair.ts  navegacao.ts
        infra/              # cliente HTTP e Worker
          dto.ts            # formatos da API, porta `ClienteApi` e `ErroApi`
          clienteApi.ts     # implementação com fetch (upload com progresso por XMLHttpRequest)
          retificacao.ts    # cliente do Worker (prévia e retificação completa)
          workers/
            retificar.worker.ts   # warp + codificação WebP fora da thread da UI (ADR-04)
        ui/
          canvas/
            theme.ts        # cores/medidas do canvas Konva — DESIGN §2.2
            Palco.tsx       # único módulo que usa o Konva: camadas, zoom/pan, alças, lupa
            cena.ts         # cenas em dados (sem Konva): parede, área útil, perspectiva, calibração
            useImagem.ts
          paineis/          # Composição, Perspectiva, Calibração, Área útil, BarraModo, CamposAreaUtil
          telas/            # Projetos, Editor, Comparação, /dev/ui
            editor/         # HeaderEditor, Biblioteca, ToolbarCanvas, EstadoVazio, cenas.ts
              modos/        # ModoPerspectiva, ModoCalibracao, ModoAreaUtil, LayoutModo
          componentes/
            ui/             # componentes shadcn/ui (gerados)
            proprios/       # StatusSalvamento, ChipEscala, Miniatura, CampoCm, NomeProjeto, DialogosProjeto…
        lib/                # utilitários de UI (cn, etc.)
  api/
    src/
      main.ts
      app.ts                # monta a API (rotas, multipart, erros); usado por main.ts e pelos testes
      contexto.ts  erros.ts
      config.ts             # leitura/validação do .env
      rotas/                # projetos, parede (upload, escala, arquivos), variantes (hard save), saude
      servicos/             # projetos, parede, variantes, imagem (sharp), reparo (A-18); purga no M4
      repositorios/         # MongoDB (conexão e conversão ObjectId ↔ string hex)
      migracoes/            # 0001-inicial…
      armazenamento/        # PASTA_FOTOS (inclui gravação em duas fases)
  packages/
    domain/
      src/                  # tipos, schemas Zod, RN, geometria, homografia, snap, desenho, formatadores
        arquivos.ts  projetos.ts   # validação de arquivo de imagem e de nome de projeto
        geometria/          # homografia, quadrilátero, viewport, grid
        escala/             # calibração linear, retificação, warp, parede inteira, área útil, padrões, referência
        templates/
          catalogo.ts       # catálogo de templates (constante; fonte: docs/specs/templates.md)
  tests/
    e2e/                    # Playwright: smoke, rede, projetos, parede e escala, salvamento, desempenho (ajudantes.ts)
    fixtures/
      imagens/
      paredes/
      dominio.ts            # exemplos válidos do modelo (builders para testes)
      api.ts                # app Fastify de teste + atalhos de requisição (multipart, escala, variante)
      paredes.ts            # cantos e medidas da parede em perspectiva (300 × 200 cm)
      banco-teste.ts        # banco parede-fotos-test; ObjectId ↔ string hex
    spikes/                 # spikes de risco (sharp: EXIF → WebP Leve)
    seed/                   # seed do banco de teste
```

Arquivos de dados fora do repositório: `PASTA_FOTOS` (definida no `.env`; estrutura em `docs/specs/M0-setup.md` §4.8).

## 7. Fluxos críticos

**Upload de fotos:** seleção (arquivos/pasta/drag) + perfil → `POST /api/imagens` multipart → sharp: rotação EXIF, redimensiona, WebP, thumb → grava em `PASTA_FOTOS` → registra no Mongo → biblioteca global atualizada.

**Adicionar foto à variante:** arrastar miniatura → `adicionarFoto` (RN-03/04, snap) → 1 passo no histórico da variante → autosave.

**Mover foto:** Konva move o nó; snap em `dragBoundFunc` → `dragend` → `moverFoto` (1 passo) → autosave.

**Perspectiva:** 4 alças → Worker retifica → upload do bitmap → `aplicarPerspectiva` (fotos preservam cm — RN-10).

**Comparar:** escolher 2 variantes → viewports lado a lado com viewport compartilhado.

## 8. Orçamentos de desempenho

| Métrica | Alvo |
|---|---|
| Arrastar com 40 fotos | 60 fps (mín. 50) |
| Retificação da parede (perfil Alto) | ≤ 3 s |
| Upload em lote de 50 fotos (perfil Leve) | progresso por arquivo; ≤ 1 s por foto |
| Salvamento (soft/hard) | resposta da API < 100 ms |
| Memória com 40 fotos (Leve) | < 300 MB no browser |

## 9. Riscos técnicos

| Risco | Mitigação |
|---|---|
| Warp em CPU lento | Medido no M1: 0,9 s em 28 MP; o gargalo é a codificação WebP (ADR-16) |
| `sharp` falhar ao instalar no Windows | Binários pré-compilados; validar no M0 |
| Mongo fora do ar | Checagem na inicialização; aviso na UI; autosave com nova tentativa |
| `PASTA_FOTOS` inválida ou sem permissão | Validação na inicialização |
| Canvas "contaminado" na exportação | Imagens na mesma origem |
| Arquivo sem registro / registro sem arquivo | Gravação atômica + rotina de verificação (definir com o modelo) |
| Versões React ↔ react-konva | Fixar no M0 |

## 10. Decisões pendentes

1. Desempenho do perfil Alto (28 MP): decisão do Nicholas sobre as opções da ADR-16.

## 11. Referências

- Konva — https://konvajs.org/docs/ · react-konva — https://github.com/konvajs/react-konva
- Zustand — https://zustand.docs.pmnd.rs/ · zundo — https://github.com/charkour/zundo
- sharp — https://sharp.pixelplumbing.com/
- Fastify — https://fastify.dev/docs/latest/
- MongoDB Node.js Driver — https://www.mongodb.com/docs/drivers/node/current/
- Zod — https://zod.dev/
- Vite — https://vite.dev/releases
