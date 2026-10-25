# Especificação M2 — Biblioteca e composição

| Campo | Valor |
|---|---|
| Versão | 0.2 (implementada; decisões e premissas aguardam revisão do Nicholas) |
| Data | 2026-10-25 |
| Base | `docs/PRD.md` v0.11 · `docs/ARCHITECTURE.md` v0.7 · `docs/DESIGN.md` v0.3 + protótipos 03, 03a, 03b, 07, 16 · `docs/specs/M0-setup.md` v0.6 · `docs/specs/M1-parede-e-escala.md` v0.3 |
| Status | **Implementada (25/10), aguardando a revisão e a validação visual do Nicholas.** Ele liberou o M2 sem revisar a spec; as decisões da §0.1 e as premissas da §0.2 foram tomadas com o padrão mais conservador dos documentos e seguem marcadas para revisão. Registro da implementação na §12. |

## 0. Pré-requisitos

| # | Item | Situação |
|---|---|---|
| PR-M2-01 | Aceite do M1. | ✅ 24/10 |
| PR-M2-02 | Spec do M2 (MS-01). | ✅ este arquivo (rascunho; revisão do Nicholas pendente) |
| PR-M2-03 | Dependências: `bson` (ADR-07, ids no cliente). `zundo` (ADR-03) **não** entra: ver M2-02. Nenhuma outra. | ✅ |

### 0.1 Decisões desta especificação (lacunas e contradições resolvidas)

| # | Lacuna ou contradição | Decisão (25/10) |
|---|---|---|
| M2-01 | RF-13 diz "exigir calibração antes de incluir fotos"; RF-20 pede upload "a partir de um projeto". Não estava dito se a biblioteca recebe fotos antes da escala. O texto aceito do M1 (§3.2) já diz "As fotos ficam disponíveis depois que a escala da parede for definida". | **"Carregar fotos" e "Adicionar" ficam inativos sem escala**, com o tooltip "Defina a escala primeiro." (padrão A-16). A biblioteca (miniaturas já enviadas) aparece sempre, mas só se posiciona com escala. O servidor aceita o upload de qualquer forma (a biblioteca é global); a trava de RF-13/RN-08 no servidor é a do salvamento da variante (M2-06). |
| M2-02 | A ADR-03 prevê `zundo` para o histórico, mas o conteúdo desfazível (`fotos`, `areaUtil`, `bordaPadrao`) vive aninhado em `documento.variante`, e o `zundo` mescla o estado só no primeiro nível: desfazer substituiria o `documento` inteiro (projeto, revisões, status de salvamento). Além disso o histórico é **por variante** (M3). | **Pilha própria de instantâneos, pura, em `packages/domain/src/historico.ts`**, indexada por variante e guardada na store fora do que é desfeito. Um passo por intenção do usuário, registrado explicitamente pelas ações. Limite de **100 passos** por variante (RN-18 pede ≥ 50). **Muda a ADR-03** (sem `zundo`; uma dependência a menos, P4) — registrado na ARCHITECTURE v0.8. |
| M2-03 | RN-18 só nomeia a área útil como desfazível; o grid também é da variante. | **Entram no desfazer:** fotos (adicionar, mover, tamanho, orientação, borda, recorte, duplicar, remover, ordem), área útil e borda padrão. **Ficam de fora:** os ajustes do grid (visível, passo, snap, cor, opacidade), que são auxílio de visão, não composição; continuam marcando "Alterações não salvas". Mudanças da parede continuam fora (M1-04). |
| M2-04 | Quais fotos "Adicionar" põe e onde. | **"Adicionar" põe a foto selecionada na biblioteca** (clique na miniatura seleciona; duplo clique na miniatura também adiciona). Sem foto selecionada na biblioteca o botão fica inativo ("Selecione uma foto na biblioteca."). A foto entra **centralizada na área útil** (encaixada no grid se o snap estiver ligado); se já houver uma foto exatamente no mesmo lugar, desloca-se em cascata (um passo do grid com o snap ligado; 5 cm sem snap) até ficar livre. Ao **soltar** a miniatura no canvas, o **centro** da foto vai para o ponto de soltura, encaixado no grid se o snap estiver ligado. |
| M2-05 | Qual canto fica fixo quando a borda muda, e o que acontece com o recorte quando a proporção muda. | RN-05 vale também para a borda: o **canto superior esquerdo externo não se mexe**; o tamanho externo cresce para a direita e para baixo. **Trocar o tamanho ou a orientação recentraliza o recorte** (offsets 0, 0), como já valia para o personalizado (RN-28). |
| M2-06 | O *hard save* da M1 aceita `fotos` sem conferir nada, e `imagens.projetos` (DM-05) não é mantido. | O servidor passa a recusar (422) fotos sem escala definida (RN-08), imagens inexistentes ou excluídas e `_id` de foto repetido; e, a cada salvamento, acrescenta o projeto a `imagens.projetos` das imagens usadas (`$addToSet`). |
| M2-07 | O protótipo 07 não mostra "Enviar": o envio parece começar ao escolher os arquivos, mas o perfil é definitivo (RF-25, RN-21) e os arquivos também podem chegar por arrastar-e-soltar sobre a biblioteca. | **Os arquivos escolhidos ou arrastados ficam na fila e o envio começa em "Enviar N fotos"** (primário). Até lá o perfil pode ser trocado e mais arquivos podem entrar. Depois de iniciar o envio o perfil fica travado (DV-10) até o lote acabar. Diverge do protótipo 07 (DS-02). |
| M2-08 | "Fora da parede" × "Fora da área útil": tolerância e o que conta como sobreposição. | Tolerância de **0,05 cm** (meio milímetro) contra ruído de arredondamento. **Sobreposição** = interseção dos tamanhos externos com largura e altura maiores que a tolerância (fotos encostadas não se sobrepõem). **Fora** = qualquer parte do tamanho externo além do retângulo. Prevalece "Fora da parede" (DESIGN §2.2). Alertas não bloqueiam nada (RN-11, RN-12, RN-34). |
| M2-09 | RN-16: "com snap ligado, move um passo do grid" não diz o que o Shift faz nesse caso. | Com snap **ligado**: seta = ir à linha do grid seguinte na direção (se a foto está entre linhas, vai à mais próxima na direção); Shift + seta = 5 linhas. Com snap **desligado**: seta = 1 cm; Shift + seta = 5 cm. |

### 0.2 Premissas (a revisar pelo Nicholas)

| # | Premissa |
|---|---|
| B-01 | Seleção única (RF-36 é ideia futura). Clicar numa foto seleciona; clicar no fundo ou `Esc` desseleciona; selecionar não muda a ordem. Selecionar na biblioteca e selecionar no canvas são independentes. |
| B-02 | **Snap** encaixa o canto superior esquerdo **externo** (RN-06) em múltiplos do passo a partir da origem 0,0 (RF-54, origem configurável, é futuro). Vale ao arrastar, ao soltar da biblioteca, ao adicionar, ao duplicar e nas setas. **Não** vale para valores digitados em X/Y (ficam como digitados, a 0,1 cm) nem reencaixa a foto ao trocar tamanho ou borda. |
| B-03 | O arrasto não muda o estado a cada pixel: o Konva move o nó, o palco acompanha o contorno e os alertas ao vivo, e a store recebe **uma** atualização no `dragend` (1 passo no desfazer). |
| B-04 | Campos do painel (tamanho personalizado, borda, X, Y) aplicam em Enter ou ao sair do campo (padrão do `CamposAreaUtil`), cada aplicação é 1 passo. Valor inválido mostra a faixa válida e não aplica. X e Y não têm limite (a foto pode sair da parede — RN-12); a borda vai de 0 a 20 cm. |
| B-05 | **Bounding box** (RF-62) aparece com 2 ou mais fotos (com 1 é o próprio tamanho externo). Pill "L × A cm" acima do retângulo. "Área total" do painel é essa mesma medida. |
| B-06 | **Duplicar** cria a cópia a +5 cm em X e em Y (com snap ligado, +1 passo do grid), no topo da ordem, e a seleciona. Mesma imagem, tamanho, borda e recorte (RN-13). |
| B-07 | **Remover** (painel da foto) tira só a foto **da variante**; o ciclo de vida da imagem (RF-29) é do M4. `Delete`, `Ctrl+D` e demais atalhos de UX-01 não entram. `Ctrl+Z` desfaz; `Ctrl+Shift+Z` e `Ctrl+Y` refazem (fora de campos de texto). |
| B-08 | Filtros da biblioteca: **Todas**; **Projeto** = imagens com o projeto em `imagens.projetos` **ou** usadas em alguma foto da variante aberta (inclui o que ainda não foi salvo); **Variante** = usadas na variante aberta. **Excluídas** fica visível e inativa (M4). Busca por nome segue inativa. Sem o contador de uso (RF-23, M5). |
| B-09 | A foto é desenhada com o arquivo `render` do perfil (não com a miniatura de 256 px, que fica borrada em 20 × 30 cm). A miniatura serve a biblioteca. Arquivos de imagem são imutáveis por id: `Cache-Control: public, max-age=31536000, immutable`. |
| B-10 | Entrada de arquivos (RF-20): `Selecionar arquivos` (múltiplos), `Selecionar pasta` (`webkitdirectory`, só os formatos aceitos entram; os demais contam em "arquivos ignorados por formato" — RN-20) e arrastar para o diálogo ou para a coluna Biblioteca. O limite de 50 MB é o do M1 (fixo no browser). `nomeOriginal` é o nome do arquivo sem pasta. |
| B-11 | Falha de um arquivo não interrompe o lote; o item mostra o motivo e "Tentar de novo". "Cancelar restantes" aborta o que está em envio e esvazia a fila; o que já terminou fica na biblioteca. |
| B-12 | O painel direito mostra o **painel da foto** quando há seleção e **Composição** quando não há. No modo de recorte o painel é o do recorte. |
| B-13 | Controles do M3 em diante seguem visíveis e inativos: seletor de variante (só "Base"), Comparar, Templates, Exportar. |
| B-14 | Contagem de fotos, "Área total", sobreposições e "fora da área" no painel Composição: as duas últimas linhas só aparecem quando maiores que zero ("Sem foto" é do M4). |
| B-15 | Ordem das miniaturas: mais recentes primeiro. A lista vem inteira da API (sem paginação; uso pessoal). |

## 1. Objetivo

Entregar a parte central do uso: enviar fotos para a biblioteca global (individual ou em lote), posicioná-las na parede em tamanhos sugeridos ou personalizados, retrato ou paisagem, com borda, recorte, grid e snap, ver medidas e alertas, desfazer e refazer, e salvar. Ao fim do M2, uma composição inteira numa variante é montada, salva e reaberta (PRD aceite 7) a partir da biblioteca.

## 2. Escopo

| Dentro | Fora (marco) |
|---|---|
| Upload individual e em lote com perfil, progresso, falhas e cancelamento — RF-20, RF-21, RF-25, RF-26, RN-20, RN-21, RN-25 | Contador de uso nas miniaturas (RF-23, M5); busca por nome (RF-33c, futuro) |
| Biblioteca global com miniaturas, nome, orientação e filtros — RF-22, RF-27, RF-28 | Filtro e fluxo "Excluídas", remover do projeto, excluir, restaurar, placeholders, purga (RF-29, RF-30a, RN-24 — M4) |
| Adicionar (botão e arrastar), mover (mouse e setas), selecionar, duplicar, remover, ordem — RF-30, RF-34, RF-35, RN-13, RN-16 | Seleção múltipla, alinhar, distribuir (RF-36, RF-63, RF-64 — futuro) |
| Tamanhos sugeridos, orientação, personalizado em cm — RF-31, RF-32, RN-01, RN-04, RN-05, RN-28 | Variantes, templates, comparação (M3) |
| Enquadramento *cover* e modo de recorte — RF-33, RN-14 | Rascunho (*soft save*), recuperação e diálogo de conflito (M3) |
| Borda em cm e cor, borda padrão — RF-41, RN-02, RN-03 | Exportação (M4) |
| Snap — RF-53, RN-06, RN-15 | Linha forte do grid (RF-52, M5) |
| Painel da foto, bounding box, sobreposição, fora da parede/área — RF-60, RF-62, RN-11, RN-12, RN-34 | Distância até vizinhas, guias, réguas (futuro) |
| Desfazer e refazer — RF-70, RN-18 | |

## 3. Comportamento

### 3.1 Biblioteca (protótipo 03)

- Coluna de 280 px: título "Biblioteca" (serif) com contador "N fotos" (12 px `ink-3`) à direita; botão primário **Carregar fotos** (largura total); filtros `Todas · Projeto · Variante · ⋯` (o menu ⋯ tem **Excluídas**, inativo — M4); busca inativa; grade de 2 colunas de miniaturas (altura 88 px, raio 6) com nome (12 px, reticências) e orientação ("Retrato" / "Paisagem", 12 px `ink-3`).
- Clique na miniatura seleciona (anel `accent` de 2 px — DESIGN §6); clique de novo ou `Esc` não desseleciona na biblioteca (só troca a seleção). **Duplo clique adiciona** (M2-04). A miniatura é arrastável (cursor `grab`).
- Sem fotos: "Nenhuma foto na biblioteca ainda." e o botão "Carregar fotos". Filtro sem resultado: "Nenhuma foto neste filtro.".
- Sem escala (M2-01): "Carregar fotos" inativo ("Defina a escala primeiro.") e o texto "As fotos ficam disponíveis depois que a escala da parede for definida." (M1 §3.2).
- Soltar arquivos sobre a coluna abre o diálogo com os arquivos na fila (M2-07). A coluna destaca a área de soltura (borda tracejada `accent`) enquanto arquivos são arrastados sobre ela.

### 3.2 Diálogo "Carregar fotos" (protótipo 07, M2-07)

- Diálogo de 640 px: **Selecionar arquivos** · **Selecionar pasta** · "ou arraste para esta janela".
- `fieldset` "Qualidade · definitiva para este envio": radio cards **Leve** 1024 px · **Médio** 2048 px · **Alto** 3072 px (padrão Leve — RF-25), nota "Convertidas para WebP. Seus arquivos originais não são alterados.". Desabilitado enquanto o lote envia.
- Resumo: "9 de 14 enviadas" e, se houver, "3 arquivos ignorados por formato" (RN-20; o texto cita também o tamanho: "2 arquivos ignorados (formato ou tamanho)" quando houver recusa por tamanho); barra de progresso de 6 px.
- Lista: miniatura (quando concluída), nome, estado e tamanho (mono): **Aguardando** · **Enviando 45%** · **Concluída** (`success-ink`) · **Falhou: <motivo>** (`danger-ink`) + "Tentar de novo" · **Cancelada**.
- Rodapé (`surface-muted`): fantasma **Cancelar restantes** (só durante o envio), primário **Enviar N fotos** (com fila e sem envio em curso) ou **Concluir** (fecha). Fechar com envio em andamento pede confirmação "Cancelar os envios restantes?".
- Envio: 1 requisição por arquivo, **3 em paralelo**, progresso por arquivo (DV-10); a miniatura entra na biblioteca assim que o arquivo termina.
- Recusas no browser (antes de enviar): formato (inclusive HEIC — RF-15) e tamanho acima de 50 MB, com a mensagem do arquivo na lista de ignorados.

### 3.3 Canvas — fotos

- **Camada Fotos** entre a área útil e o overlay (ADR-02): 1 `Group` por foto — retângulo da borda (tamanho externo, cor da borda) + imagem *cover* com `crop` (tamanho impresso) deslocada pela borda. Ordem do array = z-index (o último fica por cima).
- **Seleção** (DESIGN §2.2): contorno contínuo 2 px `accent`, offset 3 px; 4 alças 8 × 8 brancas nos cantos (indicativo de seleção, sem redimensionar — o tamanho vem do painel); pill `accent` abaixo com o **tamanho externo** ("24,0 × 34,0 cm"). Contorno, alças e pill ficam na camada em px de tela (tamanho constante em qualquer zoom).
- **Alertas** (DESIGN §2.2, M2-08): contorno tracejado `danger` 2 px (offset 2 px) em todas as fotos envolvidas + pill `danger` com ícone: "Sobreposição", "Fora da parede" ou "Fora da área útil". Calculados ao vivo durante o arrasto.
- **Bounding box** (RF-62, B-05): retângulo tracejado 1,5 px `ink-2` com 8 px de folga e pill `ink-2` "L × A cm" acima.
- **Arrastar**: botão esquerdo sobre a foto; o canto superior esquerdo externo é encaixado no grid quando o snap está ligado (B-02); o Konva move o nó e a store só muda no `dragend` (B-03). Arrastar o fundo continua sendo pan.
- **Teclado** (RN-16, M2-09), com a foto selecionada e o foco fora de campos de texto: setas movem; `Esc` desseleciona; `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` desfazem e refazem.
- **Soltar da biblioteca** (M2-04): `dragover` aceita a miniatura; `drop` converte o ponto da página em cm (`PalcoApi.dePaginaParaConteudo`).
- Imagem ainda carregando: retângulo `sand`. Imagem que não está na biblioteca (ou que falha ao carregar): fica o retângulo `sand`; a foto continua selecionável e movível, e o painel mostra "Imagem indisponível".
- Hook de teste (estende o da M1 §3.9): `window.__deco.paraTela(x, y)`, `window.__deco.dePagina(x, y)` e `window.__deco.retanguloDaFoto(id)` → `{ x, y, largura, altura }` em px da página do **tamanho externo**.

### 3.4 Painel da foto (protótipo 03; DESIGN §7)

Cabeçalho: miniatura + nome (serif 18) + "Retrato natural" / "Paisagem natural" (orientação da **imagem**, não da foto na parede). Depois:

1. **Tamanho** (`Select` agrupado Padrão · Quadrados · Grandes + "Personalizado…", rótulo mono "20 × 30 cm"; personalizado exibido com 1 casa, "21,0 × 29,7 cm") e **Orientação** (segmented 152 px, Retrato · Paisagem; inativa nos tamanhos quadrados — RN-28). Trocar aplica RN-05 e M2-05.
2. **Borda**: `CampoCm` (0 a 20 cm) + `SeletorCor`. Aplica em Enter/sair (B-04).
3. Bloco **Tamanho externo** ("34,0 × 54,0 cm").
4. **Posição do canto superior esquerdo**: X e Y (`CampoCm`, prefixo "X" / "Y" e sufixo `cm`; precisão de 0,1 cm; aceitam valores negativos).
5. `Alert` de alerta com o texto do alerta ativo: "Esta foto sobrepõe outra na parede." · "Esta foto passa dos limites da parede." · "Esta foto passa dos limites da área útil.".
6. **Enquadramento**: botão "Ajustar recorte" (também por duplo clique na foto — RN-14).
7. **Duplicar** e **Remover** (texto `danger-ink`).

### 3.5 Modo de recorte (RN-14, RN-28, protótipo 16; DESIGN §7.0)

- Entrada: "Ajustar recorte", duplo clique na foto, ou escolher "Personalizado…" no tamanho. Barra do modo **só identifica** ("Ajustar recorte · IMG_2041.jpg" + "O restante da parede fica bloqueado até concluir"); as ações ficam no painel.
- Canvas: demais fotos e controles sem interação; a **imagem inteira** (cobrindo o quadro) é desenhada com a parte fora do quadro esmaecida (`ink` a 55%); quadro com contorno `accent`; arrastar desloca a imagem **só no eixo com sobra**; pill de medida "30,0 × 30,0 cm" e ícone de mover no centro.
- Painel: título "Ajustar recorte"; `Select` de tamanho (como acima); com tamanho **personalizado**, campos **Largura × Altura** (5,0 a 150,0 cm; passo 0,1; texto "Entre 5,0 e 150,0 cm em cada lado."); bloco "Tamanho externo"; texto "A foto sempre preenche o quadro. Arraste a imagem para escolher a parte que aparece."; **Cancelar** e **Concluir**.
- Enquanto o modo está aberto o tamanho e o recorte são um *rascunho* na UI (o canto superior esquerdo externo fica fixo — RN-05); mudar o tamanho recentraliza o recorte. **Concluir** (ou `Enter`) grava tudo como **1 passo**; **Cancelar** (ou `Esc`) descarta o rascunho. Personalizado igual a um sugerido vira o sugerido (RN-28).

### 3.6 Painel Composição (protótipo 11)

Passa a mostrar: Fotos N · Área total (bounding box, ou "—") · Sobreposições n · Fora dos limites n (as duas últimas só se > 0, B-14). **Borda padrão** vira funcional (largura e cor valem para **novas** fotos; as existentes não mudam — RN-03). As demais seções seguem como no M1.

### 3.7 Header, toolbar e barra de status

- **Desfazer / Refazer** funcionam (inativos, por estado, quando a pilha está vazia: dica "Nada para desfazer." / "Nada para refazer."). `Salvar` não limpa as pilhas (SV-10).
- **Toolbar**: Adicionar, Duplicar, Trazer para frente, Enviar para trás funcionam; Duplicar e as de ordem ficam inativas sem foto selecionada ("Selecione uma foto na parede."); "Adicionar" segue M2-04.
- **Barra de status**: à esquerda "Nenhuma foto selecionada" ou a posição da foto selecionada (`X 112,5 · Y 40,0 cm`); no centro a dica de teclado (M2-09); à direita o status de salvamento.
- Sem escala (M2-01): o editor se comporta como no M1.

## 4. Domínio

### 4.1 Módulos novos em `packages/domain/src/` (TS puro; testes obrigatórios)

| Módulo | Funções |
|---|---|
| `fotos/tamanho.ts` | `orientacaoDoTamanho`, `tamanhoSugerido(id, orientacao)`, `tamanhoDaImagem(orientacaoNatural)` (RN-04), `tamanhoPersonalizado(l, a)` (5–150, 0,1; igual a um sugerido → sugerido — RN-28), `trocarOrientacao`, `validarLadoPersonalizado`, `ehQuadrado` |
| `fotos/geometria.ts` | `tamanhoExterno(foto)` (RN-02), `caixaExterna(foto)`, `caixaDaComposicao(fotos)` (RF-62), `encaixarNoGrid(valor, passo)`, `encaixarPosicao`, `proximaLinhaDoGrid(valor, passo, direcao)` (M2-09), `moverPorSeta(foto, direcao, shift, grid)` |
| `fotos/alertas.ts` | `calcularAlertas(fotos, paredeInteira, areaUtil)` → por `_id`: `{ sobreposicao, fora: 'parede' \| 'area-util' \| null }`; `resumirAlertas` (M2-08) |
| `fotos/recorte.ts` | `recorteCover(imagem, tamanho, offset)` → retângulo em px da imagem; `deslocarRecorte(imagem, tamanho, offset, deltaCm)` → novo offset (só no eixo com sobra) |
| `fotos/composicao.ts` | `criarFoto` (RN-03, RN-04, RN-13), `posicaoInicial` (M2-04), `posicaoDoDrop`, `duplicarFoto` (B-06), `trazerParaFrente`, `enviarParaTras`, `aplicarTamanho`, `aplicarBorda` (RN-05, M2-05), `resumoDaComposicao` |
| `historico.ts` | pilha de desfazer/refazer, pura e imutável: `criarHistorico`, `registrar`, `desfazer`, `refazer`, `podeDesfazer`, `podeRefazer` (limite 100 — M2-02); a store guarda uma por variante |
| `constantes.ts` | `THUMB_FOTO_PX = 256`, `LIMITE_HISTORICO = 100`, `TOLERANCIA_CM = 0.05`, `DESLOCAMENTO_DUPLICAR_CM = 5`, `LIMITE_BORDA_CM = { min: 0, max: 20 }`, `UPLOAD_PARALELO = 3`, `PASSO_CASCATA_CM = 5` |

### 4.2 Fórmulas

- **Tamanho externo** = impresso + 2 × borda (arredondado a 0,1 cm).
- **Recorte *cover*** (RN-14): `s = max(W/iw, H/ih)` (cm por px); recorte em px da imagem: `cw = W/s`, `ch = H/s`, `x = (iw − cw)/2 · (1 + offsetX)`, `y = (ih − ch)/2 · (1 + offsetY)`. `offset` ∈ [−1, 1]; −1 mostra a borda esquerda/superior, +1 a direita/inferior; sem sobra no eixo, o offset daquele eixo é 0.
- **Arrasto no modo de recorte**: arrastar a imagem `d` cm para a direita mostra mais da esquerda (`x` diminui `d/s` px); o offset é recalculado e limitado a [−1, 1].
- **Posição inicial** (M2-04): centro da área útil (ou da parede inteira, se não houver) menos metade do tamanho externo; encaixada se o snap estiver ligado; em cascata (um passo do grid com snap; 5 cm sem snap) enquanto houver outra foto exatamente no lugar.

## 5. API (M2)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `POST /api/imagens` | multipart: `arquivo`, `perfil`, `projetoId` | 201 `Imagem` (datas em texto) · 400 perfil ou projeto inválido · 404 projeto · 413 tamanho · 415 formato |
| `GET /api/imagens` | — | `Imagem[]` ativas (`excluidaEm = null`), por `criadaEm` decrescente |
| `GET /api/imagens/:id/arquivo?tipo=render\|thumb` | — | `image/webp`, `Cache-Control: public, max-age=31536000, immutable` · 404 |
| `PUT /api/projetos/:pid/variantes/:id` | (M1) | + 422 sem escala / imagem inexistente ou excluída / `_id` repetido; atualiza `imagens.projetos` |

Processamento (`sharp`): `rotate()` (EXIF), lado maior do perfil (`PERFIS[perfil].ladoFotoPx`, sem ampliar), WebP na qualidade do perfil, miniatura de **256 px** (ADR-05). O id (`ObjectId`) é gerado antes de gravar; arquivos vão para `tmp/` e só são promovidos depois do `insertOne` aceito (sem rastro em falha). `orientacaoNatural`: largura > altura → `paisagem`, senão `retrato` (RN-04). `bytes` = tamanho do arquivo `render`. `nomeOriginal` = nome do arquivo sem pasta; vazio vira "sem-nome". Sem detecção de duplicatas (RN-25).

## 6. Web

| Camada | Entrega |
|---|---|
| `app/` | Store: `ui.selecaoId`, `ui.bibliotecaSelecaoId`, `ui.recorte` (rascunho), fatia `biblioteca` (imagens, carregando, erro) e `historico` por variante; ações nomeadas: `carregarBiblioteca`, `adotarImagem`, `adicionarFoto`, `moverFoto`, `moverPorSeta`, `trocarTamanho`, `trocarOrientacao`, `alterarBordaDaFoto`, `definirPosicao`, `duplicarFoto`, `removerFoto`, `trazerParaFrente`, `enviarParaTras`, `selecionarFoto`, `abrirRecorte`, `concluirRecorte`, `cancelarRecorte`, `alterarBordaPadrao`, `desfazer`, `refazer`. `app/uploadLote.ts`: fila com 3 em paralelo, cancelamento e nova tentativa (sem React). Ids de foto com `ObjectId` da lib `bson` (ADR-07). |
| `infra/` | `ClienteApi`: `listarImagens`, `enviarImagem` (XHR com progresso). `urlArquivoImagem(id, tipo)`. |
| `ui/canvas/` | `cena.ts`: `CenaParede` ganha `fotos`, `selecaoId`, callbacks e o rascunho do recorte; `Palco.tsx`: camada Fotos, seleção, alertas, bounding box, arrasto com snap, `dePaginaParaConteudo`, modo de recorte. |
| `ui/telas/editor/` | `Biblioteca` (real), `DialogoUpload`, `ModoRecorte`, `ToolbarCanvas` e `HeaderEditor` funcionais. |
| `ui/paineis/` | `PainelFoto`, `PainelRecorte`, `PainelComposicao` (contagens e borda padrão). `ui/componentes/proprios/SeletorTamanho`. |

Dependência nova: `bson` (versão do `mongodb` 7.7.0 já instalado, fixada em `apps/web`). Qualquer outra para e pede aprovação.

## 7. Testes

| Tipo | Cobertura |
|---|---|
| Unitário (domínio) | Tamanhos (orientação, quadrado, personalizado = sugerido, limites); geometria (externo, caixa, bounding box, snap, próxima linha, setas); alertas (encostar ≠ sobrepor, tolerância, prioridade parede × área); recorte (*cover*, offsets, sem sobra, arrasto); composição (criar foto, cascata, drop, duplicar, ordem, tamanho/borda mantendo o canto, recorte recentralizado); histórico (limite 100, registrar limpa o refazer, desfazer/refazer, por chave). Cobertura do domínio ≥ 90%. |
| API (integração) | Upload (perfis, EXIF, miniatura 256, orientação natural, 415/413/400/404, nome sem pasta, `projetos`); listagem e ordem; arquivo (cabeçalhos, 404); *hard save* (422 sem escala, imagem inexistente, `_id` repetido; `imagens.projetos` atualizado e sem duplicar). |
| Web (Vitest) | Store (adicionar com borda padrão e tamanho natural, mover, trocar tamanho/orientação mantendo o canto, borda, duplicar, ordem, remover, desfazer/refazer por passo, recorte em 1 passo, histórico não mexe em `documento`); fila de upload (3 em paralelo, falha sem parar, cancelar, tentar de novo, ignorados); Biblioteca (filtros, seleção, duplo clique); `DialogoUpload`; `PainelFoto`; `PainelRecorte`; `PainelComposicao`; toolbar e header (estados inativos por estado); `Editor` com o palco trocado por um marcador. |
| E2E (Playwright) | (1) enviar lote pelo diálogo (perfil, progresso, ignorados, falha), conferir a biblioteca e recarregar; (2) adicionar por botão e por arrastar da biblioteca; (3) mover com snap (X/Y múltiplos de 5 — aceite 4) e setas; (4) 20 × 30 retrato mede 20 × 30 cm na tela (±1 px — aceite 1) e 10 × 15 com borda 2 cm mede 14 × 19 externo (aceite 2); (5) personalizado 21,0 × 29,7 aceito e 4,9 / 150,1 rejeitados (2a); (6) orientação (3); (7) sobreposição e fora da área; (8) recorte (Concluir, Esc); (9) desfazer/refazer; (10) salvar, recarregar, mesmo estado (7); (11) imagem do projeto A aparece na biblioteca do B (10); (12) rede: nenhuma requisição externa nos fluxos novos. |

## 8. Critérios de aceite do M2

1. Upload individual e em lote (arquivos, pasta e arrastar) com perfil escolhido antes do envio, progresso por arquivo, falhas listadas sem interromper e cancelamento (RF-20, RF-21, RF-25, DV-10); arquivos não suportados ignorados com a contagem (PRD aceite 9).
2. A biblioteca mostra nome e orientação natural; os filtros Todas, Projeto e Variante funcionam; uma imagem carregada no projeto A aparece na biblioteca do projeto B (PRD aceite 10).
3. Adicionar por botão e por arrastar; mover por mouse e setas; selecionar, duplicar, remover e mudar a ordem.
4. **PRD aceite 1:** foto 20 × 30 retrato sem borda mede 20 × 30 cm na escala (±1 px). **Aceite 2:** 10 × 15 com borda de 2 cm tem tamanho externo 14 × 19 cm. **Aceite 2a:** 21,0 × 29,7 aceito; 4,9 e 150,1 rejeitados. **Aceite 3:** alternar orientação inverte largura e altura mantendo o canto (RN-05).
5. **PRD aceite 4:** com snap ligado e passo 5 cm, X e Y de qualquer foto solta são múltiplos de 5 cm.
6. Borda em cm e cor; borda padrão vale para as novas fotos.
7. Modo de recorte: arrastar a imagem, Concluir (1 passo), Esc cancela; personalizado igual a sugerido vira o sugerido.
8. Sobreposição, "Fora da parede" e "Fora da área útil" aparecem como na §3.3 sem bloquear; bounding box e "Área total" corretos.
9. Desfazer e refazer cobrem as ações da M2-03; um passo por intenção; `Ctrl+Z`.
10. **PRD aceite 7:** salvar, fechar e reabrir restaura fotos, posições, tamanhos, bordas e recortes; o servidor recusa fotos sem escala ou com imagem inexistente.
11. `typecheck`, `lint`, `format:check`, `test` e `e2e` verdes; cobertura do domínio ≥ 90%; nenhuma requisição externa.

## 9. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Documentação (spec, PRD v0.12, ARCHITECTURE v0.8 com §6 atualizada), constantes e dependência `bson` | — |
| T2 | Testes (vermelhos) de domínio, API e store | T1 |
| T3 | Domínio: tamanho, geometria, alertas, recorte, composição, histórico | T2 |
| T4 | API: imagens (upload, listagem, arquivo) e *hard save* com fotos | T2, T3 |
| T5 | Web: cliente, store (biblioteca, fotos, histórico), fila de upload | T3, T4 |
| T6 | Web: Palco (camada Fotos, seleção, alertas, bounding box, arrasto, snap, drop) | T5 |
| T7 | Web: Biblioteca e `DialogoUpload` | T5 |
| T8 | Web: `PainelFoto`, `SeletorTamanho`, modo de recorte, `PainelComposicao`, toolbar, header, barra de status | T6 |
| T9 | E2E, README, `MEMORY.md` | todas |

## 10. Forma de trabalho

TDD como no M1: os testes de domínio, API e store entram primeiro, vermelhos (`test(m2): …`), depois a implementação em verde (`feat(m2): …`); os testes de componente e os E2E são escritos junto das telas. `typecheck`, `lint`, `format:check`, `test` e `e2e` verdes ao fim. Os pontos de validação com o Nicholas ficam para o fim (aceite do M2), como no M1.

## 11. Alterações em outros documentos

| Documento | Alteração |
|---|---|
| `docs/PRD.md` v0.12 | RF-13 (incluir fotos = carregar e posicionar), RN-16 (snap e Shift), RN-18 (o que entra no desfazer; 100 passos), RF-20 (fila com envio explícito), novo RN-36 (alertas: tolerância e sobreposição) |
| `docs/ARCHITECTURE.md` v0.8 | ADR-03 (histórico próprio, sem `zundo`); §6 com as pastas e arquivos novos; ADR-05 (miniatura de 256 px) |
| `docs/DESIGN.md` v0.4 | §7: painel da foto, modo de recorte e diálogo de envio como implementados (envio explícito, diverge do protótipo 07) |
| `MEMORY.md` | Decisões M2-01 a M2-09, status |

## 12. Registro da implementação (25/10)

**Forma de trabalho.** Como no M1: a spec e os testes de domínio, API e store entraram primeiro, vermelhos (`test(m2): …`); a implementação seguiu em verde (`feat(m2): …`). Os testes de componente e os E2E foram escritos junto das telas, não antes.

| Item | Resultado |
|---|---|
| Testes | Vitest: domínio (tamanho, geometria, alertas, recorte, composição, histórico; cobertura 97,4% das instruções e 93,5% dos ramos), API (imagens, salvamento com fotos), web (store, fila de upload, filtros, painéis da foto e do recorte, biblioteca, diálogo de envio, teclado, recorte). Playwright: `biblioteca.spec.ts` e `composicao.spec.ts` cobrem os aceites 1, 2, 2a, 3, 4, 7, 9 e 10 do PRD, os alertas, o recorte e a rede. O aceite 5 (recalibrar mantém as fotos) tem teste de API. O aceite 12 (desfazer na variante A não altera a B) fica **parcial**: a pilha é por variante, mas a independência só é verificável no M3, com mais de uma variante. |
| Orçamento de arrasto (RNF-03) | Sonda do Playwright (`desempenho.spec.ts`): com 40 fotos de 10 × 15 cm e borda, o arrasto longo mede **60 fps** (quadro médio 16,7 ms, p95 16,7 ms) no Chromium headless da máquina de desenvolvimento; o teste só guarda contra regressões grosseiras (média ≤ 33 ms). |
| Dependências novas | `bson` 7.3.3 (ADR-07; a mesma versão que o driver do MongoDB já instala) para os ids das fotos no navegador. `zundo` **não** entrou (M2-02, ADR-03 revista). |
| Desempenho | O pacote JS da web foi de ~917 kB para ~1.016 kB (o `bson` entra no pacote principal; sem divisão de código, como já pendia no M1). |

**Decisões de implementação** (o que a spec não fixava):

- Os instantâneos do desfazer são as próprias estruturas imutáveis do Immer (compartilham estrutura): não há cópia profunda, e comparar o conteúdo antes e depois (JSON) evita registrar passos sem mudança (mover para o mesmo lugar, concluir recorte sem alteração).
- Desfazer e refazer só valem no modo Editor; trocam o conteúdo (fotos, área útil, borda padrão), soltam a seleção que sumiu e marcam "Alterações não salvas". Refazer não devolve a seleção.
- "Confirmar área" continua marcando a variante como alterada mesmo com a área igual à gravada (M1 §3.6), embora a área útil agora entre no desfazer.
- O gatilho do seletor de tamanho mostra só "20 × 30" (cabe ao lado da Orientação); os campos do painel da foto têm rótulo só para leitores de tela.
- Rótulos do canvas (pills) usam a fonte mono medida por estimativa de largura (6,6 px por caractere a 11 px) e a camada é refeita quando a fonte termina de carregar; o Konva só aceita o mesmo `padding` nos quatro lados.
- A camada de fotos fica entre a área útil e o overlay; no modo Área útil as fotos aparecem sem reagir ao mouse e sem alertas; no modo de recorte, o resto da parede é desenhado normalmente, esmaecido pelo véu do quadro.
- O modo de recorte reaproveita o `LayoutModo` (painel de 340 px) com uma barra só de identificação, sem botões (DESIGN §7.0).
- `Esc` que já fechou um menu ou seletor (Radix) não cancela mais o modo aberto (`defaultPrevented`).
- O gancho de teste do palco ganhou `dePagina`, `retanguloDaFoto(id)` e `idsDasFotos()`.
- Os E2E compartilham o banco `parede-fotos-test` e a biblioteca é global: os testes não assumem biblioteca vazia e escolhem a miniatura mais recente.

**Limitações conhecidas / pendências do M2:**

- Soltar pastas arrastadas depende de `webkitGetAsEntry` (Chrome/Edge); "Selecionar pasta" usa `webkitdirectory`.
- O limite de 50 MB do upload continua fixo no browser (o servidor respeita `UPLOAD_MAX_MB`).
- Sem coalescer setas repetidas: cada toque de seta é um passo do desfazer (limite de 100 por variante).
- Pacote JS de ~1 MB sem divisão (pendente desde o M1).
- Decisões M2-01 a M2-09 e premissas B-01 a B-15: revisar (principalmente M2-01 — upload só com escala; M2-03 — grid fora do desfazer; M2-07 — envio explícito).

