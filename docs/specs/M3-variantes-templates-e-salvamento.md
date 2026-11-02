# Especificação M3 — Variantes, templates e salvamento

| Campo | Valor |
|---|---|
| Versão | 0.2 |
| Data | 2026-11-02 |
| Base | `docs/PRD.md` v0.13 · `docs/ARCHITECTURE.md` v0.8 · `docs/DESIGN.md` v0.4 + protótipos 06, 09, 14, 15, 15b (e 03, 03a, 11, 13, 17 no que tocam o M3) · `docs/specs/M0-setup.md` v0.6 · `docs/specs/M1-parede-e-escala.md` v0.3 (aceita) · `docs/specs/M2-biblioteca-e-composicao.md` v0.4 (implementada e aceita) · `docs/specs/templates.md` v0.2 |
| Status | **Aceita pelo Nicholas** (02/11; implementada em 02/11) — decisões M3-01 a M3-10 e premissas A-01 a A-31 aprovadas; M2 aceito (31/10); §11 aplicada aos outros documentos (PR-M3-04). Escrita só com a documentação (regra do `CLAUDE.md`), em paralelo ao M2; registro da implementação na §12. |

## 0. Pré-requisitos

| # | Item | Bloqueia | Situação |
|---|---|---|---|
| PR-M3-01 | **Aceite do M2** (§8 da spec M2). O M3 usa o store por variante, o histórico zundo, os placeholders e a camada de fotos do M2. | T1 | ✅ M2 aceito pelo Nicholas em 31/10 (implementação em `claude/m2-implementation-8f6bef`, mesclada nesta branch) |
| PR-M3-02 | Lacunas e contradições da §0.1 decididas pelo Nicholas (M3-01 a M3-10). | T1 | ✅ 02/11 (M3-01 a M3-10) |
| PR-M3-03 | Revisão das premissas da §0.2 pelo Nicholas. | T1 | ✅ 02/11 |
| PR-M3-04 | Alterações da §11 aplicadas ao PRD, à DESIGN, à ARCHITECTURE e às specs M0, M1 e M2, depois da revisão, com este branch atualizado com a `main`. | T1 | ✅ 02/11 (PRD v0.14, DESIGN v0.5, ARCHITECTURE v0.9, M0/M1/M2) |

### 0.1 Lacunas e contradições (com proposta)

As dez lacunas foram decididas pelo Nicholas em 02/11. M3-01 a M3-04 foram respondidas na hora (marcadas **Decisão**); M3-05 a M3-10 eram propostas e foram aprovadas na revisão do mesmo dia (com os ajustes registrados no `MEMORY.md`). M3-01 muda o escopo do marco e vem primeiro.

| # | Lacuna ou contradição | Decisão |
|---|---|---|
| M3-01 | **Vagas de template sem como preencher até o M4.** Os templates (RN-31) criam só placeholders. A M2-06 deixa "associar imagem ao placeholder" para o M4. No aceite do M3, uma variante de template não poderia receber fotos: as vagas só poderiam ser movidas, redimensionadas e removidas. | **Decisão (02/11): antecipar para o M3 a associação básica** (mesma natureza da M1-01): arrastar uma miniatura da biblioteca sobre a vaga, ou selecionar a vaga e usar **Preencher com a foto selecionada** no painel. A vaga mantém id, tamanho, posição e borda; a foto entra em *cover* com o recorte centralizado; 1 passo de desfazer. **Continuam no M4**: `imagemAnteriorId` e a recomendação, a exclusão que *gera* placeholders, a restauração e o filtro "Excluídas". Ajusta M2-06 e o roadmap (§11). |
| M3-02 | **Sinais de "sem foto".** O `MEMORY.md` e a M1 (A-04, §12) tiraram o selo "1 sem foto" do header e o indicador do card "até o M4, porque não há placeholders". Com templates, há placeholders já no M3. | **Decisão (02/11): voltam no M3**: selo "N sem foto" no seletor de variante (por variante e na ativa) e no card do projeto (soma das variantes **salvas**, campo `semFoto` na listagem). O resto do indicador (RF-30a, "variantes com placeholder são sinalizadas") não muda. Revê a A-04 da M1. |
| M3-03 | **Alterações não salvas entre variantes.** Não está definido se as edições da variante A sobrevivem à troca para B, o que o Salvar grava, como o status e o aviso ao sair tratam várias variantes sujas e o que o rascunho automático cobre. | **Decisão (02/11): exigir decisão ao trocar.** Só a **variante ativa** tem estado de trabalho (conteúdo, histórico, sujo, revisão base). Qualquer ação que **deixe** a ativa com alterações não salvas — trocar de variante, criar em branco, duplicar, iniciar um template — antes pergunta **Salvar e continuar · Descartar alterações · Cancelar** (A-12). Salvar grava a ativa (um conflito interrompe a ação e abre o diálogo da M3-09); Descartar apaga as alterações e o rascunho da sessão e zera o histórico dela. Por isso só a ativa pode estar suja: o ponto âmbar, o status, o **rascunho automático**, o `beforeunload` e o "Sair sem salvar?" (M1 A-20) continuam como na M1/M2, sem lista de variantes sujas. **O histórico de uma variante salva sobrevive à troca** (RN-18, SV-10, PRD aceite 12): voltar à variante recarrega o conteúdo e a pilha que ficaram em memória. |
| M3-04 | **CRUD de variantes.** O ADR-13 lista criar, duplicar, renomear e excluir, mas não diz se valem na hora ou só no Salvar, nem o que "duplicar" copia, nem o nome padrão, nem qual variante fica ativa depois de excluir. | **Decisão (02/11): criar, duplicar, renomear e excluir valem na hora (chamada à API, como nos projetos), não pelo Salvar**; a variante nova nasce **já salva** (revisão 1). **Duplicar copia o estado em tela.** Como criar e duplicar deixam a ativa (M3-03), a decisão sobre alterações não salvas vem antes; com \"Salvar e continuar\", tela e versão salva são iguais, e com \"Descartar\", a cópia sai da versão salva. **Nome repetido é permitido** (como no projeto, M1 A-02); os nomes sugeridos são numerados (A-03). **Excluir** pede confirmação, é físico (variante + rascunhos), não mexe em `imagens.projetos` e é bloqueado na última variante (RN-23); depois de excluir a ativa, a ativa passa a ser a anterior na ordem (ou a seguinte, se era a primeira). **`ultimaVarianteId`** muda ao trocar de variante e ao criar (sem alterar `atualizadoEm`, para a lista de projetos não reordenar). Renomear não muda `revisao` (como a A-05 da M1). |
| M3-05 | **O que a variante nova herda.** A RN-35 só fixa a área útil. | **Decisão (02/11):** a variante nova (em branco, cópia ou template) herda da **ativa em tela**: **área útil** (RN-35), **grid** e **borda padrão**. Na variante de template, a **borda padrão** é a escolhida no diálogo (RN-30), para as fotos acrescentadas depois combinarem com as vagas. A "Base" nasce com os padrões (M1). |
| M3-06 | **Aplicar template: regras que o RN-29 deixa abertas.** "Maior tamanho que caiba" (por área? por lado?), célula quadrada, onde a célula "cresce", se o conjunto se move pelo canto do modelo ou das vagas, como o snap age (as vagas individuais não cairiam no grid, o que não é problema para o aceite 4 do PRD, que fala de foto solta) e se o limite da M2-11 vale para o conjunto. | **Tamanho** (§4.2): o sugerido de **maior área impressa** cujo tamanho externo (impresso + 2 × borda) cabe na célula (folga 0,05 cm), **na orientação da célula** (quadrada → retrato; 13×13 e 15×15 sem orientação). Verificado: a regra reproduz **as 82 linhas** "Foto (borda 0)" de `templates.md`. Centralizada na célula; a sobra vira espaçamento. **Nenhum cabe** (**decisão de 02/11: a vaga cresce e empurra as vizinhas**): 10×15 na orientação da célula, **crescendo em torno do centro**; as vizinhas são **afastadas** até não sobrepor (§4.3, passo 3; algoritmo na A-31); aviso "N vagas ficaram maiores que o espaço do modelo e as vizinhas foram afastadas". **Conjunto** = caixa que une as células e as vagas (igual ao total do catálogo, salvo vaga que cresça); é ele que centraliza, arrasta, mostra o total e é comparado com a área útil. **Snap** só no canto superior esquerdo do conjunto; **limite M2-11** vale para a caixa do conjunto (≥ 1 cm dentro da parede inteira); as vagas podem acabar fora da parede ou da área útil e ganham os destaques de sempre. **Cancelar** no posicionamento volta à galeria; fechar a galeria não cria nada. O **servidor aplica o template** (domínio compartilhado) a partir de `templateId`, posição e borda — o cliente só envia a escolha. |
| M3-07 | **Soft save: conflito, configuração e falhas.** A SV-04 pede detecção "antes de qualquer gravação" e a SV-06 suspende o salvamento automático em conflito, mas o modelo não diz se o servidor confere a revisão no rascunho nem como a web sabe o intervalo. | **Decisão (02/11):** o servidor **confere a revisão também no rascunho**: se `revisao` oficial ≠ `revisaoBase`, responde 409 **sem gravar**; a web marca a variante em "Conflito" e **suspende o rascunho dela** até o usuário decidir (SV-06). O conflito achado no rascunho aparece como `Alert` com **Resolver…** (não abre diálogo sozinho, para não interromper a edição); o do Salvar abre o diálogo na hora. Intervalo: `GET /api/config` passa a devolver `autosaveMinutos`. Falha de rede ou 5xx: nova tentativa no tick seguinte; após 2 falhas seguidas, `Alert` discreto (A-07). |
| M3-08 | **Recuperação de rascunho (SV-07).** O `sessaoId` muda a cada abertura, então o rascunho de uma aba fechada é sempre de outra sessão. Faltam: qual rascunho vale, o que "recusar" faz, quando é "base antiga" e como limpar. | **Decisão (02/11):** ao ativar uma variante pela primeira vez na sessão, a web consulta o **rascunho mais recente de qualquer sessão** com `salvoEm` > `salvaEm` da variante (a listagem do projeto já traz o resumo). Diálogo **"Recuperar alterações não salvas de hh:mm?"** com **Recuperar** (carrega como alteração não salva, `revisaoBase` = revisão atual), **Descartar** (apaga aquele rascunho) e fechar (×/Esc: abre a versão salva e **mantém** o rascunho; a pergunta volta na próxima abertura). Se `rascunho.revisaoBase` < `revisao` (**base antiga**), o diálogo avisa, mostra as duas versões e oferece também **Salvar como nova variante**. O *hard save* apaga os rascunhos da variante mais velhos que a nova versão oficial (SV-02, SV-07: deixam de ser oferecíveis). |
| M3-09 | **Diálogo de conflito (SV-05): miniaturas, destino de cada saída e casos de borda.** O protótipo 09 mostra duas miniaturas da parede; a spec não dizia de que são feitas, o que cada saída faz com a variante original, nem o caso de a variante ter sido excluída em outra aba. O 409 da *parede* (M1) é outro caso. | **Decisão (02/11):** as miniaturas são **esboços em retângulos** (A-15), sem imagens. **Manter a minha**: grava com a revisão atual do servidor (`revisaoBase` ← revisão da salva); se mudar de novo, o diálogo volta. **Usar a salva**: descarta o estado local da variante (conteúdo, histórico e rascunho da sessão) e adota a versão salva. **Salvar a minha como nova variante**: cria "<nome> (cópia hh:mm)" com o meu conteúdo, ativa a nova e a original passa a mostrar a versão salva (como em "Usar a salva"). **Confirmação digitada** (decisão de 02/11): cada saída só é acionada depois de o usuário digitar a palavra dela ("minha", "salva" ou "nova") e clicar no botão (A-14). **Variante excluída em outra aba** (404 ao salvar): diálogo curto com **Salvar como nova variante** e **Descartar**. O 409 da **parede** continua com o `Alert` simples da M1. |
| M3-10 | **Comparação (RF-92, ADR-12): conteúdo mostrado e padrões.** Não está definido se a ativa aparece em memória ou salva, qual par abre, se a mesma variante pode estar nos dois lados, nem o que se desenha (o protótipo 06 mostra grid). | **Decisão (02/11):** mostra o **estado de trabalho em memória** (o que o usuário vê no editor, com marcador "não salva" no cabeçalho do painel). Abre com a **ativa à esquerda** e a **seguinte na ordem** (a anterior, se a ativa for a última) à direita. ~~Escolher no seletor a variante que está no outro lado **troca os lados**.~~ **Revisto em 02/11 pela RN-36 (spec M4, M4-02):** o seletor aceita a mesma variante nos dois lados e não altera o outro painel; sem troca de lados. **Visualização limpa por padrão** (parede e fotos, placeholders e "Imagem indisponível" incluídos), **sem seleção**, com três chaves no cabeçalho — **Grid**, **Área útil** e **Alertas** — **desligadas por padrão** que, ligadas, valem **para os dois painéis** (cada lado usa o grid e a área útil da própria variante; alertas = sobreposição e fora da parede/área útil, como no editor). Zoom/pan **sempre sincronizados**, pelo mesmo viewport em cm; entrada inativa com menos de 2 variantes ou sem escala. |

Contradições menores, corrigidas sem decisão nova (DS-02: a documentação prevalece sobre o protótipo):
- O protótipo 15/15b desenha vagas de 20×30, 30×40, 40×50… para a Pirâmide. O catálogo (`templates.md`, TPL-07/08) manda 20×30 ×5 e 30×20, e a DESIGN §7.3 já marca os esboços e as vagas dos protótipos como ilustrativos. Vale o catálogo.
- O protótipo 15 mostra o posicionamento sem painel direito e com palco claro. A DESIGN §7 manda, para os modos, header escuro, palco `stage-dark` e painel direito de 320–360 px. Vale a DESIGN (conteúdo do painel: A-22).
- O protótipo 06 desenha grid sempre ligado. Vale a M3-10: visualização limpa, com chaves Grid, Área útil e Alertas (desligadas por padrão).
- O texto de conflito da M1 §3.8 ("Recarregue para ver a versão salva.") vale só para a parede. Para a variante, vale o diálogo desta spec.
- A M1 §12 diz "o seletor mostra só a Base e o selo saiu do header". Passa a valer a M3-02.
- O protótipo 14 abre com "Pirâmide" selecionada e subtítulo com a área útil da variante; mantido (A-18).
- A SV-07 fala em rascunho "baseado em revisão antiga", mas nunca explicou como isso acontece. Com a M3-07, o servidor não grava rascunho em conflito; o caso real é o de revisões que **o servidor** muda sem salvar a variante (primeira escala e troca de parede — M1 §3.3 e §3.6). A M3-08 define "base antiga" assim.

### 0.2 Premissas (a revisar pelo Nicholas)

Valores e comportamentos que os documentos não fixavam. Cada premissa segue o formato **"Decidi <premissa> porque <causa> com o risco <o que pode dar errado>"**. Todas foram aprovadas pelo Nicholas em 02/11 (A-05 e A-14 com os ajustes descritos nelas).

| # | Premissa |
|---|---|
| A-01 | Decidi que o **seletor de variante** (header, DESIGN §7) mostra no gatilho o nome da ativa (Newsreader), um chevron, o selo "N sem foto" (`danger-tint`, só com N > 0) e um ponto âmbar quando a ativa tem alterações não salvas; que a lista traz, por item, nome, "N fotos", selo e check na ativa, com menu ⋯ (**Renomear**, **Duplicar**, **Excluir**, este inativo na última variante, tooltip "Todo projeto precisa de ao menos uma variante."); que o rodapé traz **Nova variante em branco…**, **Duplicar “<ativa>”…** e **Novo a partir de template…**; e que o seletor fica inativo em qualquer modo (perspectiva, calibração, área útil, recorte, posicionar template), porque só a ativa pode estar suja (M3-03) e trocar de variante no meio de um modo perderia o trabalho do modo, com o risco de o usuário não achar como trocar de variante durante um modo e ter de cancelá-lo. |
| A-02 | Decidi que os **diálogos de variante** (640 px, DESIGN §6) são *Nova variante* e *Duplicar variante* (campo Nome já selecionado, Enter confirma), *Renomear* (mesmas regras do projeto: 1–60 caracteres, sem espaços nas pontas) e *Excluir variante* ("A variante “X” e as fotos posicionadas nela serão apagadas. As imagens da biblioteca continuam disponíveis.", mais "Ela tem alterações não salvas." quando for o caso, com botão `destructive` "Excluir variante"), e que a variante criada fica ativa, porque reaproveita o padrão dos diálogos de projeto (M1 §3.1), com o risco de o usuário excluir por engano uma variante com trabalho, já que a exclusão é física e não tem desfazer. |
| A-03 | Decidi que os **nomes sugeridos** são: em branco "Variante N" (menor N ≥ 2 ainda não usado); cópia "<nome> (cópia)", depois "(cópia 2)"…; template, o nome do modelo, depois "Pirâmide 2"…; conflito "<nome> (cópia hh:mm)"; recuperação "<nome> (rascunho hh:mm)"; sempre truncados a 60 caracteres, preservando o sufixo, porque o modelo limita o nome a 60 (M0 §4.5) e o nome repetido é permitido (M3-04), com o risco de duas variantes terminarem com o mesmo nome digitado à mão e se confundirem no seletor e na comparação. |
| A-04 | Decidi que `ordem` = maior existente + 1 (a variante nova vai para o fim da lista) e que não há reordenação na v1, porque ninguém pediu reordenar e o seletor já destaca a ativa, com o risco de, com muitas variantes, o usuário querer agrupá-las e não poder. |
| A-05 | Decidi que a variante **ativa** guarda `{ conteudo, ultimoOficial, revisaoBase, historico, alteradoEm, sujoOficial, sujoRascunho, ultimoRascunhoEm, conflito, salvando }`, que ao trocar para outra variante **limpa** (salva) o conteúdo e a pilha de desfazer dela ficam num `cache` por `varianteId` e voltam na reativação, que "Descartar alterações" zera a pilha, que a troca limpa a **seleção** e mantém o **viewport** (a parede é a mesma) e que a pilha também some quando a variante é recarregada por "Usar a salva" ou por 409 (M2 A-27), porque a M3-03 só permite uma variante suja por vez e o PRD aceite 12 exige histórico independente por variante, com o risco de o cache ficar desatualizado se outra aba salvar a mesma variante (sem sincronização — A-28) e a reativação mostrar conteúdo antigo até o próximo Salvar dar 409 (por isso o botão para **forçar a sincronização entre abas** entra no roadmap como ideia futura, RF-74 do PRD §11). |
| A-06 | Decidi que o **status de salvamento da ativa** segue a prioridade Conflito (`danger`) › Salvando… › "Alterações não salvas" (âmbar: difere da oficial e mudou depois do último rascunho) › "Rascunho salvo às hh:mm" (verde: difere da oficial e nada mudou depois do rascunho) › "Salvo às hh:mm", que voltar por desfazer ao conteúdo oficial vale "Salvo" (M2 A-26) e que a comparação com a oficial é estrutural, por valor, porque a SV-08 pede os quatro estados e o usuário precisa saber se há rede de proteção, com o risco de a comparação por valor ficar cara com 40 fotos se rodar a cada alteração (mitigado por rodar só quando o conteúdo muda). |
| A-07 | Decidi que o **salvamento automático** usa um temporizador por sessão, a cada `autosaveMinutos` desde a abertura do projeto, grava `PUT …/rascunho` se a **ativa** tem `sujoRascunho` e não está em conflito nem salvando, adia o tick se um Salvar manual está em andamento, grava `{ grid, bordaPadrao, areaUtil, fotos }` validado só pelo Zod (imagens só são conferidas no *hard save* — M2 §5), repete no tick seguinte se falhar e, após 2 falhas seguidas, mostra o `Alert` dispensável "Não foi possível salvar o rascunho automático. Use Salvar.", porque a SV-01 manda salvar a cada X minutos só com alteração e o rascunho nunca toca a versão oficial, com o risco de um rascunho com imagem inexistente só falhar na recuperação (a foto aparece como "Imagem indisponível") e de o usuário perder até `autosaveMinutos` de trabalho numa queda. |
| A-08 | Decidi que a **recuperação aparece** na primeira ativação da variante na sessão (inclusive a que abre com o projeto) em que o resumo traga um rascunho elegível (M3-08), um diálogo por vez, em fila, com a variante já carregada com a versão salva por baixo, porque o resumo vem na carga do projeto e evita uma consulta por variante, com o risco de o usuário se deparar com vários diálogos em sequência se várias variantes tiverem rascunho. |
| A-09 | Decidi que **Recuperar** transforma o rascunho em estado de trabalho (alteração não salva, `revisaoBase` = revisão oficial atual, histórico vazio) e o mantém no servidor até o *hard save* ou o descarte, que **Descartar** apaga só aquele rascunho (`DELETE …?sessaoId=`), que **Fechar** não apaga e que, com base antiga, o diálogo mostra "Estas alterações foram feitas sobre a revisão R; a versão salva já está na revisão N." e as duas versões lado a lado (mesmo componente do conflito), porque a SV-07 pede para avisar sobre base antiga e o usuário decide com as duas versões à vista, com o risco de Recuperar com base antiga sobrescrever, no próximo Salvar, mudanças que outra aba salvou (por isso o aviso e a saída "Salvar como nova variante"). |
| A-10 | Decidi que o *hard save* apaga o rascunho da própria sessão (SV-02) e os de outras sessões da mesma variante com `salvoEm` anterior à nova `salvaEm`, que excluir variante ou projeto apaga os rascunhos (DM-12), que **trocar a parede apaga os rascunhos do projeto** e que a reparação da inicialização (M1 A-18) continua só para rascunho de variante inexistente, porque, pela SV-07, rascunho mais velho que a versão oficial nunca mais é oferecido e só acumularia lixo, e os da parede antiga não fazem mais sentido, com o risco de o rascunho de uma segunda aba aberta ser apagado pelo Salvar da primeira e o trabalho não salvo da segunda ficar sem cópia até ela resolver o conflito. |
| A-11 | Decidi que o `PUT` da variante com fotos e `parede.escala.metodo = null` responde 422 "A parede está sem escala.", porque, se a parede for trocada em outra aba (a troca só é bloqueada por fotos já *salvas*), uma aba com fotos em memória poderia gravar fotos em cm sobre uma parede sem escala, que o editor não sabe desenhar, com o risco de o usuário não conseguir salvar aquela aba até redefinir a escala (o conteúdo continua em memória e pode ir para uma nova variante). |
| A-12 | Decidi que trocar de variante, **Nova variante em branco**, **Duplicar** e **Templates** com a ativa suja abrem antes o diálogo "Salvar as alterações de “<nome>”?" com **Cancelar**, **Descartar alterações** (fantasma, `danger-ink`) e **Salvar e continuar** (primário), que um conflito ao salvar interrompe a ação e abre o diálogo da A-14, que Descartar apaga o rascunho da sessão (`DELETE …?sessaoId=`) e zera a pilha, que sem alterações a ação segue direto, que "Sair sem salvar?" (M1 A-20) fica como está e que **Comparar** não pergunta, porque a M3-03 (decidida em 02/11) exige decisão ao deixar a ativa suja e Comparar não deixa a variante, com o risco de o usuário clicar em Descartar por hábito e perder o trabalho sem volta, já que a pilha também é zerada. |
| A-13 | Decidi que `Salvar` e `Ctrl+S` gravam a variante ativa e que o tooltip passa a "Salvar “<nome>” (Ctrl+S)", porque só a ativa pode estar suja (M3-03) e o nome no tooltip deixa claro o alvo, com o risco de quem chega do M1/M2 achar que o Salvar grava o projeto inteiro. |
| A-14 | Decidi que o **diálogo de conflito** segue o protótipo 09 e a DESIGN §8: ícone de aviso e título "Esta variante foi salva em outra aba"; subtítulo "“<nome>” mudou desde que você a abriu. Escolha qual versão manter. O salvamento automático está pausado."; dois cartões — **A minha** (borda `accent`, "hh:mm · esta aba" com a hora da última alteração local, "N fotos · baseada na revisão R") e **A salva** ("hh:mm · outra aba", de `salvaEm` e `salvaPorSessao` ≠ sessão atual, "N fotos · revisão R"); rodapé **Usar a salva** (fantasma) · **Salvar a minha como nova variante** (secundário) · **Manter a minha** (primário), todos **inativos até o usuário digitar a palavra da opção** num campo "Para confirmar, digite a palavra da opção" acima do rodapé — **minha** para "Manter a minha", **salva** para "Usar a salva", **nova** para "Salvar a minha como nova variante" (sem diferenciar maiúsculas e espaços nas pontas); a palavra digitada habilita só o botão correspondente (os outros ficam inativos) e Enter no campo aciona esse botão; Esc ou × deixa a decisão para depois (variante em "Conflito" com o `Alert` "Resolver…"); a versão salva vem de `GET …/variantes/:id`, porque a SV-05 pede as duas versões com quem e quando, com o risco de o usuário, por pressa, digitar a palavra sem ler os cartões (a digitação reduz, mas não elimina, o clique por reflexo) e de o atrito incomodar quem resolve conflitos com frequência; a mesma exigência não vale para os diálogos de recuperação (A-09) nem de variante excluída (M3-09), que não sobrescrevem uma versão salva. |
| A-15 | Decidi que o **esboço** (miniaturas do conflito, da recuperação e dos cards de template) é o componente `EsbocoVariante` em SVG, sem Konva e sem imagens, desenhando a caixa da parede inteira (ou a área útil, se a parede inteira não couber) com um retângulo por foto (placeholder em `danger-tint` tracejado, foto em `sand` com contorno `line`), calculado por uma função pura do domínio (§4.7), porque é barato, testável e igual nos três usos, com o risco de o esboço não bastar para o usuário distinguir as versões quando elas diferem só nas imagens e não nas posições. |
| A-16 | Decidi que a **comparação** não tem seleção, mostra por padrão só parede e fotos, e traz três `Toggle` no cabeçalho (**Grid**, **Área útil**, **Alertas**), desligados ao abrir e não persistidos, que valem para os dois painéis (cada lado usa o grid, a área útil e os alertas da própria variante; o grid respeita o corte de 4 px da M1 A-07), com cursor de mão e sem atalhos de edição (Ctrl+Z, setas e Ctrl+S inativos; Esc volta ao editor) e com o salvamento automático seguindo em segundo plano, porque você pediu a visualização limpa com a opção de ligar os itens, com o risco de, com os dois grids ligados e passos diferentes, o usuário ler uma diferença de grid como diferença de composição. |
| A-17 | Decidi que o **viewport da comparação** é um estado único `{ centroCm, zoom }` aplicado aos dois palcos de mesmo tamanho (divisão 50/50, sem quebra de linha, mínimo útil 1280 px), que roda e pan em qualquer painel movem os dois, que os botões −/+ dão zoom no centro, que **Parede inteira** enquadra a parede e que a comparação abre nela, com limites e passo da M1 A-06 e sem persistência, porque o RF-92 exige zoom e pan sempre sincronizados (DV-01), com o risco de, em telas abaixo de 1280 px, cada painel ficar apertado demais para comparar detalhes. |
| A-18 | Decidi que a **galeria** (protótipo 14, DESIGN §7.3) é um diálogo de 960 px aberto por **Templates** ou pelo menu do seletor, com subtítulo "Área útil da variante: L × A cm", grade de 4 colunas com os 12 cards (esboço proporcional, nome, total, "N fotos" e o aviso "Maior que a área útil" em `warning-ink`), "Pirâmide" pré-selecionada, navegação por setas e Enter/Espaço (`RadioGroup`), e rodapé com **Borda das fotos** (0 a 20 cm, passo 0,1, padrão = borda padrão da ativa), **Cor da borda**, "Será criada a variante “<nome>”.", Cancelar e **Posicionar na parede** (primário), inativa sem escala ("Defina a escala primeiro."), porque segue o protótipo e a RN-30, com o risco de quem não mexe na borda criar a variante com a borda padrão da ativa sem perceber. |
| A-19 | Decidi que a galeria mostra ao vivo, em `warning-ink`, "Com esta borda, N vagas ficam maiores que o espaço do modelo e as vizinhas serão afastadas." quando a borda digitada faz alguma vaga do modelo não caber (§4.2), sem bloquear, porque a M3-06 aceita que a vaga cresça e o usuário deve saber antes de posicionar, com o risco de o aviso ficar só no rodapé e passar despercebido. |
| A-20 | Decidi que, ao confirmar o posicionamento, o app cria a variante (`POST`), troca para ela e mostra "Variante “<nome>” criada com N vagas." por 6 s, e que uma falha da API vira `Alert` dentro do modo, sem sair dele, porque o usuário não perde a posição que acabou de acertar, com o risco de a criação falhar de forma repetida (ex.: Mongo fora do ar) e o usuário ficar preso no modo até cancelar. |
| A-21 | Decidi que o **conjunto no canvas** (DESIGN §2.2) tem vagas a 80% de opacidade, contorno tracejado de 1,5 px `ink-2` (ou `danger` quando maior que a área útil) com 8 px de folga e pill com o ícone de mover e o total ("151,0 × 70,6 cm"), arrasta com snap no canto superior esquerdo (se o snap da variante estiver ligado) e move por setas em 1 passo do grid (Shift: 5), ou 1 cm (Shift: 5 cm) sem snap, como a M2-01, porque reaproveita o comportamento de fotos, com o risco de o snap só no canto deixar as vagas fora do grid e o usuário estranhar. |
| A-22 | Decidi que o modo Posicionar template tem **painel direito** (DESIGN §7) com *Modelo* (nome, "N vagas", total), *Borda das fotos* (somente leitura), *Posição do conjunto* (X e Y em `CampoCm`, mesmas regras de snap e limite do arraste; Enter aplica), **Centralizar na área útil** e os avisos "O template é maior que a área útil. <total> não cabe em <área>. Você pode confirmar assim mesmo e ajustar as fotos depois." (`Alert` de alerta, também no topo do palco) e "N vagas ficaram maiores que o espaço do modelo; as vizinhas foram afastadas." (aviso); que a barra de status mostra "Arraste para posicionar · Enter confirma · Esc cancela", "X 14,5 · Y 19,8 cm" e "Encaixe no grid de 5 cm" (ou "Sem encaixe"); que o palco mostra só parede, grid (se visível), área útil e conjunto, com as fotos da ativa ocultas, e Desfazer, Refazer e Salvar inativos, porque você aprovou o painel e a DESIGN §7 manda painel nos modos (o protótipo 15 diverge), com o risco de o usuário achar que as fotos da ativa sumiram. |
| A-23 | Decidi que **preencher vaga** (M3-01) funciona soltando uma miniatura sobre a vaga (se houver várias sob o ponto, a do topo da pilha) ou pelo botão **Preencher com a foto selecionada** do painel do placeholder (secundário; inativo sem miniatura selecionada, "Selecione uma foto na biblioteca."); que soltar fora de vaga continua adicionando foto nova (M2 A-04); que a vaga mantém id, `tamanho`, `xCm`/`yCm`, `borda` e posição na pilha, com recorte 0,0 e `imagemAnteriorId` inalterado; e que uma vaga que já recebeu imagem (agora uma foto comum) não aceita outra, porque trocar a imagem é a RF-37 (ideia futura), com o risco de o usuário errar a foto na vaga e ter de removê-la e adicionar outra, perdendo o formato da vaga. |
| A-24 | Decidi que o **card do projeto** mostra a pill `danger-tint` "N sem foto" junto à meta, com N = soma das vagas (placeholders) das variantes **salvas** do projeto, oculta com N = 0, e que a meta passa a "N variantes" real, porque você aprovou o sinal no card (M3-02), com o risco de N não refletir as vagas que o usuário já preencheu e ainda não salvou. |
| A-25 | Decidi que ativam no M3 o seletor de variante, **Comparar** (inativo com menos de 2 variantes — "Crie ao menos duas variantes para comparar." — ou sem escala) e **Templates**, e que seguem inativos Exportar e "Excluídas" (M4), a busca (ideias futuras) e "Linha forte a cada" (M5), porque segue a regra de controles inativos da DESIGN §7.1, com o risco de o usuário esperar exportar a composição ao fim do M3. |
| A-26 | Decidi que cada painel da **comparação** tem seletor de variante (que, pela RN-36 — spec M4, M4-02 —, aceita a mesma variante do outro painel, sem troca de lados) (nome em Newsreader, ponto âmbar se não salva), "N fotos" (placeholders incluídos) e a pill mono com a **Área total** ("90,0 × 47,0 cm", "—" sem fotos), que a rota é `/projetos/<id>/comparar` (mesma store do editor), que abrir pela URL carrega o projeto, que com menos de 2 variantes volta ao editor e que "Voltar ao editor" mantém a ativa de antes, porque segue o protótipo 06 e a ADR-12, com o risco de o usuário recarregar a página na comparação e perder alterações não salvas da ativa (o `beforeunload` avisa). |
| A-27 | Decidi que ir à Comparação e voltar não grava nem zera nada, e que sair para Projetos segue o "Sair sem salvar?" da M1, porque a comparação é só visualização (ADR-12), com o risco de o usuário supor que comparar também salvou. |
| A-28 | Decidi que **não há sincronização entre abas** (como a M2 A-01): a lista de variantes de uma aba não se atualiza quando outra cria ou exclui, e os efeitos são tratados no servidor (salvar variante excluída — M3-09; `ordem` calculada no servidor; exclusão da última responde 409), porque sincronizar em tempo real é fora da v1 e o uso é de um só usuário, com o risco de o seletor de uma aba mostrar variantes que já não existem até um erro aparecer. |
| A-29 | Decidi as metas de **desempenho** (ARCHITECTURE §8): aplicar template e abrir o posicionamento < 200 ms; arrastar o conjunto (12 vagas) ≥ 50 fps; salvar rascunho < 100 ms; pan/zoom na comparação com 2 × 40 fotos ≥ 50 fps; memória nessa comparação (perfil Leve) < 400 MB, com as imagens carregadas uma vez por `imagemId` e compartilhadas entre os dois palcos, porque a RNF-03 exige fluidez com 40 fotos, com o risco de dois palcos Konva com 40 fotos cada ficarem abaixo de 50 fps em máquinas mais fracas, hipótese a medir na T14 e registrar no `MEMORY.md`. |
| A-30 | Decidi que a **forma de trabalho** é a do M1 e do M2 — um commit com todos os testes do M3 vermelhos (`test(m3): …`) e depois a implementação com tudo verde (`feat(m3): …`), com a sua validação só no fim (T14) — porque o processo funcionou nos marcos anteriores, com o risco de um erro de interpretação desta spec só aparecer na validação final, depois de muito código escrito. |
| A-31 | Decidi que o **afastamento das vizinhas** (M3-06) é o algoritmo do §4.3, passo 3: afasta no eixo de menor penetração, só reage a vagas crescidas ou empurradas, faz no máximo 10 passadas e para quando encostar, sem recompor o vão original de ~2–5 cm, e só ocorre com borda grande o bastante para uma vaga não caber (com 10×15, a partir de ~1,4 cm nas menores células do catálogo), porque você escolheu empurrar as vizinhas e a spec não tinha o algoritmo, com o risco de o resultado ficar menos fiel ao desenho do catálogo, de o empurrão em cascata levar vagas para fora da área útil e de sobrar sobreposição após as 10 passadas (visível pela RN-11). |

## 1. Objetivo

Fechar o ciclo de trabalho com várias composições e com proteção contra perda: criar, duplicar, renomear, excluir e alternar variantes; criar variantes a partir dos 12 templates e preenchê-las com fotos; salvar rascunhos automaticamente e recuperá-los; resolver conflitos entre abas com as três saídas da SV-05; e comparar duas variantes lado a lado com zoom e pan sincronizados. Ao fim do M3, o usuário monta uma composição por template, guarda alternativas e compara.

## 2. Escopo

| Dentro | Fora (marco) |
|---|---|
| Seletor de variante; criar (em branco, cópia), renomear, excluir, alternar — RF-91, RN-23, M3-03 a M3-05 | Reordenar variantes (fora da v1) |
| Galeria de 12 templates, borda única, aplicação com variante nova — RF-93, RN-29 a RN-32, RN-35, TPL-01 a TPL-08 | Aplicar template sobre variante existente (TPL-04: sempre variante nova) |
| Posicionamento do conjunto com snap, centralização e aviso — RN-32 | Mover o conjunto depois de confirmado (RF-36, ideia futura) |
| Preencher vaga com foto da biblioteca — M3-01 | Recomendação da imagem anterior, exclusão que gera placeholders, restauração, "Excluídas" (RF-29, RF-30a — M4) |
| Selo "N sem foto" no seletor e no card — M3-02 | Exportação do placeholder (RN-19 — M4) |
| Salvamento automático (rascunho), recuperação, status completo — RF-71, SV-01, SV-03, SV-07, SV-08 | Persistir o histórico de desfazer (RN-18: não persistido) |
| Diálogo de conflito com as três saídas — RF-73, RN-26, SV-04 a SV-06 | Sincronização entre abas, em tempo real ou por botão (RF-74, ideia futura) |
| Comparação lado a lado, zoom/pan sincronizados, "Parede inteira" — RF-92, ADR-12, PRD aceite 11 | Comparação com edição, destaque das diferenças (ideias futuras) |
| Desfazer independente por variante — PRD aceite 12 (completo) | Contador de uso (RF-23 — M5), linha forte (RF-52 — M5) |

**O que muda em relação ao M2** (para não passar despercebido na implementação):

| Item do M2 | No M3 |
|---|---|
| M2-06: "associar imagem a placeholder" no M4 | A associação básica vem para o M3 (M3-01, A-23). A recomendação e a exclusão continuam no M4. |
| M2 §6: "uma pilha de histórico por `varianteId` (no M2 só a Base)" | Passa a haver uma pilha por variante de fato; trocar de variante troca a pilha e a seleção (A-05). |
| M2 §5: `PUT` da variante apaga só o rascunho da própria sessão (M0 SV-02) | Apaga também os rascunhos obsoletos da variante (A-10) e responde 422 sem escala (A-11). |
| M2 §3.10 / A-26: status "Salvo" ou "Alterações não salvas" | Ganha "Rascunho salvo às hh:mm", "Salvando…" e "Conflito" (A-06). |
| M1 §3.8: 409 do Salvar com `Alert` "Recarregue" | Para a variante, abre o diálogo de conflito (§3.5). Para a parede, o `Alert` fica. |
| M1 A-20: "Sair sem salvar?" | Sem mudança (só a ativa pode estar suja — M3-03). Novo: o diálogo de decisão ao deixar a ativa suja (A-12). |
| M1 A-04 / §12: indicador "sem foto" no M4; seletor só com a Base | Selo no seletor e no card já no M3 (M3-02, A-01, A-24). |
| `GET /api/config` → `{ uploadMaxMb }` (M2 A-28) | Passa a devolver também `autosaveMinutos`. |
| A-15 do M1 / §2 do M2: inativos | **Ativam**: seletor de variante, Comparar, Templates. **Continuam inativos**: Exportar, "Excluídas", buscas, "Linha forte a cada". |

## 3. Comportamento

### 3.1 Variantes (RF-91, RN-23, M3-04, A-01 a A-04)

- **Seletor** no header (A-01). Trocar de variante: conteúdo, histórico e status passam a ser os da escolhida (A-05); o canvas mostra a parede e as fotos dela; a seleção é limpa; atualiza `ultimaVarianteId`.
- **Nova variante em branco**: diálogo (A-02) → `POST` com a área útil, o grid e a borda padrão da ativa (M3-05) e `fotos: []` → a nova fica ativa.
- **Duplicar** (antes, a decisão da A-12 se a ativa estiver suja): diálogo com o nome sugerido → `POST` com as fotos **em tela** da variante duplicada (novos ids no servidor) → a cópia fica ativa, já salva. A origem não muda.
- **Renomear**: diálogo; `PATCH`; não gera revisão.
- **Excluir**: confirmação (A-02) → `DELETE`; a ativa passa a ser a vizinha (M3-04). Se a excluída tinha alterações não salvas, o texto avisa. Inativo na última variante.
- A variante nova começa com histórico vazio, sem seleção e com status "Salvo".

### 3.2 Alterações não salvas entre variantes (M3-03, A-05, A-06, A-12, A-13)

- Só a ativa tem estado de trabalho; deixá-la suja pede a decisão da A-12. A pilha de desfazer das variantes salvas é preservada na troca (A-05).
- **Salvar/Ctrl+S**: só a ativa; sucesso atualiza `revisaoBase` e apaga os rascunhos obsoletos (A-10).
- **Status da barra de status** da ativa: A-06.
- **`beforeunload`**: avisa se a ativa tiver alterações não salvas, mesmo com rascunho salvo (SV-08).
- **Sair para Projetos**: "Sair sem salvar?" da M1 (A-20).

### 3.3 Salvamento automático (RF-71, SV-01, M3-07, A-07)

- Temporizador de sessão com `autosaveMinutos`; só salva variantes alteradas desde o último salvamento (rascunho ou oficial).
- Grava **só** em `rascunhos` (upsert por variante e sessão); a versão oficial nunca muda (SV-01).
- Conflito de revisão (409): a variante entra em "Conflito", o rascunho dela fica suspenso (SV-06) e aparece o `Alert` do §3.5.
- Resposta esperada < 100 ms (ARCHITECTURE §8).

### 3.4 Recuperação de rascunho (RF-71, SV-03, SV-07, M3-08, A-08 a A-10)

1. Ao abrir o projeto, a API devolve o resumo dos rascunhos **elegíveis** (mais novos que a versão oficial; um por variante, o mais recente de qualquer sessão).
2. Na primeira ativação da variante, abre o diálogo "Recuperar alterações não salvas de hh:mm?" com **Recuperar**, **Descartar** e fechar. Os dados completos do rascunho vêm de `GET …/rascunho` só quando o usuário escolhe Recuperar (ou quando o diálogo mostra as duas versões).
3. Base antiga: avisos e a opção **Salvar como nova variante** (A-09).
4. Depois de recuperar, o status é "Alterações não salvas" e o usuário decide quando gravar.

### 3.5 Conflito de versão (RF-73, RN-26, SV-04 a SV-06, M3-09, A-14)

- **Detecção**: no *hard save* (409 do `PUT` da variante) e no rascunho (409 do `PUT …/rascunho`).
- **Hard save** → abre o diálogo da A-14. **Rascunho** → `Alert` no topo do canvas "Esta variante foi salva em outra aba às hh:mm." com **Resolver…**, e o status "Conflito".
- **Saídas** (cada uma só é acionada depois de o usuário **digitar a palavra da opção** — "minha", "salva" ou "nova" — e clicar no botão correspondente; A-14):

| Saída | Efeito |
|---|---|
| **Manter a minha** | `PUT` com `revisaoBase` = revisão atual do servidor (obtida no `GET`); nova revisão; apaga rascunhos obsoletos; o autosave volta. Novo 409 → o diálogo reabre. |
| **Usar a salva** | Substitui o estado de trabalho pela versão salva; zera o histórico da variante; apaga o rascunho da sessão; o autosave volta. |
| **Salvar a minha como nova variante** | `POST` com o meu conteúdo e o nome "<nome> (cópia hh:mm)" → a nova fica ativa e salva; a original adota a versão salva (como em "Usar a salva"). |
| **Esc / ×** | Mantém o conflito; o `Alert` com **Resolver…** fica; Salvar reabre o diálogo. |

- **Variante excluída em outra aba**: 404 ao salvar → diálogo curto "Esta variante foi excluída em outra aba." com **Salvar como nova variante** e **Descartar** (remove o estado local; a ativa passa a ser outra).
- **Parede** (409 de `projetos.revisao`): `Alert` simples da M1.

### 3.6 Galeria de templates (RF-93, RN-29, RN-30, TPL-01 a TPL-08, A-18, A-19)

- Abre por **Templates** ou pelo menu do seletor. Exige escala (a área útil existe).
- Cartão de cada modelo: esboço proporcional gerado do catálogo, nome (PT), total do conjunto, "N fotos" (vagas) e, se o total não couber na área útil da ativa, "Maior que a área útil" (não bloqueia).
- Rodapé: borda das fotos (RN-30), nome que a variante terá (TPL-04) e **Posicionar na parede**. Aviso de vagas maiores que o espaço (A-19).
- Cancelar ou × fecha sem criar nada.

### 3.7 Posicionar template (RN-32, TPL-06, A-20 a A-22)

- Modo de DS-05: barra escura "Posicionar template · <nome>" com "N vagas · nova variante “<nome>”", **Cancelar** (volta à galeria) e **Confirmar posição**; palco `stage-dark`; painel direito da A-22.
- Entra com o conjunto **centralizado na área útil** (TPL-06). O usuário arrasta o conjunto (snap e limite — M3-06), digita X/Y ou usa **Centralizar na área útil**.
- Maior que a área útil: contorno `danger`, `Alert` no topo e no painel; **Confirmar posição** continua ativo.
- **Confirmar** (botão ou Enter): `POST` da variante (§5); sucesso → troca para a nova (A-20). Esc cancela.
- A variante criada tem `templateOrigem`, a borda padrão da escolha (M3-05), a área útil, o grid e as vagas (RN-31); nenhuma foto de biblioteca.

### 3.8 Preencher vaga (M3-01, A-23)

- **Arrastar** a miniatura sobre uma vaga, ou **Preencher com a foto selecionada** no painel do placeholder.
- Efeito: a vaga vira foto (imagem associada, recorte centralizado); 1 passo de desfazer; o "Sem foto N" do painel Composição e o selo do seletor diminuem; a variante fica "Alterações não salvas".
- A foto continua com o formato da vaga; o usuário pode mudar tamanho, orientação, borda e recorte como em qualquer foto (M2).

### 3.9 Comparação (RF-92, ADR-12, M3-10, A-16, A-17, A-26)

- **Comparar** (header) abre `/projetos/<id>/comparar`: header com "Voltar ao editor", título, selo "Somente visualização", o aviso "Zoom e posição iguais nos dois lados", as chaves Grid · Área útil · Alertas (A-16), zoom −/%/+ e **Parede inteira**; abaixo, dois painéis lado a lado.
- Cada painel: cabeçalho (A-26) e um palco de leitura. Zoom e pan em qualquer um movem os dois (A-17).
- Sem edição: nenhuma seleção, nenhum arraste, nenhum atalho de edição (A-16). Esc ou "Voltar ao editor" retorna à edição da variante ativa (ADR-12).
- Faltando imagem: "Imagem indisponível" (M2 A-16); placeholder: vermelho hachurado (DESIGN §2.2).

### 3.10 Projetos e barra de status

- Card do projeto: A-24. Abrir o projeto: variante `ultimaVarianteId` (ou a primeira); recuperação conforme A-08.
- Barra de status: A-06 e A-13; no posicionamento de template, A-22; na comparação, a dica "Arraste para mover · Roda para zoom" e o aviso "Medidas aproximadas, parede considerada plana" à direita.

## 4. Domínio e algoritmos

### 4.1 Módulos novos em `packages/domain` (TS puro, testes obrigatórios)

Pasta nova: `variantes/` (a registrar na ARCHITECTURE §6 antes de criar — §11). `templates/` já está prevista na §6.

| Módulo | Funções |
|---|---|
| Catálogo | `TEMPLATES` (constante, 12 modelos, fonte: `docs/specs/templates.md`): `{ id, nome, celulas: [{ xCm, yCm, larguraCm, alturaCm }] }`; `totalDoTemplate(t)` → caixa das células; `templatePorId(id)` |
| Aplicação | `tamanhoParaCelula(celula, bordaCm)` → `{ tamanho, cresceu }` (§4.2); `aplicarTemplate({ template, posicaoCm, borda, novoId })` → `{ fotos, conjunto, vagasMaiores }` (§4.3); `maiorQueAreaUtil(conjunto, areaUtil)` |
| Conjunto | `centralizarNaAreaUtil(conjunto, areaUtil)`, `encaixarConjunto(posicao, grid)` (reusa `encaixar` do M2), `limitarConjunto(posicao, conjunto, paredeInteira)` (generaliza `limitarPosicao` da M2-11 para um retângulo) |
| Vagas | `preencherVaga(foto, imagemId)` (A-23: só placeholder; id, tamanho, posição e borda preservados; recorte 0,0) |
| Nomes | `nomeNovaVariante(existentes)`, `nomeCopia(base, existentes)`, `nomeDoTemplateUnico(nome, existentes)`, `nomeComSufixo(base, sufixo)`, `truncarNome(nome, sufixo?)` (A-03) |
| Variante | `semFoto(fotos)` (nº de placeholders), `copiarParaNovaVariante(variante, novoId)` (ids novos para as fotos), `conteudoIgual(a, b)` (comparação estrutural, A-06) |
| Salvamento | `estadoDeSalvamento({ conflito, salvando, sujoOficial, sujoRascunho, salvoEm, rascunhoEm })` → `conflito \| salvando \| alteracoes \| rascunho(em) \| salvo(em)` (A-06); `rascunhoElegivel(variante, rascunhos)` → o mais recente com `salvoEm` > `salvaEm`; `rascunhoDesatualizado(rascunho, variante)` (`revisaoBase` < `revisao`); `rascunhoObsoleto(rascunho, salvaEm)` |
| Esboço | `esbocoDeFotos(fotos, caixaCm)` → retângulos normalizados em 0–1 com tipo (foto, placeholder), usado nos cartões do conflito, da recuperação e dos templates (A-15) |
| Constantes | `NOME_VARIANTE_MAX = 60`, `FALHAS_ANTES_DO_AVISO = 2` (A-07), `AVISO_CRIACAO_MS = 6000` (A-20) |

O domínio não gera ids: `novoId` chega como parâmetro (web: `bson`; API: `ObjectId`).

### 4.2 Tamanho de uma vaga (RN-29)

Entrada: célula `L × A` cm e borda `b` cm.

1. **Orientação da célula**: `L < A` retrato · `L > A` paisagem · `L = A` retrato.
2. **Candidatos**: todos os tamanhos sugeridos da RN-01 na orientação da célula (13×13 e 15×15 sem orientação).
3. **Cabe**: `larguraImpressa + 2b ≤ L + ε` **e** `alturaImpressa + 2b ≤ A + ε`, com `ε = TOLERANCIA_CM = 0,05`.
4. **Escolha**: o que cabe e tem a **maior área impressa** (largura × altura). Não há empates na lista da RN-01.
5. **Nenhum cabe**: 10×15 na orientação da célula e `cresceu = true`.

Verificação feita na redação desta spec: com `b = 0`, a regra reproduz **as 82 linhas** da coluna "Foto (borda 0)" de `templates.md` (os 12 modelos). Exemplos: 27,9 × 35,6 → 20×30; 15,2 × 20,3 → 13×18; 20,3 × 20,3 (quadrada) → 13×18; 40,6 × 50,8 → 40×50; 50,8 × 25,4 → 30×20. Com borda 2: 20,3 × 25,4 → 15×21 (externo 19 × 25).

### 4.3 Aplicação do template (RN-29 a RN-31, M3-06)

1. Para cada célula do catálogo (na ordem do modelo): `tamanhoParaCelula` → tamanho e `cresceu`.
2. **Retângulo externo** da vaga: `(larguraImpressa + 2b) × (alturaImpressa + 2b)`, **centralizado na célula**: `x = cx − externoL / 2`, `y = cy − externoA / 2` (relativos ao modelo), arredondados a 0,1 cm (RN-27). Vaga que cresceu mantém o mesmo centro.
3. **Afastamento** (só se alguma vaga cresceu; A-31): até 10 passadas; em cada uma, para todo par de retângulos externos que se sobrepõem em mais de `ε` nos dois eixos e em que ao menos um é *crescido* ou *empurrado*, move-se o outro (o posterior na ordem, se ambos forem) no eixo de **menor penetração**, para longe do centro do primeiro, pelo valor da penetração arredondado para cima a 0,1 cm. Uma vaga movida passa a contar como *empurrada* e pode empurrar outras na passada seguinte. Termina sem sobreposição ou ao fim das 10 passadas (o que restar fica visível como sobreposição, RN-11).
4. **Conjunto** = caixa que une todas as células e todos os retângulos externos (= o total do catálogo, exceto se alguma vaga ultrapassar as células ou for empurrada para fora delas).
5. **Posição**: `posicaoCm` é o canto superior esquerdo do **conjunto**; cada vaga recebe `xCm = posicao.x + (xRel − conjunto.minX)` e `yCm` análogo.
6. **Foto** gerada: `{ _id: novoId(), imagemId: null, imagemAnteriorId: null, tamanho: { sugeridoId, larguraCm, alturaCm }, xCm, yCm, recorte: { offsetX: 0, offsetY: 0 }, borda }` — a ordem do array é a pilha (DM-04); as vagas do catálogo não se sobrepõem.
7. `vagasMaiores` = quantas vagas têm `cresceu`.
8. **Maior que a área útil**: `conjunto.larguraCm > area.larguraCm + ε` ou a altura análoga.

### 4.4 Posição do conjunto (RN-32)

- **Centralizar**: `x = area.xCm + (area.larguraCm − conjunto.larguraCm) / 2`, idem em Y, arredondado a 0,1; vale mesmo que o conjunto seja maior (estoura igualmente dos dois lados).
- **Snap**: só com `grid.snap`, aplicado ao canto superior esquerdo do conjunto (`encaixar` da M2 §4.4).
- **Limite**: ≥ 1 cm (`MINIMO_DENTRO_CM`) da caixa do conjunto dentro da parede inteira, em cada eixo (M2-11).

### 4.5 Nomes (A-03)

- Em branco: "Variante 2", "Variante 3"… (menor N ≥ 2 livre). Cópia: "<nome> (cópia)", "<nome> (cópia 2)"… Template: "<modelo>", "<modelo> 2"…
- Truncamento: se passar de 60, corta o prefixo e preserva o sufixo ("…" no fim do prefixo).

### 4.6 Estado de salvamento (A-06) e rascunho (M3-08)

- `sujoOficial` = `!conteudoIgual(conteudoAtual, ultimoOficial)`; `sujoRascunho` = mudou desde o último rascunho ou salvamento oficial.
- Rascunho **elegível**: `salvoEm > variante.salvaEm`; entre vários, o de `salvoEm` maior. **Desatualizado**: `revisaoBase < variante.revisao`. **Obsoleto**: `salvoEm ≤ salvaEm` (apagado no *hard save*, A-10).

### 4.7 Esboço (A-15)

`esbocoDeFotos(fotos, caixaCm)` devolve, para cada foto, `{ x, y, w, h, tipo }` em 0–1 relativos a `caixaCm` (parede inteira ou, para a galeria, o total do modelo), na ordem da pilha. Sem Konva e sem imagens; renderizado como SVG.

## 5. API (M3)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /api/config` (M2, ampliada) | — | `{ uploadMaxMb, autosaveMinutos }` |
| `GET /api/projetos` (M1, ampliada) | — | acrescenta `semFoto` (soma de placeholders das variantes salvas — M3-02) |
| `GET /api/projetos/:id` (M1, ampliada) | — | `{ projeto, variantes, rascunhos }`; `rascunhos` = `[{ varianteId, sessaoId, salvoEm, revisaoBase, qtdFotos }]`, só os **elegíveis** (M3-08), um por variante |
| `GET /api/projetos/:pid/variantes/:id` | — | 200 variante completa · 404 |
| `POST /api/projetos/:pid/variantes` | `{ sessaoId, nome, grid, bordaPadrao, areaUtil, origem }` com `origem` = `{ tipo: 'vazia' }` \| `{ tipo: 'copia', fotos }` \| `{ tipo: 'template', templateId, posicaoCm: { xCm, yCm }, borda: { larguraCm, cor } }` | 201 `{ variante }` · 400 Zod · 404 projeto/template · 422 (`copia` com imagem inexistente; `template` sem escala) |
| `PATCH /api/projetos/:pid/variantes/:id` | `{ nome }` | 200 `{ _id, nome }` (sem mudar `revisao`) |
| `DELETE /api/projetos/:pid/variantes/:id` | — | 204 (apaga variante e rascunhos; ajusta `ultimaVarianteId`) · 409 última variante · 404 |
| `PUT /api/projetos/:pid/variantes/:id` (M1/M2, ampliada) | igual | acrescenta: apaga rascunhos obsoletos (A-10) · **404** variante inexistente · **422** com fotos e sem escala (A-11) |
| `GET /api/projetos/:pid/variantes/:id/rascunho?sessaoId=` | — | 200 `{ sessaoId, revisaoBase, conteudo, salvoEm }` (sem `sessaoId`: o mais recente elegível) · 404 |
| `PUT /api/projetos/:pid/variantes/:id/rascunho` | `{ sessaoId, revisaoBase, conteudo: { grid, bordaPadrao, areaUtil, fotos } }` | 200 `{ salvoEm }` · **409** `{ revisao, salvaEm, salvaPorSessao }` se `revisao` ≠ `revisaoBase` (nada gravado — M3-07) · 400 Zod · 404 |
| `DELETE /api/projetos/:pid/variantes/:id/rascunho?sessaoId=` | — | 204, idempotente |
| `PATCH /api/projetos/:id` (M1, ampliada) | `{ nome? , ultimaVarianteId? }` | 200 projeto; `ultimaVarianteId` não altera `atualizadoEm` |
| `PUT /api/projetos/:id/parede` (M1, ampliada) | igual | acrescenta: apaga os rascunhos do projeto (A-10) |

`POST` de variante:
1. **`vazia`**: `fotos: []`.
2. **`copia`**: o servidor gera ids novos para as fotos e confere as imagens (como no *hard save*, M2 §5).
3. **`template`**: o servidor aplica `aplicarTemplate` (domínio) com `templateId`, posição e borda; `bordaPadrao` = a borda recebida; grava `templateOrigem`. O cliente não envia fotos.
4. Em todos: `ordem` = maior + 1; `revisao = 1`; `salvaPorSessao = sessaoId`; `projetos.atualizadoEm` e `ultimaVarianteId` atualizados. Fotos com imagem reais fazem `$addToSet` em `imagens.projetos` (M2-05).

Regras comuns do M1 e do M2 continuam (erros `{ erro, detalhes? }` em pt-BR, Zod na entrada, API só em `127.0.0.1`). Sem transações: criar variante é uma gravação única; excluir apaga rascunhos → variante.

## 6. Web

| Camada | Entrega |
|---|---|
| `app/` | A fatia **documento** guarda o estado da ativa e o cache das variantes salvas (A-05): conteúdo, histórico zundo, revisão base, sujo, conflito. Ações novas: `decidirAlteracoes` (A-12), `alternarVariante`, `criarVariante`, `duplicarVariante`, `renomearVariante`, `excluirVariante`, `aplicarTemplate`, `preencherVaga`, `salvarRascunhos`, `recuperarRascunho`, `descartarRascunho`, `resolverConflito` (`manter` · `usar-salva` · `nova-variante`). Temporizador do salvamento automático na fatia **ui**/sessão. A fatia **ui** ganha o modo "template" e o estado da galeria. |
| `infra/` | `ClienteApi` ganha as rotas da §5 (variantes, rascunhos, `PATCH` de `ultimaVarianteId`). Sem dependências novas. |
| `ui/canvas/` | `Palco.tsx` continua o único módulo com Konva: ganha o modo **somente leitura** (sem hit nem seleção; grid, área útil e alertas opcionais por propriedade) e o viewport **controlado** (`viewport` + `onViewport`) para a comparação; `cena.ts` ganha o conjunto do template (vagas a 80%, contorno, pill) como dados. O gancho `window.__deco` ganha `paraTelaComparacao(lado, x, y)` para os E2E. |
| `ui/paineis/` | Painel do modo Template (A-22); painel do placeholder com **Preencher com a foto selecionada**; painel Composição com "Sem foto N" já ativo (M2) e aviso das outras variantes sujas. |
| `ui/telas/editor/` e `ui/componentes/` | `SeletorVariante` (A-01), `DialogosVariante` (A-02), `DialogoTemplates` (galeria, A-18), `DialogoConflito` e `DialogoRecuperar` (A-14, A-09), `EsbocoVariante` (A-15), `modos/ModoTemplate`; `DialogoSair` ampliado (A-12). |
| `ui/telas/` | Tela **Comparação** (`/projetos/<id>/comparar`, A-26): dois `Palco` de leitura com viewport compartilhado (A-17). Projetos: pill "N sem foto" no card (A-24). |

Dependências novas: nenhuma prevista. Qualquer uma para e pede aprovação.

## 7. Testes

| Tipo | Cobertura |
|---|---|
| Unitário (domínio) | `tamanhoParaCelula`: **as 82 linhas "Foto (borda 0)" de `templates.md`** (teste dirigido pelo catálogo), caso com borda 2 (20,3 × 25,4 → 15×21), célula quadrada → retrato, "nenhum cabe" (borda grande no Mondrian → 10×15 e `cresceu`), folga de 0,05. `aplicarTemplate`: 12 modelos (totais iguais a `templates.md` ±0,1 cm, número de vagas, vagas centralizadas, sem sobreposição com borda 0, ids novos, posição do conjunto, vaga que cresce amplia o conjunto; afastamento: vizinhas sem sobreposição, vaga crescida com o mesmo centro, modelos sem crescimento inalterados, limite de 10 passadas). Conjunto: centralizar (inclusive maior que a área útil), snap, limite. `maiorQueAreaUtil`. `preencherVaga`. Nomes (numeração, truncamento). `copiarParaNovaVariante`. `conteudoIgual`. `estadoDeSalvamento` (todas as prioridades). Rascunho elegível, desatualizado, obsoleto. `esbocoDeFotos`. Cobertura do domínio ≥ 90%. |
| API (integração) | CRUD de variantes (criar nas 3 origens, ordem, `semFoto`, renomear sem mudar revisão, excluir com cascata de rascunhos e `ultimaVarianteId`, 409 na última, 404). `template`: fotos iguais ao domínio, `templateOrigem`, `bordaPadrao`, 422 sem escala. Rascunho: upsert por (variante, sessão), 409 sem gravar, GET do mais recente de outra sessão, DELETE idempotente, resumo elegível em `GET /api/projetos/:id`. *Hard save*: apaga rascunhos próprio e obsoletos, mantém os mais novos, 404, 422 sem escala. Trocar a parede apaga os rascunhos. `GET /api/config` com `autosaveMinutos`. Reparação da inicialização (M1 A-18) sem regressão. Banco de teste com o seed existente (variante de template, rascunho de revisão antiga). |
| Componentes | `SeletorVariante` (itens, selos, ponto âmbar na ativa, excluir inativo na última, inativo em modo); diálogos de variante; diálogo de decisão ao deixar a ativa suja (A-12: três saídas, conflito interrompe); galeria (seleção, aviso "Maior que a área útil", aviso de borda, nome sugerido, inativa sem escala); painel do modo Template (campos, centralizar, avisos); diálogo de conflito (três saídas só habilitam com a palavra digitada, palavra errada não habilita, Enter no campo, 404); diálogo de recuperação (normal e base antiga);  barra de status (A-06, A-13); painel do placeholder (preencher); cabeçalhos da comparação (RN-36: a mesma variante nos dois lados, sem troca de lados). |
| E2E (Playwright) | (1) Variantes: criar em branco, duplicar (com alterações não salvas → diálogo de decisão → Salvar e continuar / Descartar / Cancelar), renomear, alternar, excluir, última não exclui (RN-23). (2) **Desfazer por variante**: alterar A, salvar, ir para B, alterar B; desfazer em B não muda A, e ao voltar a A a pilha dela continua ali (PRD aceite 12). (3) Template Pirâmide: galeria → posicionar → arrastar com snap → confirmar → 6 vagas nos tamanhos de `templates.md`, nome "Pirâmide", área útil copiada, "6 sem foto". (4) Borda 2 cm recalcula os tamanhos. (5) Template maior que a área útil: aviso e confirmação. (6) Preencher vaga por arraste e pelo botão; recorte centralizado. (7) Salvamento automático com o relógio do Playwright avançando `autosaveMinutos`: status "Rascunho salvo às hh:mm", Salvar apaga o rascunho. (8) Recuperação: editar, esperar o rascunho, recarregar sem salvar, reabrir → diálogo → Recuperar → "Alterações não salvas". (9) Conflito com duas páginas: Salvar em A, depois em B → diálogo → as três saídas, cada uma só depois de digitar "minha", "salva" ou "nova". (10) Conflito no rascunho: `Alert` "Resolver…" e autosave suspenso. (11) **Comparação**: zoom e pan em um painel replicados no outro (PRD aceite 11), RN-36 (a mesma variante nos dois lados, sem troca de lados), somente visualização, "Parede inteira", chaves Grid/Área útil/Alertas afetando os dois lados. (12) Fechar e reabrir restaura as variantes e posições (PRD aceite 7). (13) Nenhuma requisição fora de `localhost` (teste existente estendido). |
| Desempenho | Os números da A-29, registrados no `MEMORY.md`. |

## 8. Critérios de aceite do M3

1. Variantes: criar (em branco e duplicando), renomear, excluir com confirmação e alternar; a última não se exclui; trocar de variante com alterações pede Salvar, Descartar ou Cancelar, e preserva o histórico das variantes salvas (RF-91, RN-23, M3-03 a M3-05).
2. **PRD aceite 12:** desfazer na variante A não altera a variante B.
3. Galeria com os 12 modelos; cada vaga recebe o maior tamanho que cabe (verificado contra as 82 linhas do catálogo); borda única; aviso de vagas maiores; aviso "Maior que a área útil" sem bloqueio (RN-29, RN-30, TPL-01 a TPL-08).
4. Posicionamento: conjunto centralizado na área útil, arrastável com snap, X/Y editáveis, Confirmar/Enter e Cancelar/Esc; a variante nasce com o nome do modelo, a área útil copiada e as vagas como placeholders (RN-31, RN-32, RN-35, TPL-04, TPL-06).
5. Preencher vaga por arraste e pelo botão, mantendo formato, posição e borda (M3-01).
6. Selo "N sem foto" no seletor e no card do projeto (M3-02).
7. Salvamento automático grava rascunho a cada `AUTOSAVE_MINUTOS` só quando há alteração, sem tocar a versão oficial; o *hard save* tem prioridade e limpa os rascunhos (RF-71, SV-01 a SV-03).
8. Recuperação de rascunho mais novo que a versão oficial, com aviso quando a base é antiga (SV-07).
9. Conflito entre abas detectado no Salvar e no rascunho, com as três saídas (cada uma confirmada digitando a palavra da opção) e autosave suspenso (RF-73, RN-26, SV-04 a SV-06).
10. Status e `beforeunload` conforme SV-08 e A-06; a decisão ao deixar a ativa suja funciona nas quatro entradas (A-12).
11. **PRD aceite 11:** na comparação, zoom e pan em um painel se repetem no outro; somente visualização; "Parede inteira" enquadra os dois.
12. **PRD aceite 7 (variantes):** fechar e reabrir restaura projetos, variantes, posições e a variante ativa.
13. Desempenho da A-29 atingido ou registrado com plano de ação no `MEMORY.md`.
14. `typecheck`, `lint`, `test` e `e2e` verdes; cobertura do domínio ≥ 90%; nenhuma requisição externa.

## 9. Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| T1 | Constantes, pasta `variantes/` (após a ARCHITECTURE §6), `autosaveMinutos` em `GET /api/config` | PR-M3-01 a 04 |
| T2 | Domínio: catálogo dos 12 modelos, `tamanhoParaCelula`, `aplicarTemplate`, conjunto + testes (incluindo as 82 linhas) | T1 |
| T3 | Domínio: nomes, `copiarParaNovaVariante`, `conteudoIgual`, estado de salvamento, rascunho, esboço, `preencherVaga` + testes | T1 |
| T4 | API: CRUD de variantes (3 origens), `GET` da variante, `PATCH` de `ultimaVarianteId`, `semFoto` + testes | T2, T3 |
| T5 | API: rascunhos (PUT/GET/DELETE, 409), resumo no `GET` do projeto, ajustes do *hard save* (limpeza, 404, 422), limpeza na troca de parede + testes | T4 |
| T6 | Web: store (ativa + cache de variantes salvas), seletor, diálogos de variante, decisão ao deixar a ativa suja (A-12), status | T4 |
| T7 | Web: salvamento automático (temporizador, falhas), recuperação | T5, T6 |
| T8 | Web: conflito (diálogo, `Alert`, saídas, 404) e `EsbocoVariante` | T5, T6 |
| T9 | Web: galeria de templates | T2, T6 |
| T10 | Web: modo Posicionar template (palco, painel, criação) | T9 |
| T11 | Web: preencher vaga (arraste, botão) | T6 |
| T12 | Web: comparação (palco somente leitura, viewport controlado, tela) | T6 |
| T13 | Web: card do projeto (`semFoto`), ativação de Comparar/Templates/seletor, barra de status | T6, T12 |
| T14 | E2E + desempenho + README + `MEMORY.md` | todas |

## 10. Forma de trabalho

- Conforme a A-30: TDD em dois commits, como no M1 e no M2 — `test(m3): …` com todos os testes vermelhos e `feat(m3): …` com a implementação e tudo verde (`typecheck`, `lint`, `test`, `e2e`). A ordem da §9 é a ordem de implementação. Status no `MEMORY.md` ao fim.
- Validação do Nicholas na **T14** (aceite do M3).
- Esta spec foi escrita sem abrir o código-fonte (`CLAUDE.md`). Pontos que dependem da forma real do store e da camada de fotos do M2 (A-05, §6) devem ser reconferidos contra a implementação do M2 na T1.

## 11. Alterações a fazer em outros documentos (após a revisão, PR-M3-04)

**Aplicadas em 02/11** (PRD v0.14, DESIGN v0.5, ARCHITECTURE v0.9 e specs M0, M1 e M2); a tabela abaixo fica como registro do que mudou.

| Documento | Alteração prevista |
|---|---|
| `docs/PRD.md` | RF-30a/roadmap: associação básica de imagem ao placeholder no M3 (M3-01); RF-90: card com "N sem foto" no M3 (M3-02); RF-91/RN-23: criar/duplicar/excluir imediatos, duplicar copia o estado em tela, última variante não se exclui (M3-04); RN-35: variante nova herda também grid e borda padrão (M3-05); RN-29: critério "maior área impressa", orientação da célula e crescimento em torno do centro (M3-06); RN-32: snap e limite no conjunto (M3-06); RN-26/RF-71/RF-73: conferência no rascunho, saídas do conflito (M3-07, M3-09); RF-92: estado em memória, par inicial, visualização limpa (M3-10); roadmap M3 (protótipos e escopo). **Já aplicada (02/11):** RF-74 em Ideias futuras (botão para forçar a sincronização entre abas), PRD v0.13. |
| `docs/DESIGN.md` | §7: seletor de variante (A-01), comparação (A-16, A-17, A-26), painel do modo Template (A-22), `Alert` de conflito do rascunho, campo de confirmação por palavra no diálogo de conflito (A-14); §6: selo "N sem foto" e ponto âmbar; §8: textos novos (recuperação, conflito do rascunho, excluir variante); §10: protótipos 15/15b sem painel (ilustrativos) e 06 sem grid. |
| `docs/ARCHITECTURE.md` | §6: `packages/domain/src/variantes/`, `ui/telas/comparacao/`, `modos/ModoTemplate`; ADR-12: estado em memória por variante, comparação com viewport controlado; ADR-13: rotas de variantes e rascunhos, `PATCH` de `ultimaVarianteId`; ADR-11: `autosaveMinutos` em `/api/config`; §7 fluxos (soft save, recuperação, conflito). |
| `docs/specs/M0-setup.md` | SV-04/SV-06: conferência também no rascunho (sem gravar); SV-07: definição de base antiga; SV-02: limpeza dos rascunhos obsoletos; §4.6: `DELETE` por sessão; §4.5: `ordem`. |
| `docs/specs/M1-parede-e-escala.md` | A-04: indicador "sem foto" no M3; §3.8: Salvar grava a variante ativa e há decisão ao deixá-la suja; troca de parede apaga rascunhos. |
| `docs/specs/M2-biblioteca-e-composicao.md` | M2-06: associação de imagem a placeholder passa ao M3 (básica); A-26: novos estados do status; §6: histórico por variante já efetivo. |
| `MEMORY.md` | Decisões M3-01 a M3-10 (com a data da decisão) e premissas alteradas na revisão. |

## 12. Registro da implementação (02/11)

Implementada em `claude/m3-implementation-fb9960`, que **carrega o código do M2** (mesclado de `claude/m2-implementation-8f6bef`, aceito em 31/10): a `main` ainda não tem o M2. Ordem do TDD: `test(m3)` vermelho antes de cada `feat(m3)`, **por camada** (domínio e API; store e cliente HTTP; UI; E2E), e não num único commit de testes como pedia a A-30 — a UI foi escrita contra os contratos dos testes das camadas de baixo, o que deixou o laço de correção curto. Os E2E foram escritos junto da UI.

### 12.1 Números

Vitest 1.341 testes (domínio, API e web), Playwright 99/99, `typecheck`, `lint` e `format:check` verdes. Cobertura do domínio: 98,6% das instruções, 95,7% dos ramos e 99,4% das linhas. Desempenho no Chromium headless (Windows), meta da A-29 em parênteses:

| Medida | Resultado |
|---|---|
| Abrir o posicionamento do template (clique até o modo pintado) | 84–98 ms (< 200 ms) |
| Salvar o rascunho de uma variante com 40 fotos (`PUT …/rascunho`, mediana de 7) | 4 ms (< 100 ms) |
| Arrastar o conjunto do template, 10 vagas (o máximo do catálogo; a A-29 fala em 12, que não existe) | 60 fps, quadro médio 16,7 ms (≥ 50 fps) |
| Pan e zoom na comparação, 2 × 40 fotos de 12 MP no perfil Leve | 60 fps, quadro médio 16,7 ms (≥ 50 fps) |
| Memória do navegador inteiro nessa comparação | +266 a +297 MB sobre o navegador vazio (< 400 MB); heap JS 20–23 MB |

### 12.2 Escolhas da implementação que a spec não fixava

| # | Escolha | Por quê |
|---|---|---|
| I-01 | A criação de variante (`POST`) grava `atualizadoEm` (§5, item 4); só o `PATCH` de `ultimaVarianteId` o preserva. | **Confirmada pelo Nicholas (02/11):** a M3-04 diz que `ultimaVarianteId` muda "ao trocar e ao criar (sem alterar `atualizadoEm`)" e a §5 manda atualizar `atualizadoEm` na criação. Segui a §5 (criar variante é uma edição real); a consequência é o projeto subir na lista de projetos ao criar uma variante. |
| I-02 | O temporizador do rascunho passa por `agendador.periodico` (`apps/web/src/app/autosave.ts`). | Os testes capturam o intervalo e disparam os ticks sem relógio falso, que atrapalha a espera do Testing Library. Os E2E usam `page.clock`. |
| I-03 | Em base antiga, a recuperação busca o conteúdo do rascunho antes da escolha (`ui.recuperacao.previa`) para o diálogo mostrar as duas versões (A-09). | O resumo do projeto só traz o número de fotos. |
| I-04 | Duplicar pelo menu ⋯ de outra variante primeiro abre essa variante (com a decisão da A-12) e depois o diálogo de nome. | "Duplicar copia o estado em tela" (M3-04): só a ativa tem estado em tela. |
| I-05 | O cartão "A minha" do conflito usa a hora da última alteração local (`documento.alteradoEm`). | A-14 pede a hora; a store não a guardava. |
| I-06 | O PUT da variante responde 422 "A parede está sem escala." com fotos e sem escala (A-11), **revendo a M2-14** (que tirou os acréscimos do servidor). O E2E e o teste de API do M2 que esperavam 200 foram ajustados. | Decisão já aprovada nesta spec (A-11, §2). |
| I-07 | As vagas do conjunto saem a 80% de opacidade nos nós da cena (cm); a hachura de placeholder, que o Palco desenha na camada em px de tela, mantém opacidade cheia. | Reaproveita a camada de placeholders do M2 sem duplicá-la. |
| I-08 | A pill do total do conjunto é desenhada no palco (ícone ✥ e medida). | DESIGN §7.3 / A-21. |
| I-09 | As setas movem o conjunto no modo Posicionar template (A-21), com a regra das fotos (1 passo do grid, ou 1 cm sem snap; Shift, 5 vezes) e o mesmo limite do arraste. | A-21. Veio da revisão do fim da sessão, depois do primeiro registro. |
| I-10 | A comparação esconde a frase "Zoom e posição iguais nos dois lados" abaixo de 1440 px. | Em 1280 px ela empurrava "Parede inteira" para fora do header (visto nas capturas). |
| I-11 | A caixa do esboço de cada card da galeria tem 116 px de altura fixa, com o esboço centralizado (DESIGN §6). | Sem ela os cards ficavam com alturas diferentes, conforme a proporção do modelo. |

### 12.3 Alterações em testes do M1 e do M2 que o M3 muda de propósito

`store.test.ts` (forma do conflito), `Editor.test.tsx` (Comparar e Templates ativos; 409 abre o diálogo), `Projetos.test.tsx` (`semFoto`), `variantes.test.ts` e `config.test.ts`/`projetos.test.ts` da API (rascunhos obsoletos, 422 sem escala, `autosaveMinutos`, `semFoto`, `rascunhos` no `GET`), `composicao.spec.ts`, `parede.spec.ts` e `projetos.spec.ts` (E2E).

