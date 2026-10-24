# Especificação M0 — Setup e Modelo de Dados

| Campo | Valor |
|---|---|
| Versão | 0.6 |
| Data | 2026-10-17 |
| Base | `docs/PRD.md` v0.10 · `docs/ARCHITECTURE.md` v0.5 · `docs/DESIGN.md` v0.2 + protótipos `docs/design/` · `docs/specs/templates.md` v0.2 |
| Status | **Pronta para implementação** — pré-requisitos resolvidos; aguardando liberação do Nicholas |

## 0. Pré-requisitos para iniciar a implementação

Itens que precisavam estar resolvidos antes da T1 — todos ✅. Nenhum código é escrito sem liberação explícita do Nicholas.

| # | Item | Bloqueia | Situação |
|---|---|---|---|
| PR-01 | **Local do código:** `C:\Desenvolvimento\deco-wall` (fora do OneDrive). Documentação e definições centralizadas na mesma pasta. | T1 | ✅ decidido 17/10 |
| PR-02 | **Fontes locais:** `@fontsource` (ADR-14). | T6b | ✅ decidido 17/10 |
| PR-03 | **Ícones:** `lucide-react` (ADR-15). | T6b | ✅ decidido 17/10 |
| PR-04 | **Caminhos de arquivos** centralizados em `docs/ARCHITECTURE.md` §6; DESIGN só com decisões de design; em divergência, vale a ARCHITECTURE. | T6b | ✅ decidido 17/10 |
| PR-05 | **Divergências design × PRD** (§0.1). | M1 | ✅ resolvidas (DV-01 a DV-11) e protótipos/DESIGN v0.2 atualizados (17/10) |

### 0.1 Divergências entre protótipos e PRD

| # | Protótipo | O que o design mostra | Situação no PRD/ARCH | Decisão necessária |
|---|---|---|---|---|
| DV-01 | 06 Comparação | Alternância "Zoom sincronizado / Independente" e botão "Parede inteira" | RF-92 | ✅ Só sincronizado; "Parede inteira" mantido como atalho; alternância fora (17/10) |
| DV-02 | 03 Editor | Botão "Parede" no header | RF-04 em Ideias futuras | ✅ Botão mantido **inativo** com tooltip; regra geral para funções não implementadas (DESIGN §7.1) (17/10) |
| DV-03 | 01 Projetos · 03 Editor | Busca de projetos e busca por nome na biblioteca | — | ✅ Fora da v1; campos visíveis e inativos; RF-33b/RF-33c em Ideias futuras (17/10) |
| DV-04 | 03 Editor | Contador de uso ("1×") nas miniaturas | RF-23 (P1) | ✅ Mantido P1 (marco M5); não aparece até lá (17/10) |
| DV-05 | 11 Painel | "Linha forte a cada" e cor do grid | RF-52 (P1); cor já é P0 (RF-51) | ✅ RF-52 mantido P1 (marco M5); controle visível e inativo até lá (17/10) |
| DV-06 | 04 Perspectiva | "Prévia frontal" ao vivo | — | ✅ Prévia **sob demanda** (botão "Gerar prévia", ~320 px, estado desatualizada); novo RF-06 P0 (17/10) |
| DV-07 | 01 Projetos | Card com miniatura e menu "Mais ações" | RF-90 | ✅ Miniatura = só a foto da parede (thumb 400 px gerada no upload e regenerada ao aplicar perspectiva, usando a retificada); menu: Renomear e Excluir (17/10) |
| DV-08 | 03 Editor · 11 Painel | Cor da borda como botão "Branco" | ADR-09 | ✅ Cores prontas (6) + "Outra cor…" com seletor nativo (DESIGN §6) (17/10) |
| DV-09 | 03 Editor | Botão "Ajustar recorte" | RN-14 | ✅ Modo de recorte (botão ou duplo clique; Enter/Esc; 1 passo de desfazer) — DESIGN §7.0 (17/10) |
| DV-10 | 07 Upload | Progresso, "Cancelar restantes", ignorados por formato | ADR-05 | ✅ 1 requisição por arquivo, 3 em paralelo; inválidos descartados no browser; falha não interrompe o lote (com "tentar de novo"); cancelar aborta envios e fila (concluídos ficam); perfil único por lote, travado após iniciar; limite `UPLOAD_MAX_MB` = 50. Sem HEIC (RF-15 futuro) (17/10) |
| DV-11 | 10 Exportar | Resolução exibida e "Baixar PNG" | RF-80 | ✅ `<projeto>-<variante>-AAAAMMDD-HHmm.png` (slug sem acentos, hora de Brasília) (17/10) |

## 1. Objetivo

Deixar o projeto pronto para receber funcionalidades: monorepo configurado, web e API subindo com um comando, conexão com o MongoDB local, pasta de fotos validada, **modelo de dados criado (coleções, índices e validadores)**, schemas compartilhados, **fundação de design** (tokens, fontes, ícones, componentes) e a infraestrutura de testes funcionando. Nenhuma funcionalidade de usuário do PRD é entregue no M0.

## 2. Escopo

| Dentro | Fora |
|---|---|
| Estrutura do monorepo, TypeScript, lint, format, scripts | Telas funcionais (parede, biblioteca, canvas) — M1 a M4 (PRD §11) |
| `.env` + validação na inicialização | Upload, salvamento, templates, área útil e lixeira funcionando (modelados aqui, implementados de M1 a M4) |
| API Fastify com rota de saúde | Rotas de negócio — M1 em diante |
| Conexão Mongo, migração inicial (coleções, índices, validadores) + seed de teste | Perspectiva, exportação, catálogo de templates (M3) |
| Schemas Zod do modelo em `packages/domain` | |
| Web Vite + React + Tailwind + shadcn/ui | |
| **Fundação de design**: tokens (DESIGN §2–4), fontes locais, ícones, componentes base do shadcn tematizados, formatadores pt-BR | Comportamento real das telas (M1+) |
| Casca estática das telas 01 Projetos e 03 Editor (layout DESIGN §7, sem dados reais) e página `/dev/ui` com as pranchas 00 e 17 | Canvas Konva funcional |
| Testes: Vitest (domain, api), Playwright (smoke) | |
| *Spikes* de risco: sharp no Windows, versões React ↔ react-konva | |

## 3. Pré-requisitos do ambiente

| Item | Requisito | Situação |
|---|---|---|
| SO | Windows | ok |
| Node.js | 24.15.0 | ok |
| MongoDB | 8.2.6 Community, instalado no Windows | ok |
| Browser | Chrome ou Edge atual | ok |
| Git | Repositório **somente local**, sem remoto | ok |

## 4. Modelo de dados

### 4.1 Visão geral

```
imagens (biblioteca global, soft delete)      projetos
┌───────────────────────────┐                ┌──────────────────────────────┐
│ _id: ObjectId              │                │ _id: ObjectId                 │
│ nomeOriginal, perfil, …    │                │ nome, revisao                 │
│ excluidaEm, purgaEm        │                │ parede { … } (embutida)       │
└────────────▲──────────────┘                └──────────────▲───────────────┘
             │ fotos[].imagemId                               │ projetoId
             │                ┌──────────────────────────────┴───────────────┐
             └────────────────│ variantes (salvamento manual = versão oficial)│
                              │ nome ("Base" por padrão), revisao, fotos[]    │
                              └──────────────▲────────────────────────────────┘
                                             │ varianteId
                              ┌──────────────┴────────────────────────────────┐
                              │ rascunhos (salvamento automático, por sessão)  │
                              └───────────────────────────────────────────────┘
migracoes (controle de versão do schema)
```

### 4.2 Decisões de modelagem

| # | Decisão | Status |
|---|---|---|
| DM-01 | `_id` = **ObjectId** em todas as coleções e subdocumentos. No domínio/JSON trafega como string hex de 24 caracteres; a API converte na fronteira do repositório. O cliente gera ids de novas fotos com `ObjectId` da lib oficial `bson` (roda no browser). Arquivos em disco nomeados pelo hex. | Decidido |
| DM-02 | Parede embutida no projeto (1:1). | Decidido |
| DM-03 | Variantes em coleção própria, ligadas ao projeto. Todo projeto nasce com a variante **"Base"**. | Decidido |
| DM-04 | Fotos posicionadas embutidas na variante (ordem do array = z-index). | Decidido |
| DM-05 | "Fotos do projeto" = imagens **carregadas no projeto** ou **usadas em qualquer variante** dele. Mantido no campo `imagens.projetos` (lista de projetos associados): entra no upload feito no projeto e ao posicionar a foto numa variante; sai em "remover do projeto". | Decidido |
| DM-06 | Salvamento manual (*hard save*) e automático (*soft save*) separados, com detecção de conflito — ver §4.9. | Decidido |
| DM-07 | Validação de estrutura em **duas camadas**: Zod na API (fonte única, em `packages/domain`) **e** validador `$jsonSchema` no Mongo (`validationLevel: strict`, `validationAction: error`), **gerado a partir dos schemas Zod** por um conversor próprio (string hex → `objectId`, data → `date`, enums, limites). Teste garante que as duas camadas aceitam e rejeitam os mesmos casos. | Decidido |
| DM-08 | Medidas em cm arredondadas a 0,1 cm (1 mm). | Decidido |
| DM-09 | Datas `Date` (BSON) em UTC. | Decidido |
| DM-10 | Caminhos de arquivo relativos a `PASTA_FOTOS`. | Decidido |
| DM-11 | Ciclo de vida da imagem: remover do projeto ou excluir; exclusão com *soft delete* de 30 dias, *placeholder* nas variantes e purga definitiva — ver §4.10. | Decidido |
| DM-12 | Exclusão de projeto: física, em cascata (variantes, rascunhos, arquivos da parede). Imagens da biblioteca não são afetadas. | Decidido |
| DM-13 | `schemaVersion` por documento + coleção `migracoes`. | Decidido |
| DM-14 | Tamanho da foto como `{ sugeridoId, larguraCm, alturaCm }` na orientação atual; orientação derivada (RN-01, RN-28). | Decidido |
| DM-15 | Área útil na **variante** (`areaUtil`), copiada da variante ativa ao criar outra (RN-33 a RN-35). | Decidido |
| DM-16 | Vagas de template e fotos de imagem excluída usam a mesma estrutura de placeholder (`imagemId = null`); vaga de template tem `imagemAnteriorId = null` (TPL-05). | Decidido |

### 4.3 Coleção `imagens`

| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `_id` | ObjectId | sim | |
| `nomeOriginal` | string | sim | Nome do arquivo enviado |
| `perfil` | `'leve' \| 'medio' \| 'alto'` | sim | RF-25 |
| `larguraPx`, `alturaPx` | int | sim | Da versão processada |
| `orientacaoNatural` | `'retrato' \| 'paisagem'` | sim | RN-04 |
| `bytes` | int | sim | |
| `arquivos.render`, `arquivos.thumb` | string | sim | `imagens/<id>.webp`, `imagens/<id>.thumb.webp` |
| `mime` | string | sim | `image/webp` |
| `criadaEm` | Date | sim | |
| `projetos` | ObjectId[] | sim | Projetos associados (DM-05) |
| `excluidaEm` | Date \| null | sim | `null` = ativa |
| `purgaEm` | Date \| null | sim | `excluidaEm + 30 dias` |
| `schemaVersion` | int | sim | |

Índices: `{ excluidaEm: 1, criadaEm: -1 }` (biblioteca ativa e lixeira) · `{ projetos: 1, excluidaEm: 1 }` (filtro "Neste projeto") · `{ purgaEm: 1 }` (purga) · `{ nomeOriginal: 1 }`.

Obs.: **não** usar índice TTL do Mongo para a purga — ele apaga o documento mas deixa os arquivos órfãos em disco.

### 4.4 Coleção `projetos`

| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `_id` | ObjectId | sim | |
| `nome` | string (1–100) | sim | |
| `criadoEm`, `atualizadoEm` | Date | sim | |
| `revisao` | int | sim | Controle de conflito de alterações da parede (§4.9) |
| `ultimaVarianteId` | ObjectId | não | Reabrir onde parou |
| `parede` | objeto \| null | sim | `null` até o upload |
| `parede.perfil` | enum | sim | |
| `parede.arquivo` | string | sim | `paredes/<projetoId>.webp` |
| `parede.thumb` | string | sim | `paredes/<projetoId>.thumb.webp` — miniatura do card de projeto (DV-07) |
| `parede.larguraPx`, `parede.alturaPx` | int | sim | |
| `parede.escala.metodo` | `'perspectiva' \| 'linear' \| null` | sim | `null` bloqueia fotos (RN-08) |
| `parede.escala.perspectiva` | `{ cantosPx: Pt[4], larguraCm, alturaCm }` | se perspectiva | RF-05 |
| `parede.escala.linear` | `{ p1, p2, comprimentoCm }` | se linear | RF-10 |
| `parede.escala.homografia` | number[9] | com escala | `H` imagem → mundo (cm) |
| `parede.retificada` | `{ arquivo, larguraPx, alturaPx, pxPorCm, origemCm }` | com perspectiva | ADR-04 |
| `schemaVersion` | int | sim | |

Índices: `{ atualizadoEm: -1 }`.

### 4.5 Coleção `variantes` (versão oficial — *hard save*)

| Campo | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `_id` | ObjectId | sim | |
| `projetoId` | ObjectId | sim | |
| `nome` | string (1–60) | sim | Primeira = "Base" |
| `ordem` | int | sim | |
| `criadaEm` | Date | sim | |
| `revisao` | int | sim | +1 a cada *hard save* |
| `salvaEm` | Date | sim | Último *hard save* |
| `salvaPorSessao` | string | sim | Id da sessão que gravou (§4.9) |
| `grid` | `{ visivel, snap, passoCm, principalACada, cor, opacidade }` | sim | RN-15 |
| `bordaPadrao` | `{ larguraCm, cor }` | sim | RN-03 |
| `areaUtil` | `{ xCm, yCm, larguraCm, alturaCm }` \| null | sim | Área útil (RN-33/35); `null` até a escala ser definida |
| `templateOrigem` | string \| null | não | Id do modelo usado para criar a variante (informativo) |
| `fotos` | `FotoNaParede[]` | sim | |
| `schemaVersion` | int | sim | |

`FotoNaParede`: `_id` (ObjectId) · `imagemId` (ObjectId \| **null** = *placeholder*) · `imagemAnteriorId` (ObjectId \| null — imagem excluída que ocupava a posição; base da recomendação) · `tamanho { sugeridoId: string \| null, larguraCm, alturaCm }` (dimensões da área impressa **já na orientação atual**; `sugeridoId` = id do tamanho sugerido, ex.: `'20x30'`, ou `null` se personalizado — RN-01/RN-28; orientação **derivada**: largura < altura → retrato, > → paisagem, = → quadrado) · `xCm`, `yCm` (0,1 cm; canto externo — RN-06) · `recorte { offsetX, offsetY }` (−1..1) · `borda { larguraCm, cor }`.

Índices: `{ projetoId: 1, ordem: 1 }` · `{ 'fotos.imagemId': 1 }` (associações de uma imagem) · `{ 'fotos.imagemAnteriorId': 1 }` (limpeza na purga).

A API devolve, na listagem de variantes, `qtdPlaceholders` (calculado por agregação) para o indicador do seletor.

### 4.6 Coleção `rascunhos` (*soft save*)

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | |
| `varianteId`, `projetoId` | ObjectId | |
| `sessaoId` | string | Sessão (aba) que gerou o rascunho |
| `revisaoBase` | int | Revisão oficial sobre a qual o rascunho foi feito |
| `conteudo` | `{ grid, bordaPadrao, areaUtil, fotos }` | Mesmo formato da variante |
| `salvoEm` | Date | |

Índices: `{ varianteId: 1, sessaoId: 1 }` único · `{ projetoId: 1 }`.

### 4.7 Coleção `migracoes`

`_id` (string, ex.: `0001-inicial`) · `aplicadaEm` (Date). Migração `0001-inicial` cria coleções e índices; idempotente.

### 4.8 Estrutura em disco (`PASTA_FOTOS`)

```
<PASTA_FOTOS>/
  imagens/<id>.webp  imagens/<id>.thumb.webp
  paredes/<projetoId>.webp  paredes/<projetoId>.retificada.webp  paredes/<projetoId>.thumb.webp
  tmp/      # gravação atômica (escreve aqui, depois rename)
```

### 4.9 Salvamento e conflitos

Conceitos:
- **Sessão**: cada aba do app gera um `sessaoId` ao abrir um projeto.
- **Versão oficial**: documento em `variantes`, alterado só por *hard save*.
- **Rascunho**: documento em `rascunhos`, alterado só por *soft save*.
- **Revisão base**: revisão oficial que a sessão carregou ou gravou por último.

Regras:

| # | Regra |
|---|---|
| SV-01 | *Soft save* a cada **X minutos** (`AUTOSAVE_MINUTOS` no `.env`, padrão **5**), só se houver alteração desde o último salvamento. Grava em `rascunhos`; **nunca** altera a versão oficial. |
| SV-02 | *Hard save* por botão e `Ctrl+S`. Grava a versão oficial (`revisao + 1`) e apaga o rascunho da própria sessão. |
| SV-03 | **Hard tem prioridade sobre soft**: ao abrir uma variante, carrega-se sempre a versão oficial; rascunhos só são oferecidos como recuperação. |
| SV-04 | **Detecção de versão desconexa** antes de qualquer gravação: se `revisao` oficial ≠ `revisaoBase` da sessão, existe versão gravada por outra sessão (ex.: sessão gravou A1→A2, mas já existe B2) → condição de corrida → perguntar. |
| SV-05 | Diálogo de conflito mostra as duas versões (quem/quando) e oferece: **Manter a minha** (sobrescreve, nova revisão), **Usar a salva** (descarta a local e recarrega) ou **Salvar a minha como nova variante** (nome sugerido: "<nome> (cópia hh:mm)"). |
| SV-06 | Em conflito durante *soft save*, o salvamento automático fica suspenso até o usuário decidir. |
| SV-07 | Ao abrir uma variante com rascunho mais novo que a versão oficial: perguntar "Recuperar alterações não salvas de hh:mm?". Se o rascunho for baseado em revisão antiga, avisar. |
| SV-08 | Indicador de estado: *salvo* / *alterações não salvas* / *rascunho salvo hh:mm* / *conflito*. Aviso do browser ao fechar com alterações sem *hard save*. |
| SV-09 | Alterações na parede (upload, calibração, perspectiva) são gravadas ao confirmar a ação, no projeto, com a mesma checagem por `projetos.revisao`. A área útil é da variante e segue o salvamento da variante. |
| SV-10 | Desfazer/refazer (por variante) não é afetado por salvamentos. |

Operação atômica: o *hard save* usa `updateOne({ _id, revisao: revisaoBase }, …)`; se nenhum documento for alterado, há conflito (resposta 409 com metadados da versão atual).

### 4.10 Ciclo de vida das imagens

| Ação | Efeito |
|---|---|
| **Remover do projeto** | Remove a imagem de todas as variantes do projeto aberto. A imagem continua na biblioteca. Exige que não haja alterações sem *hard save*; gera nova revisão das variantes afetadas. |
| **Excluir** | Mostra as associações (projetos e variantes que a usam) e pede confirmação. Marca `excluidaEm` e `purgaEm = +30 dias`; some da biblioteca ativa. Em todas as variantes e rascunhos que a usam, a foto vira **placeholder**: `imagemAnteriorId = id`, `imagemId = null`, mantendo tamanho, posição e borda (variantes afetadas ganham nova revisão). |
| **Consultar excluídas** | Filtro "Excluídas" na biblioteca, com dias restantes até a purga. |
| **Restaurar** | Limpa `excluidaEm`/`purgaEm`; volta à biblioteca ativa. **Não** repõe a imagem nos placeholders automaticamente. |
| **Associar foto ao placeholder** | O placeholder aceita qualquer imagem da biblioteca (arrastar ou escolher). Se a `imagemAnteriorId` estiver ativa (restaurada), ela aparece em destaque como recomendação. |
| **Indicador** | Seletor de variantes e lista de projetos sinalizam variantes com placeholders sem foto (quantidade). |
| **Purga** | Rotina na inicialização da API e a cada 24 h: apaga documento e arquivos de imagens com `purgaEm` vencido e zera `imagemAnteriorId` que apontava para elas (placeholder continua, sem recomendação). |
| **Placeholder na tela** | Vermelho hachurado com ícone e tamanho em mono (DESIGN §2.2), no tamanho externo da foto; selecionável, movível e com as mesmas regras de snap/medida. Vale também para vagas de template (DM-16). |
| **Placeholder na exportação** | Retângulo **vermelho hachurado, semitransparente**, no tamanho externo (exceção explícita à RN-19). |

Ao clicar em excluir/remover, o app pergunta primeiro qual das duas ações o usuário quer.

## 5. Entregáveis

### 5.1 Monorepo e tooling

Estrutura de pastas e arquivos: `docs/ARCHITECTURE.md` §6.

`.env.example` com todas as variáveis da ARCHITECTURE ADR-11: `PASTA_FOTOS`, `MONGODB_URI`, `API_PORT`, `WEB_PORT`, `AUTOSAVE_MINUTOS` (5), `UPLOAD_MAX_MB` (50).

Scripts na raiz:

| Script | Faz |
|---|---|
| `dev` | web (Vite) + api (watch) em paralelo |
| `build` | domain → api → web |
| `start` | api servindo o build da web em uma porta |
| `typecheck` | `tsc --noEmit` em todos os workspaces |
| `lint` / `format` | ESLint / Prettier |
| `test` | Vitest (domain + api) |
| `e2e` | Playwright |

### 5.2 `packages/domain`

- Constantes: tamanhos sugeridos e limites do personalizado (RN-01, RN-28), perfis (ADR-05), padrões de grid e borda (RN-03, RN-15), nome da variante padrão ("Base"), prazo de purga (30 dias).
- Schemas Zod + tipos inferidos: `Imagem`, `Projeto`, `Parede`, `Escala`, `Variante`, `AreaUtil`, `Rascunho`, `FotoNaParede`, `Tamanho`, `Grid`, `Borda`, `Pt`; ids como string hex de 24 caracteres.
- Conversor Zod → `$jsonSchema` do Mongo (DM-07), com testes de paridade.
- Função `arredondarCm` (DM-08).
- Formatadores pt-BR (DESIGN §8): `formatarCm(24) → "24,0"`, `formatarDimensao(24, 34) → "24,0 × 34,0 cm"` (U+00D7), `formatarEscala(4) → "4,0 px/cm"`, `formatarTamanho` (sugerido sem decimal "20 × 30"; personalizado com 1 casa "21,0 × 29,7" — DESIGN DS-02), `formatarHora(d) → "às 14:35"`, `formatarData(d) → "12/10"`. Testados.
- Testes unitários dos schemas e constantes.

### 5.3 `apps/api`

| Item | Detalhe |
|---|---|
| Config | Lê `.env`, valida: `PASTA_FOTOS` existe e é gravável; `MONGODB_URI` válido e Mongo acessível; portas, `AUTOSAVE_MINUTOS` e `UPLOAD_MAX_MB` numéricos e positivos. Erro → mensagem clara e encerra |
| Mongo | Conexão única (driver oficial), migração `0001-inicial` |
| Armazenamento | Cria subpastas; helper de gravação atômica |
| Rotas | `GET /api/saude` → `{ api: 'ok', mongo: 'ok'|'erro', pasta: 'ok'|'erro', versao }` |
| Servidor | Escuta em `127.0.0.1`; log via logger nativo do Fastify |
| Produção local | Serve `apps/web/dist` como estático em `start` |

### 5.4 `apps/web`

Base:
- Vite + React 19 + TS + Tailwind 4 + shadcn/ui inicializado.
- Proxy `/api` → API; porta fixa (`strictPort`).
- Indicador de status consumindo `/api/saude`.

Fundação de design (fonte: `docs/DESIGN.md`):

| Item | Entrega |
|---|---|
| Tokens | Arquivo de tokens (ARCHITECTURE §6) com `@theme` contendo **todos** os tokens da DESIGN §2.1, raios e sombras (§4), famílias (§3) e mapeamento das variáveis do shadcn (§5). Só tema claro. |
| Tipografia | Escala `display-xl` … `mono` (§3) como utilitários; `tabular-nums` no mono; *antialiased*. |
| Fontes | Arquivos empacotados no build (PR-02); nenhuma requisição fora de `localhost`. |
| Ícones | Biblioteca de PR-03; traço 1,6–1,8 px, 16–18 px. |
| Componentes shadcn | `Button` (primário, outline, ghost, destructive, icon), `Input` (com prefixo/sufixo mono), `ToggleGroup` (segmented com colunas iguais e larguras fixas da §6), `Switch`, `RadioGroup` (radio card), `Dialog` (640 px, rodapé `surface-muted`), `DropdownMenu`, `Popover`, `Select` (seletor de tamanho), `Toggle` (Grid/Snap), `Badge`, `Alert` (aviso e alerta), `Tooltip`. Variantes conforme DESIGN §6. |
| Componentes próprios | `StatusSalvamento` (4 estados SV-08), `ChipEscala`, `Miniatura` (anel de seleção; contador de uso só no marco M5 — DV-04), `CampoCm`, `SeletorCor` (DV-08), `BotaoEmBreve` (controle inativo com tooltip — DESIGN §7.1). |
| Tema do canvas | Arquivo de tema do canvas (ARCHITECTURE §6) com as constantes da DESIGN §2.2. |
| Foco | Anel 2 px `accent`, offset 2 px em todos os controles (DESIGN §5, §9). |

Cascas estáticas (sem dados reais, sem Konva):
- **01 Projetos**: header, título, busca **inativa** (DESIGN §7.1), grade de cards com estado "Sem foto da parede" e menu ⋯ (Renomear, Excluir).
- **03 Editor**: header completo em 1440 e versão 1280 com menu “Parede ▾” (DESIGN §7, protótipos 03/03a), botão "Parede" inativo, coluna Biblioteca (busca inativa, filtros), área do canvas vazia com toolbar, painel direito "Composição" (protótipo 11, com Área útil e "Linha forte a cada" inativo), barra de status.
- **`/dev/ui`**: reprodução das pranchas `Identidade.dc.html` (00) e `Componentes.dc.html` (17) — cores, tipografia, componentes, sinais na parede, seletor de tamanho, cor da borda, controle inativo, área útil, vaga e card de template — para validação visual.

Os protótipos `.dc.html` usam placeholders (`{{…}}`, `<sc-for>`, `<sc-if>`) e não renderizam por completo no navegador; servem de referência de estrutura, medidas e textos.

### 5.5 Testes

| Tipo | M0 |
|---|---|
| Unitário (domain) | Schemas, constantes, formatadores e conversor Zod → `$jsonSchema` |
| API | `/api/saude` e migração idempotente via `fastify.inject`, contra banco de teste |
| E2E | Smoke: app abre e mostra status "ok"; `/dev/ui` e as cascas 01/03 renderizam; **nenhuma requisição de rede fora de `localhost`** durante a navegação (RNF-01) |

Banco de teste: database separado na instância local (`parede-fotos-test`), recriado a cada execução, com **seed**:
- `tests/fixtures/imagens/`: 6 fotos pequenas (retrato, paisagem, quadrada, JPG com EXIF rotacionado, PNG, WEBP) + arquivos inválidos (texto renomeado para `.jpg` e um `.heic` — RN-20, RF-15).
- `tests/fixtures/paredes/`: parede frontal e parede sintética em perspectiva com retângulo de medida conhecida (critério de aceite 6 do PRD).
- Seed de banco (`npm run seed:test`): imagens ativas e excluídas (purga vencida e não vencida), 1 imagem restaurada, 1 projeto com parede calibrada, variantes "Base" e "Alternativa" compartilhando imagens, 1 variante com placeholder (com e sem recomendação), 1 variante criada de template (`templateOrigem: 'piramide'`, só vagas), áreas úteis distintas entre variantes, 1 foto com tamanho personalizado, 1 rascunho com revisão base antiga (cenário de conflito).
- Conexão de teste: mesma instância de `MONGODB_URI`, database `parede-fotos-test`.
- Pasta de fotos de teste em diretório temporário.

### 5.6 Spikes de risco

| Spike | Critério de sucesso |
|---|---|
| sharp no Windows | Converte fixture JPG com EXIF rotacionado para WebP no perfil Leve, orientação correta |
| React ↔ react-konva | Versões fixadas compatíveis; um `Stage` com 1 retângulo arrastável renderiza |

## 6. Critérios de aceite do M0

1. Em máquina Windows limpa (com Node e Mongo), `npm install` + copiar `.env.example` + `npm run dev` sobe web e API.
2. Web mostra status `api/mongo/pasta = ok`.
3. `.env` com pasta inexistente, Mongo inacessível ou valor numérico inválido → API não sobe e informa o motivo.
4. Migração cria `imagens`, `projetos`, `variantes`, `rascunhos`, `migracoes`, todos os índices e validadores; rodar duas vezes não gera erro nem duplicidade.
5. Inserir direto no Mongo um documento inválido (ex.: `tamanho.larguraCm: 200`) é rejeitado pelo validador; o mesmo caso é rejeitado pelo Zod (paridade).
6. Seed de teste popula o banco `parede-fotos-test` com os cenários da §5.5.
7. `npm run typecheck`, `lint`, `test` e `e2e` passam.
8. Spikes da §5.6 aprovados e registrados no `MEMORY.md`.
9. `README.md` descreve setup e comandos.
10. `/dev/ui` reproduz as pranchas 00 `Identidade.dc.html` e 17 `Componentes.dc.html` (com as correções da DESIGN §10): cores, fontes (Newsreader, Instrument Sans, IBM Plex Mono), componentes e sinais na parede, conferidos visualmente pelo Nicholas.
11. Cascas 01 Projetos e 03 Editor seguem a DESIGN §7 em 1440×900 e, em 1280 px, o header usa o menu "Parede ▾" sem quebra de linha.
12. Controles inativos (DESIGN §7.1) têm `aria-disabled`, recebem foco e mostram o tooltip.
13. Nenhuma requisição externa em toda a navegação (teste E2E).
14. Contraste ≥ 4,5:1 nos pares de texto da DESIGN §2.1 (teste automatizado com os tokens).

## 7. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Monorepo: workspaces, tsconfig base, ESLint, Prettier, `.gitignore`, `.env.example`, git init (local, sem remoto), `engines.node >= 24.15` | — |
| T2 | `packages/domain`: constantes, schemas Zod, conversor `$jsonSchema`, formatadores, testes | T1 |
| T3 | `apps/api`: config + validação do `.env`, armazenamento, conexão Mongo | T1, T2 |
| T4 | Migração `0001-inicial` (coleções, índices, validadores `$jsonSchema` gerados do Zod) + testes de paridade Zod ↔ Mongo | T3 |
| T4a | Fixtures + seed do banco de teste | T4 |
| T5 | Rota `/api/saude` + testes | T3 |
| T6a | `apps/web`: Vite, Tailwind, shadcn, proxy, status | T1, T5 |
| T6b | Fundação de design: tokens, fontes, ícones, componentes base e próprios, tema do canvas | T6a, T2 |
| T6c | Cascas estáticas 01 Projetos e 03 Editor | T6b |
| T6d | Página `/dev/ui` (pranchas 00 e 17) | T6b |
| T7 | Script `start` (API serve build da web) | T5, T6a |
| T8 | Playwright smoke + requisições externas + contraste + controles inativos | T6c, T6d |
| T9 | Spikes sharp e react-konva | T1 |
| T10 | README + atualização de `MEMORY.md` | todas |

## 8. Forma de trabalho na implementação

- Uma tarefa por vez, na ordem da §7; ao fim de cada uma: `typecheck`, `lint` e `test` verdes, commit local (`feat(m0): T3 config e validação do .env`) e atualização do Status no `MEMORY.md`.
- Ponto de validação com o Nicholas ao final de **T4a** (modelo no Mongo + seed), **T6d** (identidade visual) e **T10** (aceite do M0).
- Qualquer dependência fora das ADRs para e pede aprovação antes de instalar.
- Versões exatas fixadas no `package-lock.json` na T1 e registradas no `MEMORY.md`.

## 9. Próximos marcos

Divisão aprovada (MS-01) — ver PRD §11. Cada marco recebe especificação própria em `docs/specs/` após o aceite do anterior: M1 Parede e escala · M2 Biblioteca e composição · M3 Variantes, templates e salvamento · M4 Ciclo de vida e exportação · M5 v1 desejável.

## 10. Decisões pendentes

Nenhuma. A implementação começa só com liberação explícita do Nicholas.
