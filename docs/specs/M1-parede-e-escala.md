# Especificação M1 — Parede e escala

| Campo | Valor |
|---|---|
| Versão | 0.3 |
| Data | 2026-10-24 |
| Base | `docs/PRD.md` v0.11 · `docs/ARCHITECTURE.md` v0.7 · `docs/DESIGN.md` v0.3 + protótipos 01, 02, 04, 04a, 05, 11, 13 · `docs/specs/M0-setup.md` v0.6 |
| Status | **Implementada (24/10); aguardando a validação do Nicholas** — testes escritos antes (commit vermelho) e implementação em seguida; ver §12. |

## 0. Pré-requisitos

| # | Item | Bloqueia | Situação |
|---|---|---|---|
| PR-M1-01 | **Aceite do M0**: validação visual de `/dev/ui` e das cascas (T6d, T10; aceites 10 e 11 do M0) e commits por tarefa do M0. | T1 | ✅ 24/10 (M0 aceito; commit `M0 implementado`) |
| PR-M1-02 | Lacunas e contradições da §0.1 decididas. | T1 | ✅ 24/10 |
| PR-M1-03 | Revisão das premissas da §0.2 pelo Nicholas. | T1 | ✅ 24/10 |

### 0.1 Decisões desta especificação (lacunas e contradições resolvidas)

| # | Lacuna ou contradição | Decisão (24/10) |
|---|---|---|
| M1-01 | Grid e área útil são da variante e só gravam no salvamento da variante (SV-09), que estava no M3. Sem salvamento, o M1 não persistiria nada da variante. | **Salvamento manual (*hard save*) antecipado para o M1**: botão "Salvar", `Ctrl+S`, status "Salvo" / "Alterações não salvas" / "Conflito", aviso do browser ao fechar com alterações e resposta 409 com aviso simples (§3.8). Rascunho (*soft save*), recuperação (SV-07) e o diálogo de conflito completo (SV-05) seguem no M3. |
| M1-02 | O header tem "Perspectiva" e "Calibrar". Não estava definido o que "Calibrar" faz com a perspectiva já aplicada. | **"Calibrar" fica inativo com a perspectiva aplicada**, com tooltip "Com a perspectiva aplicada, use Perspectiva para refazer a escala.". Calibração linear só existe para quem pulou a perspectiva. O caminho inverso é permitido: com escala linear, "Perspectiva" substitui a linear (RN-10: valores em cm preservados). |
| M1-03 | "Margem +100%" (ADR-04) era ambígua (50% ou 100% por lado?), e "parede inteira" (RN-33) não estava definida para a vista retificada. | **Retificar a foto inteira**: projeção dos 4 cantos da foto no plano da parede, cortada em até **+100% de L e +100% de A em cada lado** do retângulo de referência (no máximo 3L × 3A). Fora da foto, o bitmap fica transparente. **Parede inteira** = retângulo envolvente da região com pixels da foto, em cm. Com escala linear, parede inteira = a foto toda. |
| M1-04 | A RN-18 põe as mudanças da parede no desfazer da variante ativa, mas a parede é do projeto, comum a todas as variantes, e grava ao confirmar (SV-09). | **A parede fica fora do desfazer**: upload, troca, perspectiva e calibração têm Cancelar no próprio modo e gravam ao confirmar. A área útil, que é da variante, entra no desfazer (implementado no M2). RN-18 ajustada no PRD. |
| M1-05 | O perfil da parede é definitivo e trocar a parede (RF-04) era ideia futura. Uma foto errada só se resolvia excluindo o projeto. | **Trocar a parede enquanto nenhuma variante tem fotos**: o botão "Parede" fica ativo nesse caso. A troca pede confirmação e descarta escala, vista retificada e áreas úteis. Com fotos, o botão volta a ser inativo com o tooltip padrão. Manter as fotos posicionadas ao trocar (RF-04) continua ideia futura. |
| M1-06 | O fluxo após o upload da parede não estava definido. | **O upload abre direto o modo Perspectiva**, com o link "Pular e usar calibração linear". Cancelar volta ao editor com a parede e o aviso de escala pendente. |
| M1-07 | Não estava definido se a área útil encaixa no grid. | **A área útil é livre**, com precisão de 0,1 cm (RN-27). O snap só vale para fotos (M2). |
| M1-08 | Não estava definido o efeito de Cancelar no primeiro modo Área útil. | **Fica a parede inteira**: a primeira escala já grava a área útil = parede inteira (§3.6). Cancelar só descarta o ajuste. Depois que há escala, a área útil nunca fica vazia. |

Contradições menores, corrigidas sem decisão nova:
- O protótipo 02 mostra um header antigo (sem "Área útil") e o texto "As 48 fotos de outros projetos já estão disponíveis". Vale o header da DESIGN §7. A biblioteca entra no M2 (DS-02: a documentação prevalece sobre o protótipo).
- O protótipo 13 diz "a partir do canto superior esquerdo da parede". Vale a IC-01: "Medido a partir da origem 0,0 (canto do retângulo de referência)." Com escala linear: "(canto superior esquerdo da foto)".
- O protótipo 04a mostra a prévia com as medidas do retângulo ("80,0 × 210,0 cm"). A prévia mostra **só o retângulo de referência**, não a margem.
- A ARCHITECTURE ainda dizia "Base: PRD v0.6" e "próxima etapa: modelo de dados". Cabeçalho atualizado.

### 0.2 Premissas (revisadas pelo Nicholas em 24/10)

Valores e comportamentos que os documentos não fixavam. Todas foram revisadas; as marcadas com **(alterada)** mudaram na revisão.

| # | Premissa |
|---|---|
| A-01 | Rotas da web: `/` = Projetos, `/projetos/<id>` = Editor. Saem `/editor` (casca do M0) e `/dev/spike-konva` (MEMORY: removível após o M1). `/dev/ui` fica. |
| A-02 | **(alterada)** "Novo projeto" cria na hora o projeto "Projeto sem nome" e abre o editor no estado vazio. O nome muda pelo menu ⋯ da lista ou clicando no nome no header do editor (edição inline: Enter grava, Esc cancela). Regras do nome: 1–100 caracteres, sem espaços nas pontas; nome repetido é permitido. |
| A-03 | Lista sem projetos: estado vazio "Nenhum projeto ainda" + botão primário "Novo projeto". |
| A-04 | Meta do card: "1 variante · editado hoje, 14:35", "editado ontem, 09:10" ou "editado em 12/10" (com ano, "12/10/2025", se for de outro ano); sem parede: "1 variante · parede não definida". O indicador de placeholders entra no M4. |
| A-05 | Renomear (lista ou header) não usa revisão (vale a última gravação) e atualiza `atualizadoEm`. |
| A-06 | Zoom: 100% = 1 px do bitmap da parede por px de tela (CSS). Limites: de 10% (ou metade do "Ajustar à tela", o que for menor) até 800%. A roda dá zoom no ponto do cursor (fator 1,1 por passo). Pan: arrastar o fundo ou a parede, espaço + arrastar ou botão do meio. Abre sempre em "Ajustar à tela"; o viewport não é persistido. |
| A-07 | Grid: linhas a partir da origem 0,0, desenhadas só dentro da parede inteira (RN-34). Se o passo na tela ficar abaixo de 4 px, o grid não é desenhado nesse zoom e o toggle Grid do header mostra o indicador e o tooltip "Grid oculto neste zoom, aproxime para ver". |
| A-08 | Grid **por variante** (modelo M0), padrão: passo 5 cm, visível, snap ligado (RN-15), cor `#1F1B16`, opacidade 0,08 (DESIGN §2.2), `principalACada` 5 (P1, M5). "Outro" passo: 0,5 a 100 cm, passo 0,1. Cores prontas do grid: Tinta `#1F1B16`, Branco `#FFFFFF`, Cinza `#8C8C8C` + "Outra cor…". Opacidade de 0 a 100%, de 1 em 1. |
| A-09 | Medidas do retângulo de referência e comprimento linear: de 10 a 2000 cm, passo 0,1. Abaixo de 100 cm, o aviso RF-14 ganha a frase "Referência menor que 1 m: a precisão diminui." (não bloqueia). |
| A-10 | **(alterada)** Perspectiva, primeira vez: as 4 alças já aparecem prontas, num retângulo a 25% das bordas da foto, e o usuário as arrasta até os cantos reais (lupa durante o arraste). A lista mostra os 4 cantos numerados; se o usuário cruzar as alças, o app as reordena em sentido horário a partir do superior esquerdo. Refazer começa com os cantos e as medidas salvos. Alça ativa: setas movem 1 px da imagem, Shift + seta 10 px. |
| A-11 | Quadrilátero válido: convexo, sem 3 cantos alinhados, área ≥ 1% da foto. Inválido: polígono em `danger`, mensagem "Os cantos precisam formar um quadrilátero." e "Aplicar" desabilitado. |
| A-12 | **(alterada)** Segmento linear pronto, como na A-10: horizontal, no centro da foto, com metade da largura; o usuário arrasta as duas pontas (lupa durante o arraste). Mínimo de 20 px da imagem. Rótulo com o comprimento em px sobre o segmento. Recalibrar começa com o segmento salvo. |
| A-13 | Área útil: mínimo 5 cm por lado; as alças e os campos ficam limitados à parede inteira (campo fora do limite mostra a faixa válida e não aplica). Arrastar o interior move o retângulo. |
| A-14 | Painel direito: os campos L, A, X, Y da "Área útil desta variante" são editáveis (Enter ou sair do campo aplica, com as regras de A-13). "Ajustar" abre o modo Área útil. |
| A-15 | **(alterada)** Snap (header) e "Encaixar no grid" (painel) já funcionam no M1: ligam e desligam e o estado é salvo na variante, mas não têm efeito na tela até o M2 (a área útil é livre — M1-07). Controles do M2 em diante ficam visíveis e inativos (DESIGN §7.1): Desfazer/Refazer, Borda padrão, Adicionar/Duplicar/Trazer para frente/Enviar para trás, seletor de variante, Comparar, Templates, Exportar, Carregar fotos, filtros e busca da biblioteca. |
| A-16 | Controles que dependem do estado (não de versão futura) usam o mesmo padrão inativo (`aria-disabled` + tooltip), com tooltip próprio: Perspectiva/Calibrar sem parede ("Carregue a foto da parede primeiro."), Área útil sem escala ("Defina a escala primeiro."), Calibrar com perspectiva (M1-02). |
| A-17 | **(alterada)** A miniatura do card (400 px) sai sempre da **foto original** da parede (já com EXIF), gerada no upload e na troca. Não muda ao aplicar ou refazer a perspectiva (revê parte do DV-07). |
| A-18 | Não há transações (o MongoDB local roda *standalone*). Gravações em mais de uma coleção usam compensação: criar projeto + "Base" desfaz o projeto se a variante falhar; excluir projeto apaga na ordem variantes → rascunhos → arquivos → projeto. Na inicialização, a API corrige restos de falha: projeto sem variante ganha a "Base"; variantes e rascunhos de projeto inexistente são apagados. |
| A-19 | **(alterada)** Arquivos da parede servidos com `Cache-Control: no-cache` e `ETag` (revalidação a cada carga, resposta 304 quando não mudou), porque o nome do arquivo não muda na troca nem ao refazer a perspectiva. |
| A-20 | Voltar para Projetos com alterações não salvas abre o diálogo "Sair sem salvar?" com **Salvar e sair** (primário), **Sair sem salvar** e **Cancelar**. |

## 1. Objetivo

Entregar o início do fluxo do usuário: criar e gerenciar projetos, carregar a foto da parede, definir a escala por perspectiva (principal) ou por calibração linear, definir a área útil, ver a parede no canvas com grid, zoom e pan, e salvar a variante. Ao fim do M1, um projeto reaberto mostra a parede retificada na escala certa, com grid e área útil.

## 2. Escopo

| Dentro | Fora (marco) |
|---|---|
| Projetos: listar, criar (com "Base"), abrir, renomear, excluir — RF-90, RN-17, RN-23 | Busca de projetos (RF-33b, ideia futura) |
| Upload da parede com perfil, EXIF e troca sem fotos — RF-01, RF-02, RF-07, RF-25, M1-05 | Trocar a parede mantendo fotos (RF-04, ideia futura) |
| Perspectiva com lupa, prévia sob demanda e retificação em Worker — RF-05, RF-06, RF-14, RN-07, RN-09, RN-10 | Distorção de lente (fora da v1) |
| Calibração linear — RF-10, RF-12, RN-08, M1-02 | Calibração pela largura da parede (RF-11, ideia futura) |
| Área útil da variante Base — RF-94, RN-33, RN-35 (parcial) | Cópia da área útil entre variantes (M3) |
| Grid: visível, passo, cor, opacidade — RF-50, RF-51, RN-15 | Snap (RF-53, efeito no M2); linha forte (RF-52, M5) |
| Canvas Konva com zoom, pan e "Ajustar à tela" — RF-03 | Fotos, biblioteca, borda, medidas, sobreposição (M2) |
| Salvamento manual da variante — RF-72, SV-02, SV-08 parcial, M1-01 | Rascunho, recuperação e diálogo de conflito (RF-71, RF-73 — M3); desfazer (RF-70 — M2) |
| Bloqueio de fotos sem escala — RF-13 (estado visível; a inclusão em si é M2) | Variantes, templates, comparação (M3); exportação, ciclo de vida das imagens (M4) |

## 3. Comportamento

### 3.1 Tela Projetos (protótipo 01)

- Grade de cards por `atualizadoEm` decrescente. Card: miniatura da parede (A-17) ou ícone + "Sem foto da parede"; nome (Newsreader); meta (A-04); menu ⋯ com **Renomear** e **Excluir** (texto `danger-ink`).
- Clique no card abre `/projetos/<id>` na `ultimaVarianteId` (no M1, sempre a "Base").
- **Novo projeto** (primário, 40 px): `POST /api/projetos` → editor no estado vazio com "Projeto sem nome" (A-02).
- **Renomear**: diálogo com o nome atual selecionado; mesmas regras de A-02. No editor, clicar no nome do projeto no header edita inline.
- **Excluir** (RN-17): diálogo destrutivo "Excluir “<nome>”?" com o texto "As variantes e a foto da parede deste projeto serão apagadas. As fotos da biblioteca continuam disponíveis." e o botão `destructive` "Excluir projeto". Exclusão física em cascata (DM-12).
- Busca: campo inativo (DESIGN §7.1).

### 3.2 Editor — estados

| Estado | Canvas | Painel direito | Header |
|---|---|---|---|
| **Sem parede** (protótipo 02) | Bloco "Comece pela parede": *dropzone* "Arraste a foto da parede aqui · JPG, PNG ou WEBP", "Escolher arquivo", segmented **Qualidade** Leve · Médio · Alto (padrão Leve, RF-25), passos 1 Parede · 2 Escala · 3 Fotos | Composição com valores vazios | Perspectiva, Calibrar, Área útil inativos (A-16) |
| **Parede sem escala** | Foto da parede (EXIF aplicado), sem grid; `Alert` de aviso "Defina a escala da parede para posicionar fotos." com "Corrigir perspectiva" (primário) e "Calibrar com uma medida" | Escala: "Não definida" | Área útil inativo |
| **Com escala** | Parede (retificada ou não) em cm, grid, área útil (DESIGN §2.2), rótulo "0,0" na origem | Composição completo (§3.7) | Tudo do M1 ativo |

Coluna Biblioteca no M1: título, contador oculto, "Carregar fotos", busca e filtros inativos (A-15); enquanto não há escala, o texto "As fotos ficam disponíveis depois que a escala da parede for definida." (RF-13). O aviso "Defina a escala da parede para posicionar fotos." fica só no `Alert` do canvas (§3.2), para não repetir a frase na tela.

Header (DESIGN §7 e protótipo 03a): no M1 funcionam voltar (A-20), nome do projeto (edição inline, A-02), Área útil, Perspectiva, Calibrar, chip de escala, Parede (M1-05), Grid, Snap (A-15) e Salvar. O status de salvamento fica só na barra de status (o texto completo não cabe no header). Em 1280 px, Área útil, Perspectiva, Calibrar e Parede ficam no menu "Parede ▾".

### 3.3 Upload e troca da parede

1. Arquivo por seleção ou *drag-and-drop*. No browser: aceitos JPG, PNG e WEBP até `UPLOAD_MAX_MB`. Os demais (inclusive HEIC — RF-15) são recusados com "Formato não suportado. Use JPG, PNG ou WEBP." ou "Arquivo maior que 50 MB.".
2. `PUT /api/projetos/:id/parede` (multipart: arquivo, perfil, `revisaoBase`) com barra de progresso (DESIGN §6).
3. Servidor (sharp): `rotate()` (EXIF, RF-02), redimensiona ao lado maior do perfil (`PERFIS[perfil].ladoParedePx`, sem ampliar), WebP na qualidade do perfil, miniatura de 400 px; grava de forma atômica `paredes/<projetoId>.webp` e `.thumb.webp`; `parede.escala = { metodo: null }`.
4. A web abre o **modo Perspectiva** (M1-06).

**Troca (M1-05):** botão "Parede" ativo se nenhuma variante do projeto tem fotos (`fotos.length = 0` em todas). Exige não haver alterações sem salvar ("Salve as alterações antes de trocar a parede."). Diálogo: "Trocar a foto da parede? A escala e a área útil serão descartadas." → mesmo fluxo de upload. O servidor recusa com 409 se alguma variante tiver fotos; apaga a retificada; põe `areaUtil = null` nas variantes (`revisao + 1`). Com fotos, o botão é inativo com o tooltip padrão (RF-04).

### 3.4 Modo Perspectiva (protótipos 04 e 04a)

- Barra escura (DS-05): "Correção de perspectiva · Marque os quatro cantos de um retângulo real da parede" · Cancelar · **Aplicar**. Canvas `stage-dark` com a foto da parede **sem retificação**, zoom e pan (A-06).
- Cantos (A-10, A-11): 4 alças prontas de 18 px (DESIGN §2.2), número do canto em pill, polígono `accent` a 12%; lista "Cantos 4 de 4" (1 Superior esq. · 2 Superior dir. · 3 Inferior dir. · 4 Inferior esq.); dica "Arraste as alças para ajustar. Use a roda do mouse para zoom.".
- **Lupa** (DESIGN §2.2): 160 px, 4×, mira em cruz; aparece ao arrastar uma alça, no canto oposto ao cursor.
- **Medidas reais**: Largura e Altura em cm (A-09); aviso RF-14 sempre visível: "Medidas assumem parede plana. Prefira referências com 1 m ou mais.".
- **Prévia frontal** (RF-06, DV-06): estados Vazio → Gerando → Pronta ("Gerada às hh:mm · L × A cm") → Desatualizada (prévia esmaecida + "Os cantos mudaram" + "Gerar prévia" de novo). Gerada no Worker a partir da parede reduzida; saída de ~320 px de largura **só do retângulo de referência**; não é persistida nem enviada à API. Os cantos podem ser ajustados durante a geração; o resultado chega já desatualizado se eles mudarem.
- Nota: "A origem das medidas é o canto superior esquerdo do retângulo marcado." (RN-07).
- Link "Pular e usar calibração linear" → modo Calibração. Só aparece se a escala atual não for de perspectiva (M1-02).
- **Aplicar**: indicador "Aplicando perspectiva…" (Cancelar aborta o Worker) → retificação completa (§4.2) → `PUT /api/projetos/:id/parede/escala` → se for a primeira escala, abre o modo Área útil; senão, volta ao editor. Se alguma área útil ficar fora da parede inteira (RN-35), aparece o aviso "A área útil ficou fora da parede. Ajuste em Área útil." com o botão "Ajustar".
- Esc cancela e mantém a escala anterior. Enter aplica (se válido).

### 3.5 Modo Calibração linear (protótipo 05)

- Barra: "Calibração linear · Trace um segmento sobre algo de comprimento conhecido" · Cancelar · **Aplicar escala**. Canvas com a foto **sem retificação**.
- Segmento pronto (A-12) com alças de 18 px e lupa; rótulo "520 px".
- **Comprimento real** em cm (A-09); "Escala resultante 4,0 px/cm" ao vivo.
- Avisos: "Sem correção de perspectiva, a escala só é precisa no plano do segmento." + RF-14. Nota: "Recalibrar mantém posição e tamanho das fotos em centímetros." (RN-10).
- Link "Usar correção de perspectiva" → modo Perspectiva.
- Aplicar → `PUT …/parede/escala` (linear) → primeira escala abre o modo Área útil.
- Disponível só sem perspectiva aplicada (M1-02).

### 3.6 Área útil (protótipo 13, RN-33 a RN-35)

- **Primeira escala** (de `metodo: null` para perspectiva ou linear): o servidor grava `areaUtil = parede inteira` nas variantes com `areaUtil = null`, na mesma requisição (`revisao + 1`), e devolve as novas revisões. A web abre o modo Área útil sobre esse valor. Cancelar mantém a parede inteira (M1-08).
- **Refazer a escala** (perspectiva de novo, ou linear → perspectiva): a área útil mantém os valores em cm (RN-10, RN-35); se sair da parede inteira, aviso (§3.4).
- **Modo**: barra "Área útil" com subtítulo conforme o contexto ("Perspectiva aplicada. Agora defina onde as fotos podem ficar." / "Escala aplicada. Agora defina onde as fotos podem ficar." / "Ajuste onde as fotos podem ficar."), Cancelar, **Confirmar área**. Retângulo tracejado com 8 alças de 12 px, exterior `ink` a 55%, rótulo "Área útil · L × A cm", grid visível. Painel: Largura, Altura, X, Y (`CampoCm`), "Usar a parede inteira", nota da origem (§0.1), "Cada variante tem a sua área útil.". Dica: "Arraste os cantos ou os lados · Enter confirma · Esc cancela".
- Livre a 0,1 cm (M1-07), limites de A-13.
- Confirmar altera a variante (status "Alterações não salvas"). O desfazer da área útil entra no M2 (M1-04).
- No editor: contorno tracejado `ink-2`, exterior `paper` a 50%, rótulo acima à esquerda. Nada sai na exportação (M4).

### 3.7 Painel Composição (protótipo 11)

| Seção | M1 |
|---|---|
| Composição | Fotos 0; Área total "—"; sobreposições e "sem foto" ocultos até o M2/M4 |
| Escala | Método ("Perspectiva" / "Linear" / "Não definida"), escala (`ChipEscala`, "4,0 px/cm"), **Recalibrar** (abre o modo do método atual) |
| Área útil desta variante | L, A, X, Y editáveis (A-14) + **Ajustar** |
| Borda padrão para novas fotos | Visível, inativa (M2) |
| Grid | Mostrar grid (`Switch`), Encaixar no grid (`Switch`, sem efeito até o M2 — A-15), Passo (1 · 2 · 5 · 10 · Outro — A-08), Linha forte a cada (inativo, M5), Opacidade, Cor das linhas (`SeletorCor` com as cores de A-08) |

Escala exibida: com perspectiva, `retificada.pxPorCm`; com linear, px da foto por cm.
Mudanças de grid (painel ou toggle do header) alteram a variante.

### 3.8 Salvamento manual da variante (M1-01)

- `sessaoId` gerado por aba ao abrir o projeto (`crypto.randomUUID()`); `revisaoBase` = revisão carregada ou gravada por último.
- Alterações da variante no M1: `grid` e `areaUtil`. Mudam o status para "Alterações não salvas" (ponto âmbar).
- **Salvar** e `Ctrl+S` (inclusive dentro de campo): `PUT /api/projetos/:pid/variantes/:id` com `{ sessaoId, revisaoBase, grid, bordaPadrao, areaUtil, fotos }`. Sucesso: "Salvo hh:mm" e `revisaoBase` atualizada. Também atualiza `projetos.atualizadoEm` e `ultimaVarianteId`.
- **409** (outra aba salvou antes): status "Conflito" e `Alert` "Esta variante foi salva em outra aba às hh:mm. Recarregue para ver a versão salva." com o botão "Recarregar" (descarta as alterações locais). As três opções da SV-05 entram no M3.
- Alterações na parede (§3.3–3.5) gravam ao confirmar, no projeto, com checagem de `projetos.revisao` (SV-09). Em 409, o mesmo `Alert` com "Este projeto foi alterado em outra aba.".
- `beforeunload` com alterações não salvas (SV-08). Salvar em andamento desabilita o botão e mostra "Salvando…".

### 3.9 Canvas

- Camadas (ADR-02): **Parede** (`Konva.Image`, cacheada, em cm: posição `origemCm`, tamanho `larguraPx / pxPorCm`) · **Grid** (1 `Shape` com `sceneFunc`, só as linhas visíveis, `strokeScaleEnabled = false`) · **Overlay** (área útil, rótulo de origem, alças dos modos). A camada Fotos entra no M2.
- Sem escala, a parede é desenhada em px da imagem (1 unidade = 1 px), sem grid.
- Toolbar: zoom − / % / +, "Ajustar à tela" (A-06); demais botões inativos (A-15).
- Ao redor da parede: `--color-stage`; nos modos Perspectiva e Calibração: `--color-stage-dark`.
- **Gancho de teste:** o Palco publica `window.__deco.paraTela(x, y)`, que converte um ponto do conteúdo atual (px da foto nos modos Perspectiva e Calibração; cm no editor e na Área útil) em coordenadas da página. Os E2E usam o mouse real do Playwright para arrastar alças que não existem no DOM. Só existe com o enquadramento pronto.
- Alças, rótulos e lupa ficam numa segunda camada em px de tela (tamanho constante em qualquer zoom); a cena (parede, grid, área útil) fica na camada em unidades do conteúdo.

## 4. Domínio e algoritmos

### 4.1 Módulos novos em `packages/domain` (TS puro, testes obrigatórios)

| Módulo | Funções |
|---|---|
| Homografia | `calcularHomografia(origem[4], destino[4])` (DLT 8×8, eliminação de Gauss com pivô), `aplicarHomografia(H, pt)`, `inverterHomografia(H)` |
| Quadrilátero | `ordenarCantos(pts)` (horário a partir do sup.-esq.), `validarQuadrilatero(pts, areaImagemPx)` → `ok` ou motivo (A-11) |
| Escala linear | `pxPorCmLinear(p1, p2, comprimentoCm)`, `homografiaLinear(pxPorCm)` (`H = escala(1/pxPorCm)`) |
| Retificação | `calcularRetificacao({ cantosPx, larguraCm, alturaCm, larguraImagemPx, alturaImagemPx, ladoMaxPx })` → `{ homografia, origemCm, larguraPx, alturaPx, pxPorCm, paredeInteiraCm }` (§4.2) |
| Warp | `retificarPixels(origem: { dados, largura, altura }, Hdestino→origem, larguraPx, alturaPx)` → RGBA bilinear com alfa 0 fora da foto (só `Uint8ClampedArray`, sem API do browser) |
| Parede inteira | `paredeInteira(parede)` → `AreaUtil` (de `retificada` ou da foto com escala linear) |
| Área útil | `limitarAreaUtil(area, paredeInteira)` (A-13), `areaUtilForaDaParede(area, paredeInteira)` |
| Grid | `linhasVisiveis({ passoCm, limitesCm, janelaCm, pxPorCmTela })` → `{ xs, ys }` vazio abaixo de 4 px (A-07) |
| Viewport | `zoomNoPonto(viewport, fator, pontoTela)`, `ajustarATela(conteudoCm, telaPx, margemPx)`, `limitarZoom` (A-06) |
| Formatadores | `formatarEditadoEm(data, agora)` (A-04) |
| Constantes | `GRID_PADRAO` completo (A-08), `MARGEM_RETIFICACAO = 1` (100% por lado), `LIMITES_REFERENCIA_CM = { min: 10, max: 2000 }`, `AREA_UTIL_MIN_CM = 5`, `THUMB_PAREDE_PX = 400`, `PREVIA_LARGURA_PX = 320`, `ZOOM = { min: 0.1, max: 8, passo: 1.1 }` |

### 4.2 Retificação (ADR-04, M1-03)

1. `H` (imagem → mundo, cm) leva os 4 cantos ordenados a `(0,0) (L,0) (L,A) (0,A)`.
2. **Região**: contorno da foto (bordas amostradas, para tratar pontos que vão ao infinito) projetado por `H`, intersectado com a caixa `[−L, 2L] × [−A, 2A]`. Pontos com `w ≤ 0` (atrás do horizonte) são descartados; a caixa limita o resultado.
3. **Parede inteira** = retângulo envolvente da região, arredondado a 0,1 cm (DM-08). `origemCm` = canto sup.-esq. desse retângulo (pode ser negativo).
4. **Resolução**: `pxPorCm = ladoMaxPx / max(larguraCm, alturaCm)` da parede inteira, com `ladoMaxPx = PERFIS[perfil].ladoParedePx` (nunca acima da densidade da foto original no retângulo de referência, para não ampliar à toa).
5. **Warp** no Worker: para cada pixel de destino, `H⁻¹` → amostra bilinear na foto; fora da foto, alfa 0.
6. Codificação no Worker: `OffscreenCanvas.convertToBlob({ type: 'image/webp', quality })` com a qualidade do perfil.
7. O **servidor recalcula** `H` e a geometria com as mesmas funções do domínio a partir de `cantosPx`, medidas e dimensões da parede (fonte da verdade). Ele confere as dimensões do bitmap enviado (±1 px; senão 422), grava `paredes/<id>.retificada.webp` e grava `parede.escala` e `parede.retificada`.

Desempenho: perfil Alto (6144 px) ≤ 3 s no Chromium (ARCHITECTURE §8). Medido: Leve 0,7 s ✓; Alto (28 MP) 3,0–3,2 s, com o gargalo na codificação WebP e não no warp — ver **ADR-16** (plano B de WebGL descartado; opções de redução para o Nicholas decidir).

## 5. API (M1)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /api/projetos` | — | `[{ _id, nome, atualizadoEm, qtdVariantes, temParede, thumbUrl \| null }]` por `atualizadoEm` desc |
| `POST /api/projetos` | `{ nome? }` (padrão "Projeto sem nome") | 201 `{ projeto, variantes: [Base] }` (A-02, A-18) |
| `GET /api/projetos/:id` | — | `{ projeto, variantes }` (variante completa; no M1, só "Base") |
| `PATCH /api/projetos/:id` | `{ nome }` | 200 projeto (A-05) |
| `DELETE /api/projetos/:id` | — | 204; cascata DM-12 + retira o id de `imagens.projetos` |
| `PUT /api/projetos/:id/parede` | multipart: `arquivo`, `perfil`, `revisaoBase` | 200 `{ projeto, variantesAlteradas }` · 409 revisão ou variante com fotos · 413 tamanho · 415 formato |
| `PUT /api/projetos/:id/parede/escala` | linear: JSON `{ revisaoBase, metodo: 'linear', linear }` · perspectiva: multipart `dados` (JSON `{ revisaoBase, metodo: 'perspectiva', perspectiva }`) + `retificada` | 200 `{ projeto, variantesAlteradas: [{ _id, revisao, areaUtil }] }` · 409 · 422 (dados ou bitmap inválidos; linear com perspectiva aplicada — M1-02) |
| `GET /api/projetos/:id/parede/arquivo?tipo=original\|retificada\|thumb` | — | `image/webp` com `ETag`; 304 em `If-None-Match` igual (A-19) |
| `PUT /api/projetos/:pid/variantes/:id` | `{ sessaoId, revisaoBase, grid, bordaPadrao, areaUtil, fotos }` | 200 `{ revisao, salvaEm }` · 409 `{ revisao, salvaEm, salvaPorSessao }` · 400 Zod |

Regras comuns: validação Zod na entrada (schemas de `packages/domain`); erros em `{ erro, detalhes? }` com mensagem em pt-BR; gravação de arquivo atômica (`tmp/` + rename) **antes** do `updateOne` com revisão. Em 409, o temporário é apagado. Arquivos substituídos são apagados depois da gravação no banco.

## 6. Web

| Camada | Entrega |
|---|---|
| `app/` | Store Zustand + Immer (ADR-03): fatia `documento` (projeto, variante ativa, `revisaoBase`, `sujo`, `sessaoId`) e fatia `ui` (modo atual, viewport, estado da prévia). Ações nomeadas: `criarProjeto`, `abrirProjeto`, `enviarParede`, `aplicarPerspectiva`, `aplicarCalibracao`, `definirAreaUtil`, `alterarGrid`, `salvarVariante`. zundo entra no M2. |
| `infra/` | Cliente HTTP das rotas da §5 (com progresso de upload por `XMLHttpRequest`); Worker de retificação (prévia e completa, cancelável). |
| `ui/telas/` | Projetos (dados reais), Editor (estados da §3.2), modos Perspectiva, Calibração e Área útil. |
| `ui/canvas/` | Stage, camadas, alças, lupa, retângulo da área útil. |
| `ui/paineis/` | Composição (§3.7), painéis dos modos. |

Dependências novas, já previstas nas ADRs: `zustand` e `immer` (ADR-03), `bson` (ADR-07, ids no cliente — usado a partir do M2; entra no M1 só se necessário). Versões exatas fixadas na T1 e registradas no `MEMORY.md`. Qualquer outra dependência para e pede aprovação.

## 7. Testes

| Tipo | Cobertura |
|---|---|
| Unitário (domínio) | Homografia (identidade, retângulo conhecido, inversa, `H·H⁻¹ ≈ I`); ordenação e validação de cantos; retificação (cantos da fixture → `(0,0)–(300,200)` ±0,01 cm; caixa +100%; `w ≤ 0`; resolução por perfil); warp (xadrez sintético, alfa fora da foto); linear; parede inteira; área útil (limites, mínimo, fora da parede); grid (linhas, corte de 4 px); viewport; `formatarEditadoEm`. Cobertura do domínio ≥ 90%. |
| API (integração) | CRUD de projetos (Base criada, ordem, cascata com arquivos e `imagens.projetos`); upload (EXIF da fixture, perfis, miniatura, 413/415); troca (ok sem fotos, 409 com fotos — seed); escala linear e perspectiva (`H` recalculada, 422 em bitmap errado, primeira escala inicializa `areaUtil`, refazer preserva); 409 de revisão do projeto; *hard save* (ok, 409, 400). |
| Componentes | Diálogos Renomear/Excluir/Sair sem salvar; nome editável no header; painel Composição (campos da área útil, grid); status de salvamento; estados da prévia. |
| E2E (Playwright) | (1) Criar projeto → upload de `perspectiva.jpg` → marcar os cantos de `perspectiva.medidas.json` → 300 × 200 → gerar prévia → aplicar → confirmar área → chip de escala e grid → Salvar → recarregar → mesmo estado. (2) Calibração linear em `frontal.jpg` → escala esperada. (3) Calibrar inativo com perspectiva. (4) Trocar parede. (5) Excluir projeto. (6) Nenhuma requisição fora de `localhost` (teste existente estendido). |
| Desempenho | Retificação perfil Alto no Chromium ≤ 3 s (tempo registrado no `MEMORY.md`). |

## 8. Critérios de aceite do M1

1. Projetos: criar direto como "Projeto sem nome" (nasce com "Base"), listar por última edição, abrir, renomear (lista e header) e excluir com confirmação. A exclusão apaga variantes, rascunhos e arquivos da parede e não afeta a biblioteca.
2. Upload da parede em JPG, PNG e WEBP com o perfil escolhido; EXIF respeitado (fixture rotacionada); HEIC, formato inválido e arquivo acima do limite são recusados com mensagem. O card mostra a miniatura.
3. Após o upload abre o modo Perspectiva. Cantos com lupa, validação do quadrilátero, medidas e os 4 estados da prévia funcionam como na §3.4.
4. **PRD aceite 6:** na fixture em perspectiva, o retângulo retificado mede 300 × 200 cm (±1%).
5. Calibração linear: segmento + comprimento geram a escala esperada (±0,5%), exibida no chip e no painel (RF-12).
6. Com perspectiva, "Calibrar" fica inativo com tooltip. De linear para perspectiva, a área útil mantém os valores em cm e, se ficar fora da parede, aparece o aviso.
7. Primeira escala: área útil = parede inteira, ajustável por alças e campos dentro dos limites; Cancelar mantém a parede inteira; contorno e exterior esmaecido no editor.
8. Grid visível por padrão, passo 5 cm, opções 1/2/5/10/Outro, cor e opacidade; linhas a partir da origem 0,0 e só dentro da parede.
9. Zoom no cursor, pan e "Ajustar à tela" funcionam na parede de até 24 MP (perfil Alto) sem travar.
10. Salvar/`Ctrl+S` persiste grid e área útil. O status muda conforme a §3.8, o browser avisa ao fechar com alterações e duas abas geram 409 com o aviso. Fechar e reabrir restaura projeto, escala, área útil e grid (PRD aceite 7, parte da parede).
11. Trocar a parede funciona sem fotos e é recusado (UI inativa e API 409) com fotos.
12. Retificação no perfil Alto ≤ 3 s, ou ADR do plano B registrada.
13. `typecheck`, `lint`, `test` e `e2e` verdes; cobertura do domínio ≥ 90%; nenhuma requisição externa.

## 9. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Dependências (zustand, immer), rotas da web (A-01), remoção da casca `/editor` e do spike Konva, constantes novas | PR-M1-01 |
| T2 | Domínio: homografia, quadrilátero, linear, retificação, warp, parede inteira, área útil, grid, viewport, formatador + testes | T1 |
| T3 | API: projetos (CRUD + cascata) e *hard save* da variante + testes | T2 |
| T4 | API: upload/troca da parede e escala (linear e perspectiva) + testes; **medição de desempenho do warp** | T2, T3 |
| T5 | Web: store, cliente HTTP, tela Projetos com dados reais e diálogos | T3 |
| T6 | Web: canvas do editor (camadas, zoom, pan, grid, origem) e estados do editor | T5 |
| T7 | Web: upload da parede (estado vazio) e troca | T4, T6 |
| T8 | Web: Worker de retificação + modo Perspectiva (lupa, prévia) | T4, T6 |
| T9 | Web: modo Calibração linear | T6 |
| T10 | Web: modo Área útil + painel Composição (escala, área útil, grid) | T8, T9 |
| T11 | Web: salvamento manual, status, 409, `beforeunload` | T5, T10 |
| T12 | E2E + README + `MEMORY.md` | todas |

## 10. Forma de trabalho

- Igual ao M0 (§8 da spec M0): uma tarefa por vez, TDD, `typecheck`/`lint`/`test` verdes e commit local por tarefa (`feat(m1): T2 homografia e retificação [RF-05]`), Status no `MEMORY.md`.
- Pontos de validação com o Nicholas: fim da **T4** (retificação e tempo medido), fim da **T8** (modo Perspectiva no app) e **T12** (aceite do M1).

## 11. Alterações feitas em outros documentos (24/10)

| Documento | Alteração |
|---|---|
| `docs/PRD.md` v0.11 | RN-08 (Calibrar inativo com perspectiva), RN-18 (parede fora do desfazer), RN-33 (primeira escala grava a parede inteira; área útil livre), novo RF-07 (troca sem fotos) e RF-04 ajustado, RF-72 no M1 (roadmap) |
| `docs/ARCHITECTURE.md` v0.6 | ADR-04: margem e parede inteira definidas (M1-03); servidor recalcula `H`; §6 com as pastas novas |
| `docs/DESIGN.md` v0.3 | §7.1: botão "Parede" ativo sem fotos (M1-05) e controles inativos por estado (A-16) |
| `docs/specs/M0-setup.md` | DV-07: a miniatura não é mais regenerada com a retificada (A-17) |
| `MEMORY.md` | Decisões M1-01 a M1-08 e premissas alteradas na revisão |

## 12. Registro da implementação (24/10)

**Forma de trabalho.** TDD em dois commits (instrução do Nicholas): primeiro todos os testes do M1, vermelhos por módulos ausentes (`test(m1): …`); depois a implementação, com tudo verde (`feat(m1): …`). Isso substitui o commit por tarefa da §10; os pontos de validação da T4 e da T8 foram dispensados (o Nicholas valida no fim, na T12).

| Item | Resultado |
|---|---|
| Testes | Vitest: domínio, API (integração com MongoDB e arquivos), web (store, cliente, painéis, diálogos, Projetos, Editor com o palco trocado por um marcador). E2E (Playwright): projetos, perspectiva, calibração linear, área útil, zoom, salvamento (Ctrl+S, `beforeunload`, 409 entre abas), troca de parede, upload, desempenho, rede. |
| Dependências novas | `zustand` 5.0.16 e `immer` 11.2.9 (previstas na §6); `@fastify/multipart` 10.1.6 (citado na ADR-13; **aprovado pelo Nicholas** em 24/10). `bson` não foi necessário. |
| Desempenho (aceite 12) | Leve 0,7 s ✓. Alto 3,0–3,2 s, no limite: **não atingido de forma folgada** → ADR-16 registrada. |

**Decisões de implementação** (o que a spec não fixava):

- Servidor e Worker usam as mesmas funções do domínio; o servidor ordena os cantos, recalcula `H` e confere o bitmap (±1 px). A parede inteira é derivada **da parede gravada** por uma só função (`paredeInteira`), no servidor (área útil inicial) e na web (aviso de "fora da parede"), sem risco de divergir por arredondamento.
- Upload e escala: os arquivos novos vão para `tmp/` e só trocam o definitivo depois que o `updateOne` com `projetos.revisao` aceita (409 não deixa rastro; arquivos substituídos são apagados depois). Formato decidido pelo conteúdo (sharp), não pela extensão; dimensões depois da rotação EXIF.
- A web adota as revisões das variantes devolvidas em `variantesAlteradas` (senão o próximo *hard save* daria 409 contra si mesmo).
- Status de salvamento: "Salvo às hh:mm" depois de salvar ("Salvo" ao abrir) e "Salvando…" durante a gravação.
- O palco troca a prévia da perspectiva por geração sob demanda no Worker, a partir da foto reduzida (≤ 1600 px).
- Controles inativos por estado usam `BotaoInativo` (tooltip com o motivo); `BotaoEmBreve` continua sendo o caso "próxima versão".
- Variante: o seletor mostra só a "Base" e o selo "1 sem foto" saiu do header (sem placeholders até o M4).
- ESLint e Prettier ignoram `.claude/` (worktrees de outras sessões do Claude contaminavam o `tsconfigRootDir`).
- Fora do desfazer (M1-04), sem rascunho/recuperação (M3), sem snap com efeito (M2): como na spec.

**Pendências do M1:** validação do Nicholas (T12); decisão sobre o desempenho do perfil Alto (ADR-16); chunk JS de ~917 kB sem divisão (o Konva entra no pacote principal).
