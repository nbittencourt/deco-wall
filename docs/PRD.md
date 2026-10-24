# PRD — Simulador de Parede de Fotos

| Campo | Valor |
|---|---|
| Versão | 0.11 (decisões da spec M1) |
| Data | 2026-10-24 |
| Autor | Nicholas Bittencourt |
| Status | Requisitos e regras fechados — arquitetura em `docs/ARCHITECTURE.md` |

Legenda de origem: **[U]** pedido do usuário · **[D]** decidido em revisão · **[I]** inferência necessária · **[P]** proposta pendente de validação.

## 1. Contexto e problema

Montar uma parede com várias fotos exige decidir posição, tamanho e espaçamento antes de furar a parede. Hoje isso é feito "no olho", gerando retrabalho e furos desnecessários.

## 2. Objetivo

App web executado apenas localmente (browser + servidor local + MongoDB local) que permite simular sobre uma foto real da parede o posicionamento de fotos impressas em tamanhos padrão de laboratório ou personalizados (retrato ou paisagem), com grid de apoio e dimensões aproximadas em cm. **[U]**

### 2.1 Metas de sucesso **[D]**

- Simular uma composição completa (parede → calibração → posicionamento → exportação) em menos de 15 minutos.
- Erro de medida ≤ 5% após calibração/correção de perspectiva.

### 2.2 Fora de escopo (v1)

- Servidor remoto, autenticação/contas, multiusuário, compartilhamento online. **[D]**
- Geração de PDF pelo app (impressão, se necessária, via função do navegador). **[D]**
- Moldura e passe-partout (ver Ideias futuras). **[D]**
- Edição de imagem (filtros, cor), detecção automática da parede, correção de distorção de lente.

## 3. Cenário de uso

Usuário único, uso pessoal: **[U]**
1. Fotografa a parede.
2. Carrega a foto no app e define a escala (perspectiva e/ou referência linear).
3. Aponta a pasta com as fotos.
4. Adiciona fotos, escolhe tamanho e orientação, posiciona com apoio do grid.
5. Confere medidas e exporta a imagem da simulação.

## 4. Glossário

| Termo | Definição |
|---|---|
| Parede | Imagem de fundo enviada pelo usuário. |
| Calibração | Relação px ↔ cm obtida por referência linear ou por correção de perspectiva. |
| Foto | Imagem do usuário posicionada na parede, com tamanho físico definido. |
| Tamanho | Tamanho de impressão em cm: um dos tamanhos sugeridos (RN-01) ou personalizado (RN-28). |
| Orientação | Retrato (lado menor na horizontal) ou paisagem (lado maior na horizontal). |
| Borda | Faixa colorida somada por fora da área impressa da foto. |
| Tamanho externo | Área impressa + 2 × borda. |
| Composição | Conjunto de fotos posicionadas + configuração da parede. |

## 5. Requisitos funcionais (v1)

Prioridade: **P0** = obrigatório na v1 · **P1** = desejável na v1. Demais itens estão na seção 11 (Ideias futuras).

### 5.1 Parede

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-01 | Carregar foto da parede (JPG, PNG, WEBP) por seleção de arquivo ou drag-and-drop, com perfil de qualidade (RF-25). | P0 | U |
| RF-02 | Respeitar orientação EXIF ao exibir. | P0 | I |
| RF-03 | Zoom e pan sobre a parede. | P0 | I |
| RF-06 | Prévia frontal sob demanda na correção de perspectiva: botão "Gerar prévia" calcula uma versão de baixa resolução (~320 px) com os cantos atuais; ao mover uma alça, a prévia é marcada como desatualizada. | P0 | D |
| RF-05 | Correção de perspectiva: usuário marca os 4 cantos de um retângulo real (parede, porta, quadro) e informa largura × altura em cm; o app retifica a imagem e obtém a escala. | P0 | D |
| RF-07 | Trocar a foto da parede enquanto nenhuma variante do projeto tem fotos, com confirmação; a troca descarta escala, vista retificada e áreas úteis. | P0 | D |

### 5.2 Calibração de escala

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-10 | Calibração linear: usuário desenha um segmento e informa o comprimento real em cm. | P0 | I |
| RF-12 | Exibir a escala (px/cm) e permitir recalibrar a qualquer momento. | P0 | I |
| RF-13 | Exigir calibração antes de incluir fotos (ver RN-08). | P0 | I |
| RF-14 | Aviso de precisão: medidas assumem parede plana; recomendar referência ≥ 1 m. | P0 | I |

### 5.3 Biblioteca de fotos (global)

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-20 | Upload de fotos individual ou em lote (seleção de arquivos, de pasta ou drag-and-drop), feito a partir de um projeto. | P0 | U/D |
| RF-21 | Progresso por arquivo no upload em lote; falhas listadas sem interromper o lote. | P0 | I |
| RF-22 | Miniaturas com nome original do arquivo e orientação natural detectada. | P0 | I |
| RF-23 | Indicar quais fotos já estão na variante ativa (e quantas vezes). | P1 | I |
| RF-25 | Perfil de qualidade escolhido no upload (Leve, Médio, Alto; padrão Leve): a imagem é reduzida e convertida para WebP; o resultado é definitivo. | P0 | U/D |
| RF-26 | Imagens processadas gravadas na pasta definida em configuração (`.env`). | P0 | D |
| RF-27 | Biblioteca única: toda foto carregada fica disponível em todos os projetos. | P0 | D |
| RF-28 | Filtros da biblioteca: Todas · Neste projeto (carregadas no projeto ou usadas em qualquer variante) · Nesta variante · Excluídas. | P0 | D |
| RF-29 | Ao excluir/remover uma imagem: perguntar se é remoção do projeto ou exclusão; mostrar associações; exclusão reversível por 30 dias (restaurar), depois definitiva. | P0 | D |
| RF-30a | Foto excluída vira *placeholder* nas variantes (mantém formato, posição, borda); restaurar não repõe automaticamente; placeholder aceita outra foto e recomenda a anterior se restaurada; variantes com placeholder são sinalizadas. | P0 | D |

### 5.4 Fotos na parede

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-30 | Adicionar foto por drag-and-drop da biblioteca ou botão "Adicionar". | P0 | U |
| RF-31 | Escolher o tamanho entre os sugeridos (RN-01) ou definir tamanho personalizado em cm no modo de recorte (RN-28). | P0 | U/D |
| RF-32 | Escolher orientação: retrato ou paisagem. | P0 | U |
| RF-33 | Enquadramento: imagem preenche o formato (*cover*); usuário reposiciona o recorte dentro do quadro. | P0 | I |
| RF-34 | Mover por arrastar e por setas do teclado. | P0 | U/I |
| RF-35 | Selecionar, duplicar, excluir, trazer para frente/enviar para trás. | P0 | I |
| RF-41 | Borda opcional: largura em cm e cor, somada por fora da área impressa. Cor escolhida entre cores prontas ou livre ("Outra cor…"). | P0 | D |

### 5.5 Grid

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-50 | Grid sobreposto com espaçamento em cm configurável. | P0 | U |
| RF-51 | Liga/desliga; cor e opacidade ajustáveis. | P0 | U/I |
| RF-52 | Linhas principais a cada N divisões com rótulo de medida. | P1 | I |
| RF-53 | *Snap to grid* liga/desliga. | P0 | I |

### 5.6 Medidas

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-60 | Painel da foto selecionada: tamanho, orientação, borda, tamanho externo e posição X/Y (cm), editáveis. | P0 | U/I |
| RF-62 | Bounding box da composição com largura × altura total (cm). | P0 | U/I |

### 5.7 Histórico e persistência

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-70 | Desfazer/refazer por variante. | P0 | D |
| RF-71 | Salvamento automático (rascunho) a cada X minutos, separado do salvamento manual. | P0 | D |
| RF-72 | Salvamento manual (*hard save*) por botão e Ctrl+S; versão oficial da variante. | P0 | D |
| RF-73 | Detecção de versão desconexa antes de salvar, com escolha: manter a minha, usar a salva ou salvar a minha como nova variante. | P0 | D |

### 5.8 Exportação

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-80 | Exportar a simulação como PNG/JPG na resolução da parede. Nome do arquivo: `<projeto>-<variante>-AAAAMMDD-HHmm.<ext>` (minúsculas, sem acentos, espaços → hífen, hora de Brasília). | P0 | I/D |

### 5.9 Projetos e variantes

| ID | Requisito | Prior. | Origem |
|---|---|---|---|
| RF-90 | Listar, criar, abrir, renomear e excluir projetos. Lista em cards com miniatura **da foto da parede** (sem as fotos posicionadas; "Sem foto da parede" quando não houver), resumo (nº de variantes, última edição), aviso de placeholders e menu ⋯ com **Renomear** e **Excluir**. | P0 | D |
| RF-91 | Variantes de composição por projeto: criar (vazia ou duplicando), renomear, excluir, alternar. Parede compartilhada entre variantes. | P0 | D |
| RF-93 | **Templates de layout**: galeria de 12 modelos pré-definidos (catálogo e geometria em `docs/specs/templates.md`) para criar uma variante nova com vagas (*placeholders*) posicionadas. | P0 | U |
| RF-94 | **Área útil por variante**: retângulo da parede onde as fotos devem ficar; definida após a escala e editável a qualquer momento. | P0 | U |
| RF-92 | Comparação lado a lado de 2 variantes, com zoom e pan sempre sincronizados, permitindo focar um recorte da parede, e atalho "Parede inteira". Somente visualização (sem edição). | P0 | D |

## 6. Regras de negócio

| ID | Regra | Status |
|---|---|---|
| RN-01 | Tamanhos sugeridos (cm, menor × maior lado; retrato = menor na horizontal, paisagem = maior na horizontal): padrão 10×15 · 13×18 · 15×21 · 20×25 · 20×30; quadrados 13×13 · 15×15; grandes 30×40 · 30×45 · 40×50 · 40×60 · 50×60 · 50×70 · 60×80 · 60×90 · 70×100 · 75×120. Rótulos só em cm. | Decidido |
| RN-02 | Borda é somada por fora: tamanho externo = impresso + 2 × borda. Borda 0 = sem borda. | Decidido |
| RN-03 | Borda: valor padrão global (largura e cor) aplicado a novas fotos, editável por foto. Padrão 0 cm, cor branca. | Decidido |
| RN-04 | Tamanho padrão ao adicionar: 10×15. Orientação padrão: natural da imagem (largura > altura → paisagem; senão retrato). | Decidido |
| RN-05 | Alternar orientação ou mudar o tamanho mantém fixo o canto superior-esquerdo externo. | Decidido |
| RN-06 | Posição X/Y, snap e bounding box usam o **tamanho externo** (inclui borda), pois é o objeto físico na parede. | Decidido |
| RN-07 | Sistema de coordenadas: origem no canto superior-esquerdo do retângulo de referência da perspectiva (ou da imagem, se só houver calibração linear); X cresce para a direita, Y para baixo. | Decidido |
| RN-08 | Escala: a correção de perspectiva é o método principal e já define a escala; a calibração linear é usada quando o usuário pular a perspectiva. Com a perspectiva aplicada, a calibração linear fica indisponível (refazer a escala = refazer a perspectiva); com escala linear, aplicar a perspectiva a substitui. Inclusão de fotos é bloqueada sem nenhuma das duas. | Decidido |
| RN-09 | Com perspectiva aplicada, o canvas exibe a parede **retificada** (vista frontal); as fotos são desenhadas sem deformação. | Decidido |
| RN-10 | Recalibrar ou refazer a perspectiva preserva posição e tamanho das fotos em cm. | Decidido |
| RN-11 | Sobreposição entre fotos é permitida, com destaque visual (contorno vermelho) nas fotos sobrepostas. | Decidido |
| RN-12 | Foto pode ultrapassar os limites da parede, com destaque visual; a exportação recorta nos limites da imagem. | Decidido |
| RN-13 | A mesma imagem pode ser usada várias vezes na composição. | Decidido |
| RN-14 | Enquadramento: *cover* centralizado por padrão; o usuário apenas desloca o recorte (sem zoom adicional na v1), em um **modo de recorte** (botão "Ajustar recorte" ou duplo clique; Enter conclui, Esc cancela; 1 passo de desfazer). | Decidido |
| RN-15 | Grid: passo padrão 5 cm (opções 1, 2, 5, 10 cm ou personalizado); visível e snap ligados por padrão. | Decidido |
| RN-16 | Teclado: seta move 1 cm; Shift + seta move 5 cm; com snap ligado, move um passo do grid. | Decidido |
| RN-17 | Vários projetos persistidos; um projeto aberto por vez; excluir projeto pede confirmação. | Decidido |
| RN-18 | Desfazer/refazer **por variante**, mínimo 50 passos, mantido enquanto o projeto está aberto (não persistido). Mudanças na parede (upload, troca, perspectiva, calibração) **não** entram no histórico: gravam ao confirmar o modo, que tem Cancelar. A área útil, que é da variante, entra no histórico. | Decidido |
| RN-19 | Exportação: opção de incluir ou não o grid; nunca inclui handles de seleção nem destaques de alerta. Exceção: placeholders saem como retângulo vermelho hachurado semitransparente. | Decidido |
| RN-20 | Arquivos não suportados na pasta são ignorados, com aviso da quantidade ignorada. | Decidido |
| RN-28 | Tamanho personalizado: escolhido em "Personalizado…", editado no modo de recorte (largura × altura); 5 a 150 cm por lado, passo 0,1 cm; mudar o tamanho recentraliza o recorte (*cover*); orientação troca largura e altura; tamanhos quadrados não têm orientação; personalizado igual a um sugerido é tratado como o sugerido. | Decidido |
| RN-29 | Aplicar template: sempre cria **variante nova** com o nome do modelo; cada espaço do modelo é uma célula com seu tamanho real (polegadas → cm, 1 mm); em cada célula entra o **maior tamanho sugerido** (RN-01) que caiba com a borda, centralizado; a sobra vira espaçamento; se nenhum couber, usa 10×15 e a célula cresce, com aviso. | Decidido |
| RN-30 | Ao aplicar template, uma **borda única** para todas as vagas, escolhida no diálogo (padrão = borda padrão da variante ativa). Depois, cada foto pode ter a borda alterada normalmente. | Decidido |
| RN-31 | Vagas do template são *placeholders* (mesmo estado da RF-30a: vermelho hachurado, contam como "sem foto"). | Decidido |
| RN-32 | Posição do template: prévia centralizada na área útil; o usuário pode arrastar o conjunto (com snap) e confirma (clique/Enter; Esc cancela). Modelo maior que a área útil gera aviso antes de confirmar. | Decidido |
| RN-33 | Área útil: após aplicar perspectiva/calibração, padrão = parede inteira (região com pixels da foto — ARCHITECTURE ADR-04), gravada já na primeira escala, com confirmação e redimensionamento pelo usuário (cancelar mantém a parede inteira); posição e tamanho livres a 0,1 cm, sem snap, mínimo 5 cm por lado, dentro da parede inteira; editável pelo botão "Área útil" (alteração da variante: entra no desfazer e no salvamento). Contorno tracejado e exterior esmaecido; nada disso sai na exportação. | Decidido |
| RN-34 | Foto fora da área útil recebe o mesmo destaque de RN-12 e conta como alerta; não bloqueia o movimento. Grid continua na parede inteira. | Decidido |
| RN-35 | Variante nova (vazia, duplicada ou de template) copia a área útil da variante ativa; a "Base" nasce com a parede inteira. Refazer perspectiva preserva as áreas em cm (aviso se ficarem fora da parede). | Decidido |
| RN-21 | Os arquivos originais do usuário nunca são alterados nem guardados pelo app; só a versão processada é armazenada. O perfil é definido no upload e é definitivo — outro peso exige novo upload. | Decidido |
| RN-22 | Biblioteca global, sem autenticação: imagens carregadas em qualquer projeto ficam disponíveis em todos. | Decidido |
| RN-23 | Todo projeto tem ao menos 1 variante. Novo projeto nasce com a variante vazia **"Base"**. | Decidido |
| RN-25 | Upload não verifica duplicatas: a mesma foto pode ser carregada mais de uma vez (inclusive em perfis diferentes). | Decidido |
| RN-24 | Imagem: "remover do projeto" (sai das variantes do projeto, fica na biblioteca) ou "excluir" (*soft delete* 30 dias, consultável e restaurável; depois remoção definitiva). Detalhes em `docs/specs/M0-setup.md` §4.10. | Decidido |
| RN-26 | Salvamento manual tem prioridade sobre o automático; conflito entre sessões exige escolha do usuário. Detalhes em `docs/specs/M0-setup.md` §4.9. | Decidido |
| RN-27 | Medidas em cm arredondadas a 1 mm. | Decidido |

## 7. Requisitos não funcionais

| ID | Requisito | Status |
|---|---|---|
| RNF-01 | 100% local: browser, servidor e MongoDB na mesma máquina; nada sai da máquina; sem autenticação. | Decidido |
| RNF-02 | Execução local por um comando; Chrome/Edge desktop atuais. | Decidido |
| RNF-08 | Configuração por `.env`: pasta das fotos, conexão MongoDB, portas. | Decidido |
| RNF-03 | Interação fluida com até 40 fotos e parede de até 24 MP (miniaturas para render, original só no export). | Decidido |
| RNF-04 | Modelo de dados em cm; px apenas na renderização. | Decidido |
| RNF-05 | Interface em pt-BR, unidades métricas. | Decidido |
| RNF-07 | TypeScript estrito; testes unitários para geometria (escala, snap, homografia). | Decidido |

## 8. Modelo de dados

Persistência em MongoDB local (dados) + pasta configurável (imagens). Coleções, campos e índices serão definidos em etapa própria — ver `docs/ARCHITECTURE.md` (ADR-07).

Entidades conceituais: **Imagem** (biblioteca global) · **Projeto** · **Parede** (1 por projeto) · **Variante** (N por projeto) · **Foto na parede** (N por variante).

## 9. UX

Layout, componentes, estados e textos: `docs/DESIGN.md` (v0.2) e protótipos em `docs/design/`.

## 10. Critérios de aceite (v1)

1. Com escala definida, uma foto 20x30 retrato sem borda mede 20 × 30 cm na escala (±1 px).
2. Foto 10×15 com borda de 2 cm tem tamanho externo 14 × 19 cm (retrato).
2a. Tamanho personalizado 21,0 × 29,7 cm é aceito; 4,9 cm ou 150,1 cm em um lado é rejeitado (RN-28).
3. Alternar orientação inverte largura e altura conforme RN-05.
4. Com snap ligado e passo 5 cm, X/Y de qualquer foto solta é múltiplo de 5 cm.
5. Recalibrar mantém X/Y/tamanho em cm de todas as fotos.
6. Após perspectiva com retângulo de L × A cm, o retângulo retificado mede L × A cm (±1%).
7. Fechar e reabrir o app restaura projetos, variantes e posições a partir do MongoDB.
8. Exportação PNG segue RN-19.
9. Arquivos não suportados seguem RN-20.
10. Imagem carregada no projeto A aparece na biblioteca do projeto B.
11. Na comparação, zoom/pan em um viewport é replicado no outro.
12. Desfazer na variante A não altera a variante B.

## 11. Roadmap

Cada marco tem especificação própria em `docs/specs/`, escrita após o aceite do anterior (MS-01).

| Marco | Escopo | Protótipos |
|---|---|---|
| M0 — Setup | Monorepo, configuração, MongoDB (modelo, validadores, seed), fundação de design, cascas estáticas, testes | 00, 17, cascas 01/03 |
| M1 — Parede e escala | Projetos (CRUD), upload e troca da parede, perspectiva + prévia, calibração, área útil, grid, canvas com zoom/pan, salvamento manual (*hard save*) | 01, 02, 04, 04a, 05, 11, 13 |
| M2 — Biblioteca e composição | Upload em lote, biblioteca e filtros, adicionar/mover, tamanhos + personalizado, recorte, borda e cor, snap, medidas, sobreposição e "fora da área", desfazer | 03, 03a, 03b, 07, 16 |
| M3 — Variantes, templates e salvamento | Variantes, galeria e posicionamento de templates, *soft save* (rascunho e recuperação), diálogo de conflito, comparação | 06, 09, 14, 15, 15b |
| M4 — Ciclo de vida e exportação | Remover/excluir/restaurar, placeholders, purga, exportação | 08, 10, 12 |
| M5 — v1 desejável | P1: RF-23 (contador de uso), RF-52 (linha forte do grid) | — |

### Ideias futuras (sem prioridade definida)

| ID | Ideia |
|---|---|
| RF-04 | Substituir a foto da parede mantendo as fotos posicionadas. (Na v1, o botão "Parede" só troca a parede sem fotos — RF-07; com fotos, fica visível e inativo.) |
| RF-33b | Busca de projetos por nome. (Campo visível e inativo na v1.) |
| RF-33c | Busca na biblioteca por nome, combinada com o filtro ativo. (Campo visível e inativo na v1.) |
| RF-11 | Calibração pela largura total da parede. |
| RF-15 | Suporte a HEIC (fotos de iPhone). Fora da v1: o usuário converte para JPG antes do envio (17/10). |
| RF-36 | Seleção múltipla e mover em grupo (o conjunto do template só é movido em grupo antes de confirmar — RN-32). |
| RF-37 | Trocar a imagem de uma foto mantendo formato e posição. |
| RF-38 | Moldura (espessura, cor) e passe-partout. |
| RF-40 | Sombra para realismo. |
| RF-54 | Origem do grid configurável. |
| RF-55 | Guias inteligentes de alinhamento com outras fotos. |
| RF-56 | Linha de referência horizontal (altura do olhar, topo do sofá). |
| RF-57 | Réguas em cm nas bordas do canvas. |
| RF-61 | Distância até as fotos vizinhas ao selecionar/arrastar. |
| RF-63 | Alinhar seleção (esquerda, centro, direita, topo, meio, base). |
| RF-64 | Distribuir seleção com espaçamento fixo. |
| RF-65 | Centralizar composição em um eixo de referência. |
| RF-66 | Layouts prontos (grade, linha, *salon*). |
| RF-81 | Mapa de instalação como página imprimível pelo navegador (sem geração de PDF no app). |
| RF-82 | Tabela de instalação em CSV. |
| RF-83 | Lista de impressão (quantidade por tamanho). |
| RF-84 | Ponto de fixação (prego/gancho) configurável por foto. |
| RNF-06 | Uso em tablet/celular (touch). |
| UX-01 | Atalhos de teclado adicionais (Del, Ctrl+D, G, S, R). |
| UX-02 | Ajuda no app: guia de como fotografar a parede. |

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Foto da parede com perspectiva ou grande-angular | Correção de perspectiva (RF-05); aviso (RF-14). Distorção de lente não corrigida. |
| Imagens grandes consomem memória | Perfis de qualidade no upload (RF-25). |
| Marcação imprecisa de pontos | Zoom ao marcar; recomendar referência ≥ 1 m. |

## 13. Questões em aberto

Ver `docs/specs/M0-setup.md` §8.
