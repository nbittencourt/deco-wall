# MEMORY.md — Simulador de Parede de Fotos

> **Objetivo deste arquivo:** memória viva do projeto — contexto de origem, decisões, questões em aberto, status e histórico. Atualizado a cada sessão relevante.
> Instruções de como trabalhar ficam em `CLAUDE.md`. Requisitos detalhados ficam em `docs/PRD.md`.

## Contexto de origem (2026-10-17)

Pedido original do Nicholas:
- Decorar uma parede de casa com diversas fotos e, antes, fazer um preview da posição e das dimensões aproximadas.
- Construir um app para simular: envia uma foto da parede onde as fotos serão posicionadas; as fotos ficam em uma pasta.
- Formatos: 10x15 ou 20x30, paisagem ou retrato.
- Fluxo: incluir fotos, escolher o tamanho e posicionar.
- Grid na parede para ajudar no posicionamento é altamente desejável.
- Começar pelo PRD em `docs/`.

## Decisões

| Data | Decisão | Status |
|---|---|---|
| 2026-10-17 | PRD v0.1 criado em `docs/PRD.md`. | Feito |
| 2026-10-17 | Modelo de dados usa cm como unidade de verdade; px só na renderização. | Proposto |
| 2026-10-17 | ~~App 100% client-side~~ → substituído: 100% local com servidor Node + MongoDB local. | Revisto |
| 2026-10-17 | App web, rodando apenas localmente (Vite + React + TS + react-konva). | Decidido |
| 2026-10-17 | Calibração linear e correção de perspectiva por 4 pontos, ambas na v1 (P0). | Decidido |
| 2026-10-17 | Moldura e passe-partout ficam para depois (P2); borda das fotos em cm entra na v1 (RF-41). | Decidido |
| 2026-10-17 | Borda somada por fora da área impressa (tamanho externo = impresso + 2 × borda). | Decidido |
| 2026-10-17 | Sem geração de PDF no app; impressão, se necessária, pelo navegador. | Decidido |
| 2026-10-17 | Itens inferidos além do pedido não foram cortados: movidos para "Ideias futuras" no roadmap. | Decidido |
| 2026-10-17 | Fechar todas as regras de negócio do PRD antes de discutir arquitetura. | Decidido |
| 2026-10-17 | Regras RN-03 a RN-20, metas 2.1 e RNF-03 confirmadas (PRD v0.4). | Decidido |
| 2026-10-17 | Arquitetura registrada em `docs/ARCHITECTURE.md`. | Em andamento |
| 2026-10-17 | UI: shadcn/ui + Tailwind; lint: ESLint + Prettier; histórico em memória (100 passos); retificação com margem +100%. | Decidido |
| 2026-10-17 | Imagens reduzidas e convertidas para WebP no upload, perfil escolhido no upload e definitivo (padrão Leve); originais nunca alterados nem guardados (RF-25, RN-21). | Decidido |
| 2026-10-17 | Persistência em MongoDB local; modelo de dados (coleções/campos) em etapa própria. | Decidido |
| 2026-10-17 | Imagens processadas gravadas em pasta configurável via `.env` (`PASTA_FOTOS`). | Decidido |
| 2026-10-17 | Biblioteca de imagens global (sem autenticação): fotos carregadas valem para todos os projetos; upload individual ou em lote a partir de um projeto. | Decidido |
| 2026-10-17 | Variantes na v1; comparação lado a lado com zoom/pan sincronizados (recorte); desfazer por variante. | Decidido |
| 2026-10-17 | Perfis Leve/Médio/Alto (1024/2048/3072 px fotos; 3072/4096/6144 px parede). | Decidido |
| 2026-10-17 | Imagens processadas no servidor com sharp; sem detecção de duplicatas. | Decidido |
| 2026-10-17 | MongoDB via driver oficial + schemas Zod compartilhados; Mongo já instalado no Windows. | Decidido |
| 2026-10-17 | API em Fastify; monorepo npm workspaces (web, api, domain). | Decidido |
| 2026-10-17 | Comparação de variantes somente visualização. | Decidido |
| 2026-10-17 | Ids ObjectId; parede embutida no projeto; variantes em coleção própria com "Base" padrão; fotos embutidas na variante; visão de todas as fotos do projeto. | Decidido |
| 2026-10-17 | Salvamento: soft (automático a cada X min, rascunho) separado de hard (manual, prioritário); detectar versão desconexa e perguntar a prioridade em conflito. | Decidido |
| 2026-10-17 | Imagem: perguntar remover do projeto vs excluir; mostrar associações; soft delete 30 dias + purga; consulta a excluídas. | Decidido |
| 2026-10-17 | Precisão 1 mm; banco de teste separado com seed. | Decidido |
| 2026-10-17 | Validação em duas camadas: Zod na API + `$jsonSchema` no Mongo (gerado do Zod). | Decidido |
| 2026-10-17 | "Fotos do projeto" = carregadas no projeto ou usadas em qualquer variante. | Decidido |
| 2026-10-17 | Soft save a cada 5 min; conflito oferece também "salvar como nova variante"; parede grava ao confirmar a ação. | Decidido |
| 2026-10-17 | Placeholder na exportação: retângulo vermelho hachurado semitransparente. | Decidido |
| 2026-10-17 | Exclusão de imagem deixa placeholder nas variantes; restaurar não repõe; placeholder aceita outra foto e recomenda a anterior se restaurada; variantes com placeholder sinalizadas. | Decidido |
| 2026-10-17 | Ambiente: Node 24.15.0, MongoDB 8.2.6 Community (Windows); git só local, sem GitHub. | Decidido |
| 2026-10-17 | Projeto centralizado em `C:\Desenvolvimento\deco-wall` (código + docs); pasta antiga no OneDrive esvaziada. | Decidido |
| 2026-10-17 | Fontes empacotadas via `@fontsource` (ADR-14). | Decidido |
| 2026-10-17 | Ícones com `lucide-react` (ADR-15). | Decidido |
| 2026-10-17 | Caminhos de arquivos definidos só na ARCHITECTURE §6; DESIGN só design; em divergência vale a ARCHITECTURE. | Decidido |
| 2026-10-17 | DV-01: comparação só com zoom/pan sincronizados + atalho "Parede inteira"; sem modo independente. | Decidido |
| 2026-10-17 | Regra: função não implementada mantém o botão visível e inativo (tooltip "Disponível em uma próxima versão"). DV-02: botão "Parede" inativo; RF-04 segue em Ideias futuras. | Decidido |
| 2026-10-17 | DV-03: buscas de projeto e biblioteca fora da v1 (campos inativos; RF-31/32 em Ideias futuras). | Decidido |
| 2026-10-17 | DV-04: contador de uso nas miniaturas segue P1 (marco M5). | Decidido |
| 2026-10-17 | DV-05: "Linha forte a cada" (RF-52) segue P1 (marco M5); controle inativo até lá. | Decidido |
| 2026-10-17 | DV-06: prévia frontal da perspectiva sob demanda (RF-06, P0), sem atualização ao vivo. | Decidido |
| 2026-10-17 | DV-07: card de projeto com miniatura só da foto da parede; menu ⋯ com Renomear e Excluir. | Decidido |
| 2026-10-17 | DV-08: cor da borda = 6 cores prontas + "Outra cor…" (seletor nativo). | Decidido |
| 2026-10-17 | DV-09: ajuste de recorte em modo próprio (botão/duplo clique; Enter conclui, Esc cancela). | Decidido |
| 2026-10-17 | DV-10: upload 1 req/arquivo, 3 em paralelo, cancelar restantes, limite 50 MB (`UPLOAD_MAX_MB`). Sem HEIC — usuário converte antes. | Decidido |
| 2026-10-17 | Novo escopo: templates de layout (referência: infográfico "Inspirations for gallery wall frame layouts", 12 modelos) para propor ao usuário e criar placeholders na parede. | Em definição |
| 2026-10-17 | TPL-01: templates combinam (a) mapear cada espaço para 10x15/20x30 mantendo arranjo e (b) manter o tamanho externo do modelo via borda. | Decidido |
| 2026-10-17 | TPL-02: borda continua única (RN-02 inalterado); diferença de proporção entre formato e espaço do template é absorvida pelo espaçamento entre fotos. | Decidido |
| 2026-10-17 | TPL-03: ao aplicar template, uma borda única para todas as fotos (padrão = borda padrão da variante); maior tamanho que caiba na célula; célula cresce com aviso se nada couber. | Decidido |
| 2026-10-17 | TPL-04: template sempre aplicado em variante nova, nomeada com o nome do modelo. | Decidido |
| 2026-10-17 | TPL-05: vagas do template usam o mesmo placeholder vermelho hachurado e contam como "sem foto" (um único estado). | Decidido |
| 2026-10-17 | TPL-06: template entra centralizado automaticamente (na área útil) como prévia; usuário pode arrastar o conjunto e confirma (clique/Enter; Esc cancela). | Decidido |
| 2026-10-17 | Novo: área útil da parede, informada ao importar a parede, para posicionar fotos e templates. | Em definição |
| 2026-10-17 | AU-01: após aplicar a perspectiva (ou calibração), área útil = parede inteira por padrão; app pede confirmação e permite redimensionar o retângulo. | Decidido |
| 2026-10-17 | AU-02: área útil **por variante**; contorno tracejado + exterior esmaecido (fora da exportação); templates centralizados nela com aviso se maiores; foto fora = alerta como RN-12 (não bloqueia); grid na parede inteira; botão "Área útil" no header para editar (alteração da variante: entra no desfazer e no salvamento da variante). | Decidido |
| 2026-10-17 | AU-03: variante nova copia a área útil da ativa; Base nasce com a parede inteira. PRD v0.10 (RF-93/94, RN-29 a RN-35); modelo: `variantes.areaUtil`, `templateOrigem`. | Decidido |
| 2026-10-17 | TPL-07: catálogo com 12 modelos (nomes em PT), constante em `packages/domain/src/templates/catalogo.ts`; transcrição para revisão em `docs/specs/templates.md` (+ esboços SVG); referência em `docs/design/referencias/`. | Decidido |
| 2026-10-17 | TPL-08: geometria dos templates fiel ao desenho (vãos ~2–5 cm; totais calculados, não os declarados). | Decidido |
| 2026-10-17 | DV-11: nome do arquivo exportado `<projeto>-<variante>-AAAAMMDD-HHmm.<ext>`. | Decidido |
| 2026-10-17 | DS-01: novos protótipos (templates, área útil, tamanhos, recorte, prévia, header) serão gerados pelo Nicholas no Claude Design a partir de prompt; depois revisão de consistência. | Decidido |
| 2026-10-17 | DESIGN v0.2 + protótipos 03a, 03b, 04a, 13–17 recebidos; regra: documentação prevalece sobre protótipos. | Registrado |
| 2026-10-17 | IC-01: inconsistências do DESIGN v0.2 corrigidas (origem da área útil, sem "reduzir" template, decimais no tamanho personalizado, tamanho em todo placeholder, pills "Fora da parede"/"Fora da área útil"). | Decidido |
| 2026-10-17 | MS-01: marcos M0 Setup · M1 Parede e escala · M2 Biblioteca e composição · M3 Variantes, templates e salvamento · M4 Ciclo de vida e exportação · M5 v1 desejável (P1). Spec de cada marco só após aceite do anterior. | Decidido |
| 2026-10-17 | Formatos ampliados: tamanhos sugeridos 10x15, 13x18, 15x21, 20x25, 20x30, 13x13, 15x15 e grandes (30x40 até 120x75); tamanho personalizado em cm no modo de recorte. Borda segue única. Substitui RN-01 (só 10x15/20x30); docs atualizados. | Decidido |
| 2026-10-17 | FMT-01: lista aprovada — padrão 10x15, 13x18, 15x21, 20x25, 20x30; quadrados 13x13, 15x15; grandes 30x40, 30x45, 40x50, 40x60, 50x60, 50x70, 60x80, 60x90, 70x100, 75x120; rótulos só em cm (sem A4/A5); retrato ou paisagem. | Decidido |
| 2026-10-17 | FMT-02: tamanho personalizado no modo de recorte, 5–150 cm, passo 0,1; recentraliza recorte; orientação troca L/A; quadrado sem orientação; canto sup.-esq. fixo. PRD v0.9, RN-01/RN-28, modelo `tamanho {sugeridoId, larguraCm, alturaCm}`. | Decidido |
| 2026-10-17 | DS-02: em divergência, a documentação (PRD, DESIGN, specs, ARCHITECTURE) prevalece sobre os protótipos de `docs/design/`; protótipos são referência visual. | Decidido |
| 2026-10-17 | M0 liberado. Testes escritos antes da implementação (TDD): unitários do domínio e de integração da API, Mongo, seed e fixtures. Todos vermelhos por módulo ausente. Sem commit (não pedido). | Feito |
| 2026-10-17 | Contratos de módulos definidos pelos testes: `packages/domain/src/{constantes,arredondar,formatadores,schemas,jsonschema}.ts`; `apps/api/src/{config,armazenamento/pasta,repositorios/mongo,migracoes/executar,rotas/saude}.ts`; seed em `tests/seed/semear.ts`. | Decidido |
| 2026-10-17 | Padrões quando ausentes no `.env`: AUTOSAVE 5 min, UPLOAD_MAX_MB 50, API_PORT 3001, WEB_PORT 5173; MONGODB_URI padrão `mongodb://127.0.0.1:27017/parede-fotos`. | Decidido |
| 2026-10-17 | `formatarHora` e `formatarData` usam o fuso de Brasília (`America/Sao_Paulo`). | Decidido |
| 2026-10-17 | Paridade Zod ↔ `$jsonSchema` cobre regras de campo (tipo, faixa, enum, formato, `strict`). Regras cruzadas entre campos (ex.: dimensões batendo com `sugeridoId`, método da escala exigindo seus dados) são só do Zod. | Decidido |
| 2026-10-17 | Versões fixadas (T1 parcial): zod 4.6.7, fastify 5.12.7, mongodb 7.7.0, sharp 0.35.5, vitest 5.0.5, typescript 7.0.2, @types/node 24.19.2. | Decidido |
| 2026-10-17 | Testes de banco: database `parede-fotos-test` na instância de `MONGODB_URI`; projeto `api` do Vitest roda em série (`fileParallelism: false`). | Decidido |
| 2026-10-18 | T1 ferramentas: TypeScript 6.0.3 (não 7.0.2, que o `typescript-eslint` 8.71 não aceita: peer `<6.1.0`); `moduleResolution: Bundler` (imports sem extensão); ESLint 10 flat + typescript-eslint + react-hooks; Prettier 3.9 (`printWidth` 110, aspas simples); `git init` local, sem commits. | Decidido |
| 2026-10-18 | T6–T9: web com React 19.3.1, react-konva 19.3.2 (ADR-01), Konva 10.9.0, Vite 8.3.4 (JSX automático, sem `@vitejs/plugin-react`), Tailwind 4.3.3, `radix-ui` 1.8.1 com componentes shadcn copiados à mão (ADR-09), lucide-react 1.59, @fontsource 5.3.0 (só latin), @fastify/static 10.1.6, Playwright 1.64.1, Testing Library 16.3.3 / 10.4.2 e jsdom 30.1.3. Roteamento mínimo por caminho, sem biblioteca de rotas. | Decidido |
| 2026-10-18 | `npm run dev` por `scripts/dev.mjs` (dois processos, sem `concurrently`). `npm run start` serve `apps/web/dist` pela API. E2E sobe a API com a build em `127.0.0.1:3101` e usa o banco de teste. | Decidido |
| 2026-10-18 | Controle inativo: `aria-disabled`, foco e tooltip; clique sempre bloqueado, mesmo com `onClick` passado por fora (bug corrigido: a ordem das props escondia o bloqueio). Campos inativos usam `CampoEmBreve` / `CampoCm inativo`. | Decidido |
| 2026-10-18 | Typecheck em dois passos: API e domínio pela raiz (sem DOM), web por `apps/web/tsconfig.json` (com DOM). | Decidido |
| 2026-10-18 | `seed:test` via `tsx` (devDependency raiz, 4.23.15, aprovada pelo Nicholas); o runner cria fotos de teste em pasta temporária. | Decidido |
| 2026-10-18 | T4a: fixtures de imagem e parede são sintéticos, gerados com sharp (cenas com gradiente, EXIF orientation 6 no JPEG rotacionado, `.heic` placeholder não decodificável). Parede em perspectiva tem medida conhecida em `perspectiva.medidas.json` (300 × 200 cm). Seed usa os builders de `tests/fixtures/dominio.ts`; trocar por fotos reais é decisão do Nicholas. | Decidido |
| 2026-10-18 | T4: o `$jsonSchema` do Mongo segue draft 4. Limite exclusivo sai como `minimum` + `exclusiveMinimum: true` (não como número). Migração `0001-inicial` roda uma vez (registro em `migracoes`); coleções e índices são idempotentes. | Decidido |
| 2026-10-18 | T2 (domínio): schemas Zod 4 com `.strict()`; id = `IdSchema` com metadado `bson: 'objectId'`; conversor `gerarJsonSchema` lê a definição interna do Zod (`_zod.def`) e ignora superRefine. Sugerido aceita as duas orientações. Precisão de 0,1 cm (DM-08) é aplicada via `arredondarCm`; o schema ainda não rejeita valores fora do passo. | Decidido |

| 2026-10-24 | Spec M1 v0.1 (rascunho) em `docs/specs/M1-parede-e-escala.md`, escrita antes do aceite do M0 a pedido do Nicholas; implementação só após o aceite (MS-01). | Feito |
| 2026-10-24 | M1-01: *hard save* (Salvar/Ctrl+S, status, `beforeunload`, 409 com aviso simples) antecipado para o M1 para persistir grid e área útil; rascunho, recuperação e diálogo de conflito seguem no M3. | Decidido |
| 2026-10-24 | M1-02: "Calibrar" inativo com a perspectiva aplicada; de linear para perspectiva, a perspectiva substitui (RN-08 no PRD v0.11). | Decidido |
| 2026-10-24 | M1-03: retificar a foto inteira, cortada em +100% de L e de A em cada lado (máx. 3L × 3A), transparente fora da foto; parede inteira = caixa da região com pixels (ADR-04). | Decidido |
| 2026-10-24 | M1-04: parede (upload, troca, perspectiva, calibração) fora do desfazer; área útil entra (RN-18 ajustada). | Decidido |
| 2026-10-24 | M1-05: trocar a parede enquanto nenhuma variante tem fotos (novo RF-07); com fotos, "Parede" inativo (RF-04 segue futuro). Ajusta DV-02. | Decidido |
| 2026-10-24 | M1-06: upload da parede abre direto o modo Perspectiva. M1-07: área útil livre a 0,1 cm, sem snap. M1-08: a primeira escala grava área útil = parede inteira; Cancelar a mantém. | Decidido |
| 2026-10-24 | Premissas A-01 a A-20 da spec M1 revisadas (spec v0.2, pronta). Alteradas: A-02 projeto criado direto como "Projeto sem nome", nome editável inline no header; A-10 alças da perspectiva já prontas (25% das bordas); A-12 segmento linear pronto; A-15 Snap e "Encaixar no grid" funcionais já no M1 (sem efeito até o M2); A-17 miniatura sempre da foto original (revê DV-07); A-19 arquivos da parede com `no-cache` + `ETag`. Confirmadas: compensação sem transações (Mongo standalone), roda = zoom, área útil limitada à parede inteira, grid por variante com opacidade padrão 8%. | Decidido |
| 2026-10-24 | Validação visual do M0, 1ª rodada (ajustes do Nicholas): `html` volta a 16 px (o `font-size: 14px` no `html` encolhia todo rem em 12,5%: header 49 px, botões 31,5 px, círculo do Switch encostando na borda); segmented com indicador deslizante; dica de rolagem no seletor de tamanho; ícone duplicado no alerta do card de template removido; primário inativo `sand` + `ink-3` (novo par no teste de contraste); títulos de seção do painel em Newsreader 18 px com divisória; "Excluídas" desmarca os outros filtros; `ComDica` (tooltip num `span` em volta do controle, para não disputar o `data-state` de Toggle/DropdownMenu) em todo botão só de ícone. DESIGN §6/§7 atualizada. | Feito |
| 2026-10-24 | `.env` criado a partir do `.env.example` e pasta `C:\Users\nbitt\Pictures\ParedeFotos` criada para a validação. `.claude/launch.json` com `dev` e `start`; no painel do app, só o `start` (build servido pela API, porta 3001) subiu: o Vite do `dev` não abriu a porta lá dentro (sozinho, sobe normal). | Registrado |
| 2026-10-24 | **M0 aceito pelo Nicholas** (validação visual T6d/T10). Divergências do header resolvidas: em 1280 só Área útil, Perspectiva, Calibrar e Parede vão para o menu "Parede ▾" (Comparar e Templates ficam); gap de 4 px e padding de 9 px nos botões fantasma (DESIGN §7); E2E de hover/foco nas dicas dos botões só de ícone. | Feito |
| 2026-10-24 | Status de salvamento sai do header e fica só na barra de status, com o texto completo: "Alterações não salvas" e "Rascunho salvo às hh:mm" estouravam o header em 1280 e 1440. Diverge do protótipo 03a; DESIGN §7 e spec M1 §3.2 atualizadas. A marca "Parede" ao lado do voltar foi mantida. | Decidido |
| 2026-10-24 | Repositório com remoto GitHub (`origin` = `github.com/nbittencourt/deco-wall`), configurado pelo Nicholas; substitui "git só local, sem GitHub" (17/10). Primeiro commit "M0 implementado" feito por ele; commits seguintes na `main`, sem push até pedido. | Decidido |

## Questões em aberto

- Status HTTP de `/api/saude` quando algum componente está em erro: o teste verifica só o corpo. Definir na T5.

## Status

- Fase atual: **M0 aceito (24/10).** Próximo: M1 (spec v0.2 pronta). Verde: Vitest 207 testes, Playwright 10/10, typecheck, lint e `format:check`.
- Spikes (§5.6): **sharp** ✓ (`tests/spikes/sharp.test.ts`: JPEG com EXIF rotacionado vira WebP Leve com a orientação aplicada). **react-konva** ✓ (`tests/e2e/spike-konva.spec.ts`: Stage com retângulo arrastável; página `/dev/spike-konva`, removível após o M1).
- Cobertura do domínio (`@vitest/coverage-v8` 5.0.5): instruções 91,7%, linhas 94,0%, funções 100%, ramos 84,3%.
- `npm run seed:test` funciona (tsx 4.23.15, aprovada pelo Nicholas em 18/10). T1 fechada: ESLint, Prettier, `tsconfig`, typecheck, README e `git init` local.
- M1: spec v0.2 pronta (`docs/specs/M1-parede-e-escala.md`); começa com a liberação do Nicholas.
- Pendências: commits por tarefa (spec §8, não feitos porque o pedido não veio); chunk JS de 840 kB no build (sem code-splitting no M0).

## Histórico

- 2026-10-17 — Projeto iniciado; criados `docs/PRD.md`, `CLAUDE.md`, `MEMORY.md`.
- 2026-10-17 — PRD v0.2: web local confirmado, perspectiva na v1, borda em cm na v1, moldura adiada.
- 2026-10-17 — PRD v0.3: borda externa, sem PDF, ideias futuras no roadmap, seção de regras de negócio criada.
- 2026-10-17 — PRD v0.4 (regras fechadas) e ARCHITECTURE.md v0.1 criado.
- 2026-10-17 — ARCHITECTURE v0.2: perfis de qualidade na importação, ADRs fechadas exceto persistência e variantes.
- 2026-10-17 — Virada para servidor local + MongoDB; biblioteca global; variantes com comparação na v1 (PRD v0.6, ARCHITECTURE v0.3).
- 2026-10-17 — ARCHITECTURE v0.4: sharp, driver+Zod, Mongo local Windows, Fastify, comparação só visualização.
- 2026-10-17 — Especificação M0 v0.1 criada (setup + modelo de dados MongoDB).
- 2026-10-17 — Spec M0 v0.2: ObjectId, salvamento soft/hard com conflito, ciclo de vida das imagens, seed de teste; PRD v0.7.
- 2026-10-17 — Spec M0 v0.3: modelo de dados fechado (validação dupla, placeholders, autosave 5 min); PRD v0.8.
- 2026-10-17 — Spec M0 v0.4 fechada (placeholder vermelho hachurado na exportação).
- 2026-10-17 — DESIGN.md v0.1 + 13 protótipos recebidos; spec M0 v0.5 com fundação de design, pré-requisitos e divergências design × PRD.
- 2026-10-17 — Documentação movida para `C:\Desenvolvimento\deco-wall`.
- 2026-10-17 — Marcos M0–M5 aprovados; spec M0 v0.6 revisada e pronta.
- 2026-10-17 — M0 liberado: bootstrap do monorepo e testes escritos (domínio, API, Mongo, seed, fixtures); 13 arquivos de teste rodando em vermelho, por módulos ainda não implementados.
- 2026-10-24 — Spec M1 v0.1 (rascunho) com 8 decisões (M1-01 a M1-08) e 20 premissas; PRD v0.11, ARCHITECTURE v0.6, DESIGN v0.3.
