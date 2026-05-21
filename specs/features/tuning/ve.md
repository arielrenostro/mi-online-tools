# Tuning › Aba VE

**Pré-requisito:** mapa carregado · **Mapa da ECU:** VE (`#F01`–`#F16`) · **Eixos:** linhas = MAP (kPa), colunas = RPM

## Layout

Três seções verticais, cada `MapWithChart` = tabela `HeatmapTable` à esquerda + gráfico interativo à direita:

1. **Mapa Original** (colapsável) — somente leitura; estado de colapso persiste em `localStorage`
2. **Mapa Editável** — editável + botões `[Auto Tuning]` `[Resetar]`
3. **Análise do Auto-tuning** — heatmaps diagnósticos, warnings, estatísticas; visível só após rodar o auto-tuning

O gráfico tem switches de orientação (`MAP×RPM` / `RPM×MAP`) e modo (`2D` linhas / `3D` superfície); selecionar células na tabela destaca os pontos no gráfico; a largura do gráfico é ajustável por drag (proporção no `localStorage`). Ver [components/map-chart.md](../../architecture/frontend/components/map-chart.md).

## Seção 2 — Mapa Editável

Começa como cópia do original. Células editadas ganham contorno laranja.

### Edição de células

| Ação | Resultado |
|------|-----------|
| Hover | Tooltip: valor original + diff % |
| Clique simples | Seleciona a célula; destaca o ponto no gráfico |
| Duplo clique ou `Enter` | Abre edição inline (aceita percentual ou novo valor) |
| Digitar + `Enter` ou clique fora | Confirma |
| `Escape` | Cancela, restaura o valor anterior |
| Múltiplas células + `Enter` | Abre edição inline (percentual ou novo valor) |

**Validação:** apenas inteiros positivos, faixa 100–9999. Fora da faixa: campo vermelho, não confirma.

### Botão Auto-tuning

1. Confirma com o usuário (irá sobrescrever valores)
2. Executa a análise conforme [config.md](config.md) e [tuning-engine.md](../tuning-engine.md)
3. Plota as correções no mapa editável; células alteradas recebem marcador (ponto no canto sup. dir.)
4. Exibe um painel de resumo abaixo da tabela: nº de células corrigidas / sem dados / sem alteração, e correção média/máx/mín com RPM/MAP

### Botão Resetar

Sempre visível; desabilitado quando `isDirty = false`. Diálogo de confirmação. Restaura todas as células ao mapa original importado.

## Seção 3 — Análise do Auto-tuning

Visível só após o auto-tuning. Exibe os dados do `TuningOutput`.

### 3.1 Heatmaps diagnósticos

Seis modos por abas, todos na grade MAP×RPM; células sem dados em cinza:

| Aba | Dado | Escala de cor |
|-----|------|---------------|
| VE Lambda | `ve_lambda_map` | warm (azul→verde→amarelo→vermelho) |
| Amostras | `sample_count_map` (pós-outlier) | cinza (0) → azul saturado (N≥100) |
| Confiança | `confidence_map` | vermelho (0) → verde (1) |
| CV | `cv_map` | verde (0) → vermelho (≥cv_threshold) |
| Correção % | `correction_pct_map` | divergente: azul (neg) → branco (0) → vermelho (pos) |
| Convergência | `convergence_map` | verde (convergida) / amarelo (em progresso) / cinza (sem dados) |

**Tooltip** (hover em qualquer modo): sempre exibe todos os campos (VE atual, VE Lambda + diff, Amostras, Confiança, CV, Correção, Convergida + residual). O modo só determina a cor.

### 3.2 Warnings

Painel colapsável com as violações do pós-processamento (exibido mesmo com contagem zero): monotonicidade MAP e gradientes excessivos, com RPM/MAP e detalhes. Clicar numa linha destaca a célula no heatmap ativo e na tabela editável. Warnings **não bloqueiam** a exportação.

### 3.3 Estatísticas de filtragem

Painel fixo com o diagnóstico de quantos pontos foram usados e por que cada grupo foi descartado (lidos → aprovados → outliers; descartes por CLT, loop aberto, skip CL/bucket, deltas, lambda máximo, fora do range, outlier intra-célula). Critérios com valor zero aparecem como "0"; critérios desabilitados na config aparecem como "—".

## Atalhos de teclado — Mapa Editável

A tabela replica Excel/Calc. A célula `[0,0]` é auto-selecionada ao montar — os atalhos funcionam imediatamente.

### Navegação e seleção

| Atalho | Ação |
|--------|------|
| `↑↓←→` | Move o cursor |
| `Shift`+Seta | Estende a seleção a partir do âncora |
| `Tab` / `Shift+Tab` | Confirma a edição, move para a coluna seguinte/anterior |
| `Enter` | Célula única: abre edição; range: move para baixo |
| `Shift+Enter` | Move para cima |
| Clique | Seleciona a célula (nova âncora) |
| `Shift+Clique` | Estende a seleção até a célula clicada |
| Clicar e arrastar | Seleciona um range |

Âncora: contorno azul. Restante do range: fundo azul semitransparente.

### Edição inline (célula única)

`Duplo clique` ou `0`–`9`/`-`/`.` inicia a edição (dígito substitui o valor; duplo clique seleciona o valor atual). `Enter` confirma e move para baixo; `Tab`/`Shift+Tab` confirma e move lateral; `↓`/`↑` confirma e navega; `Escape` cancela.

### Edição em massa — F2

`F2` abre a modal de edição em massa para as células selecionadas. Três campos alternativos (preencher um limpa os outros):

- **Percentual (%)** — `novo = atual × (1 + pct/100)`
- **Acrescentar valor** — `novo = atual + delta`
- **Definir valor** — sobrescreve todas com o mesmo valor

Prioridade: acrescentar > definir > percentual. Confirma com `Enter`/`Aplicar`, cancela com `Escape`/clique fora. Registra **uma única entrada** no histórico.

### Ajuste rápido e área de transferência

| Atalho | Ação |
|--------|------|
| `Ctrl+I` | Aumenta 1% as células selecionadas (× 1,01) |
| `Ctrl+U` | Diminui 1% as células selecionadas (× 0,99) |
| `Ctrl+C` | Copia a seleção como TSV (compatível Excel/Sheets) |
| `Ctrl+V` | Cola TSV a partir do âncora |
| `Delete`/`Backspace` (célula única) | Abre edição inline com campo vazio |
| `Delete`/`Backspace` (range) | Zera o range (valor → 0, clampado para 100 no backend) |

`Ctrl+I/U` operam sobre o range completo; uma entrada no histórico por acionamento.

### Histórico (undo/redo)

`Ctrl+Z` desfaz; `Ctrl+Shift+Z` / `Ctrl+Y` refazem. Funcionam globalmente na página, inativos quando o foco está num campo de texto. Limite de 50 passos; histórico de sessão (não persiste ao recarregar). O roteamento por aba (`/tuning/ve`) usa o histórico de VE — independente dos de ignição e lambda.

Cada uma destas ações cria 1 entrada no histórico: edição de célula individual, edição em massa F2, cola `Ctrl+V`, Delete/Backspace em range, rodar auto-tuning, resetar mapa.

## Overlay de pontos do log

Quando há logs e seleção de tempo, os pontos do log são plotados como scatter sobre os gráficos — cada ponto é uma amostra no seu RPM×MAP real, com densidade indicada por opacidade/tamanho. Células sem nenhum ponto ficam com fundo hachurado no mapa editável (o auto-tuning não pode corrigi-las).
