# Especificação M2 — Biblioteca e composição

| Campo | Valor |
|---|---|
| Versão | 0.4 (registro da implementação, lacunas e tarefas de ajuste — §9, §12, §13) |
| Data | 2026-10-25 |
| Base | `docs/PRD.md` v0.12 · `docs/ARCHITECTURE.md` v0.8 · `docs/DESIGN.md` v0.4 + protótipos 03, 03a, 03b, 07, 11, 16 · `docs/specs/M0-setup.md` v0.6 · `docs/specs/M1-parede-e-escala.md` v0.3 (implementada e aceita) |
| Status | **Concluída** (25/10, Nicholas) e **M2 aceito** (31/10, Nicholas) — decisões e premissas revisadas (24/10) e conflitos com a implementação decididos (§12.1). A implementação de 25/10 seguiu outra spec (§12) e está em ajuste a esta pelas tarefas T14 a T23 (§9, §13); aceite do M2 na T13. |

## 0. Pré-requisitos

| # | Item | Bloqueia | Situação |
|---|---|---|---|
| PR-M2-01 | **Aceite do M1** (§8 da spec M1). | T1 | ✅ 24/10 (M1 aceito; ADR-16 pendente, não bloqueia o M2) |
| PR-M2-02 | Lacunas e contradições da §0.1 decididas. | T1 | ✅ 24/10 |
| PR-M2-03 | Revisão das premissas da §0.2 pelo Nicholas. | T1 | ✅ 24/10 |
| PR-M2-04 | Alterações da §11 aplicadas ao PRD, à DESIGN, à ARCHITECTURE e à spec M0, depois da revisão das premissas e com este branch atualizado com a `main` (o M1 alterou ARCHITECTURE, DESIGN e `MEMORY.md`). | T1 | ✅ 24/10 |

### 0.1 Decisões desta especificação (lacunas e contradições resolvidas)

| # | Lacuna ou contradição | Decisão (24/10) |
|---|---|---|
| M2-01 | **Shift + seta com snap ligado.** A RN-16 diz "seta move 1 cm; Shift + seta move 5 cm; com snap ligado, move um passo do grid", sem dizer o que o Shift faz com snap. O protótipo 03 diz "Shift + setas: 5 cm". Com passo de 2 cm, mover 5 cm tira a foto do grid. | **Com snap ligado, a seta move 1 passo e Shift + seta move 5 passos.** Sem snap, 1 cm e 5 cm. A barra de status mostra o texto do estado atual: "Setas: 1 passo do grid · Shift + setas: 5 passos" ou "Setas: 1 cm · Shift + setas: 5 cm". |
| M2-02 | **Atalhos de desfazer.** A DESIGN §9 só lista setas, Ctrl+S e Esc. A UX-01 deixa Del, Ctrl+D, G, S e R para o futuro, mas não fala de Ctrl+Z. | **Ctrl+Z desfaz; Ctrl+Y e Ctrl+Shift+Z refazem.** Os atalhos fazem parte da RF-70, não da UX-01. Del e Ctrl+D continuam ideias futuras. Com o foco num campo de texto, Ctrl+Z é do campo. |
| M2-03 | **O que entra no desfazer, e quantos passos.** A RN-18 põe a área útil no histórico (M1-04) e não fala do grid nem da borda padrão. A RN-18 pede no mínimo 50 passos, e a ADR-03 fixa 100. | **Entram as fotos (todas as ações), a área útil e a borda padrão. O grid fica fora**, porque é preferência de exibição: visível, snap, passo, cor e opacidade continuam alterando a variante e indo no salvamento, mas sem passo de desfazer. **Limite de 100 passos por variante** (ADR-03, atende ao mínimo da RN-18). |
| M2-04 | **"Remover" com dois sentidos.** O painel da foto (protótipo 03) tem "Remover", que tira a foto da variante. A DESIGN §8 e a RN-24 usam "Remover deste projeto" para outra ação, a da imagem na biblioteca (M4). | **O botão do painel continua "Remover"** (protótipo 03), com o tooltip "Tira a foto desta variante. A imagem continua na biblioteca.". Sem confirmação, porque a ação se desfaz. "Remover deste projeto" continua sendo a ação da imagem (M4). |
| M2-05 | **Quando `imagens.projetos` muda (DM-05).** A regra diz "ao posicionar a foto numa variante", mas a variante só é gravada no salvamento manual (M1-01). Também não estava definido o que os filtros mostram para fotos ainda não salvas. | **O servidor grava a associação em dois momentos**: no upload feito no projeto e no salvamento da variante, para cada `imagemId` das fotos (`$addToSet`), mantendo a RF-28 e a DM-05. No M2 a associação nunca é removida ("Remover deste projeto" é do M4). **Os filtros mostram só o estado salvo**: "Projeto" = imagens com o projeto em `projetos`; "Variante" = imagens das fotos da última versão salva da variante. Foto adicionada e ainda não salva não entra nesses filtros até o Salvar. Depois de cada salvamento, a web recarrega a biblioteca. |
| M2-06 | **Placeholders no M2.** O seed do M0 já tem variantes com placeholders (imagem excluída e vaga de template), e a associação de imagem fica no M4. Um projeto com placeholder aberto no M2 precisa aparecer certo. | **O M2 desenha placeholders** (DESIGN §2.2) e permite selecionar, mover, mudar tamanho, orientação e borda, duplicar e remover. "Ajustar recorte" fica inativo, com o tooltip "Sem imagem para enquadrar.". A linha "Sem foto" do painel Composição já aparece no M2 quando houver placeholder. Associar uma imagem e a recomendação continuam no M4 (**a associação básica passa ao M3** — spec M3, M3-01). O M2 não cria placeholders. |
| M2-07 | **Filtro "Excluídas".** O menu ⋯ da biblioteca (protótipo 03) tem "Excluídas", função do M4. | **"Excluídas" fica no menu ⋯, visível e inativo**, com o tooltip padrão (DESIGN §7.1). |
| M2-08 | **"Trazer para frente" e "Enviar para trás" (RF-35).** O texto não diz se a foto vai uma posição ou até o fim da pilha. | **Uma posição por clique**: "Trazer para frente" troca a foto com a seguinte na pilha; "Enviar para trás", com a anterior. Cada clique é 1 passo de desfazer. O botão fica inativo quando a foto já está no topo (ou no fundo). |
| M2-09 | **Recorte ao mudar tamanho ou orientação.** A RN-28 manda recentralizar só no tamanho personalizado; para os sugeridos e para a orientação, não estava definido. | **Toda mudança de tamanho ou de orientação recentraliza o recorte** (*cover* centralizado, deslocamento 0, 0). |
| M2-10 | **Borda e canto fixo.** A RN-05 fixa o canto superior esquerdo externo ao mudar orientação ou tamanho, mas não fala da borda. | **Mudar a borda também mantém fixo o canto superior esquerdo externo** (a área impressa se desloca). Assim X/Y no painel não mudam e a foto continua no grid. |
| M2-11 | **Limite de posição.** A RN-12 permite que a foto ultrapasse a parede. Sem limite, uma foto pode ser arrastada para longe da parede e ficar difícil de achar. | **A foto pode sair da parede inteira, mas não por completo**: o arraste e os campos X/Y garantem pelo menos 1 cm do retângulo externo dentro da parede inteira, em cada eixo. O limite vale só para movimentos do usuário (arraste, teclado, campos, adicionar, duplicar), nunca ao abrir o projeto nem ao refazer a escala: se a parede inteira encolher, a foto mantém os cm (RN-10) e só recebe o destaque "Fora da parede". A regra fica no domínio e na UI, sem mudar o schema (A-23). |
| M2-12 | **Snap nos campos X/Y.** O PRD aceite 4 fala de foto "solta", e a RN-15 não diz se o snap vale para valores digitados. | **Com snap ligado, X/Y digitados também encaixam no grid**: o valor vai para a linha mais próxima e o campo mostra o valor encaixado. Com snap desligado, vale o valor digitado (0,1 cm). O snap vale para arraste, adicionar, duplicar, teclado e campos. |

Contradições menores, corrigidas sem decisão nova (DS-02: a documentação prevalece sobre o protótipo):
- O protótipo 07 pinta a barra de progresso em `accent`. Vale a DESIGN §6: preenchimento `ink-2`, porque não é ação.
- O protótipo 03 mostra o status "Salvo 14:35" no header. Vale a DESIGN §7: o status fica só na barra de status.
- O protótipo 03 mostra o contador de uso nas miniaturas. Ele continua no M5 (DV-04, RF-23).
- O protótipo 03 diz "Setas movem 1 passo do grid · Shift + setas: 5 cm". O texto passa a seguir a M2-01.
- A RNF-03 diz "miniaturas para render, original só no export", mas o original nunca é guardado (RN-21). O canvas desenha a versão do perfil (`render`); as miniaturas (256 px) servem à biblioteca. O texto da RNF-03 está desatualizado (§11).
- O M1 trocou o texto da Biblioteca sem escala para "As fotos ficam disponíveis depois que a escala da parede for definida." (M1 §3.2). No M2 a biblioteca funciona sem escala (A-20), então o texto passa a "Defina a escala da parede para colocar fotos nela."; o `Alert` do canvas continua com a frase dele.
- O protótipo 16 mostra "Personalizado" no gatilho do seletor. Fora do modo de recorte, o gatilho mostra a medida (A-10).

### 0.2 Premissas (revisadas pelo Nicholas em 24/10)

Valores e comportamentos que os documentos não fixavam. Todas foram revisadas; as marcadas com **(alterada)** mudaram na revisão.

| # | Premissa |
|---|---|
| A-01 | **Biblioteca**: carregada ao abrir o projeto e atualizada a cada upload concluído; sem sincronização entre abas. Ordem por `criadaEm` decrescente; sem paginação (uso pessoal, até alguns milhares de imagens); miniaturas com `loading="lazy"`. O contador do título mostra quantas fotos o filtro ativo exibe ("48 fotos"). |
| A-02 | **Miniatura**: grade de 2 colunas, altura 92 px (DESIGN §6), imagem em *cover*, nome com reticências. Tooltip com o nome completo e a orientação natural ("Retrato natural" / "Paisagem natural" — RF-22). Imagem quadrada conta como retrato (RN-04: largura > altura → paisagem; senão retrato). |
| A-03 | **(alterada)** **Seleção na biblioteca**: clique seleciona uma miniatura (anel `accent`); só o botão "Adicionar" (ou arrastar) a põe na parede — duplo clique não faz nada. Uma por vez (seleção múltipla na parede é RF-36, futura). A seleção da biblioteca é independente da seleção na parede. |
| A-04 | **Adicionar** (RF-30, RN-03, RN-04): pelo botão "Adicionar" da toolbar, a foto entra **centralizada na área útil**; arrastando a miniatura para o canvas, entra **centralizada no ponto de soltura**. Nos dois casos, com snap, o canto superior esquerdo externo encaixa no grid. Se outra foto já tiver o mesmo canto, a nova é deslocada em cascata (+1 passo, ou +5 cm sem snap, em X e Y; até 10 tentativas). Tamanho 10×15 na orientação natural, borda = borda padrão da variante, recorte centralizado. A foto nova vai para o topo da pilha e fica selecionada. |
| A-05 | **Controles inativos por estado** (padrão da DESIGN §7.1): "Adicionar" sem escala ("Defina a escala primeiro.") ou sem miniatura selecionada ("Selecione uma foto na biblioteca."); "Duplicar", "Trazer para frente" e "Enviar para trás" sem foto selecionada ("Selecione uma foto na parede."). Sem escala, as miniaturas não são arrastáveis (RF-13). |
| A-06 | **Seleção na parede**: clique seleciona; clique no fundo ou Esc limpa. Arrastar uma foto não selecionada a seleciona e a move. Arrastar o fundo continua fazendo *pan* (A-06 do M1). As 4 alças da seleção (DESIGN §2.2) só indicam a seleção: não redimensionam, porque os tamanhos vêm do seletor. A seleção fica fora do desfazer. |
| A-07 | **Arraste**: snap durante o arraste; ao soltar, a posição é arredondada a 0,1 cm (DM-08). Os destaques (sobreposição, fora da parede ou da área útil) são recalculados a cada quadro durante o arraste. A barra de status mostra "X 112,5 · Y 40,0 cm" ao vivo. Um arraste gera 1 passo de desfazer, no fim; clique sem movimento não gera passo. |
| A-08 | **Teclado** (RN-16, M2-01): setas só agem com foto selecionada e o foco fora de campo de texto. Setas seguidas na mesma foto, com menos de 1 s entre elas, formam 1 passo de desfazer. Com snap e a foto fora do grid, a primeira seta vai até a linha seguinte naquela direção. |
| A-09 | **Campos do painel**: Enter ou sair do campo aplica (1 passo de desfazer); Esc restaura o valor. Valor fora da faixa mostra a faixa válida e não aplica (mesmo padrão da A-13 do M1). Borda: 0 a 20 cm, passo 0,1. Posição: 0,1 cm; com snap ligado, encaixa no grid (M2-12); limite da M2-11. |
| A-10 | **Seletor de tamanho** (DESIGN §6, protótipo 03b): o gatilho mostra "20 × 30 cm" para sugerido (sem decimal) ou "21,0 × 29,7 cm" para personalizado (DS-02). Os itens mostram sempre menor × maior. Escolher um sugerido mantém a orientação atual; vindo de um quadrado, usa a orientação natural da imagem (retrato para placeholder). "Personalizado…" abre o modo de recorte com o tamanho atual nos campos. Orientação inativa em tamanho quadrado, com o tooltip "Quadrado: sem orientação". |
| A-11 | **Modo de recorte** (DESIGN §7.0, protótipo 16): barra escura só identifica o modo ("Ajustar recorte · <nome>" + "O restante da parede fica bloqueado até concluir" — DS-05). Painel: Tamanho (o seletor funciona dentro do modo), Largura × Altura quando personalizado ("Entre 5,0 e 150,0 cm em cada lado."), Tamanho externo, texto "A foto sempre preenche o quadro. Arraste a imagem para escolher a parte que aparece.", Cancelar e **Concluir**. Zoom e *pan* continuam funcionando. As outras fotos ficam a 35% e sem interação. Desfazer, Refazer, Salvar e Ctrl+S ficam inativos durante o modo. |
| A-12 | **Destaques no canvas** (DESIGN §2.2): contorno tracejado `danger` em todas as fotos envolvidas. **(alterada)** A pill "Sobreposição" fica **na foto da camada superior** de cada sobreposição (a que está mais acima na pilha), no canto inferior direito dela; uma pill por foto, mesmo que ela cubra várias. "Fora da parede" ou "Fora da área útil" em pill abaixo da foto, alinhada à direita. Pills e contornos com tamanho fixo em px de tela (não escalam com o zoom). |
| A-13 | **(alterada)** **Bounding box** (RF-62): mostrada ou escondida por um `Toggle` "Área total" na toolbar do canvas, antes do zoom (padrão ligado; estado da tela, não persistido e fora do desfazer). Ligado, aparece com 1 foto ou mais; pill acima, à direita. Fica fora da exportação. No painel Composição, "Área total" aparece com 1 foto ou mais ("—" sem fotos). Placeholders entram no cálculo. |
| A-14 | **Painel Composição** (protótipo 11, confirmada a linha nova): Fotos (N, placeholders incluídos); Área total; Sobreposições "N fotos" (`danger-ink`); Sem foto N; **Fora da área "N fotos"** (linha nova, `danger-ink`, conta fora da parede e fora da área útil — RN-34 "conta como alerta"). As linhas de alerta só aparecem com valor > 0. "Borda padrão para novas fotos" fica ativa: altera só as fotos adicionadas depois (RN-03) e entra no desfazer (M2-03). |
| A-15 | **Painel da foto** (DESIGN §7, protótipo 03): miniatura + nome original + orientação natural; Tamanho e Orientação na mesma linha; Borda (cm + `SeletorCor` com as cores da DV-08); Tamanho externo; "Posição do canto superior esquerdo" X/Y; alertas da foto ("Esta foto sobrepõe outra na parede.", "Esta foto está fora da área útil.", "Esta foto está fora da parede."); Enquadramento ("Ajustar recorte"); "Trazer para frente" e "Enviar para trás" ficam na toolbar; rodapé com Duplicar e Remover (M2-04, texto `danger-ink`). Para placeholder, o cabeçalho mostra o ícone imagem-cortada e "Sem foto". |
| A-16 | **Imagem indisponível**: se o arquivo da imagem não carregar (404 ou falha de decodificação), a foto aparece como retângulo `sand` com ícone e o texto "Imagem indisponível". Não é placeholder: continua com a imagem associada e pode ser movida e editada. |
| A-17 | **Diálogo "Carregar fotos"** (protótipo 07, DV-10): abre pelo botão "Carregar fotos". A qualidade é escolhida antes, em radio cards (Leve 1024 px · Médio 2048 px · Alto 3072 px; padrão Leve — RF-25). Selecionar arquivos, selecionar pasta (subpastas incluídas) ou arrastar para o diálogo **inicia o envio na hora**. A qualidade trava no primeiro envio e só destrava ao fechar o diálogo; arquivos acrescentados depois entram na mesma fila, com a mesma qualidade. **(alterada)** Soltar arquivos do sistema sobre a coluna Biblioteca abre o diálogo com eles (aguardando "Enviar" — A-18). Em outras áreas, soltar não faz nada (o browser não abre o arquivo). |
| A-18 | **Estados por arquivo**: Na fila · Enviando nn% · Processando… · Concluída (tamanho do WebP em KB/MB, `success-ink`) · Formato não suportado · Arquivo maior que N MB (A-28) · Não foi possível ler a imagem (415 do servidor) · Falhou — **Tentar de novo** (rede ou 5xx) · Cancelada. Resumo "9 de 14 enviadas" + "3 arquivos ignorados por formato" (RN-20). **Cancelar restantes** fica ativo com envios pendentes. **Concluir** (primário) fica ativo sem pendentes e fecha o diálogo. Fechar (×/Esc) com pendentes pergunta "Cancelar os envios restantes?". **Arquivos soltos sobre a Biblioteca** (A-17) abrem o diálogo como "Aguardando": escolhe-se a qualidade (padrão Leve) e clica-se em **Enviar** (primário, só nesse caso; "Concluir" aparece depois do início). Com o diálogo já aberto, selecionar ou arrastar continua iniciando na hora. |
| A-19 | **Formatos aceitos no browser**: extensão `.jpg`, `.jpeg`, `.png` ou `.webp` **e** tipo `image/jpeg`, `image/png` ou `image/webp`; até `UPLOAD_MAX_MB`. **(alterada)** Todo arquivo não suportado, inclusive os de sistema da pasta (`Thumbs.db`, `desktop.ini`, ocultos), entra na lista e no contador de ignorados (RN-20). O servidor confere o conteúdo de verdade (sharp). |
| A-20 | **Upload sem escala**: "Carregar fotos" funciona sem parede e sem escala, porque a biblioteca é global (RN-22). Só adicionar à parede exige escala (RF-13). |
| A-21 | **Botão "Parede"** (M1-05): passa a considerar também as fotos ainda não salvas (é estado da tela, não filtro). Com qualquer foto na variante em memória, fica inativo com o tooltip padrão. |
| A-22 | **Persistência**: as fotos da variante gravam só no Salvar (M1-01); o rascunho automático é do M3. O upload grava na hora, na biblioteca. |
| A-23 | **Sem migração no M2**: os limites novos (borda até 20 cm, posição da M2-11) ficam no domínio e na UI. Os schemas Zod e os validadores `$jsonSchema` do M0 não mudam. |
| A-24 | **Pilha**: ordem do array `fotos` = z-index (DM-04); foto nova e cópia vão para o topo; "Trazer para frente" e "Enviar para trás" andam uma posição (M2-08). |
| A-25 | **Duplicar**: copia imagem, tamanho, borda e recorte; a cópia sai deslocada +1 passo (snap) ou +5 cm (sem snap) em X e Y, sujeita à M2-11, e fica selecionada. Id novo gerado no cliente (DM-01). |
| A-26 | **Status depois de desfazer**: se o conteúdo voltar a ser igual ao último salvo, o status volta a "Salvo às hh:mm" (hora do último salvamento — M1 §12); senão, "Alterações não salvas". No M3 o status ganha "Rascunho salvo às hh:mm", "Salvando…" e "Conflito" (spec M3, A-06). |
| A-27 | **Histórico**: mantido por variante enquanto o projeto está aberto (RN-18, SV-10: salvar não o altera). É descartado ao recarregar depois de um 409 (§3.8 do M1) e ao trocar a parede (M1-05). Refazer a escala o mantém, porque os valores em cm não mudam (RN-10). Desfazer mantém a seleção se a foto ainda existir. |
| A-28 | **Limite de upload na web**: a API passa a expor `GET /api/config` → `{ uploadMaxMb }` (de `UPLOAD_MAX_MB`), lido ao abrir o app. O browser deixa de usar 50 MB fixos (limitação registrada no M1 §12) e a mensagem mostra o valor real ("Arquivo maior que N MB."), para fotos e para a parede. |
| A-29 | **Forma de trabalho**: igual ao M1 (M1 §12) — primeiro um commit com todos os testes do M2, vermelhos; depois a implementação, com tudo verde. Validação do Nicholas no fim (T13), sem pontos intermediários. |

## 1. Objetivo

Entregar o centro do fluxo: carregar fotos na biblioteca global, filtrá-las, colocá-las na parede em tamanhos sugeridos ou personalizados, ajustar orientação, borda e recorte, posicionar com snap e teclado, ver medidas, sobreposições e fotos fora da área, e desfazer. Ao fim do M2, uma composição completa da variante "Base" pode ser montada, salva e reaberta.

## 2. Escopo

| Dentro | Fora (marco) |
|---|---|
| Upload individual e em lote (arquivos, pasta, arrastar) com perfil — RF-20, RF-21, RF-25, RF-26, RN-20, RN-21, RN-25, DV-10 | HEIC (RF-15, ideia futura) |
| Biblioteca global, miniaturas, filtros Todas · Projeto · Variante — RF-22, RF-27, RF-28 (parcial), RN-22, M2-05 | "Excluídas", remover, excluir, restaurar, purga (RF-29, RN-24 — M4); busca (RF-33c, ideia futura); contador de uso (RF-23 — M5) |
| Adicionar por arrastar e por botão; bloqueio sem escala — RF-13, RF-30, RN-03, RN-04, RN-13 | Seleção múltipla e mover em grupo (RF-36, ideia futura) |
| Tamanho sugerido e personalizado, orientação — RF-31, RF-32, RN-01, RN-05, RN-28 | Trocar a imagem de uma foto (RF-37, ideia futura) |
| Recorte em modo próprio — RF-33, RN-14, DV-09 | Zoom dentro do recorte (fora da v1) |
| Mover por arraste e teclado, selecionar, duplicar, remover da variante, ordem — RF-34, RF-35, RN-16 | Atalhos Del, Ctrl+D e outros (UX-01, ideia futura) |
| Borda e cor por foto e borda padrão — RF-41, RN-02, RN-03, DV-08 | Moldura e passe-partout (RF-38, ideia futura) |
| Snap em efeito — RF-53, RN-06, RN-15 | Linha forte (RF-52 — M5) |
| Painel da foto e bounding box — RF-60, RF-62, RN-27 | Distâncias, réguas, guias (RF-55 a RF-61, ideias futuras) |
| Sobreposição, fora da parede e fora da área útil — RN-11, RN-12, RN-34 | Exportação (RF-80 — M4) |
| Desfazer e refazer por variante — RF-70, RN-18, M2-02, M2-03 | Variantes, templates, rascunho, conflito completo, comparação (M3) |
| Placeholders desenhados e editáveis — M2-06 | Associação **básica** de imagem a placeholder passa ao **M3** (spec M3, M3-01: arrastar a miniatura sobre a vaga ou "Preencher com a foto selecionada"); recomendação da imagem anterior, exclusão que gera placeholders e restauração (RF-30a) ficam no M4 |

**O que muda em relação ao M1** (para não passar despercebido na implementação):

| Item do M1 | No M2 |
|---|---|
| A-15: Snap e "Encaixar no grid" sem efeito | Passam a agir nas fotos (§4.4). A área útil continua livre (M1-07). |
| M1-04: desfazer da área útil "implementado no M2" | O modo Área útil confirmado e os campos L, A, X, Y do painel geram 1 passo de desfazer cada. |
| A-15: controles inativos até o M2 | **Ativam**: Desfazer, Refazer, Borda padrão, Adicionar, Duplicar, Trazer para frente, Enviar para trás, Carregar fotos, filtros Todas · Projeto · Variante. **Continuam inativos**: seletor de variante, Comparar, Templates (M3); Exportar e "Excluídas" (M4); busca da biblioteca e de projetos (ideias futuras); "Linha forte a cada" (M5). |
| §3.7: linhas do painel Composição ocultas | Fotos, Área total, Sobreposições, Sem foto e Fora da área (A-14). |
| M1-05: "Parede" ativo sem fotos | Agora pode haver fotos: o botão segue a A-21, e o servidor recusa a troca com 409 (já previsto no M1). |
| RF-13: bloqueio sem escala só como estado visível | Vale para as ações reais: Adicionar e arrastar miniatura (A-05). |
| §3.8: salvamento de `grid` e `areaUtil` | Passa a levar `fotos` e `bordaPadrao` com conteúdo; o servidor valida as imagens e associa ao projeto (§5). |

## 3. Comportamento

### 3.1 Coluna Biblioteca (protótipo 03)

- Título "Biblioteca" (Newsreader) + contador do filtro (A-01); **Carregar fotos** (primário, largura total) abre o diálogo (§3.2).
- Filtros (DESIGN §6): segmented **Todas · Projeto · Variante · ⋯**; "Excluídas" no ⋯, inativo (M2-07). Padrão ao abrir: Todas. O filtro não é persistido.
- Busca: campo inativo (DESIGN §7.1).
- Grade de miniaturas (A-02); seleção (A-03); arrastar para o canvas (A-04, RF-30).
- Estados vazios: Todas — "Nenhuma foto na biblioteca. Carregue fotos para começar."; Projeto — "Nenhuma foto neste projeto ainda."; Variante — "Nenhuma foto salva nesta variante ainda.". Projeto e Variante refletem o estado salvo (M2-05).
- Sem escala: a lista e o upload funcionam, mas as miniaturas não arrastam e o texto acima da grade passa a "Defina a escala da parede para colocar fotos nela." (§0.1, contradições menores).

### 3.2 Diálogo "Carregar fotos" (protótipo 07)

- Diálogo de 640 px (DESIGN §6) com "Selecionar arquivos" (`<input type="file" multiple>`), "Selecionar pasta" (`webkitdirectory`) e "ou arraste para esta janela" (ADR-06).
- "Qualidade · definitiva para este envio": radio cards com o lado maior de cada perfil (ADR-05) e o texto "Convertidas para WebP. Seus arquivos originais não são alterados." (RN-21).
- Validação no browser (A-19). Inválidos entram na lista com o motivo e contam em "ignorados" (RN-20).
- Fila: **3 envios em paralelo**, 1 requisição por arquivo, progresso por arquivo e geral, falha não interrompe o lote, "Tentar de novo" por arquivo, cancelamento aborta os envios em curso e esvazia a fila; os concluídos ficam (DV-10). Estados e botões: A-17, A-18.
- Cada envio concluído entra no topo da biblioteca na hora (A-01) e já fica associado ao projeto (M2-05).

### 3.3 Fotos na parede

- **Adicionar**: A-04, A-05. Bloqueado sem escala (RF-13).
- **Selecionar e mover**: A-06, A-07, A-08. Snap pelo §4.4. Limite de posição pela M2-11.
- **Rótulo da seleção**: pill `accent` abaixo da foto com o tamanho externo ("24,0 × 34,0 cm" — DESIGN §2.2).
- **Duplicar**: A-25. **Remover**: M2-04. **Ordem**: M2-08, A-24.
- **Imagem indisponível**: A-16. **Placeholder**: M2-06.
- A mesma imagem pode ser usada várias vezes (RN-13).

### 3.4 Painel da foto (RF-60, protótipo 03)

Aparece com uma foto selecionada, no lugar do painel Composição. Layout e textos: A-15.

| Campo | Regra |
|---|---|
| Tamanho | Seletor (A-10, RN-01). Mudar mantém o canto superior esquerdo externo (RN-05) e recentraliza o recorte (M2-09). |
| Orientação | Segmented Retrato · Paisagem (152 px). Troca largura e altura (RN-05, RN-28); inativo em quadrado. |
| Borda | Largura em cm (0 a 20, A-09) e cor (DV-08). Soma por fora (RN-02); canto fixo (M2-10). |
| Tamanho externo | Somente leitura: impresso + 2 × borda (RN-02). |
| Posição X/Y | Canto superior esquerdo externo (RN-06), a partir da origem 0,0 (RN-07). Com snap ligado, o valor encaixa no grid (M2-12); limite da M2-11. |
| Enquadramento | "Ajustar recorte" (§3.5). |

### 3.5 Modo de recorte (DESIGN §7.0, protótipo 16)

- Entrada: "Ajustar recorte" no painel, duplo clique na foto ou "Personalizado…" no seletor de tamanho (RN-28). Inativo para placeholder (M2-06).
- Tela: A-11. A imagem inteira aparece, com a parte fora do quadro esmaecida (`ink` 55%) e o quadro com contorno `accent` e o ícone de mover no centro; pill com o tamanho externo.
- Arrastar desloca a imagem só no eixo com sobra (§4.3); a foto não se move na parede.
- Tamanho personalizado: campos Largura × Altura (`CampoCm`, 5 a 150 cm, passo 0,1 — RN-28); valor fora da faixa mostra a faixa e não aplica (critério 2a do PRD). Mudar o tamanho recentraliza. Personalizado igual a um sugerido, em qualquer orientação, vira o sugerido (RN-28).
- **Concluir** ou Enter: aplica tamanho e recorte juntos, em 1 passo de desfazer (RN-14). **Cancelar** ou Esc: restaura tudo.

### 3.6 Grid e snap

- O grid continua como no M1 (passo, cor, opacidade, só dentro da parede inteira). O snap vale **mesmo com o grid oculto**: Grid e Snap são chaves separadas (RN-15).
- O toggle Snap do header e "Encaixar no grid" do painel continuam ligados ao mesmo valor da variante e fora do desfazer (M2-03).

### 3.7 Alertas e bounding box

- Sobreposição (RN-11), fora da parede (RN-12) e fora da área útil (RN-34): regras no §4.5, desenho na A-12. Com os dois "fora", prevalece "Fora da parede" (DESIGN §2.2).
- Os alertas não bloqueiam nada (RN-12, RN-34).
- Bounding box: §4.6 e A-13.
- Nenhum destaque sai na exportação (RN-19, M4).

### 3.8 Painel Composição (sem seleção)

Como no M1 (§3.7 da spec M1), com as linhas de resumo da A-14 e a seção "Borda padrão para novas fotos" ativa.

### 3.9 Desfazer e refazer (RF-70, RN-18)

- Botões Desfazer e Refazer do header (tooltips "Desfazer (Ctrl+Z)" e "Refazer (Ctrl+Y)"), atalhos da M2-02.
- Conteúdo do histórico: M2-03. Passos: 1 por intenção (ADR-03) — fim do arraste, campo aplicado, item escolhido no seletor, orientação, cor, Concluir do recorte, Confirmar área, adicionar, duplicar, remover, cada clique de ordem; setas agrupadas (A-08).
- Inativos sem passo disponível e durante qualquer modo (perspectiva, calibração, área útil, recorte).
- Status de salvamento: A-26. Ciclo de vida do histórico: A-27.

### 3.10 Barra de status

- Esquerda: com foto selecionada, "X 112,5 · Y 40,0 cm" (ao vivo no arraste); dica de teclado conforme M2-01.
- Direita: "Medidas aproximadas, parede considerada plana" e o status de salvamento (M1).
- No modo de recorte: "Arraste para reposicionar · Enter conclui · Esc cancela".

## 4. Domínio e algoritmos

### 4.1 Módulos novos em `packages/domain` (TS puro, testes obrigatórios)

Pastas novas: `composicao/` e `biblioteca/` (a registrar na ARCHITECTURE §6 antes de criar — §11). A validação de formato amplia o `arquivos.ts` do M1 (ARCHITECTURE §6), sem módulo novo.

| Módulo | Funções |
|---|---|
| Tamanho | `tamanhoSugerido(id, orientacao)`, `orientacaoDe(tamanho)` (retrato · paisagem · quadrado), `alternarOrientacao(tamanho)`, `tamanhoPersonalizado(larguraCm, alturaCm)` → tamanho normalizado (vira sugerido se coincidir — RN-28) ou erro de faixa, `tamanhoExterno(tamanho, borda)` |
| Foto | `novaFoto({ id, imagem, bordaPadrao, centroCm, grid })` (RN-03, RN-04, A-04), `retanguloExterno(foto)`, `mudarTamanho(foto, tamanho)` e `mudarBorda(foto, borda)` (canto fixo — RN-05, M2-10; recorte recentralizado — M2-09), `duplicarFoto(foto, novoId, grid)` (A-25) |
| Snap | `encaixar(valorCm, passoCm)`, `encaixarPosicao(pt, grid)` (só com `grid.snap`) |
| Teclado | `moverPorTeclado(foto, direcao, { shift, grid })` (RN-16, M2-01, A-08) |
| Limites | `limitarPosicao(foto, paredeInteira)` (M2-11; chamada só em movimentos do usuário) |
| Recorte | `calcularRecorte({ larguraPx, alturaPx }, tamanho, recorte)` → janela em px da imagem (§4.3), `deslocarRecorte(recorte, deltaPx, ...)` |
| Alertas | `sobreposicoes(fotos)` → pares e ids, `foraDaParede(foto, paredeInteira)`, `foraDaAreaUtil(foto, areaUtil)`, `alertasDaComposicao(variante, paredeInteira)` → contagens do painel (A-14) |
| Caixa | `boundingBox(fotos)` → `{ xCm, yCm, larguraCm, alturaCm } \| null` (RF-62) |
| Ordem | `trazerParaFrente(fotos, id)`, `enviarParaTras(fotos, id)` (M2-08) |
| Biblioteca | `orientacaoNatural(larguraPx, alturaPx)` (RN-04), `filtrarBiblioteca(imagens, filtro, { projetoId, fotosSalvas })` (M2-05: só o estado salvo); em `arquivos.ts`, a validação de formato e tamanho do M1 serve às fotos, com o motivo de recusa da A-18 e o filtro de arquivos de sistema (A-19) |
| Formatadores | `formatarTamanhoComUnidade` (A-10: "20 × 30 cm" / "21,0 × 29,7 cm"), `formatarBytes` ("412 KB", "1,2 MB") |
| Constantes | `THUMB_FOTO_PX = 256` (ADR-05), `UPLOAD_PARALELO = 3` (DV-10), `HISTORICO_LIMITE = 100` (M2-03), `BORDA_MAX_CM = 20` (A-09), `TOLERANCIA_CM = 0.05` (§4.5), `MINIMO_DENTRO_CM = 1` (M2-11), `DESLOCAMENTO_SEM_SNAP_CM = 5` (A-04, A-25), `AGRUPAR_SETAS_MS = 1000` (A-08) |

O domínio não gera ids: o id da foto nova chega como parâmetro (gerado na web com `bson` — DM-01).

### 4.2 Tamanho e posição

- `tamanho.larguraCm` × `tamanho.alturaCm` = área impressa na orientação atual (DM-14). Orientação derivada: largura < altura → retrato; > → paisagem; = → quadrado.
- Tamanho externo = (largura + 2 × borda) × (altura + 2 × borda) (RN-02). Ex.: 10×15 retrato com borda 2 → 14,0 × 19,0 cm (PRD aceite 2).
- `xCm`, `yCm` = canto superior esquerdo externo (RN-06), 0,1 cm (DM-08).
- Mudança de tamanho, orientação ou borda: `xCm` e `yCm` não mudam (RN-05, M2-10).

### 4.3 Recorte (*cover*, RN-14)

Entrada: imagem `iw × ih` px; quadro = área impressa `w × h` cm (a borda não entra); `recorte = { offsetX, offsetY }` ∈ [−1, 1].

1. Proporções `ri = iw / ih` e `rq = w / h`.
2. Se `ri > rq`, a sobra é horizontal: janela `jh = ih`, `jw = ih · rq`, `sobraX = iw − jw`, `sobraY = 0`. Senão, a sobra é vertical: `jw = iw`, `jh = iw / rq`, `sobraY = ih − jh`, `sobraX = 0`.
3. Janela: `x = (sobraX / 2) · (1 + offsetX)`, `y = (sobraY / 2) · (1 + offsetY)`.
4. Significado: 0 = centralizado; −1 = encostado à esquerda (ou no topo) da imagem; +1 = encostado à direita (ou embaixo).
5. No eixo sem sobra, o offset é sempre 0 (normalizado ao gravar).
6. Arraste no modo de recorte: mover a imagem `d` px da imagem para a direita move a janela para a esquerda, `offsetX −= 2d / sobraX` (idem em Y), limitado a [−1, 1] e arredondado a 3 casas.
7. Mudar tamanho ou orientação zera os offsets (M2-09).

A janela vai para o `crop` do `Konva.Image` (ADR-02), com a imagem do perfil (`render`).

### 4.4 Snap (RF-53, RN-06, RN-15)

- `encaixar(v, passo) = arredondarCm(round(v / passo) · passo)`, a partir da origem 0,0 (mesma origem do grid — A-07 do M1).
- Aplicado ao canto superior esquerdo externo, só com `grid.snap` ligado: durante o arraste (`dragBoundFunc`), ao adicionar (A-04), ao duplicar (A-25), no teclado (M2-01) e nos campos X/Y (M2-12).
- Com snap, toda foto solta ou digitada tem X/Y múltiplos do passo (PRD aceite 4), salvo quando o limite da M2-11 empurrar a foto.

### 4.5 Alertas

Sobre os retângulos externos, com tolerância `ε = 0,05 cm` para evitar falso alerta por arredondamento:
- **Sobreposição** (RN-11): `min(a.dir, b.dir) − max(a.esq, b.esq) > ε` **e** o mesmo em Y. Fotos que só encostam não contam. Placeholders entram.
- **Fora da parede** (RN-12): o retângulo não cabe na parede inteira (ADR-04: retângulo envolvente da região com pixels; com escala linear, a foto toda), com folga `ε`.
- **Fora da área útil** (RN-34): o retângulo não cabe na área útil da variante, com folga `ε`.
- Custo: O(n²) pares; com 40 fotos são 780 pares, recalculados por quadro só durante o arraste (A-07).

### 4.6 Bounding box (RF-62)

Mínimo e máximo dos retângulos externos de todas as fotos da variante (placeholders inclusive). Exibida com 1 casa ("90,0 × 47,0 cm").

### 4.7 Desfazer (ADR-03, M2-03)

- zundo sobre a parte desfazível da variante: `{ fotos, areaUtil, bordaPadrao }`. Uma pilha por `varianteId` (no M2, só a "Base"; a estrutura já serve ao M3, que mantém a pilha das variantes salvas num cache por `varianteId` ao trocar de variante — spec M3, A-05).
- Limite de 100 passos; o mais antigo sai.
- Seleção, modo, viewport e grid ficam fora.

## 5. API (M2)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `POST /api/imagens` | multipart: `arquivo`, `perfil`, `projetoId` | 201 `{ imagem }` · 400 Zod · 404 projeto · 413 tamanho · 415 formato ou imagem ilegível |
| `GET /api/imagens` | — | `[{ _id, nomeOriginal, perfil, larguraPx, alturaPx, orientacaoNatural, bytes, criadaEm, projetos, thumbUrl, renderUrl }]`, só ativas (`excluidaEm: null`), por `criadaEm` desc |
| `GET /api/imagens/:id/arquivo?tipo=render\|thumb` | — | `image/webp` com `Cache-Control: public, max-age=31536000, immutable` · 404 |
| `PUT /api/projetos/:pid/variantes/:id` (M1, ampliada) | `{ sessaoId, revisaoBase, grid, bordaPadrao, areaUtil, fotos }` | 200 `{ revisao, salvaEm }` · 409 (M1) · 400 Zod · **422** `{ erro, detalhes: { imagensInexistentes } }` |

Upload (`POST /api/imagens`):
1. Valida perfil e projeto; recusa acima de `UPLOAD_MAX_MB` (413).
2. sharp: `rotate()` (EXIF), redimensiona ao lado maior do perfil (ADR-05: 1024 · 2048 · 3072 px; sem ampliar), WebP na qualidade do perfil; miniatura de 256 px no lado maior (ADR-05). Falha de decodificação → 415 "Não foi possível ler a imagem." (fixture de texto renomeado para `.jpg`).
3. Grava `imagens/<id>.webp` e `imagens/<id>.thumb.webp` de forma atômica (`tmp/` + rename) e insere o documento: `orientacaoNatural` pelas dimensões processadas (RN-04), `projetos: [projetoId]` (M2-05), `excluidaEm: null`, `purgaEm: null`.
4. Requisição abortada pelo cliente (`AbortController`, DV-10): apaga temporários e não insere documento.
5. Sem verificação de duplicata (RN-25).

Arquivos da imagem nunca mudam (RN-21), por isso o cache imutável, diferente da parede (A-19 do M1).

Salvamento da variante (ampliação do M1):
- Todo `imagemId` não nulo precisa existir em `imagens`; senão, 422 com a lista. (A imagem excluída e o placeholder automático são do M4.)
- Depois do `updateOne` com revisão, `$addToSet: { projetos: projetoId }` nas imagens usadas (M2-05). Falha nessa etapa não desfaz o salvamento: é registrada no log e repetida no próximo salvamento.
- Placeholder (`imagemId: null`) é aceito (M2-06).

Regras comuns do M1 continuam (erros `{ erro, detalhes? }` em pt-BR, gravação atômica, API só em `127.0.0.1`).

## 6. Web

| Camada | Entrega |
|---|---|
| `app/` | Fatia **biblioteca** (ADR-03): imagens, filtro, miniatura selecionada, fila de upload (estados da A-18). Fatia **documento**: fotos da variante + histórico zundo por variante (§4.7), comparação com o último salvo (A-26). Fatia **ui**: foto selecionada, modo recorte. Ações nomeadas que delegam ao domínio: `enviarImagens`, `cancelarEnvios`, `tentarDeNovo`, `adicionarFoto`, `moverFoto` (ARCHITECTURE §7), `moverPorTeclado`, `alterarTamanho`, `alternarOrientacao`, `alterarBorda`, `alterarPosicao`, `concluirRecorte`, `duplicarFoto`, `removerFoto`, `trazerParaFrente`, `enviarParaTras`, `alterarBordaPadrao`, `desfazer`, `refazer`. |
| `infra/` | A porta `ClienteApi` (`dto.ts`) e o `clienteApi.ts` do M1 ganham as rotas de `/api/imagens` e `/api/config` (upload por `XMLHttpRequest` com progresso e `abort()`, como o da parede; fila de 3). Geração de id com `bson` (DM-01; não foi necessário no M1). |
| `ui/canvas/` | Segue a divisão do M1 (ARCHITECTURE §6): `cena.ts` ganha as fotos, destaques, bounding box e o modo recorte **como dados**, e o `Palco.tsx` continua o único módulo com Konva. Camada **Fotos** em cm (1 `Group` por foto: `Rect` da borda + `Image` com `crop`; snap no `dragBoundFunc`); seleção, alças, rótulos e pills na camada em px de tela do M1 (tamanho constante em qualquer zoom — A-12) — ADR-02. Imagens carregadas uma vez por `imagemId` (`useImagem`) e compartilhadas entre fotos repetidas. O gancho `window.__deco.paraTela` (M1 §3.9) passa a servir também para as fotos. |
| `ui/paineis/` | Painel da foto (§3.4), painel do recorte (§3.5), painel Composição do M1 ampliado (A-14). |
| `ui/telas/editor/` e `ui/componentes/` | `Biblioteca` e `ToolbarCanvas` do M1 passam a funcionar; diálogo Carregar fotos; `SeletorTamanho` (DESIGN §6); uso de `Miniatura`, `CampoCm`, `SeletorCor` do M0 e de `BotaoInativo` / `BotaoEmBreve` (M1 §12) para os inativos da A-05 e da §2. |

Dependências novas, já previstas nas ADRs: `zundo` (ADR-03) e `bson` (ADR-07). Versões exatas fixadas na T1 e registradas no `MEMORY.md`. Qualquer outra dependência para e pede aprovação.

## 7. Testes

| Tipo | Cobertura |
|---|---|
| Unitário (domínio) | Tamanho (sugeridos nas duas orientações, quadrado sem orientação, personalizado 21,0 × 29,7 aceito e 4,9 / 150,1 recusados, personalizado igual a sugerido); tamanho externo (10×15 + borda 2 → 14 × 19); RN-05 e M2-10 (canto fixo); `novaFoto` (RN-03, RN-04, cascata); snap (múltiplos, passo 2,5, negativos); teclado (com e sem snap, Shift, foto fora do grid); limites (M2-11); recorte (sobra em X e em Y, offsets −1/0/+1, eixo sem sobra, arraste limitado, zerar ao mudar); alertas (encostar não conta, ε, fora da parede × área útil, prevalência); bounding box; ordem (uma posição, limites no topo e no fundo); duplicar; filtros (só o estado salvo; foto não salva fora); formatos e motivos de recusa; formatadores. Cobertura do domínio ≥ 90%. |
| API (integração) | Upload: EXIF da fixture rotacionada, os 3 perfis (lado maior), miniatura de 256 px, `orientacaoNatural` de retrato, paisagem e quadrada, `projetos = [pid]`, 413, 415 (texto renomeado, `.heic`), abortado sem documento nem arquivo. Listagem: ordem, sem excluídas do seed, **imagem do projeto A listada no B** (PRD aceite 10). Arquivo: cabeçalhos de cache, 404. Salvamento com fotos: ok, 422 com imagem inexistente, `$addToSet` sem duplicar, placeholder aceito, ordem preservada. |
| Componentes | Coluna Biblioteca (filtros, estados vazios, inativo sem escala); diálogo Carregar fotos (perfil travado, estados, cancelar restantes, tentar de novo, fechar com pendentes); `SeletorTamanho` (grupos, rodapé de rolagem, quadrado, personalizado); painel da foto (campos, faixas, alertas, placeholder); painel do recorte; painel Composição (linhas de alerta); Desfazer/Refazer (estados e atalhos). |
| E2E (Playwright) | (1) Carregar as fixtures em lote, válidas e inválidas → contadores e ignorados (RN-20, RF-21). (2) Arrastar para a parede calibrada, escolher 20 × 30 retrato sem borda e medir o nó: 20 × 30 cm ± 1 px na escala (PRD aceite 1). (3) Borda 2 em 10 × 15 → "14,0 × 19,0 cm" (aceite 2). (4) Personalizado 21,0 × 29,7 aceito, 4,9 recusado (aceite 2a). (5) Alternar orientação (aceite 3). (6) Snap passo 5: X/Y múltiplos de 5 após soltar (aceite 4). (7) Recalibrar mantém X/Y/tamanho (aceite 5). (8) Sobreposição e fora da área útil com pills e contagens. (9) Recorte: arrastar, Concluir, Esc. (10) Desfazer/refazer por botão e atalho. (11) Salvar → recarregar → mesma composição (aceite 7). (12) Imagem do projeto A no projeto B (aceite 10). (13) Nenhuma requisição fora de `localhost` (teste existente estendido ao upload e ao canvas com fotos). |
| Desempenho | Arraste com 40 fotos ≥ 50 fps (alvo 60); upload de 50 fotos Leve ≤ 1 s por foto; memória < 300 MB com 40 fotos **no perfil Leve** no Chromium (ARCHITECTURE §8; com perfil Alto o orçamento não se aplica). Números registrados no `MEMORY.md`. |

## 8. Critérios de aceite do M2

1. Upload individual, em lote e de pasta, com o perfil escolhido; progresso por arquivo; inválidos listados e contados sem parar o lote; cancelar restantes e tentar de novo funcionam (RF-20, RF-21, RF-25, RN-20, DV-10). **PRD aceite 9.**
2. A biblioteca é global e os filtros Todas · Projeto · Variante seguem a M2-05; "Excluídas" e busca visíveis e inativas. **PRD aceite 10.**
3. Adicionar por arraste e pelo botão, com tamanho 10×15 na orientação natural e a borda padrão; bloqueado sem escala (RF-13, RN-03, RN-04).
4. **PRD aceite 1:** 20×30 retrato sem borda mede 20 × 30 cm na escala (±1 px).
5. **PRD aceites 2, 2a e 3:** tamanho externo com borda, faixas do personalizado e orientação conforme RN-05.
6. **PRD aceite 4:** com snap e passo 5 cm, toda foto solta tem X/Y múltiplos de 5.
7. **PRD aceite 5:** recalibrar ou refazer a perspectiva mantém X/Y/tamanho em cm de todas as fotos.
8. Recorte em modo próprio, só no eixo com sobra, com Concluir/Enter e Esc (RN-14, DV-09); mudar tamanho ou orientação recentraliza (M2-09).
9. Mover por arraste e teclado (RN-16, M2-01), duplicar, remover, trazer para frente e enviar para trás uma posição (RF-34, RF-35, M2-08).
10. Sobreposição, fora da parede e fora da área útil destacados e contados, sem bloquear (RN-11, RN-12, RN-34); bounding box com o total (RF-62).
11. Desfazer e refazer por botão e atalho, até 100 passos, com o escopo da M2-03. **PRD aceite 12 parcial**: só há a "Base" no M2; o teste entre variantes fica no M3.
12. **PRD aceite 7 (posições):** salvar, fechar e reabrir restaura fotos, tamanhos, bordas, recortes e ordem.
13. Desempenho da §7 atingido ou registrado com plano de ação no `MEMORY.md`.
14. `typecheck`, `lint`, `test` e `e2e` verdes; cobertura do domínio ≥ 90%; nenhuma requisição externa.

## 9. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Dependências (`zundo`, `bson`), constantes novas, pastas `composicao/` e `biblioteca/` (após a ARCHITECTURE §6), `GET /api/config` e limite de upload na web (A-28) | PR-M2-01 a 04 |
| T2 | Domínio: tamanho, foto, snap, teclado, limites, recorte + testes | T1 |
| T3 | Domínio: alertas, bounding box, ordem, biblioteca (filtros, formatos), formatadores + testes | T1 |
| T4 | API: `POST/GET /api/imagens` e arquivo + testes; medição do upload em lote | T3 |
| T5 | API: salvamento da variante com fotos (422, `$addToSet`) + testes | T2 |
| T6 | Web: fatia biblioteca, cliente de imagens, coluna Biblioteca (filtros, vazios, seleção) | T4 |
| T7 | Web: diálogo Carregar fotos (fila, estados, cancelar, tentar de novo) | T6 |
| T8 | Web: camada Fotos e Overlay, seleção, adicionar (arraste, botão), mover com snap, teclado e limite, destaques e bounding box; medição de fps e memória | T2, T3, T6 |
| T9 | Web: painel da foto (tamanho, orientação, borda, posição, alertas), toolbar (duplicar, ordem), remover | T8 |
| T10 | Web: modo de recorte e tamanho personalizado | T9 |
| T11 | Web: desfazer/refazer (zundo), atalhos, status pós-desfazer, área útil e borda padrão no histórico | T9 |
| T12 | Web: painel Composição (A-14), barra de status, ativação dos controles do header e da toolbar (§2) | T9, T11 |
| T13 | E2E + desempenho + README + `MEMORY.md` | todas, inclusive T14 a T23 |

**Tarefas de ajuste (25/10).** A implementação de T1 a T12 seguiu outra spec (§12). As tarefas abaixo levam o código a esta spec. Cada linha da §13 está em uma tarefa. Os itens marcados "Verificar" na §13 são conferidos na tarefa indicada e corrigidos se divergirem. A T13 fica por último.

| # | Tarefa | Depende de |
|---|---|---|
| T14 | **Testes vermelhos do ajuste (A-29).** Corrigir os testes que fixam o comportamento da outra spec (por exemplo: duplo clique adiciona, pill em todas as fotos, envio explícito, bounding box só com 2 fotos, Carregar fotos inativo sem escala, 422 sem escala) e escrever os testes que faltam para cada linha "Diverge" da §13, nos níveis da §7. Um commit `test(m2): …` com esses testes vermelhos e o resto verde. | — |
| T15 | **Domínio na estrutura da §4.1 (M2-15).** Levar `fotos/` e `historico.ts` para `composicao/` e `biblioteca/`, com as funções e os nomes da tabela da §4.1, e apagar `fotos/`. Acrescentar ou corrigir: `limitarPosicao` (M2-11), snap nos campos X/Y (M2-12), cascata de até 10 tentativas (A-04), `filtrarBiblioteca` só pelo estado salvo (M2-05), que sai de `apps/web/src/app/biblioteca.ts`, validação por extensão **e** tipo, com arquivos de sistema contados como ignorados (A-19), e as constantes da §4.1. Cobertura do domínio ≥ 90%. | T14 |
| T16 | **Desfazer com `zundo` (M2-13, ADR-03).** Instalar o `zundo` (ainda não está no projeto) com versão exata registrada no `MEMORY.md`. Reestruturar a store para que a parte desfazível da variante (`{ fotos, areaUtil, bordaPadrao }`) fique isolada, com uma pilha por variante e limite de 100. Também: setas seguidas agrupadas (A-08), status depois de desfazer (A-26) e ciclo de vida do histórico (A-27). **Se o `zundo` não servir, parar e perguntar ao Nicholas, sem alternativa por conta própria.** | T15 |
| T17 | **API (M2-14, §5, A-28).** Retirar as recusas que esta spec não tem: salvar sem escala, imagem excluída e `_id` repetido. O 422 fica só para imagem inexistente, com `{ erro, detalhes: { imagensInexistentes } }`; imagem excluída conta como existente. Imagem ilegível → 415 "Não foi possível ler a imagem.". Falha do `$addToSet` vai para o log sem derrubar o salvamento. `GET /api/config` → `{ uploadMaxMb }`. Conferir o upload abortado sem rastro. | T14 |
| T18 | **Web — Biblioteca (§3.1).** Duplo clique sem ação (A-03); "Carregar fotos" ativo sem escala (A-20) e o texto da §3.1; estados vazios por filtro; contador do filtro ativo (A-01); miniatura de 92 px com tooltip (A-02); filtros pelo estado salvo e recarga da biblioteca depois de salvar (M2-05). | T15, T17 |
| T19 | **Web — Diálogo Carregar fotos (§3.2).** Envio na hora; "Aguardando" e **Enviar** só para arquivos soltos sobre a Biblioteca; qualidade travada até fechar o diálogo (A-17); estados e textos da A-18; limite real de upload, também na parede (A-28). | T17, T18 |
| T20 | **Web — Canvas (§3.3, §3.7, ARCHITECTURE §6).** Pill "Sobreposição" só na foto da camada superior (A-12); toggle "Área total" e bounding box com 1 foto (A-13); "Imagem indisponível" no canvas (A-16); placeholders (M2-06); no modo de recorte, as outras fotos a 35% e sem interação (A-11); posição ao vivo no arraste (A-07). Konva só no `Palco.tsx`: se o arquivo ficar grande demais, propor ao Nicholas a mudança da §6 antes de dividir. | T15, T16 |
| T21 | **Web — Painéis, toolbar e barra de status.** X/Y com o limite M2-11 e o snap M2-12; ordem inativa no topo e no fundo (M2-08); tooltip do Remover (M2-04); seletor de tamanho (A-10); textos de alerta e cabeçalho de placeholder (A-15, M2-06); linhas do painel Composição (A-14); textos da barra de status (M2-01, §3.10); Desfazer, Refazer, Salvar e Ctrl+S inativos durante o recorte (A-11). | T16, T20 |
| T22 | **Referências no código.** Comentários e nomes de teste citam IDs da outra spec: M2-01 a M2-09, com outro sentido, e B-01 a B-15 (74 ocorrências em 35 arquivos em 25/10). Citam também o RN-36, que não existe (M2-14; 5 ocorrências em 25/10). Trocar pelos IDs desta spec ou do PRD; ao fim, `grep -rnE "B-[01][0-9]|RN-36"` em `apps`, `packages` e `tests` não acha nada. | T15 a T21 |
| T23 | **E2E e desempenho que faltam (§7).** Completar os 13 cenários E2E da §7 (incluindo o 8, alertas com pills e contagens, e o 13, rede); medir o upload de 50 fotos Leve (≤ 1 s por foto) e a memória com 40 fotos no Leve (< 300 MB); registrar os números no `MEMORY.md`. | T18 a T21 |

## 10. Forma de trabalho

- Conforme a A-29: TDD em dois commits, como no M1 — `test(m2): …` com todos os testes vermelhos e `feat(m2): …` com a implementação e tudo verde (`typecheck`, `lint`, `test`, `e2e`). A ordem da §9 continua sendo a ordem de implementação. Status no `MEMORY.md` ao fim.
- **Ajuste (T14 a T23):** mesmo TDD. A T14 é o commit vermelho, e as demais vêm em commits `fix(m2): …` com tudo verde. Comportamento que esta spec não define não é inventado: **pergunte ao Nicholas** (a origem das divergências está na §12).
- Validação do Nicholas na **T13** (aceite do M2).

## 11. Alterações feitas em outros documentos (24/10)

Aplicadas depois da revisão das premissas, com o branch atualizado com a `main` (M1 aceito).

| Documento | Alteração |
|---|---|
| `docs/PRD.md` | RN-16 (Shift + seta com snap — M2-01); RN-18 (escopo do desfazer, limite 100, atalhos — M2-02, M2-03); RN-05 (borda com canto fixo — M2-10); RN-12 (limite de 1 cm dentro da parede inteira — M2-11); RN-14/RN-28 (recentralizar em toda mudança de tamanho ou orientação — M2-09); RN-15 (snap também nos campos X/Y — M2-12); RF-35 (ordem anda uma posição — M2-08); RF-28 ("Excluídas" no M4 — M2-07); RNF-03 (canvas usa a versão do perfil; o original não é guardado — RN-21). Versão 0.12. |
| `docs/DESIGN.md` | §8: "Remover" (foto da variante) × "Remover deste projeto" (imagem) e o tooltip da M2-04; §7: toolbar do canvas com o toggle "Área total" (A-13); textos da barra de status (M2-01) e linha "Fora da área" no painel Composição (A-14); §7.1: "Excluídas" inativo até o M4 e controles inativos por estado da A-05; §2.2: imagem indisponível (A-16). |
| `docs/ARCHITECTURE.md` | §6: pastas `packages/domain/src/composicao/` e `packages/domain/src/biblioteca/`; ADR-03: escopo do histórico (M2-03). |
| `docs/specs/M0-setup.md` | DM-05: momentos da associação (upload e salvamento) e filtros pelo estado salvo (M2-05). |
| `MEMORY.md` | Decisões M2-01 a M2-12 (registradas em 24/10) e premissas alteradas na revisão. |

## 12. Registro da implementação (25/10)

**Origem das divergências.** O branch `claude/m2-implementation-8f6bef` foi criado a partir da `main` em `c89ddd7`. Esta spec só existia no branch `claude/m2-specification-dcc0e1`, que ainda não estava na `main`. A sessão de implementação escreveu então uma spec própria (v0.2, commit `0de7f75`), com decisões M2-01 a M2-09 e premissas B-01 a B-15 diferentes destas, e implementou T1 a T12 sobre ela. Também alterou PRD, DESIGN e ARCHITECTURE: RF-13, RF-20, um RN-36 novo e a ADR-03 sem `zundo`. Em 25/10 o Nicholas apontou as divergências. Esta spec entrou na `main` (`8488184`) e foi mesclada na implementação (`3ac18f1`), e os documentos ficaram exatamente como na `main`. **A v0.2 está descartada.** Os IDs M2-01 a M2-09 citados no código têm o sentido da v0.2 até a T22.

### 12.1 Decisões de 25/10 (Nicholas)

| # | Conflito | Decisão |
|---|---|---|
| M2-13 | A implementação trocou o `zundo` por uma pilha própria (`packages/domain/src/historico.ts`). O motivo dado: o `zundo` mescla o estado só no primeiro nível, e desfazer substituiria o `documento` inteiro. | **Vale a ADR-03: `zundo`.** A store é reestruturada para isolar a parte desfazível (§4.7). A pilha própria sai. Se o `zundo` se mostrar inviável, a implementação para e pergunta (T16). |
| M2-14 | O servidor passou a recusar (422) salvar fotos sem escala, com imagem excluída ou com `_id` repetido, e o PRD ganhou um RN-36 (tolerância dos alertas). | **Saem todos os acréscimos.** O salvamento só confere se as imagens existem (§5), e a imagem excluída fica para o M4. O RN-36 não entra: a tolerância já está no §4.5. |
| M2-15 | O domínio ficou em `fotos/` (tamanho, geometria, alertas, recorte, composição) e `historico.ts`. | **Vale a §4.1:** `composicao/` e `biblioteca/`, com as funções e os nomes da tabela (T15). |

### 12.2 O que já atende a esta spec

M2-01 (seta e Shift + seta, com e sem snap); M2-02 (atalhos); M2-03 (escopo do desfazer e limite de 100; o mecanismo muda na T16); M2-07 ("Excluídas" inativo); M2-09 (recentraliza o recorte); M2-10 (canto fixo na borda); A-05 (miniatura não arrasta sem escala); A-21 (botão Parede considera fotos não salvas); A-23 (schemas Zod e `$jsonSchema` sem mudança); A-24; adicionar por botão e por arraste (A-04, exceto o limite de tentativas); modo de recorte com Concluir em 1 passo (§3.5; teste em `apps/web/src/app/store-composicao.test.ts`); upload no servidor com EXIF, lado maior por perfil, miniatura de 256 px, recusa sem rastro em `tmp/` e cache imutável (§5; testes em `apps/api/src/rotas/imagens.test.ts`); `bson` para os ids das fotos. Os itens sem teste citado foram conferidos no código.

### 12.3 Números antes do ajuste

Vitest 808 testes, Playwright 65/65, typecheck, lint e `format:check` verdes. Esses testes cobrem também o comportamento da v0.2 (T14). Cobertura do domínio: 97,4% das instruções e 93,5% dos ramos. Arraste com 40 fotos de 10 × 15 com borda: 60 fps (quadro médio 16,7 ms) no Chromium headless. Dependência nova: `bson` 7.3.3, a mesma do driver do MongoDB. Pacote JS da web: de ~917 kB para ~1.016 kB.

## 13. Lacunas da implementação (25/10)

Comparação desta spec com o código de `claude/m2-implementation-8f6bef` em `3ac18f1`. **Diverge**: confirmado no código. **Verificar**: não conferido, e a tarefa confere. O comportamento exigido é o do item citado; a coluna do meio só descreve o código atual.

| # | Item | Hoje no código | Situação | Tarefa |
|---|---|---|---|---|
| L-01 | A-03 | Duplo clique na miniatura adiciona a foto (`apps/web/src/ui/telas/editor/Biblioteca.tsx:166`). | Diverge | T18 |
| L-02 | A-12 | Pill "Sobreposição" em todas as fotos envolvidas (`apps/web/src/ui/canvas/FotosKonva.tsx:375`). O contorno tracejado em todas está certo. Posição das pills "Fora…" a conferir. | Diverge | T20 |
| L-03 | A-13 | Sem o toggle "Área total"; bounding box só com 2 fotos ou mais (`FotosKonva.tsx:346`). | Diverge | T20 |
| L-04 | A-20, §3.1 | "Carregar fotos" inativo sem escala (`Biblioteca.tsx:91`); texto "As fotos ficam disponíveis depois que a escala da parede for definida." (`Biblioteca.tsx:143`). | Diverge | T18 |
| L-05 | §3.1 | Estados vazios "Nenhuma foto na biblioteca ainda." e "Nenhuma foto neste filtro." (`Biblioteca.tsx:150`), em vez dos três textos por filtro. | Diverge | T18 |
| L-06 | A-01 | O contador mostra o total da biblioteca (`imagens.length`), não o do filtro ativo. | Diverge | T18 |
| L-07 | A-02 | Miniatura de 88 px (`Biblioteca.tsx:176`) com a orientação escrita abaixo; falta o tooltip com nome e orientação natural. | Diverge | T18 |
| L-08 | M2-05 | Projeto e Variante incluem fotos não salvas (`apps/web/src/app/biblioteca.ts:14`); a biblioteca só é carregada ao abrir o editor (`Editor.tsx:48`), não depois de salvar. | Diverge | T15, T18 |
| L-09 | A-17, A-18 | Os arquivos sempre esperam "Enviar N fotos" (`DialogoUpload.tsx:262`). A qualidade trava só durante o lote. Estados Aguardando · Enviando · Concluída · Falhou · Cancelada: não há "Processando…" nem os motivos da A-18. | Diverge | T19 |
| L-10 | A-28 | Sem `GET /api/config`; 50 MB fixos no browser (`EstadoVazio.tsx:10` e upload de fotos). | Diverge | T17, T19 |
| L-11 | A-19 | Aceita por tipo, ou por extensão quando o tipo vem vazio (`packages/domain/src/arquivos.ts:21`); a spec pede extensão **e** tipo. Contagem de arquivos de sistema como ignorados a conferir. | Diverge | T15, T19 |
| L-12 | M2-11, A-25 | Sem limite de posição: a foto pode ir para longe da parede por arraste, setas, campos e duplicar. | Diverge | T15, T21 |
| L-13 | M2-12 | X/Y digitados não encaixam no grid. | Diverge | T15, T21 |
| L-14 | A-04 | Cascata de até 1000 tentativas (`packages/domain/src/fotos/composicao.ts:69`), em vez de 10. | Diverge | T15 |
| L-15 | A-08 | Cada toque de seta é um passo de desfazer: não há agrupamento < 1 s. | Diverge | T16 |
| L-16 | A-26 | Desfazer sempre marca "Alterações não salvas", mesmo voltando ao último salvo. | Diverge | T16 |
| L-17 | A-27 | Descarte do histórico depois de um 409 e na troca da parede; manutenção ao refazer a escala. | Verificar | T16 |
| L-18 | M2-13, ADR-03, §4.7 | Pilha própria `historico.ts`, sem `zundo`. | Diverge | T16 |
| L-19 | M2-15, §4.1 | Domínio em `fotos/` e `historico.ts`, com outros nomes de função. | Diverge | T15 |
| L-20 | M2-14, §5 | Salvamento recusa sem escala, imagem excluída e `_id` repetido (`apps/api/src/servicos/variantes.ts:30`); o 422 não traz `detalhes.imagensInexistentes`. | Diverge | T17 |
| L-21 | §5 | Imagem ilegível responde 415 "Formato não suportado. Use JPG, PNG ou WEBP." (`apps/api/src/servicos/imagem.ts`), não "Não foi possível ler a imagem.". | Diverge | T17 |
| L-22 | §5 | Falha do `$addToSet` depois do `updateOne` faz o salvamento responder erro (`servicos/variantes.ts:110`); a spec manda registrar no log e seguir. | Diverge | T17 |
| L-23 | §5 | Upload abortado apaga os temporários e não insere documento. | Verificar | T17 |
| L-24 | M2-06 | Placeholder (`imagemId: null`) aparece como "Imagem indisponível" (`apps/web/src/ui/telas/editor/cenas.ts:30`): falta o desenho da DESIGN §2.2, "Ajustar recorte" inativo com tooltip, cabeçalho "Sem foto" e a linha "Sem foto". | Diverge | T20, T21 |
| L-25 | A-16 | "Imagem indisponível" só no painel; no canvas fica só o retângulo `sand`, sem ícone e sem texto. | Diverge | T20 |
| L-26 | A-11 | Ctrl+S salva durante o modo de recorte (`Editor.tsx:71`; `salvarVariante` não confere o modo). As outras fotos ficam sob o véu do quadro, em vez de 35% e sem interação. | Diverge | T20, T21 |
| L-27 | A-07 | Posição ao vivo na barra de status durante o arraste (a store só muda no `dragend`). | Verificar | T20 |
| L-28 | A-06, A-09 | Arrastar foto não selecionada a seleciona e move; Esc no campo restaura o valor. | Verificar | T20, T21 |
| L-29 | M2-08 | "Trazer para frente" e "Enviar para trás" não ficam inativos no topo e no fundo da pilha (`ToolbarCanvas.tsx:93`, `:100`). | Diverge | T21 |
| L-30 | M2-04 | "Remover" sem o tooltip "Tira a foto desta variante. A imagem continua na biblioteca.". | Diverge | T21 |
| L-31 | A-10 | Gatilho do seletor sem "cm"; sem o tooltip "Quadrado: sem orientação". Orientação ao sair de um quadrado a conferir. | Diverge | T21 |
| L-32 | A-14 | "Fora dos limites n" (`PainelComposicao.tsx:92`) em vez de "Fora da área N fotos"; "Sobreposições" sem "N fotos"; sem a linha "Sem foto". | Diverge | T21 |
| L-33 | A-15 | Alertas "Esta foto passa dos limites da parede/área útil." (`PainelFoto.tsx:65`) em vez de "Esta foto está fora da parede/área útil.". | Diverge | T21 |
| L-34 | M2-01, §3.10 | Barra de status "Setas movem 1 passo do grid · …" (`Editor.tsx:259`) em vez de "Setas: 1 passo do grid · Shift + setas: 5 passos". Sem o texto do modo de recorte. | Diverge | T21 |
| L-35 | ARCHITECTURE §6 | O Konva também é usado em `apps/web/src/ui/canvas/FotosKonva.tsx`; a §6 diz que `Palco.tsx` é o único módulo com Konva. | Diverge | T20 |
| L-36 | A-29, §7 | Os testes de componente e os E2E foram escritos junto das telas, não vermelhos antes. Falta medir o upload de 50 fotos e a memória. | Diverge | T14, T23 |
| L-37 | — | Comentários e testes citam IDs da v0.2 com outro sentido (74 ocorrências em 35 arquivos) e o RN-36, que não existe. | Diverge | T22 |
| L-38 | A-05 | "Adicionar" inativo sem miniatura selecionada, com "Selecione uma foto na biblioteca." (sem teste). | Verificar | T21 |
