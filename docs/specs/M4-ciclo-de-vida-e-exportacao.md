# Especificação M4 — Ciclo de vida das imagens, exportação e pendências técnicas

| Campo | Valor |
|---|---|
| Versão | 0.1 (rascunho) |
| Data | 2026-11-02 |
| Base | `docs/PRD.md` v0.15 · `docs/ARCHITECTURE.md` v0.9 · `docs/DESIGN.md` v0.5 + protótipos 08, 10, 12 (e 03, 06, 11 no que tocam o M4) · `docs/specs/M0-setup.md` v0.6 (§4.10) · `docs/specs/M1-parede-e-escala.md` v0.3 · `docs/specs/M2-biblioteca-e-composicao.md` v0.4 · `docs/specs/M3-variantes-templates-e-salvamento.md` (aceita) · `MEMORY.md` (Questões em aberto) |
| Status | **Rascunho para revisão do Nicholas** (02/11). Escrita só com a documentação (regra do `CLAUDE.md`). Implementação só depois da revisão das lacunas (§0.1) e das premissas (§0.2). |

## 0. Pré-requisitos

| # | Item | Bloqueia | Situação |
|---|---|---|---|
| PR-M4-01 | **Aceite do M3** (§8 da spec M3). O M4 usa a store por variante, o histórico, os placeholders, a comparação e o diálogo de decisão da A-12. | spec e T1 | ✅ M3 aceito pelo Nicholas em 02/11 (já na `main`) |
| PR-M4-02 | Escopo do marco: ciclo de vida das imagens, exportação, **pendências técnicas** (M4-01) e **RN-36** (M4-02). | spec | ✅ pedido pelo Nicholas em 02/11 |
| PR-M4-03 | Lacunas da §0.1 decididas pelo Nicholas (M4-03 a M4-17). | T1 | ⏳ propostas abaixo, a revisar |
| PR-M4-04 | Premissas da §0.2 revisadas pelo Nicholas. | T1 | ⏳ a revisar |
| PR-M4-05 | Alterações da §11 aplicadas aos outros documentos depois da revisão, com este branch atualizado com a `main`. | T1 | ⏳ (a RN-36 já está no PRD v0.15) |

### 0.1 Lacunas e contradições (com proposta)

M4-01, M4-02, M4-13 (ADR-16, opção (b)) e o princípio da M4-18 são **decisões do Nicholas de 02/11**. As demais (M4-03 a M4-12 e M4-14 a M4-17) e o limite de 16 MP da M4-18 são **propostas** a aprovar, ajustar ou trocar.

| # | Lacuna ou contradição | Proposta / decisão |
|---|---|---|
| M4-01 | **Pendências técnicas.** O `MEMORY.md` lista cinco itens em aberto: ADR-16 (perfil Alto), status HTTP de `/api/saude`, chunk JS de ~1.016 kB, títulos dos diálogos sem a serifa e as quedas 0xC0000409 (Vitest e painel de preview). | **Decisão (02/11): tratar todos no M4**, como tarefas T11 a T14 (§9), uma por item. O limite de upload fixo em 50 MB já foi resolvido no M2 (A-28) e não entra. |
| M4-02 | **Comparação com a mesma variante nos dois painéis.** A M3-10 diz que escolher no seletor a variante do outro lado **troca os lados**. | **Decisão (02/11): nova regra RN-36 (PRD v0.15).** O sistema **aceita** a escolha e **não altera o outro painel**: os dois mostram a mesma variante, com zoom e pan sincronizados. Revê a troca de lados da M3-10 (e a A-26). Detalhes na §3.9. |
| M4-03 | **Como o usuário aciona "remover" e "excluir" uma imagem.** O protótipo 08 só desenha o diálogo; a M0 §4.10 manda perguntar primeiro qual das duas ações ele quer. A miniatura do M2 não tem menu. | **Um único ponto de entrada:** botão ⋯ na miniatura (visível no hover, no foco e na miniatura selecionada) com o item **"Remover ou excluir…"**, que abre o diálogo da §3.1. O diálogo **pré-seleciona "Remover deste projeto"** (a ação reversível). O protótipo 08 pré-seleciona "Excluir"; vale a documentação (DS-02) e a escolha mais segura. A confirmação muda de rótulo e de estilo com a opção marcada. |
| M4-04 | **Remover do projeto.** A M0 §4.10 diz que "exige que não haja alterações sem *hard save*" e que gera nova revisão das variantes afetadas, mas não fala dos rascunhos, da pilha de desfazer, do cache das variantes salvas nem do que a tela faz depois. | **Remover** tira a imagem de **todas as variantes salvas do projeto aberto** (as fotos somem, sem virar placeholder), sai de `imagens.projetos` e faz o mesmo nos **rascunhos** do projeto. As variantes afetadas ganham `revisao + 1`. Se a ativa tem alterações não salvas, antes abre a decisão da A-12 (Salvar e continuar · Descartar · Cancelar). Depois, a web recarrega as variantes afetadas e **zera a pilha de desfazer delas** (§3.2). |
| M4-05 | **Excluir.** A M0 §4.10 define o *soft delete* de 30 dias e o placeholder, mas não diz se o servidor mexe em `imagens.projetos`, na revisão e em `salvaEm`, nem como as outras abas ficam. | **Excluir** marca `excluidaEm` e `purgaEm = + 30 dias` (PRD RN-24) e converte em placeholder, **em todos os projetos**, cada foto da imagem nas variantes salvas e nos rascunhos (`imagemAnteriorId = id`, `imagemId = null`; tamanho, posição, borda e recorte mantidos). As variantes afetadas ganham `revisao + 1` **sem mudar `salvaEm` nem `salvaPorSessao`** (não é um salvamento do usuário; assim os rascunhos continuam elegíveis e o "base antiga" da M3-08 faz o seu papel). `imagens.projetos` **não muda**. Outra aba com a variante aberta recebe 409 no próximo Salvar (diálogo de conflito da M3). Mesma exigência de estado salvo da M4-04. |
| M4-06 | **Salvar com imagem excluída.** A M2-14 deixou "imagem excluída conta como existente" para o M4. Uma aba com a lista de imagens antiga pode salvar uma foto cuja imagem foi excluída em outra aba (e a revisão da variante não mudou, então não há 409). | **O servidor converte para placeholder em vez de recusar** (mesma regra da exclusão) e devolve `imagensExcluidas`; a web aplica a conversão no conteúdo em tela, sem passo de desfazer, e avisa. A mesma regra vale para `POST` de variante com `origem: copia` (§5). Recusar com 422 impediria o usuário de salvar o resto da composição. |
| M4-07 | **Lista "Excluídas" e restauração.** Não está dito o que a lista mostra, se o item vencido (`purgaEm` passado e purga ainda não rodada) pode ser restaurado, nem se restaurar pede confirmação. | A lista mostra as imagens com `excluidaEm` e `purgaEm` **futuro**, mais novas primeiro, com "N dias restantes" (arredondado para cima). Item vencido não aparece e a restauração responde 410. **Restaurar vale na hora**, sem confirmação (é reversível pela própria exclusão), limpa `excluidaEm` e `purgaEm`, e **não** repõe a imagem em placeholders (RF-30a). Itens excluídos não são selecionáveis nem arrastáveis. |
| M4-08 | **Recomendação da imagem anterior (RF-30a).** O protótipo 12 desenha "Espaço sem foto" na coluna esquerda, abaixo da lista; a DESIGN §7 e a M2 A-15 põem o painel do placeholder no **painel direito**. | A recomendação vai no **painel direito do placeholder** (DS-02), acima de "Preencher com a foto selecionada" (M3-01): card "Foto anterior, restaurada" com o nome do arquivo e **Usar**, só quando `imagemAnteriorId` aponta para uma imagem **ativa**. **Escolher outra na biblioteca** foca a coluna Biblioteca. |
| M4-09 | **Purga.** A M0 §4.10 manda rodar na inicialização e a cada 24 h, mas não diz a ordem das operações sem transação, o que fazer com falha de arquivo nem se zerar `imagemAnteriorId` conta como edição. | Para cada imagem com `purgaEm` vencido: (1) zera `imagemAnteriorId` nas variantes e rascunhos (sem mudar revisão: não é edição); (2) apaga `render` e `thumb` (arquivo ausente conta como feito; outro erro mantém o documento para a próxima rodada); (3) apaga o documento. Idempotente, com trava contra rodadas sobrepostas e relógio injetável nos testes. Falha em uma imagem não interrompe as outras. |
| M4-10 | **Exportação: que parte da parede, em que resolução.** O RF-80 diz "na resolução da parede"; a RN-12 diz que a exportação recorta nos limites da imagem; a RN-33 tira a área útil da exportação. | **Região = parede inteira** (`paredeInteira`, M1), não a área útil. **Resolução** = a do bitmap exibido no editor: com perspectiva, `retificada.larguraPx × alturaPx` (até 6144 px no perfil Alto); com escala linear, a foto processada da parede. Densidade de saída = `pxPorCm` desse bitmap. **PNG** mantém a transparência fora da foto retificada; **JPG** preenche com branco. |
| M4-11 | **Exportação: o que é desenhado e qual estado.** A RN-19 lista o que não sai e a exceção do placeholder; não diz como sai uma foto com imagem indisponível, nem se exporta a versão salva ou a que está em tela. | Exporta o **estado em tela da variante ativa**, inclusive alterações não salvas (o diálogo avisa). Camadas: parede, grid (opcional, **abaixo das fotos**, como no editor), fotos na ordem da pilha (borda por fora, imagem em *cover* com o recorte), placeholders (hachura vermelha, RN-19). **Imagem indisponível** sai como retângulo `sand` no tamanho externo e o diálogo avisa a quantidade. Nunca saem alças, seleção, alertas, área útil, rótulo de origem nem bounding box. |
| M4-12 | **Onde a exportação roda e a prévia do protótipo 10.** A ADR-08 fala em `OffscreenCanvas`; a ARCHITECTURE P6 manda tirar operação pesada da thread da UI; o protótipo 10 mostra uma miniatura da composição. | Compositor em **Web Worker**, desenhando em `OffscreenCanvas` uma imagem por vez (ADR-08), sem Konva. A **prévia** do diálogo é gerada pelo **mesmo compositor** em escala reduzida (lado maior 480 px) ao abrir o diálogo e ao mudar "Incluir grid". Fechar o diálogo aborta o trabalho em curso. |
| M4-13 | **ADR-16 (perfil Alto, ≈ 3 s).** Decisão do Nicholas entre (a) limitar a retificada a 4096 px, (b) WebP 0,8 só na retificada, (c) vários Workers, (d) JPEG sem transparência. | **Decisão (02/11): (b).** É a única que não reduz a resolução da parede (que é a resolução da exportação, M4-10) nem exige cabeçalhos COOP/COEP nem sai do `.webp` do modelo; custo: de 3 a 5× menos tempo de codificação em imagem com textura e arquivo cerca de metade. Meta: Alto com foto sintética ≤ 3 s (o orçamento da ARCHITECTURE §8) e a foto ruidosa medida e registrada. **Se o Alto ruidoso ficar acima de 4,5 s, para e pergunta** (próximo passo seria a opção (a), que reduz a exportação do Alto). |
| M4-14 | **Status HTTP de `/api/saude`.** Hoje o corpo diz `mongo: 'erro'` ou `pasta: 'erro'`, mas o status é sempre 200. | **200** quando tudo está `ok`; **503** quando `mongo` ou `pasta` está em `erro` (o corpo é o mesmo nos dois casos, `api` é sempre `ok` porque quem responde é a própria API). O indicador da web lê o corpo também no 503. |
| M4-15 | **Chunk JS de ~1.016 kB.** Konva, react-konva, `bson`, `zod` e o Radix entram todos no pacote de entrada. | **Divisão por rota** com `React.lazy` + `Suspense` (Editor, Comparação, `/dev/ui`) e `manualChunks` para `konva`, `bson` e o vendor de React; **sem dependência nova**. Meta mensurável: nenhum chunk acima de 500 kB (o aviso do Vite some) e a tela Projetos **não baixa** o chunk do Konva (teste E2E de rede). |
| M4-16 | **Títulos dos diálogos sem a serifa** (existe desde o M0). `DialogTitle` usa `cn('text-display-md text-ink')`, e o `tailwind-merge` descarta `text-display-md` por achar que conflita com `text-ink`. | Registrar as utilidades `text-display-*` (e `text-mono`) como tamanho de fonte no `extendTailwindMerge` de `apps/web/src/lib/utils.ts`, **auditar os outros usos de `cn()`** com essas classes e cobrir com teste de componente (classes presentes) e E2E (família computada "Newsreader" no título de um diálogo). |
| M4-17 | **Quedas 0xC0000409** (worker do Vitest em `rascunhos.test.ts`, 02/11; `npm start` pelo painel de preview no primeiro `GET /api/imagens/:id/arquivo`, 25/10). Causa desconhecida; não reproduzidas. | **Investigação com limite de tempo** (T14): reproduzir com repetição controlada, ligar os relatórios de diagnóstico do Node nos dois cenários e registrar a causa. Aceite: **causa corrigida com teste de regressão, ou documentada como não reproduzida** com o número de execuções e o plano de observação. **Não bloqueia o aceite do M4.** Qualquer mitigação que esconda a falha (repetir teste, ignorar código de saída) só com decisão do Nicholas. |
| M4-18 | **Formato padrão da exportação e aviso do PNG em imagens grandes.** Um PNG de 28 MP é lento de gerar e pesa muito; o JPG não tem transparência, é rápido e abre em qualquer computador (é o espírito da opção (d) da ADR-16, aplicado à exportação). | **Decisão (02/11):** nos **casos limite** (saída acima de **16 MP**, em geral o perfil Alto) o formato **padrão passa a ser JPG**. Se o usuário escolher **PNG**, o diálogo informa que o processamento pode demorar e **só gera depois do aceite** (botão "Aceitar e baixar PNG"). Abaixo do limite nada muda (padrão PNG, sem aviso). O arquivo baixado é sempre PNG ou JPG, **nunca WebP**: o WebP é só o formato interno de armazenamento (biblioteca e parede) e não chega ao computador do usuário. O limite de 16 MP é **proposta** a confirmar. |

Contradições menores, corrigidas sem decisão nova (DS-02: a documentação prevalece sobre o protótipo):
- O protótipo 08 pré-seleciona "Excluir" e o protótipo 12 desenha o painel do placeholder na coluna esquerda: valem M4-03 e M4-08.
- A M2 §5 diz "a imagem excluída e o placeholder automático são do M4" e a M2-14 manda tratar a imagem excluída como existente até lá: passa a valer a M4-06.
- A M3-10 manda **trocar os lados** na comparação; vale a RN-36 (M4-02).
- A DESIGN §7.1 lista "Excluídas" e Exportar como inativos "até o M4": ficam ativos.

### 0.2 Premissas (a revisar pelo Nicholas)

Formato **"Decidi <premissa> porque <causa> com o risco <o que pode dar errado>"**.

| # | Premissa |
|---|---|
| A-01 | Decidi que o **botão ⋯ da miniatura** é um `Button size=icon` de 28 px no canto superior direito, visível no hover, no foco por teclado e na miniatura selecionada, com `aria-label` "Mais ações de <nome>" e o único item "Remover ou excluir…", que fica **ausente nas imagens excluídas** (a lista de excluídas tem o botão **Restaurar**), porque a M0 §4.10 pede uma pergunta única antes de agir, com o risco de o botão que só aparece no hover passar despercebido (o teclado o alcança por foco). |
| A-02 | Decidi que o **diálogo "Remover ou excluir"** (640 px, protótipo 08) tem o cabeçalho com a miniatura (52 px), o nome do arquivo em Newsreader 22 e "O que deseja fazer com esta imagem?"; dois radio cards — **Remover deste projeto** ("Sai das variantes de <projeto>. Continua na biblioteca.") e **Excluir da biblioteca** ("Fica em Excluídas por 30 dias e pode ser restaurada. Nas composições, o espaço da foto é mantido sem imagem." — `danger-wash` quando marcado); a tabela "Usada em N lugares" (Projeto · Variante · Vezes, rolável a partir de 6 linhas); e o rodapé com **Cancelar** e a confirmação "Remover do projeto" (primário) ou "Excluir imagem" (`destructive`), conforme a opção; que **Remover deste projeto** fica inativo, com "Esta imagem não está neste projeto.", quando o projeto aberto não está em `imagens.projetos`; e que, sem usos, a tabela diz "Não está em nenhuma variante." mais os projetos em que foi carregada, porque a RF-29 pede mostrar as associações, com o risco de a tabela refletir só o estado salvo e não as alterações não salvas de outras abas. |
| A-03 | Decidi que, com a **ativa suja**, as duas confirmações abrem antes o diálogo da M3 A-12 ("Salvar as alterações de “<nome>”?" com Cancelar · Descartar alterações · Salvar e continuar), reutilizado como a quinta entrada, e que um conflito ao salvar interrompe a ação (diálogo da M3-09), porque a M0 §4.10 exige estado salvo, com o risco de o usuário descartar por hábito e perder o trabalho, já que a pilha também é zerada. |
| A-04 | Decidi que, depois da operação, a web chama **`adotarVariantesAlteradas`**: recarrega do servidor a ativa (se afetada) e zera a pilha dela como em "Usar a salva", **descarta do cache** as variantes salvas afetadas (conteúdo e pilha), limpa a seleção se a foto selecionada sumiu ou virou placeholder, recarrega o resumo do projeto (`semFoto`, rascunhos elegíveis) e mostra por 6 s "“<nome>” removida do projeto: N fotos em M variantes." ou "“<nome>” excluída. N fotos viraram espaço sem foto em M variantes.", com o aviso no diálogo "O histórico de desfazer das variantes afetadas será zerado", porque o servidor mudou o conteúdo por baixo da pilha, com o risco de o usuário perder o desfazer de uma variante que nem usava a imagem se o cache mantiver só as afetadas (só as afetadas são descartadas). |
| A-05 | Decidi que as operações do servidor sobre variantes (remover, excluir, purga) **não alteram `salvaEm`, `salvaPorSessao` nem `atualizadoEm` do projeto**, que a remoção e a exclusão somam `revisao + 1` nas variantes afetadas e reescrevem o `conteudo` dos rascunhos **sem mudar `salvoEm` nem `revisaoBase`**, porque não são salvamentos do usuário e a lista de projetos não deve reordenar por uma ação da biblioteca, com o risco de o cartão "A salva" do conflito mostrar a hora do último salvamento real e não a da exclusão, e de um rascunho recuperado passar pelo aviso de "base antiga" (que é o comportamento desejado). |
| A-06 | Decidi que **`GET /api/imagens/:id/associacoes`** devolve os usos das variantes **salvas** (`projetoId`, `projetoNome`, `varianteId`, `varianteNome`, `vezes`, ordenados por projeto e variante) e a lista dos projetos de `imagens.projetos`, e que o diálogo soma "Usada em N lugares" = soma de `vezes`, porque o protótipo 08 mostra projeto, variante e vezes, com o risco de o número divergir do que o usuário vê se houver alterações não salvas em outra aba (a ativa desta aba já está salva — A-03). |
| A-07 | Decidi que a **lista "Excluídas"** (protótipo 12) mostra o contador "N excluídas" no título, o chip "Excluídas ×", o texto "Removidas definitivamente após 30 dias. Restaurar não devolve a foto às composições.", e por item a miniatura esmaecida (55%, tons de cinza), o nome, "N dias restantes" (`danger-ink` com 3 dias ou menos; "1 dia restante" no singular) e **Restaurar**; que o estado vazio é "Nenhuma imagem excluída."; que restaurar mostra por 6 s "“<nome>” restaurada." e a imagem volta à lista "Todas"; e que o filtro não é persistido, porque segue a M2 (filtros por sessão), com o risco de o usuário achar que a restauração recolocou a foto nas composições (o texto da lista avisa). |
| A-08 | Decidi que o **painel do placeholder** ganha, quando há recomendação, o bloco "Foto anterior, restaurada" (card `accent-wash`, borda 2 px `accent`, miniatura de 48 × 32, nome do arquivo e **Usar**), que **Usar** executa o `preencherVaga` da M3 (A-23: mantém id, tamanho, posição, borda; recorte 0,0; 1 passo de desfazer), que **Escolher outra na biblioteca** leva o foco à primeira miniatura da coluna Biblioteca e que "Preencher com a foto selecionada" continua como está, porque o PRD manda recomendar a imagem anterior se restaurada, com o risco de o usuário não perceber o botão se a recomendação aparecer só depois de restaurar a imagem em outra tela. |
| A-09 | Decidi que a **recomendação** considera só imagens **ativas** (`excluidaEm = null`), que o nome vem da lista da biblioteca já carregada e que, se a imagem anterior foi purgada, o `imagemAnteriorId` fica nulo (purga, M4-09) e o bloco some, porque o PRD fala em "recomenda a anterior se restaurada", com o risco de a lista da biblioteca não ter carregado ainda a imagem restaurada em outra aba (a lista é recarregada ao abrir o editor). |
| A-10 | Decidi que a **purga** roda na inicialização da API (depois da migração e do reparo da M1 A-18) e a cada 24 h (`setInterval` com `unref`), que registra no log "Purga: N imagens removidas" e que o agendador é injetável nos testes, porque a M0 §4.10 pede inicialização e 24 h e o índice TTL do Mongo deixaria arquivos órfãos (M0 §4.3), com o risco de a API ficar meses ligada e uma imagem ficar até 24 h além do prazo (por isso o item vencido some da lista e não é restaurável — M4-07). |
| A-11 | Decidi que **`PUT` da variante** com foto de imagem excluída converte a foto em placeholder no servidor, grava e responde `{ revisao, salvaEm, imagensExcluidas: [ids] }`, que a web aplica a conversão ao conteúdo em tela **sem criar passo de desfazer** e marca esse conteúdo como o salvo, e que mostra o `Alert` "N fotos viraram espaço sem foto porque a imagem foi excluída em outra aba.", porque recusar travaria o Salvar da composição inteira, com o risco de o usuário não perceber a mudança se dispensar o aviso (o selo "N sem foto" sobe). O mesmo vale para o `POST` com `origem: copia`. |
| A-12 | Decidi que **`GET /api/imagens?situacao=excluidas`** devolve, além dos campos da lista ativa, `excluidaEm`, `purgaEm` e `diasRestantes` (calculado no servidor, arredondado para cima), e que `situacao` ausente vale `ativas`, porque o cliente não precisa do relógio, com o risco de a tela mostrar um número velho se ficar aberta por horas (a lista é recarregada ao abrir o filtro e ao restaurar). |
| A-13 | Decidi que **Exportar** (header, primário) fica ativo com escala definida, inativo sem escala ("Defina a escala primeiro.") e durante qualquer modo, que abre o diálogo "Exportar imagem" (640 px, protótipo 10) e que o diálogo diz em uma linha "Exporta o que está na tela, inclusive alterações não salvas." quando a ativa está suja, porque o usuário vê e exporta o mesmo estado, com o risco de o usuário supor que a exportação gravou a variante (não grava). |
| A-14 | Decidi que a **região exportada** é a parede inteira, que o tamanho é o do bitmap exibido (M4-10), que **PNG** mantém o alfa fora da região retificada e **JPG** a preenche com `#FFFFFF`, porque preserva o que a parede é sem inventar fundo no PNG, com o risco de o usuário abrir o PNG num visualizador que mostre o transparente como preto. |
| A-15 | Decidi que o **grid** exportado usa passo, cor e opacidade da variante, é desenhado **só dentro da parede inteira, abaixo das fotos**, com linha de 1 px na saída, **independe** de `grid.visivel`, e que "Incluir grid" abre **desligado** e não é persistido, porque a RN-19 dá a opção ao usuário a cada exportação, com o risco de, em densidades baixas, a linha de 1 px ficar mais fina que no editor. |
| A-16 | Decidi que o **placeholder** sai como retângulo no tamanho externo, **sem borda**, com hachura a 45° alternando `danger` a 45% e a 16% em faixas de 0,5 cm (mínimo de 3 px na saída), e que a foto com imagem indisponível sai como retângulo `sand` do tamanho externo, porque a DESIGN §2.2 e a M0 §4.10 fixam o placeholder e a imagem indisponível não é placeholder (M2 A-16), com o risco de o usuário exportar com uma foto cinza sem ler o aviso do diálogo. |
| A-17 | Decidi que o **Worker de exportação** recebe a lista de comandos (cm) e as URLs, busca cada arquivo na mesma origem, decodifica uma imagem por vez com `createImageBitmap`, desenha em `OffscreenCanvas` e devolve o `Blob` por `convertToBlob`, que a prévia usa o mesmo caminho com o lado maior de 480 px e que fechar o diálogo chama `abort()`, porque a ADR-08 e a P6 pedem compositor próprio fora da thread da UI, com o risco de o Worker falhar em memória com 28 MP e o usuário ver só "Não foi possível gerar a imagem." (o perfil Alto é o caso extremo). |
| A-18 | Decidi que o **nome do arquivo** é `<projeto>-<variante>-AAAAMMDD-HHmm.<ext>` (DV-11) com cada parte em *slug*: minúsculas, sem acentos (NFD), qualquer sequência fora de `a-z0-9` vira um hífen, hífens das pontas saem, máximo de 60 caracteres por parte, "projeto" ou "variante" se ficar vazia, e data e hora de Brasília, porque o RF-80 fixa o formato e o fuso, com o risco de duas exportações no mesmo minuto terem o mesmo nome (o navegador renomeia com "(1)"). |
| A-19 | Decidi que o **JPG** sai com qualidade 0,92, que o download é um `<a download>` com a URL do `Blob`, liberada depois do clique, e que falha vira `Alert` `danger` "Não foi possível gerar a imagem." dentro do diálogo, com a opção de tentar de novo, porque é o caminho comum a Chrome e Edge sem diálogo de pasta, com o risco de o navegador do usuário bloquear downloads automáticos. |
| A-20 | Decidi as metas de **desempenho**: exportar a variante com 40 fotos num perfil Leve (3072 px) < 3 s; no Alto (6144 px) < 8 s; a thread principal sem tarefa longa (> 100 ms) durante a geração; prévia < 500 ms; abrir o diálogo de imagem com as associações < 300 ms; purga de 200 imagens < 5 s, porque a RNF-03 pede fluidez e a ARCHITECTURE §8 fixa orçamentos, com o risco de a máquina do usuário ficar acima disso com fotos de textura (hipótese a medir na T15 e registrar no `MEMORY.md`). |
| A-21 | Decidi que a **comparação com a RN-36** mantém a abertura da M3-10 (ativa à esquerda, seguinte à direita), mantém Comparar inativo com menos de 2 variantes ("Crie ao menos duas variantes para comparar."), deixa **todas as variantes selecionáveis nos dois seletores**, aplica a escolha só ao painel em que o usuário escolheu, sem troca de lados, sem mensagem e sem destaque do outro lado, e que com a mesma variante os dois painéis mostram o mesmo conteúdo em tela (o marcador "não salva" aparece nos dois, se for o caso), porque você pediu que o sistema aceite e não altere nada automaticamente, com o risco de o usuário comparar uma variante com ela mesma sem querer (os cabeçalhos mostram o nome em cada lado). |
| A-22 | Decidi que **ADR-16 opção (b)** muda só a codificação da **retificada**: WebP com qualidade 0,8 em todos os perfis, no Worker e na conferência do servidor; que as fotos e a parede enviada seguem a qualidade da ADR-05; e que o E2E do Alto passa a esperar ≤ 3 s na foto sintética e **imprime** o tempo da foto ruidosa, porque preserva a resolução (M4-10) e o formato do modelo, com o risco de a retificada ficar com artefatos perceptíveis em paredes de muita textura, que o Nicholas confere na T13. |
| A-23 | Decidi que `/api/saude` responde 503 por **`mongo: 'erro'` ou `pasta: 'erro'`**, que o teste simula cada componente em erro pelo contexto de teste da API e que o indicador da web mostra o componente em erro mesmo no 503, porque o corpo já traz o estado, com o risco de um monitor externo tratar 503 como API fora do ar (a API só atende localhost e o uso é de um só usuário). |
| A-24 | Decidi que a **divisão do pacote** usa `React.lazy` em `Editor`, `Comparacao` e `/dev/ui`, `Suspense` com um *skeleton* de página, `manualChunks` para `konva` (com `react-konva`), `bson` e o vendor de React, e que o Worker de retificação e o de exportação seguem como chunks próprios, porque corta o pacote de entrada sem dependência nova, com o risco de o editor abrir com um *flash* de carregamento de alguns milissegundos (os arquivos vêm de `localhost`). |
| A-25 | Decidi que a **investigação das quedas** (M4-17) usa 30 repetições do pacote `apps/api` e 100 requisições a `GET /api/imagens/:id/arquivo` no `npm start` aberto pelo painel e à mão, com `--report-on-fatalerror` e `--report-uncaught-exception`, e que o resultado vai para o `MEMORY.md` (Questões em aberto, com data), porque a causa é desconhecida e o código de saída 0xC0000409 (falha rápida do Windows) costuma vir de código nativo, com o risco de a falha continuar sem reproduzir e ficar aberta. |
| A-26 | Decidi que a **forma de trabalho** segue a regra dos gates (`CLAUDE.md`): TDD em commits `test(m4): …` vermelhos antes de cada `feat(m4): …`/`fix(m4): …`, **por camada** (domínio e API; store e cliente; UI; E2E), referenciando os IDs do PRD, com `git push` da branch ao fim de cada conjunto verde e a sua validação só na T15, porque foi o que o Nicholas aceitou no M3 (decisões de 02/11), com o risco de um erro de interpretação desta spec só aparecer na validação final. |
| A-27 | Decidi que o M4 **não adiciona dependências** (o Worker e o `OffscreenCanvas` são APIs do navegador; a leitura do PNG exportado no E2E usa o `sharp`, já presente), porque a P4 pede o mínimo, com o risco de a leitura de pixels no E2E ficar trabalhosa sem uma biblioteca de imagem do lado do teste. |
| A-28 | Decidi que o **caso limite** da M4-18 é a saída acima de 16 MP (`LIMITE_PNG_MP = 16`: o Alto passa; o Médio e o Leve não), que nele o diálogo abre com **JPG** marcado, que ao escolher PNG aparece o `Alert` de aviso "Esta imagem tem N MP. Gerar PNG pode demorar bastante e o arquivo fica grande. JPG é mais rápido e abre em qualquer computador." e o botão primário passa a **"Aceitar e baixar PNG"**, de modo que a geração só começa nesse clique, com o aviso à vista (voltar a JPG ou Cancelar desfaz), porque você pediu informar e exportar só depois do aceite, com o risco de o limite de 16 MP não ser o ponto certo para a máquina do usuário (a T15 mede o tempo do PNG no Alto e o valor se ajusta). |

## 1. Objetivo

Fechar o ciclo de vida das imagens e entregar a exportação: o usuário **remove** uma imagem de um projeto, **exclui** da biblioteca (com 30 dias para restaurar, espaços sem foto nas composições e recomendação da foto anterior quando restaurada), vê a **purga** acontecer sozinha e **exporta** a composição em PNG ou JPG na resolução da parede. Entram também a **RN-36** da comparação e as **pendências técnicas** acumuladas (ADR-16, `/api/saude`, divisão do pacote, títulos dos diálogos, quedas 0xC0000409). Ao fim do M4, a v1 P0 está completa; o M5 só trará os itens P1.

## 2. Escopo

| Dentro | Fora (marco) |
|---|---|
| Remover deste projeto, excluir da biblioteca, associações — RF-29, RN-24, M4-03 a M4-05 | Contador de uso nas miniaturas (RF-23 — M5) |
| Filtro "Excluídas", restauração, prazo de 30 dias — RF-28, RF-29, M4-07 | Esvaziar a lixeira antes do prazo, restaurar com reposição nas composições (ideias futuras) |
| Placeholders gerados pela exclusão, recomendação da imagem anterior — RF-30a, M4-08 | Trocar a imagem de uma foto já preenchida (RF-37, ideia futura) |
| Salvar com imagem excluída (conversão no servidor) — M4-06 | Sincronização entre abas (RF-74, ideia futura) |
| Purga na inicialização e a cada 24 h — RN-24, M4-09 | Purga manual pelo usuário |
| Exportação PNG/JPG, com ou sem grid, placeholders em hachura — RF-80, RN-19, ADR-08 | PDF, mapa de instalação, tabela CSV, lista de impressão (RF-81 a RF-83, ideias futuras) |
| RN-36 na comparação — M4-02 | Comparação com edição, destaque de diferenças (ideias futuras) |
| Pendências técnicas — M4-13 a M4-17 | Linha forte do grid (RF-52 — M5) |

**O que muda em relação ao M2 e ao M3** (para não passar despercebido na implementação):

| Item anterior | No M4 |
|---|---|
| M2 §5: "a imagem excluída e o placeholder automático são do M4"; M2-14: imagem excluída conta como existente | O *hard save* converte foto de imagem excluída em placeholder (M4-06, A-11). |
| M2-07 / DESIGN §7.1: "Excluídas" visível e inativo | Ativo (A-07). |
| M3-01: associação básica no M3; recomendação, exclusão e restauração no M4 | A recomendação, a exclusão que gera placeholders e a restauração entram (M4-05, M4-07, M4-08). |
| M3-10 e A-26: escolher a variante do outro lado **troca os lados** | RN-36: o sistema aceita e não altera o outro painel (M4-02, A-21). |
| M3 A-25: Exportar inativo | Ativo com escala (A-13). |
| M3 A-12: três entradas da decisão ao deixar a ativa suja | Duas entradas novas: remover e excluir imagem (A-03). |
| Pacote JS de entrada com tudo junto (~1.016 kB) | Divisão por rota (A-24). |

## 3. Comportamento

### 3.1 Menu da miniatura e diálogo "Remover ou excluir" (RF-29, RN-24, M4-03, A-01 a A-03, A-06)

- Botão ⋯ na miniatura (A-01) → **Remover ou excluir…** → se a ativa está suja, antes a decisão da A-12 (A-03) → carrega `GET /api/imagens/:id/associacoes` e abre o diálogo da A-02.
- Opção padrão: **Remover deste projeto**. A confirmação muda de rótulo e de estilo com a opção. **Cancelar**, Esc e × fecham sem alterar nada.
- A confirmação desabilita enquanto a requisição está em curso; erro vira `Alert` dentro do diálogo, sem fechar.

### 3.2 Remover do projeto (M4-04, A-04, A-05)

1. `DELETE /api/projetos/:pid/imagens/:id` (§5): `$pull` do projeto em `imagens.projetos`; em cada variante **salva** do projeto, remove as fotos da imagem (não viram placeholder), `revisao + 1`; o mesmo no `conteudo` dos rascunhos do projeto.
2. A web chama `adotarVariantesAlteradas` (A-04) e mostra o aviso de 6 s.
3. A imagem segue na biblioteca (filtro "Todas"); deixa o filtro "Projeto" (M2-05) e volta a ele se for usada de novo e salva (`$addToSet` do *hard save*).

### 3.3 Excluir da biblioteca (M4-05, A-04, A-05)

1. `DELETE /api/imagens/:id` (§5): `excluidaEm = agora`, `purgaEm = agora + 30 dias`; **em todos os projetos**, cada foto da imagem nas variantes salvas e nos rascunhos vira placeholder (`imagemAnteriorId = id`, `imagemId = null`); variantes afetadas com `revisao + 1`. Idempotente: imagem já excluída responde 200 sem converter nada.
2. A imagem some da biblioteca ativa e entra em "Excluídas". Os arquivos continuam no disco até a purga (para a restauração).
3. A web chama `adotarVariantesAlteradas` e mostra o aviso de 6 s. O selo "N sem foto" sobe nas variantes e nos cartões dos projetos afetados (quando o projeto é aberto ou a lista recarregada).

### 3.4 Excluídas e restauração (RF-28, RF-29, M4-07, A-07, A-12)

- "Excluídas" fica no menu ⋯ do filtro da biblioteca (já existente, M2): ativa o filtro, carrega `GET /api/imagens?situacao=excluidas` e mostra o contador, o chip "Excluídas ×", o texto de aviso e a lista (A-07). Com o filtro ativo, os demais ficam desmarcados (DESIGN §6).
- **Restaurar**: `POST /api/imagens/:id/restaurar`; a imagem sai da lista, volta a "Todas" e a "Projeto", se estiver em `imagens.projetos`. Não mexe em nenhuma variante (RF-30a).
- Item vencido: 410 "Esta imagem passou do prazo de 30 dias e será removida." e a lista é recarregada.

### 3.5 Placeholder: recomendação e associação (RF-30a, M3-01, M4-08, A-08, A-09)

- Painel do placeholder (M2/M3): cabeçalho "Sem foto", tamanho, borda, posição e **Preencher com a foto selecionada** (M3). Entra o bloco "Foto anterior, restaurada" **acima** do preenchimento, quando `imagemAnteriorId` aponta para uma imagem ativa (A-08, A-09).
- **Usar** e o preenchimento comum fazem o mesmo (`preencherVaga`); a diferença é só a origem da imagem.
- Variantes com placeholder já são sinalizadas pelo selo "N sem foto" (M3-02); o M4 não muda isso.

### 3.6 Salvar com imagem excluída (M4-06, A-11)

- A web continua conferindo no cliente só o que sabe (a lista da biblioteca). Se o servidor converter fotos no *hard save* ou na cópia, a resposta traz `imagensExcluidas` e a web aplica a conversão ao conteúdo em tela e ao último salvo, sem passo de desfazer, mostrando o `Alert` da A-11.
- O rascunho **não** valida imagens (M3 A-07): a conversão acontece no *hard save* seguinte.

### 3.7 Purga (RN-24, M4-09, A-10)

- Rotina da §4.4 na inicialização da API e a cada 24 h. Sem tela e sem ação do usuário. O resultado vai só para o log; o corpo de `/api/saude` não muda.

### 3.8 Exportação (RF-80, RN-19, RN-12, ADR-08, protótipo 10, M4-10 a M4-12, A-13 a A-20)

- **Exportar** (header, primário) abre o diálogo (A-13) com: título "Exportar imagem" e ×; à esquerda a **prévia** (A-17); à direita **Formato** (segmented PNG · JPG, 160 px, padrão PNG), **Incluir grid** (`Switch`, desligado), **Resolução** em mono ("3072 × 2000 px"), o texto "Espaços sem foto aparecem em vermelho hachurado. O que passar da parede é recortado." e, quando houver, os avisos de alterações não salvas (A-13) e de "N fotos com imagem indisponível saem como retângulo cinza." (A-16).
- Rodapé: **Cancelar** e o primário **Baixar PNG** / **Baixar JPG** (ícone de download). Gerando: botão com indicador "Gerando…" e desabilitado; **Cancelar** aborta.
- **Imagem grande** (M4-18, A-28): com a saída acima de 16 MP, o formato abre em **JPG**; ao escolher **PNG**, o `Alert` da A-28 avisa que pode demorar e o primário vira "Aceitar e baixar PNG". Nada é gerado antes desse clique.
- A geração segue a §4.5 e o download, a A-19. Na prévia, só "Incluir grid" tem efeito; o formato não a altera.
- Nome do arquivo: A-18. Nada é gravado no servidor.

### 3.9 Comparação com a RN-36 (M4-02, A-21)

- Os dois seletores da tela de comparação listam **todas** as variantes do projeto, inclusive a que está no outro painel.
- Escolher em um painel a variante que já está no outro **só muda esse painel**: o outro mantém a variante e nada é trocado, avisado ou destacado. Os dois painéis passam a mostrar a mesma variante (mesmo conteúdo em tela, zoom e pan sincronizados).
- Depois, escolher outra variante em um painel continua não mexendo no outro. Não há mais "troca de lados".
- Inalterados: abertura com a ativa e a seguinte (M3-10), entrada inativa com menos de 2 variantes ou sem escala, visualização limpa, chaves Grid, Área útil e Alertas valendo para os dois lados, somente visualização.

### 3.10 Pendências técnicas (M4-13 a M4-17, A-22 a A-25)

| Item | Comportamento esperado |
|---|---|
| ADR-16 (A-22) | A retificada sai em WebP com qualidade 0,8 em todos os perfis; tempo do Alto medido e registrado. |
| `/api/saude` (A-23) | 200 com tudo `ok`; 503 com `mongo` ou `pasta` em `erro`; corpo igual. |
| Pacote JS (A-24) | Nenhum chunk acima de 500 kB; Projetos não baixa o Konva. |
| Títulos dos diálogos (M4-16) | Título em Newsreader 22–24 em todos os diálogos. |
| Quedas 0xC0000409 (A-25) | Causa corrigida ou relatório de investigação no `MEMORY.md`. |

## 4. Domínio e algoritmos

### 4.1 Módulos novos em `packages/domain` (TS puro, testes obrigatórios)

Pastas novas: `imagens/` e `exportacao/` (a registrar na ARCHITECTURE §6 antes de criar — §11).

| Módulo | Funções |
|---|---|
| Ciclo de vida (`imagens/`) | `converterEmPlaceholder(foto, imagemId)` (imagem → `null`, `imagemAnteriorId = imagemId`, resto inalterado); `removerFotosDaImagem(fotos, imagemId)` → `{ fotos, removidas }`; `fotosDaImagem(fotos, imagemId)` → quantidade; `usosDaImagem(variantes, imagemId)` → `[{ varianteId, vezes }]`; `diasRestantes(purgaEm, agora)` (arredonda para cima; `≤ 0` = vencida); `restauravel(imagem, agora)`; `purgaVencida(imagem, agora)`; `recomendacaoDoPlaceholder(foto, imagensAtivas)` → imagem ou `null` (A-09) |
| Comparação | `escolherVarianteDoPainel(par, painel, varianteId)` → novo par: só troca o painel indicado, aceita a mesma variante nos dois (RN-36); `parInicial(variantes, ativaId)` (ativa e seguinte; anterior se for a última — M3-10) |
| Exportação (`exportacao/`) | `regiaoDeExportacao(parede)` → caixa da parede inteira em cm (`paredeInteira`, M1); `resolucaoDeExportacao(parede)` → `{ larguraPx, alturaPx, pxPorCm }` (M4-10); `resolucaoDaPrevia(resolucao, ladoMaxPx)`; `comandosDeExportacao({ variante, parede, incluirGrid })` → lista ordenada (§4.5); `slugDoNome(texto)`; `nomeDoArquivoExportado({ projeto, variante, data, formato })` (A-18); `formatoPadraoDaExportacao(resolucao)` → `png` ou `jpg` (M4-18); `pngDemorado(resolucao)` → `true` acima do limite (A-28) |
| Constantes | `PRAZO_PURGA_DIAS = 30` (já existe), `INTERVALO_PURGA_HORAS = 24`, `QUALIDADE_JPG = 0.92`, `LADO_PREVIA_EXPORTACAO_PX = 480`, `FAIXA_HACHURA_CM = 0.5`, `FAIXA_HACHURA_MIN_PX = 3`, `LIMITE_PNG_MP = 16` |

O domínio não gera ids nem lê o relógio: `agora` e `data` chegam como parâmetro.

### 4.2 Remover do projeto e excluir (M4-04, M4-05)

- **Remover**: para cada variante do projeto com a imagem, `removerFotosDaImagem`; `revisao + 1` só nas variantes em que `removidas > 0`. O mesmo no `conteudo.fotos` de cada rascunho do projeto, sem mudar `salvoEm` nem `revisaoBase` (A-05).
- **Excluir**: para cada variante e rascunho de **qualquer projeto** com a imagem, `converterEmPlaceholder` em cada foto da imagem; `revisao + 1` nas variantes com pelo menos uma foto convertida.
- As consultas usam os índices `{ 'fotos.imagemId': 1 }` e, nos rascunhos, a busca por `conteudo.fotos.imagemId` (índice a criar na migração `0002`, se a medição da T15 pedir; para o volume de uso pessoal a varredura basta).

### 4.3 Recomendação (M4-08, A-09)

`recomendacaoDoPlaceholder(foto, imagensAtivas)`: `foto.imagemId === null` e `foto.imagemAnteriorId` ∈ `imagensAtivas` → a imagem; senão `null`.

### 4.4 Purga (M4-09, A-10)

Para cada imagem com `purgaEm ≤ agora`, em ordem de `purgaEm`:
1. `updateMany` em `variantes` e `rascunhos`: zera `imagemAnteriorId` das fotos que apontam para a imagem (sem mudar `revisao` nem `salvoEm`).
2. Apaga `imagens/<id>.webp` e `imagens/<id>.thumb.webp` (ausente = ok).
3. Apaga o documento.
Erro em um passo: registra, mantém o documento (a imagem volta na próxima rodada) e segue para a próxima imagem. Trava em memória evita duas rodadas ao mesmo tempo.

### 4.5 Comandos de exportação (ADR-08, RN-19, M4-10, M4-11, A-14 a A-16)

`comandosDeExportacao` devolve, **em cm** e na ordem de desenho:

1. `parede` — arquivo (retificada com perspectiva; foto processada com escala linear), `origemCm`, `tamanhoCm`.
2. `grid` (só com `incluirGrid`) — passo, cor, opacidade e limites = parede inteira; linhas a partir de 0,0 (M1 A-07 sem o corte de 4 px).
3. Para cada foto, na ordem do array (pilha — DM-04):
   - com imagem: `foto` — retângulo externo, retângulo impresso (externo − borda), cor e largura da borda (sem retângulo se a borda é 0), `imagemId` e o recorte *cover* calculado pela **mesma função do domínio** que o canvas usa (M2 §4.3);
   - placeholder: `placeholder` — retângulo externo, sem borda (A-16).
4. Nada mais: sem seleção, alças, alertas, área útil, origem nem bounding box (RN-19).

O executor (web, `infra/`) converte cm → px com `pxPorCm` da resolução, desenha cada comando e, se o arquivo de uma imagem não carregar, desenha o retângulo `sand` do tamanho externo e conta a falha (A-16). O JPG preenche o fundo antes de tudo; o PNG não.

### 4.6 Nome do arquivo (A-18)

`slugDoNome(t)`: NFD, remove diacríticos, minúsculas, troca cada sequência fora de `a-z0-9` por `-`, apara `-` das pontas, corta em 60 caracteres e apara de novo; vazio → "projeto" ou "variante". Data e hora em Brasília (`America/Sao_Paulo`): `AAAAMMDD-HHmm`. Exemplo: "Sala de Estar" + "Pirâmide 2" em 02/11/2026 14:35 PNG → `sala-de-estar-piramide-2-20261102-1435.png`.

## 5. API (M4)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /api/imagens` (M2, ampliada) | `?situacao=ativas\|excluidas` (padrão `ativas`) | para `excluidas`, acrescenta `excluidaEm`, `purgaEm`, `diasRestantes`; só `purgaEm` futuro; mais novas primeiro (por `excluidaEm`) |
| `GET /api/imagens/:id/associacoes` | — | 200 `{ imagem: { _id, nomeOriginal, thumbUrl }, usos: [{ projetoId, projetoNome, varianteId, varianteNome, vezes }], projetos: [{ projetoId, projetoNome }] }` · 404 |
| `DELETE /api/imagens/:id` (excluir) | — | 200 `{ imagem: { _id, excluidaEm, purgaEm }, afetadas: [{ projetoId, varianteId, revisao, fotos }], fotosConvertidas }` · 404; já excluída → 200 sem conversões |
| `POST /api/imagens/:id/restaurar` | — | 200 `{ imagem }` (formato da lista ativa) · 404 (inexistente ou purgada) · **410** prazo vencido; já ativa → 200 |
| `DELETE /api/projetos/:pid/imagens/:id` (remover do projeto) | — | 200 `{ afetadas: [{ varianteId, revisao, fotos }], fotosRemovidas }` · 404 projeto ou imagem; sem usos → 200 vazio |
| `PUT /api/projetos/:pid/variantes/:id` (M1 a M3, ampliada) | igual | acrescenta `imagensExcluidas: string[]` na resposta e converte as fotos (A-11) |
| `POST /api/projetos/:pid/variantes` (M3, ampliada) | igual | `origem: copia` com imagem excluída converte em placeholder e devolve `imagensExcluidas` |
| `GET /api/saude` (M0, ampliada) | — | mesmo corpo; **503** com `mongo` ou `pasta` em `erro` (M4-14) |

Regras comuns do M1 a M3 continuam (erros `{ erro, detalhes? }` em pt-BR, Zod na entrada, API só em `127.0.0.1`, sem transações: cada operação é uma sequência idempotente — §4.2 e §4.4).

Rotas de imagem e variante já existentes mantêm os formatos. Os arquivos da imagem excluída **continuam servidos** por `GET /api/imagens/:id/arquivo` até a purga (a recomendação e a restauração não dependem deles, mas um rascunho antigo ainda os referencia).

## 6. Web

| Camada | Entrega |
|---|---|
| `app/` | Fatia **biblioteca**: filtro "Excluídas", lista de excluídas, diálogo de imagem. Fatia **documento**: `adotarVariantesAlteradas` (A-04), conversão local no *hard save* (A-11). Ações novas: `abrirDialogoImagem`, `removerImagemDoProjeto`, `excluirImagem`, `carregarExcluidas`, `restaurarImagem`, `usarFotoAnterior`, `abrirExportacao`, `escolherVarianteDoPainel` (RN-36). Rotas com `React.lazy` (A-24). |
| `infra/` | `ClienteApi` ganha as rotas da §5. **`exportacao.ts`** (cliente do Worker: prévia e exportação) e **`workers/exportar.worker.ts`** (A-17); sem dependências novas. |
| `ui/canvas/` | Sem mudança no `Palco.tsx` (o compositor de exportação não usa Konva). Placeholder e "Imagem indisponível" iguais aos do M2. |
| `ui/paineis/` | Painel do placeholder com o bloco "Foto anterior, restaurada" (A-08). |
| `ui/telas/editor/` e `ui/componentes/` | `Biblioteca` com o menu ⋯ da miniatura e a lista de excluídas; `DialogoImagem` (A-02); `DialogoExportar` (A-13 a A-19); `DialogoSair`/decisão da A-12 com as duas entradas novas. |
| `ui/telas/comparacao/` | Seletores sem troca de lados (A-21). |
| `lib/utils.ts` | `extendTailwindMerge` com as utilidades `text-display-*` e `text-mono` (M4-16). |
| Build | `vite.config` com `manualChunks` (A-24). |

Dependências novas: nenhuma prevista. Qualquer uma para e pede aprovação.

## 7. Testes

| Tipo | Cobertura |
|---|---|
| Unitário (domínio) | `converterEmPlaceholder` (campos preservados, `imagemAnteriorId` sobrescrito), `removerFotosDaImagem`, `usosDaImagem`, `diasRestantes` (arredondamento, vencida), `restauravel`, `purgaVencida`, `recomendacaoDoPlaceholder` (ativa, excluída, nula). **`escolherVarianteDoPainel`** (RN-36: mesma variante nos dois lados, escolha em um painel não mexe no outro, sequência A/B → B/B → C/B), `parInicial`. Exportação: `regiaoDeExportacao` e `resolucaoDeExportacao` (perspectiva e linear), `resolucaoDaPrevia`, `comandosDeExportacao` (ordem das camadas, grid opcional abaixo das fotos, borda 0 sem retângulo, placeholder sem borda, nada de seleção ou alerta), `slugDoNome` (acentos, símbolos, vazio, 60 caracteres), `nomeDoArquivoExportado` (fuso de Brasília, minúsculas), `formatoPadraoDaExportacao` e `pngDemorado` (Leve e Médio abaixo do limite, Alto acima, exatamente 16 MP). Cobertura do domínio ≥ 90%. |
| API (integração) | Associações (usos por projeto e variante, projetos carregados, 404). **Excluir**: marca e prazo de 30 dias, conversão em todos os projetos nas variantes e nos rascunhos, `revisao + 1` só nas afetadas, `salvaEm` e `projetos` intactos, idempotência, arquivos continuam servidos. **Restaurar**: limpa campos, não repõe imagem, 410 no vencido, idempotência. **Remover do projeto**: fotos somem, `$pull`, `revisao + 1`, rascunhos reescritos sem mudar `salvoEm`, outras variantes e projetos intactos. Listagem de excluídas (`diasRestantes`, vencida fora). `PUT` e `POST` com imagem excluída convertem e devolvem `imagensExcluidas`. **Purga**: vencida apagada (documento e arquivos), referências zeradas sem mudar revisão, não vencida preservada, arquivo ausente, erro em uma imagem não derruba as outras, relógio injetado, sem rodadas sobrepostas. `/api/saude` 200 e 503. Banco de teste com o seed existente (excluídas vencida e não vencida, restaurada, placeholder com e sem recomendação). |
| Componentes | Menu da miniatura (visível no hover e no foco); `DialogoImagem` (opção padrão, rótulo e estilo da confirmação, "Remover" inativo fora do projeto, tabela de usos, sem usos, erro); decisão da A-12 nas duas entradas; lista de excluídas (dias restantes e cor, vazio, restaurar, filtro); bloco "Foto anterior" (com e sem recomendação, **Usar**, **Escolher outra**); `Alert` da A-11; `DialogoExportar` (formato, grid, resolução, avisos, estados gerando e erro, nome do arquivo, cancelar; acima de 16 MP abre em JPG e o PNG mostra o aviso com o botão "Aceitar e baixar PNG"); seletores da comparação com a **RN-36**; `DialogTitle` com `text-display-md` e `text-ink` presentes; indicador de saúde com o corpo do 503. |
| E2E (Playwright) | (1) Remover deste projeto: fotos somem das variantes, imagem segue em "Todas", pilha zerada. (2) Excluir: fotos viram placeholder em duas variantes e em outro projeto, "N sem foto" sobe, imagem em "Excluídas" com "30 dias restantes". (3) Restaurar: volta à biblioteca, **placeholders continuam vazios**, o painel do placeholder recomenda "Foto anterior, restaurada" e **Usar** preenche mantendo formato e posição. (4) Com a ativa suja, remover/excluir pede Salvar, Descartar ou Cancelar. (5) Duas páginas: excluir em uma e salvar a variante antiga na outra → conflito (variante afetada) ou conversão (variante não afetada, A-11). (6) **Exportação PNG**: arquivo baixado com o nome do padrão; largura e altura iguais à resolução da parede; pixel de uma foto na posição esperada; **sem contorno de seleção nem de alerta**; placeholder com hachura vermelha; com "Incluir grid" aparecem as linhas e sem ele não. (7) JPG: tipo e fundo branco fora da região retificada. (7b) Parede acima de 16 MP (perfil Alto): o diálogo abre em JPG; escolher PNG mostra o aviso e nada é gerado até "Aceitar e baixar PNG". (8) Exportar com alterações não salvas reflete a tela. (9) **RN-36**: na comparação, escolher no segundo painel a variante do primeiro deixa os dois iguais, e depois escolher outra no primeiro não altera o segundo; zoom e pan seguem sincronizados. (10) Projetos não baixa o chunk do Konva (rede); nenhum chunk > 500 kB. (11) Título de diálogo com a família "Newsreader". (12) Nenhuma requisição fora de `localhost` (teste existente estendido à exportação). |
| Desempenho | Metas da A-20; ADR-16 (Alto sintético ≤ 3 s e ruidoso registrado); registradas no `MEMORY.md`. |

## 8. Critérios de aceite do M4

1. **Remover** uma imagem do projeto tira as fotos dela de todas as variantes do projeto e a mantém na biblioteca; **excluir** a leva para "Excluídas" por 30 dias e converte as fotos em placeholder em todos os projetos; ambas mostram as associações e exigem a ativa salva (RF-29, RN-24, M4-03 a M4-05).
2. **Restaurar** devolve a imagem à biblioteca sem repor os placeholders; o placeholder recomenda a imagem anterior restaurada e aceita outra; as variantes com placeholder seguem sinalizadas (RF-28, RF-30a, M4-07, M4-08).
3. **Purga** apaga documento e arquivos vencidos e zera `imagemAnteriorId` sem mudar revisões (M4-09).
4. Salvar com imagem excluída converte em placeholder e avisa (M4-06).
5. **Exportação** PNG/JPG na resolução da parede, com o nome `<projeto>-<variante>-AAAAMMDD-HHmm.<ext>`, com ou sem grid, placeholders em hachura vermelha, sem seleção, alças, alertas, área útil nem origem; o que passa da parede é recortado (RF-80, RN-12, RN-19, **PRD aceite 8**). Acima de 16 MP o padrão é JPG e o PNG só é gerado depois do aceite do aviso (M4-18).
6. **RN-36:** na comparação, a mesma variante pode estar nos dois painéis e nada é trocado automaticamente (M4-02).
7. **ADR-16:** a retificada em WebP 0,8; o Alto com foto sintética ≤ 3 s e a foto ruidosa medida e registrada (M4-13).
8. `/api/saude` responde 503 com componente em erro (M4-14).
9. Nenhum chunk acima de 500 kB e Projetos sem o Konva (M4-15).
10. Títulos de todos os diálogos em Newsreader (M4-16).
11. Quedas 0xC0000409 investigadas e registradas (M4-17); não bloqueia o aceite.
12. Desempenho da A-20 atingido ou registrado com plano de ação no `MEMORY.md`.
13. `typecheck`, `lint`, `test` e `e2e` verdes; cobertura do domínio ≥ 90%; nenhuma requisição externa.

## 9. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Constantes, pastas `imagens/` e `exportacao/` (após a ARCHITECTURE §6), migração `0002` só se a medição pedir | PR-M4-03 a 05 |
| T2 | Domínio: ciclo de vida, recomendação, comparação (RN-36) + testes | T1 |
| T3 | Domínio: exportação (região, resolução, comandos, nome) + testes | T1 |
| T4 | API: associações, excluir, restaurar, remover do projeto, listar excluídas + testes | T2 |
| T5 | API: salvar e copiar com imagem excluída; purga (rotina e agendador) + testes | T4 |
| T6 | Web: store e biblioteca — menu, diálogo de imagem, excluídas, restaurar, `adotarVariantesAlteradas`, decisão da A-12 | T4 |
| T7 | Web: painel do placeholder (recomendação, **Usar**) e conversão local no *hard save* | T5, T6 |
| T8 | Web: exportação (diálogo, Worker, prévia, download) | T3 |
| T9 | Web: comparação com a RN-36 | T2 |
| T10 | API: `/api/saude` com 503 | — |
| T11 | Divisão do pacote JS (M4-15) | T6, T8, T9 |
| T12 | Títulos dos diálogos (M4-16) | — |
| T13 | ADR-16: WebP 0,8 na retificada e medição (M4-13) | — |
| T14 | Investigação das quedas 0xC0000409 (M4-17) | — |
| T15 | E2E + desempenho + README + `MEMORY.md` + validação do Nicholas | todas |

## 10. Forma de trabalho

- Conforme a A-26: TDD em commits `test(m4): …` vermelhos antes de cada `feat(m4)`/`fix(m4)`, por camada, com `typecheck`, `lint`, `test` e `e2e` verdes ao fechar cada conjunto e `git push` da branch de trabalho (`claude/*`). A ordem da §9 é a de implementação; T10, T12, T13 e T14 podem entrar em qualquer ponto.
- Gate do `CLAUDE.md`: **a implementação só começa com esta spec concluída pelo Nicholas** e os testes escritos antes do código. Validação dele na **T15**.
- Esta spec foi escrita sem abrir o código-fonte. Pontos que dependem da forma real da store, da função de recorte e do cliente HTTP (A-04, §4.5, §6) devem ser reconferidos contra a implementação do M3 na T1.
- Qualquer dependência fora das ADRs para e pede aprovação (A-27).

## 11. Alterações a fazer em outros documentos (após a revisão, PR-M4-05)

**Já aplicada (02/11):** PRD v0.15 — RN-36, RF-92 ("os dois painéis podem mostrar a mesma variante") e linha do M4 no roadmap com o escopo desta spec.

| Documento | Alteração prevista |
|---|---|
| `docs/PRD.md` | RF-29/RN-24: remover × excluir, associações, exigência de estado salvo, `projetos` intacto na exclusão, revisão sem `salvaEm`, restauração e prazo vencido (M4-04, M4-05, M4-07); RF-30a: recomendação (M4-08); RF-80/RN-19: região, resolução, transparência e imagem indisponível na exportação (M4-10, M4-11); roadmap: M4 concluído quando aceito. |
| `docs/DESIGN.md` | §6: menu ⋯ da miniatura, item da lista de excluídas, bloco "Foto anterior"; §7: diálogo de imagem (08), exportar (10), lista de excluídas (12), painel do placeholder, comparação sem troca de lados; §7.1: "Excluídas" e Exportar ativos; §8: textos novos; §10: protótipos 08 (pré-seleção), 10 e 12 (painel do placeholder à direita). |
| `docs/ARCHITECTURE.md` | §6: `packages/domain/src/imagens/` e `exportacao/`, `infra/exportacao.ts`, `infra/workers/exportar.worker.ts`, `servicos/purga.ts`, `DialogoImagem`, `DialogoExportar`; ADR-05: qualidade 0,8 da retificada; ADR-08: Worker e prévia; ADR-12: RN-36; ADR-13: rotas da §5; ADR-16: Decidido (opção escolhida e medição); §7: fluxos de exclusão, restauração e exportação; §8: metas da A-20; §10: sem decisões pendentes. |
| `docs/specs/M0-setup.md` | §4.10: restauração, `projetos` intacto na exclusão, revisão sem `salvaEm`, recomendação, prazo vencido, ordem da purga; §5.3: `/api/saude` com 503. |
| `docs/specs/M2-biblioteca-e-composicao.md` | §5 e M2-14: imagem excluída deixa de contar como existente (conversão no salvamento). |
| `docs/specs/M3-variantes-templates-e-salvamento.md` | M3-10 e A-26: sem troca de lados (RN-36). |
| `MEMORY.md` | Decisões M4-01 e M4-02 (02/11), as propostas aprovadas, RN-36 (o número já foi usado e descartado na M2-14; vale esta regra), pendências tratadas e a causa das quedas. |

## 12. Registro da implementação

(a preencher depois da implementação)
