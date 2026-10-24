# DESIGN — Simulador de Parede de Fotos

| Campo | Valor |
|---|---|
| Versão | 0.3 (botão "Parede" sem fotos, controles inativos por estado) |
| Data | 2026-10-24 |
| Status | Identidade e protótipos de alta fidelidade aprovados para implementação |
| Protótipos | `docs/design/` (ver §10) |

> **Objetivo deste arquivo:** fonte única de decisões visuais e de interação para implementar a UI. Requisitos funcionais ficam em `docs/PRD.md`; stack e **caminhos de arquivos** em `docs/ARCHITECTURE.md`. Em conflito, **a documentação (PRD, este arquivo, specs, ARCHITECTURE) prevalece sobre os protótipos** de `docs/design/`; entre documentos, o PRD prevalece em requisito e a ARCHITECTURE em tema técnico ou de caminhos.

## 1. Direção visual

**Galeria neutra.** A interface recua para que a parede e as fotos dominem.

| # | Princípio | Regra prática |
|---|---|---|
| DS-01 | As fotos primeiro | Painéis brancos, sem cor decorativa; nenhuma cor de UI compete com a parede. |
| DS-02 | Medida é texto mono | Todo valor em cm, px ou coordenada usa a fonte mono, vírgula decimal e 1 casa (RN-27). Tamanho de impressão **sugerido** sem casa decimal (“20 × 30”); tamanho **personalizado** com 1 casa (“21,0 × 29,7”). |
| DS-03 | Uma cor de ação | Terracota marca só o botão principal da tela e a foto selecionada. |
| DS-04 | Alerta nunca só pela cor | Seleção = linha contínua + alças; alerta = tracejado, hachura e/ou ícone. |
| DS-05 | Modos ocupam a barra | Perspectiva, calibração, área útil e posicionamento de template trocam o header por uma barra escura (Tinta) com Cancelar e a ação principal. No recorte, a barra só identifica o modo; as ações ficam no painel. |

## 2. Cores

### 2.1 Tokens de interface

| Token | Hex | Uso |
|---|---|---|
| `--color-paper` | `#F7F4EE` | Fundo da aplicação, blocos de resumo (“Tamanho externo”) |
| `--color-surface` | `#FFFFFF` | Header, painéis laterais, cards, diálogos |
| `--color-surface-muted` | `#FBF9F5` | Toolbar do canvas, rodapé de diálogos |
| `--color-sand` | `#EFEAE1` | Trilho de segmented control, chips neutros, thumbnail vazia |
| `--color-stage` | `#ECE6DC` | Área ao redor da parede no canvas |
| `--color-stage-dark` | `#2A2520` | Área ao redor da foto nos modos perspectiva/calibração |
| `--color-line` | `#DDD5C8` | Bordas de botão e input |
| `--color-line-soft` | `#E6DFD3` | Divisórias de painel/header |
| `--color-line-faint` | `#F0EBE3` | Divisórias de lista e seções internas |
| `--color-sketch` | `#E6DFD3`, contorno `#CFC5B6` | Esboço do arranjo nos cards de template |
| `--color-ink` | `#1F1B16` | Texto principal, barra de modo |
| `--color-ink-2` | `#5A5248` | Texto secundário, labels |
| `--color-ink-3` | `#6E655A` | Legendas, sufixos de unidade (mín. 12 px) |
| `--color-ink-disabled` | `#8E8579` | Controles desabilitados |
| `--color-accent` | `#B5532F` | Botão primário, seleção, passo ativo, radio/checkbox |
| `--color-accent-hover` | `#9A4426` | Hover do primário, links |
| `--color-accent-ink` | `#7A361E` | Texto sobre `accent-tint` |
| `--color-accent-tint` | `#F3E1D8` | Chip de filtro ativo, fundo de ícone |
| `--color-accent-wash` | `#FBF4F0` | Fundo de opção selecionada (radio card) |
| `--color-accent-on-dark` | `#E8A487` | Ícones na barra de modo |
| `--color-danger` | `#B42318` | Sobreposição, placeholder, botão destrutivo |
| `--color-danger-ink` | `#9F1D14` | Texto de alerta, badge “sem foto” |
| `--color-danger-ink-strong` | `#8A1A12` | Texto em caixa de alerta |
| `--color-danger-tint` | `#FBE9E6` | Badge/caixa de alerta |
| `--color-danger-wash` | `#FDF5F3` | Opção destrutiva selecionada |
| `--color-warning-ink` | `#6B4A12` | Texto de aviso (RF-14) |
| `--color-warning-tint` | `#FBF1DE` | Caixa de aviso |
| `--color-warning-dot` | `#B7791F` | Status “alterações não salvas” |
| `--color-success` | `#5E7A44` | Status “salvo” |
| `--color-success-ink` | `#4A6336` | Texto “concluída” no upload |

Contraste verificado para texto: `ink`, `ink-2` e `ink-3` sobre `paper`/`surface` ≥ 4,5:1; branco sobre `accent` e `danger` ≥ 4,5:1.

### 2.2 Cores do canvas (Konva)

Ficam em constantes TypeScript (não em CSS), pois são aplicadas em nós Konva. Local do arquivo: `docs/ARCHITECTURE.md` §6.

| Elemento | Especificação |
|---|---|
| Parede (sem imagem) | Gradiente vertical `#EDE6DA` → `#E4DBCC` |
| Sombra da parede | `0 18px 40px rgba(90,82,72,.14)` |
| Grid — linha menor | `#1F1B16` a 8% (`opacidade` configurável, RF-51) |
| Grid — linha principal | `#1F1B16` a 18%, a cada N divisões (RF-52 — P1, marco M5) |
| Origem | Texto mono 11 px `ink-2`, “0,0” no canto da origem (RN-07) |
| Foto selecionada | Contorno 2 px `accent`, offset 3 px; 4 alças 8×8 brancas, borda 2 px `accent`, raio 2 |
| Rótulo de medida da seleção | Pill `accent`, texto branco mono 11 px, abaixo da foto: “24,0 × 34,0 cm” |
| Sobreposição (RN-11) | Contorno 2 px tracejado `danger`, offset 2 px, em **todas** as fotos envolvidas + pill “Sobreposição” com ícone |
| Fora da parede / da área útil (RN-12, RN-34) | Mesmo tracejado `danger` na foto + pill `danger` com ícone: “Fora da parede” (RN-12) ou “Fora da área útil” (RN-34); se ambos, prevalece “Fora da parede” |
| Área útil (RN-33) | Retângulo 1 px tracejado `ink-2`; exterior coberto por `paper` a 50% no editor ou `ink` a 55% no modo Área útil; rótulo mono 11 px `ink-2` acima, à esquerda: “Área útil · 180,0 × 110,0 cm”. Fora da exportação. |
| Alças da área útil | Quadrado 12 px branco, borda 2 px `accent`, nos 4 cantos e nos 4 lados |
| Placeholder (RF-30a) | Hachura 45° `danger` 20% sobre `#FBEDEA`, borda 1,5 px tracejada `danger`, ícone imagem-cortada `danger-ink` centralizado + tamanho da foto em mono 11 px sobre branco 80% (“20 × 30”) — vale para **todo** placeholder (foto excluída ou vaga de template, TPL-05) |
| Vaga de template (RN-31, TPL-05) | Idêntica ao placeholder; durante o posicionamento, conjunto a 80% de opacidade |
| Conjunto de template (RN-32) | Contorno 1,5 px tracejado `ink-2` (ou `danger` quando maior que a área útil), 8 px de folga, + pill com ícone de mover e o total (“151,0 × 70,6 cm”) |
| Bounding box (RF-62) | Retângulo tracejado 1,5 px `ink-2`, 8 px de folga; pill `ink-2` com “90,0 × 47,0 cm” acima |
| Alças de perspectiva/calibração | Círculo 18 px branco, borda 2,5 px `accent`; ativo = preenchido `accent`; número do canto em pill `accent` |
| Polígono de perspectiva | Contorno 2 px `accent`, preenchimento `accent` a 12% |
| Lupa ao marcar pontos | Círculo 160 px, borda 3 px branca, sombra forte, mira em cruz `accent`, zoom 4× |

Exportação (RN-19): nada desta tabela sai no PNG/JPG, exceto grid (opcional) e placeholder, que sai como hachura `danger` 45% / 16% sem borda.

## 3. Tipografia

| Papel | Família | Pesos | Uso |
|---|---|---|---|
| Display | **Newsreader** (serif, eixo `opsz`) | 500 | Títulos de tela, nome do projeto, nome da foto, títulos de seção de painel e diálogo |
| Interface | **Instrument Sans** | 400, 500, 600 | Todo o resto da UI |
| Medidas | **IBM Plex Mono** | 400, 500 | Valores em cm/px, coordenadas, escala, atalhos, contadores |

Escala (px / line-height):

| Token | Tamanho | Família | Exemplo |
|---|---|---|---|
| `display-xl` | 44 / 1.05 | Newsreader | “Projetos” |
| `display-lg` | 36 / 1.1 | Newsreader | “Comece pela parede” |
| `display-md` | 22–24 / 1.2 | Newsreader | Título de diálogo, “Composição” |
| `display-sm` | 18–20 / 1.25 | Newsreader | Nome do projeto no header, “Biblioteca”, seções |
| `body` | 14 / 1.4 | Instrument Sans | Padrão |
| `body-sm` | 13 / 1.4 | Instrument Sans | Descrições, status |
| `label` | 12 / 1.3, peso 500, `ink-2` | Instrument Sans | Labels de campo |
| `mono` | 11–14 | IBM Plex Mono, `tabular-nums` | Medidas |

Regras: letter-spacing `-0.01em` na serif; `-webkit-font-smoothing: antialiased`; sem caixa alta, exceto o kicker da prancha de identidade.

**Fontes locais (RNF-01):** o protótipo carrega Google Fonts, mas o app **não pode** chamar fora de `localhost`. Empacotar as fontes no build (ex.: pacotes `@fontsource-variable/newsreader`, `@fontsource/instrument-sans`, `@fontsource/ibm-plex-mono`) — ver ADR-14.

## 4. Espaçamento, raios e elevação

- Espaçamento: múltiplos de 4 px. Painéis: padding 16–20; diálogos: 24 horizontal; gap entre seções de painel 16–18; gap de toolbar 6–10.
- Raios: `--radius-xs` 4 (thumbs pequenas) · `--radius-sm` 6 (itens internos do segmented, thumbnails) · `--radius-md` 8 (botões, inputs) · `--radius-lg` 10–12 (cards, caixas de resumo/aviso) · `--radius-xl` 16 (diálogos) · pill `999px`.
- Elevação:
  - `--shadow-xs`: `0 1px 2px rgba(31,27,22,.14)` — segmento ativo, fotos em miniatura.
  - `--shadow-md`: `0 10px 28px rgba(90,82,72,.14)` — hover de card.
  - `--shadow-lg`: `0 12px 28px rgba(31,27,22,.16)` — dropdown/popover.
  - Diálogos: overlay `ink` a 40% + `--shadow-lg`.

## 5. Implementação (Tailwind 4 + shadcn/ui)

Declarar os tokens com `@theme` e mapear as variáveis do shadcn (local do arquivo: `docs/ARCHITECTURE.md` §6):

```css
@theme {
  --color-paper: #F7F4EE;  --color-surface: #FFFFFF;  --color-sand: #EFEAE1;
  --color-ink: #1F1B16;    --color-ink-2: #5A5248;    --color-ink-3: #6E655A;
  --color-line: #DDD5C8;   --color-accent: #B5532F;   --color-danger: #B42318;
  /* …demais tokens da §2.1 */
  --font-display: 'Newsreader Variable', Georgia, serif;
  --font-sans: 'Instrument Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --radius-md: 8px;
}
/* shadcn */
:root {
  --background: var(--color-paper);   --foreground: var(--color-ink);
  --card: var(--color-surface);       --popover: var(--color-surface);
  --primary: var(--color-accent);     --primary-foreground: #fff;
  --secondary: var(--color-sand);     --muted: var(--color-sand);
  --muted-foreground: var(--color-ink-2);
  --border: var(--color-line);        --input: var(--color-line);
  --ring: var(--color-accent);        --destructive: var(--color-danger);
  --radius: 8px;
}
```

Somente tema claro na v1. Foco visível: `ring` 2 px `accent` com offset 2 px em todos os controles.

## 6. Componentes

| Componente | Base shadcn | Especificação |
|---|---|---|
| Botão primário | `Button` | `accent`, texto branco, 36 px (40 em telas de lista), raio 8, peso 500. Um por tela/diálogo. |
| Botão secundário | `Button variant=outline` | Branco, borda `line`. |
| Botão fantasma | `Button variant=ghost` | Sem borda; usado na toolbar e em “Cancelar”. |
| Botão destrutivo | `Button variant=destructive` | `danger`, só na confirmação de excluir. |
| Botão de ícone | `Button size=icon` | 36×36, `aria-label` obrigatório. |
| Segmented control | `ToggleGroup type=single` | Trilho `sand`, padding 3, gap 2; item ativo branco + `shadow-xs`. **Colunas de largura igual** (`grid-auto-columns: 1fr`) e largura fixa ajustada ao conteúdo: Orientação 152 px (texto 13 px, ao lado do seletor de tamanho), PNG/JPG 160 px, Qualidade 240 px. Não esticar à largura do painel. O fundo branco do item ativo **desliza** até a opção escolhida (200 ms, *ease-out*; sem animação na primeira pintura nem com `prefers-reduced-motion`). |
| Seletor de tamanho | `Select` | Substitui o segmented “10x15 | 20x30” do protótipo 03 (FMT-02). Itens agrupados: Padrão · Quadrados · Grandes · “Personalizado…”; rótulo mono “20 × 30 cm”; “Personalizado…” abre o modo de recorte com campos largura × altura (`CampoCm`). Orientação inativa para tamanhos quadrados. Gatilho 36 px; lista 170–220 px, raio 10, `--shadow-lg`; cabeçalho de grupo em `label` `ink-3`; item selecionado com fundo `accent-tint` e check `accent` (protótipos 03, 03b, 17). Enquanto houver itens abaixo da área visível, rodapé `ink-3` 12 px com chevron: “Role para ver mais tamanhos”. |
| Filtros da biblioteca | `ToggleGroup` + `DropdownMenu` | “Todas · Projeto · Variante · ⋯”; “Excluídas” fica no menu ⋯. Com “Excluídas” ativo, os demais filtros ficam desmarcados, o ⋯ fica no estado ativo e aparece chip `accent-tint` “Excluídas ×” (o × volta para “Todas”). |
| Campo numérico | `Input` | Mono, 36 px; prefixo (X/Y) ou sufixo (cm) em `ink-3` dentro do campo; vírgula decimal. |
| Toggle | `Switch` | 40×24, ligado = `accent`. |
| Radio card | `RadioGroup` | Borda `line`; selecionado = borda 2 px `accent` + `accent-wash` (destrutivo: `danger` + `danger-wash`). |
| Seletor de cor da borda | `Popover` | Botão com amostra 16 px + nome (ou hex, se livre). Popover com cores prontas: Branco `#FFFFFF` · Off-white `#F5F1E8` · Preto `#1A1A1A` · Cinza `#8C8C8C` · Madeira clara `#C8A27A` · Madeira escura `#5C3A21`; item “Outra cor…” abre `<input type="color">` nativo (DV-08). |
| Badge “sem foto” | `Badge` | Pill `danger-tint`, texto `danger-ink` 12 px. |
| Chip de escala | — | `sand`, raio 6, mono 12 px “4,0 px/cm”. |
| Status de salvamento | — | Ponto 7 px + texto 13 px `ink-2`: verde “Salvo às hh:mm” (só “Salvo” ao abrir), âmbar “Alterações não salvas” e “Salvando…”, verde “Rascunho salvo às hh:mm”, `danger` “Conflito” (SV-08). |
| Tooltip | `Tooltip` | Fundo `ink`, texto branco 12 px, raio 6, seta 5 px. Obrigatório em botões só com ícone e em controles inativos (§7.1). Botão só de ícone e inativo mostra o nome do botão acima de “Disponível em uma próxima versão”. |
| Grid / Snap (header) | `Toggle` | Grid: ícone + “5 cm” mono; Snap: só ícone, com `aria-label` e tooltip. Ligado = fundo `sand`. |
| Card de template | `RadioGroup` item | Branco, raio 12, borda `line-soft`, padding 12; esboço proporcional às medidas em caixa `paper` de 116 px (retângulos `sketch`); nome Newsreader 17; total mono 12 + “N fotos”. Selecionado: borda + anel `accent` (2 px). Maior que a área útil: ícone de aviso + “Maior que a área útil” em `warning-ink`, sem bloquear. |
| Card de projeto | — | Miniatura = só a foto da parede (DV-07); sem parede: ícone + “Sem foto da parede”. Menu ⋯: Renomear, Excluir (texto `danger-ink`). |
| Barra de progresso | — | 6 px, trilho `sand`, preenchimento `ink-2` (não é ação). |
| Caixa de aviso | `Alert` | `warning-tint`/`warning-ink` + ícone triângulo. Alerta: `danger-tint`/`danger-ink-strong` + ícone círculo. |
| Diálogo | `Dialog` | 640 px, raio 16, título Newsreader 22–24, rodapé `surface-muted` com ações à direita (fantasma → secundário → primário). |
| Thumbnail | — | Raio 6, altura 92; contador de uso “1×” em pill `ink` 85% no canto (RF-23 — P1, entra na marco M5; ausente até lá); selecionada = anel 2 px `accent`. |
| Ícones | — | Traço 1,6–1,8 px, 16–18 px, `currentColor`. `lucide-react` (ADR-15). Nunca emoji. |

## 7. Layout

- Alvo: desktop Chrome/Edge (RNF-02), referência 1440×900; mínimo útil 1280.
- **Editor:** header (≈56 px) · coluna esquerda Biblioteca 264–296 px · canvas fluido · coluna direita Propriedades 300–320 px · barra de status 32 px.
- **Header do editor (≥ 1440 px), da esquerda para a direita:** voltar · marca · nome do projeto (serif, máx. 120 px com reticências) · seletor de variante (badge “1 sem foto”) · Comparar | Templates · Área útil · Perspectiva · Calibrar · chip “4,0 px/cm” · Parede (inativo, DV-02) | Grid 5 cm · Snap | Desfazer · Refazer · (espaço) · Salvar (Ctrl+S no tooltip) · Exportar (primário). Botões fantasma com padding horizontal 9 px e gap 4 px. O status de salvamento **não** fica no header: só na barra de status, com o texto completo (24/10; “Alterações não salvas” e “Rascunho salvo às hh:mm” estouram o header em 1280 e 1440). Diverge do protótipo 03a.
- **Header < 1440 px (1280):** Área útil, Perspectiva, Calibrar e Parede (inativo, com tooltip) vão para o menu **“Parede ▾”**; Comparar, Templates e o chip de escala continuam visíveis. Breakpoint `max-width: 1439px` (protótipo 03a).
- **Toolbar do canvas:** Adicionar · Duplicar · Trazer para frente · Enviar para trás · (espaço) · zoom − / % / + · Ajustar à tela.
- **Painel da foto (RF-60):** cabeçalho (miniatura + nome) · Tamanho (select) e Orientação na mesma linha · Borda (cm + cor) · Tamanho externo · Posição X/Y · alerta de sobreposição, se houver · Enquadramento (“Ajustar recorte”) · Duplicar / Remover.
- **Painel sem seleção (protótipo 11):** Composição · Escala · **Área útil desta variante** (L, A, X, Y + “Ajustar”) · Borda padrão · Grid (“Linha forte a cada” inativo). Cada seção abre com título Newsreader 18 px `ink` e divisória `line-faint` acima (padding 18 px); labels de campo seguem em `label`.
- **Modos (perspectiva, calibração, área útil, posicionamento de template):** header escuro `ink` + área `stage-dark` + painel direito de 320–360 px.
- **Prévia frontal (perspectiva):** sob demanda — botão secundário “Gerar prévia” no bloco “Prévia frontal”; estados: vazio (texto de instrução), gerando (indicador), pronta, **desatualizada** (prévia esmaecida + aviso “Os cantos mudaram” + botão reativado). Não há atualização ao vivo (DV-06).
- **Comparação:** dois painéis lado a lado, cada um com seletor de variante e dimensões; selo “Somente visualização”; zoom/pan **sempre sincronizados** e botão “Parede inteira” (enquadra a parede nos dois). A alternância “Zoom sincronizado / Independente” do protótipo 06 **não** será implementada (DV-01).

### 7.0 Modo de recorte (RN-14, DV-09)

- Entrada: botão “Ajustar recorte” no painel da foto ou duplo clique na foto.
- Durante o modo: imagem inteira visível, a parte fora do quadro esmaecida (`ink` 55% por cima); quadro com contorno `accent`; demais fotos e controles do canvas sem interação; dica na barra de status “Arraste para reposicionar · Enter conclui · Esc cancela”.
- Arrastar desloca a imagem dentro do quadro apenas no eixo com sobra; a foto não se move na parede.
- Campos largura × altura (cm) visíveis durante o modo quando o tamanho for personalizado (RN-28); alterar recentraliza o recorte.
- Saída: “Concluir” / Enter confirma (1 passo de desfazer); Esc cancela e restaura.

### 7.1 Funções ainda não implementadas

- Botão **primário** inativo: fundo `sand` e texto `ink-3` (o `ink-disabled` sobre `accent` não tinha contraste).
- Controles de funções previstas mas não implementadas (Ideias futuras do PRD ou marcos seguintes) **permanecem visíveis e inativos**: estilo `ink-disabled`, `aria-disabled="true"` (não `disabled`, para manter o foco e o tooltip), clique sem efeito.
- Tooltip padrão: “Disponível em uma próxima versão”.
- Casos atuais:
  - botão **“Parede”** do header do editor quando alguma variante tem fotos (trocar a parede mantendo as fotos — RF-04). Sem fotos, o botão fica ativo e troca a parede com confirmação (RF-07, M1-05);
  - controle **“Linha forte a cada”** do painel Grid (RF-52 — P1, marco M5);
  - campos **“Buscar projeto”** (Projetos) e **“Buscar por nome”** (Biblioteca) — campo inativo (`aria-disabled`, sem aceitar digitação), mesmo tooltip (RF-33b / RF-33c, Ideias futuras).
- Controles indisponíveis **pelo estado** (não por versão futura) usam o mesmo padrão inativo, com tooltip que diz o que falta: Perspectiva e Calibrar sem parede (“Carregue a foto da parede primeiro.”), Área útil sem escala (“Defina a escala primeiro.”), Calibrar com a perspectiva aplicada (“Com a perspectiva aplicada, use Perspectiva para refazer a escala.” — RN-08).

### 7.2 Área útil (RF-94, RN-33 a RN-35)

- “Aplicar” na perspectiva (ou na calibração) abre o modo **Área útil** (protótipo 13): retângulo cobrindo a parede inteira por padrão, alças em cantos e lados, campos Largura, Altura, X, Y (cm) e “Usar a parede inteira”; nota “Cada variante tem a sua área útil.”; dica “Arraste os cantos ou os lados · Enter confirma · Esc cancela”.
- No editor, a área útil aparece como em §2.2; o botão “Área útil” do header reabre o modo.

### 7.3 Templates (RF-93, RN-29 a RN-32)

- **Galeria** (protótipo 14): diálogo de 960 px “Escolher template” com a área útil da variante no subtítulo; grade de 4 colunas com os 12 cards; rodapé com “Borda das fotos” (cm, padrão = borda padrão da variante), cor da borda, texto “Será criada a variante “<nome>”.”, “Cancelar” e “Posicionar na parede”.
- **Posicionamento** (protótipos 15 e 15b): barra “Posicionar template · <nome>” com “Cancelar” e “Confirmar posição”; vagas como em §2.2, conjunto centralizado na área útil e arrastável com snap; se maior que a área útil, caixa de alerta no topo e contorno `danger`, sem bloquear a confirmação; dica “Arraste para posicionar · Enter confirma · Esc cancela”.
- **Geometria:** a fonte é `docs/specs/templates.md` (TPL-07, TPL-08). Os esboços e as vagas dos protótipos são **ilustrativos** e não seguem a geometria aprovada.

## 8. Textos e formatos (pt-BR)

- Números: vírgula decimal, 1 casa para cm (“24,0 × 34,0 cm”), sinal “×” (U+00D7) com espaços.
- Datas/horas: “às 14:35”, “12/10”.
- Rótulos fixos: “Carregar fotos”, “Adicionar”, “Salvar”, “Exportar”, “Comparar”, “Recalibrar”, “Restaurar”, “Sem foto”, “Sobreposição”, “Templates”, “Área útil”, “Fora da área útil”, “Maior que a área útil”, “Gerar prévia”, “Os cantos mudaram”, “Confirmar área”, “Usar a parede inteira”, “Posicionar na parede”, “Confirmar posição”, “Ajustar recorte”, “Concluir”.
- Ações de imagem: “Remover deste projeto” × “Excluir da biblioteca” (RN-24).
- Conflito (SV-05): “Usar a salva” · “Salvar a minha como nova variante” · “Manter a minha”.
- Tom: frases curtas, instrução direta, sem jargão técnico (“escala”, não “homografia”).

## 9. Acessibilidade

- Controles reais (`button`, `input`, `label`); ícones sem texto com `aria-label`.
- Contraste ≥ 4,5:1 para texto; estados nunca diferenciados só por cor (DS-04).
- Alvos ≥ 36 px na toolbar, ≥ 40 px em listas e diálogos.
- Teclado: setas movem a foto (RN-16), Ctrl+S salva (RF-72), Esc fecha diálogos/menus e cancela modos.

## 10. Protótipos

Arquivos em `docs/design/`, no formato `.dc.html` do canvas de Design do Claude (HTML com placeholders `{{…}}`, `<sc-for>` e `<sc-if>`). Abertos direto no navegador **não** renderizam por completo: use-os como referência de estrutura, valores e textos. Disposição e títulos em `canvas.json`.

| # | Arquivo | Tela | Requisitos principais |
|---|---|---|---|
| 00 | `Identidade.dc.html` | Identidade visual (cores, tipos, componentes, sinais na parede) | — |
| 17 | `Componentes.dc.html` | Componentes novos: seletor de tamanho, cor da borda, controle inativo, área útil, vaga, card de template, status de prévia | §6 |
| 01 | `Projetos.dc.html` | Lista de projetos (miniatura = só a foto da parede, sem as fotos posicionadas; menu ⋯ = Renomear, Excluir — DV-07) | RF-90, RN-17, §4.10 indicador |
| 02 | `Vazio.dc.html` | Projeto novo, estado vazio guiado | RF-01, RF-25, RF-13, PRD §9 |
| 03 | `Main.dc.html` | Editor da composição (interativo: tamanho, orientação, filtro ⋯; área útil e foto fora dela) | RF-30–35, RF-41, RF-50–53, RF-60, RF-62, RF-94, RN-05/06/11/34 |
| 03a | `Header.dc.html` | Header em 1440 e 1280 (menu “Parede ▾”) | §7 |
| 03b | `SeletorTamanho.dc.html` | Seletor de tamanho aberto; orientação inativa em quadrado | FMT-01, FMT-02 |
| 04 | `Perspectiva.dc.html` | Correção de perspectiva (prévia no estado vazio) | RF-05, RF-06, RF-14, RN-07/09/10 |
| 04a | `PreviaEstados.dc.html` | Os 4 estados da prévia frontal | DV-06 |
| 05 | `Calibracao.dc.html` | Calibração linear | RF-10, RF-12, RN-08 |
| 06 | `Comparacao.dc.html` | Comparar variantes (zoom sempre sincronizado) | RF-92, DV-01 |
| 07 | `Upload.dc.html` | Upload em lote | RF-20/21/25, RN-20/21 |
| 08 | `ExcluirImagem.dc.html` | Remover × excluir imagem | RF-29, RN-24 |
| 09 | `Conflito.dc.html` | Conflito de versão | RF-73, SV-04–06 |
| 10 | `Exportar.dc.html` | Exportar imagem | RF-80, RN-12, RN-19 |
| 11 | `PainelComposicao.dc.html` | Painel direito sem seleção (com área útil; “Linha forte a cada” inativo) | RF-12, RF-50–53, RF-94, RN-03, RN-15 |
| 12 | `BibliotecaExcluidas.dc.html` | Biblioteca filtrada em Excluídas + associação de placeholder | RF-28/29, RF-30a |
| 13 | `AreaUtil.dc.html` | Confirmação da área útil após a perspectiva | RF-94, RN-33, AU-01 |
| 14 | `Templates.dc.html` | Galeria de templates (interativa) | RF-93, RN-30, TPL-04 |
| 15 | `TemplatePosicionar.dc.html` | Posicionar template na área útil | RN-32, TPL-06 |
| 15b | `TemplatePosicionarAviso.dc.html` | Mesmo modo com template maior que a área útil (importa a 15 com `aviso`) | RN-32 |
| 16 | `Recorte.dc.html` | Modo de recorte com tamanho personalizado | RN-14, RN-28, DV-09 |

Wireframe anotado com IDs do PRD (versão de baixa fidelidade): canvas “Simulador de Parede de Fotos — Wireframe” no Claude.

Observações sobre o protótipo:
- As fotos são gradientes de cor no lugar de imagens reais.
- A escala do desenho do editor é 4 px/cm; as medidas exibidas seguem RN-01/02/06.
- O sofá e o rodapé da parede são ilustrativos; no app, a parede é a foto do usuário.
- As pranchas 14 e 15b usam uma variante com área útil 140,0 × 90,0 cm (para mostrar o aviso); a 03 e a 15 usam 180,0 × 110,0 cm.
- Esboços dos cards e vagas dos templates são ilustrativos; geometria em `docs/specs/templates.md`.
- A prancha 17 usa hex aproximados para as cores de borda e opacidade de 75% na vaga; valem os da §6 (DV-08) e 80% (§2.2).
- Textos corrigidos em relação aos protótipos (IC-01):
  - 13 Área útil: “Medido a partir da origem 0,0 (canto do retângulo de referência).” (RN-07) — em vez de “a partir do canto superior esquerdo da parede”.
  - 17 Card de template: “O aviso não bloqueia a escolha: o template pode ser posicionado e ajustado foto a foto depois.” — sem “reduzido”.

## 11. ADRs relacionadas

| ADR | Tema |
|---|---|
| ADR-14 | Fontes empacotadas com `@fontsource` (RNF-01). |
| ADR-15 | Ícones com `lucide-react`. |
