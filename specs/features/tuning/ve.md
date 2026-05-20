# Tuning › Aba VE

**Pré-requisito:** mapa carregado · **Mapa da ECU:** VE (`#F01`–`#F16`) · **Eixos:** linhas=MAP (kPa), colunas=RPM

## Layout

Três seções verticais:
1. **Mapa Original** (colapsável) — `MapWithChart` somente leitura
2. **Mapa Editável** — `MapWithChart` editável + botões `[Auto Tuning]` `[Resetar]`
3. **Análise do Auto-tuning** — heatmaps diagnósticos, warnings, estatísticas; visível só após rodar o auto-tuning

`MapWithChart` = tabela `HeatmapTable` à esquerda + gráfico interativo à direita.

## Seção 1 — Mapa Original (colapsável)

Mapa exatamente como importado, somente leitura.

- Botão `[▲ Colapsar]` recolhe a seção; estado persiste em `localStorage`
- Gráfico: switches de orientação (`MAP×RPM` / `RPM×MAP`) e modo (`2D` / `3D`)
  - **2D**: linhas — `MAP×RPM` = uma linha por MAP; `RPM×MAP` = uma linha por RPM
  - **3D**: superfície mesh rotacionável
- Selecionar células na tabela destaca os pontos no gráfico (dot/esfera azul)
- Largura do gráfico ajustável por drag no separador; proporção salva no localStorage

## Seção 2 — Mapa Editável

Onde o usuário edita manualmente e o auto-tuning plota as correções. Começa como cópia do original. Células editadas ganham contorno laranja.

### Edição de células

| Ação | Resultado |
|------|-----------|
| Hover | Tooltip: `Valor original: 851 \| Diff: x%` |
| Clique simples | Seleciona a célula; destaca o ponto no gráfico |
| Duplo clique ou `Enter` | Abre edição inline (aceita percentual ou novo valor) |
| Digitar + `Enter` ou clique fora | Confirma |
| `Escape` | Cancela, restaura valor anterior |
| Múltiplas células + `Enter` | Abre edição inline (percentual ou novo valor) |

**Validação:** apenas inteiros positivos, faixa 100–9999. Fora da faixa: campo vermelho, não confirma.

### Botão Auto-tuning

1. Confirma com o usuário (irá sobrescrever valores)
2. Executa a análise conforme [config.md](config.md) e [tuning-engine.md](../tuning-engine.md)
3. Plota as correções no mapa editável; células alteradas recebem marcador (ponto no canto superior direito)
4. Exibe painel de resumo abaixo da tabela:

```
87 células corrigidas · 34 sem dados suficientes · 135 sem alteração
Correção média: +3.2% │ Máx: +8.1% (RPM 3200, MAP 100) │ Mín: -4.6% (RPM 1600, MAP 40)
```

### Botão Resetar

- Sempre visível; desabilitado quando `isDirty = false`
- Diálogo de confirmação antes de executar
- Restaura todas as células ao mapa original importado

## Seção 3 — Análise do Auto-tuning

Visível só após o auto-tuning. Exibe os dados do `TuningOutput`.

### 3.1 Heatmaps diagnósticos

Seis modos por abas, todos na grade MAP×RPM. Células sem dados em cinza.

| Aba | Dado | Escala de cor |
|-----|------|---------------|
| VE Lambda | `ve_lambda_map` | Escala quente do mapa editável |
| Amostras | `sample_count_map` (pós-outlier) | 0=cinza → N≥100=azul saturado |
| Confiança | `confidence_map` | 0=vermelho → 1=verde |
| CV | `cv_map` | 0=verde → ≥cv_threshold=vermelho |
| Correção % | `correction_pct_map` | Divergente: azul=neg, branco=zero, vermelho=pos |
| Convergência | `convergence_map` | Verde=convergida, amarelo=em progresso, cinza=sem dados |

**Tooltip (hover em qualquer modo):** sempre exibe todos os campos (VE atual, VE Lambda + diff, Amostras, Confiança, CV, Correção, Convergida + residual). O modo só determina a cor.

### 3.2 Warnings

Painel colapsável com violações da etapa de pós-processamento (exibido mesmo com contagem zero).

- Lista monotonicidade MAP e gradientes excessivos com RPM/MAP e detalhes
- Clicar numa linha destaca a célula no heatmap ativo e na tabela editável
- Warnings não bloqueiam exportação — são informativos

### 3.3 Estatísticas de filtragem

Painel fixo com diagnóstico de quantos pontos foram usados e por que cada grupo foi descartado:

```
12.430 lidos → 8.741 aprovados (70.3%) → 141 outliers intra-célula
Descartados por: CLT insuf., Loop aberto, Skip CL, Skip bucket RPM/MAP,
Δ RPM, Δ MAP, Δ lambda vs target, Lambda máximo, Δ pedal, Fora do range, Outlier intra-célula
```

- Critérios com valor zero ainda aparecem como "0" (filtro ativo mas sem descarte)
- Critérios desabilitados na config aparecem como "—"

## Atalhos de teclado — Mapa Editável

Tabela replica Excel/Calc. A célula `[0,0]` é auto-selecionada ao montar — atalhos funcionam imediatamente.

### Navegação

| Atalho | Ação |
|--------|------|
| `↑↓←→` | Move o cursor |
| `Shift`+Seta | Estende a seleção sem mover o âncora |
| `Tab` / `Shift+Tab` | Confirma edição, move para coluna seguinte/anterior |
| `Enter` | Célula única: abre edição; Range: move para baixo |
| `Shift+Enter` | Move para cima |

### Edição inline (célula única)

| Atalho | Ação |
|--------|------|
| Duplo clique | Edição inline com valor atual selecionado |
| `0`–`9`, `-`, `.` | Inicia edição substituindo o valor |
| `Enter` | Confirma, move para baixo |
| `Tab` / `Shift+Tab` | Confirma, move para coluna seguinte/anterior |
| `↓` / `↑` | Confirma, navega abaixo/acima |
| `Escape` | Cancela, restaura valor anterior |

### Edição em massa — F2

`F2` abre a modal de edição em massa para as células selecionadas. Três campos alternativos (preencher um limpa os outros):

- **Percentual (%)** — ajusta cada célula: `novo = atual × (1 + pct/100)`. `+5` = +5%
- **Acrescentar valor** — soma/subtrai delta fixo: `novo = atual + delta`
- **Definir valor** — sobrescreve todas com o mesmo valor

Prioridade: acrescentar > definir > percentual. Confirma com `Enter`/`Aplicar`, cancela com `Escape`/clique fora. Registra **uma única entrada** no histórico.

### Seleção

| Atalho | Ação |
|--------|------|
| Clique | Seleciona a célula (nova âncora) |
| `Shift+Clique` | Estende a seleção até a célula clicada |
| Clicar e arrastar | Seleciona um range |
| `Shift`+Seta | Estende o range a partir do âncora |

Âncora: contorno azul (`box-shadow` inset). Restante do range: fundo azul semitransparente.

### Ajuste rápido

| Atalho | Ação |
|--------|------|
| `Ctrl+I` | Aumenta 1% as células selecionadas (× 1,01) |
| `Ctrl+U` | Diminui 1% as células selecionadas (× 0,99) |

Opera sobre o range completo; uma entrada no histórico por acionamento.

### Área de transferência

| Atalho | Ação |
|--------|------|
| `Ctrl+C` | Copia a seleção como TSV (compatível Excel/Sheets) |
| `Ctrl+V` | Cola TSV a partir do âncora |

### Histórico (undo/redo)

| Atalho | Ação |
|--------|------|
| `Ctrl+Z` | Desfaz |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Refaz |

Funcionam globalmente na página; inativos quando o foco está num campo de texto (para não interferir com o undo nativo do browser).

Ações que criam entrada no histórico (1 cada): edição de célula individual, edição em massa F2, cola `Ctrl+V`, Delete/Backspace em range, rodar auto-tuning, resetar mapa.

Limite: 50 passos. Histórico de sessão (não persiste ao recarregar).

### Limpar células

| Atalho | Ação |
|--------|------|
| `Delete`/`Backspace` (célula única) | Abre edição inline com campo vazio |
| `Delete`/`Backspace` (range) | Zera o range (valor → 0, clamped para 100 no backend) |

## Overlay de pontos do log

Quando há logs e seleção de tempo, os pontos do log são plotados como scatter sobre os gráficos:
- Cada ponto = amostra do datalog no seu RPM×MAP real
- Densidade por célula indicada por opacidade/tamanho do ponto
- Células sem ponto de dados ficam com fundo hachurado no mapa editável (auto-tuning não pode corrigi-las)
