# Tuning › Aba VE

**Pré-requisito:** mapa carregado  
**Mapa da ECU:** Eficiência Volumétrica — instruções `#F01`–`#F16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM

---

## Layout

```
┌─ [Mapa Original — colapsável] ──────────────────────────────────────────── [▲ Colapsar] ─┐
│  ┌─ Tabela (somente leitura) ──────────┐  ┌─ Gráfico ──────────────────────────────────┐ │
│  │  HeatmapTable                       │  │  [MAP×RPM][RPM×MAP]  [2D][3D]              │ │
│  │  (overflow-x automático)            │  │  ECharts heatmap / bar3D                   │ │
│  └─────────────────────────────────────┘  └────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────┘

┌─ Mapa Editável ──────────────────────────────── [Auto Tuning]  [Resetar] ─┐
│  ┌─ Tabela (editável) ─────────────────┐  ┌─ Gráfico ──────────────────┐  │
│  │  HeatmapTable                       │  │  [MAP×RPM][RPM×MAP] [2D][3D]│  │
│  │  células modificadas: borda laranja │  │  células selecionadas: azul │  │
│  └─────────────────────────────────────┘  └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘

┌─ Análise do Auto-tuning ───────────────────────────────────────────────────┐
│  (heatmaps diagnósticos, warnings e estatísticas de filtragem)              │
│  Visível apenas após executar o auto-tuning                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Seção 1 — Mapa Original (colapsável)

Exibe o mapa exatamente como foi importado. Somente leitura — não pode ser editado aqui.

Implementado com `MapWithChart`: tabela somente-leitura à esquerda e gráfico interativo à direita.

```
┌─ Mapa Original ──────────────────────────────────────────── [▲ Colapsar] ──┐
│                                                                               │
│  ┌─ Tabela ──────────────────────────────────────────────┐                  │
│  │       400  800 1200 ... 6800                           │ ┌─ Gráfico ────┐│
│  │  200  ███  ███  ███  ... ███                           │ │[MAP×RPM][RPM×MAP]││
│  │  180  ██▓  ██▓  ██▓  ... ██▓                           │ │[  2D  ][  3D  ]  ││
│  │  ...                                                   │ │               ││
│  │   10  ░░░  ░░░  ░░░  ... ░░░                           │ │ ECharts chart ││
│  └───────────────────────────────────────────────────────┘ └───────────────┘│
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Comportamento do colapso:**
- Botão `[▲ Colapsar]` recolhe a seção, exibindo apenas o cabeçalho `Mapa Original [▼ Expandir]`
- Estado persiste em `localStorage` entre sessões

**Gráfico:**
- Switches no topo: orientação (`MAP×RPM` / `RPM×MAP`) e modo (`2D` / `3D`)
- **2D**: gráfico de linhas — padrão `MAP×RPM` com uma linha por condição de MAP; trocar para `RPM×MAP` exibe uma linha por condição de RPM
- **3D**: superfície mesh interativa (rotacionável)
- Selecionar células na tabela destaca os pontos correspondentes no gráfico (dot azul em 2D, esfera azul em 3D)
- Largura do gráfico ajustável via drag no separador — proporção salva no localStorage

---

## Seção 2 — Mapa Editável

Mapa onde o usuário faz edições manuais e onde o auto-tuning plota as correções sugeridas. Começa como cópia do mapa original. Células editadas ficam com um contorno laranja, indicando alteração.

Implementado com `MapWithChart`: tabela editável à esquerda e gráfico interativo à direita.

```
┌─ Mapa Editável ──────────────────────────── [Auto Tuning]  [Resetar] ──┐
│                                                                           │
│  ┌─ Tabela ──────────────────────┐ │ ┌─ Gráfico ───────────────────────┐ │
│  │      400  800 1200 ... 6800   │ ↕ │ [MAP×RPM][RPM×MAP] [2D][3D]     │ │
│  │ 200  ███  ███  ███  ... ███   │   │ 2D: linhas por MAP ou RPM       │ │
│  │ 180  ██▓  ██▓· ██▓  ... ██▓  │   │ 3D: superfície mesh             │ │
│  │ ...  (· = modif.)            │   │ pontos selecionados em azul     │ │
│  └───────────────────────────────┘   └─────────────────────────────────┘ │
│       drag handle (↕) para ajustar proporção tabela/gráfico               │
└───────────────────────────────────────────────────────────────────────────┘
```

### Edição de células

| Ação | Resultado |
|------|-----------|
| Hover | Tooltip: `Valor original: 851 | Diff: x%` |
| Clique simples | Seleciona a célula; destaca o ponto correspondente no gráfico ao lado |
| Duplo clique ou `Enter` | Abre campo de edição inline com o valor atual, permitindo informar um percentual ou um novo valor |
| Digitar + `Enter` ou clique fora | Confirma o novo valor |
| `Escape` | Cancela a edição, restaura o valor anterior |
| Selecionar várias células + `Enter` | Abre campo de edição inline com o valor atual, permitindo informar um percentual ou um novo valor | 

**Validação de entrada:**
- Apenas inteiros positivos
- Faixa permitida: 100–9999 (hard limits definidos na spec do mapa)
- Valor fora da faixa: campo fica vermelho, não confirma

### Botão: Rodar Auto-tuning

1. Pergunta se deseja rodar, pois irá sobreescrever os valores
2. Executa a análise conforme as premissas configuradas (ver [config.md](config.md) e [tuning-engine.md](../tuning-engine.md))
3. Plota as correções calculadas diretamente no mapa editável
4. Células alteradas recebem marcador visual (ponto no canto superior direito)
5. Um painel de resumo aparece abaixo da tabela:

```
┌─ Resultado do Auto-tuning ────────────────────────────────────────────────┐
│  87 células corrigidas · 34 sem dados suficientes · 135 sem alteração     │
│  Correção média: +3.2%  │  Máx: +8.1% (RPM 3200, MAP 100)               │
│  Mín: -4.6% (RPM 1600, MAP 40)                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Botão: Resetar

- Sempre visível; fica desabilitado enquanto o mapa não tem edições (`isDirty = false`)
- Quando habilitado, exibe diálogo de confirmação antes de executar: "Isso irá descartar todas as edições manuais. Continuar?"
- Restaura todas as células ao valor do mapa original importado

---

## Seção 3 — Análise do Auto-tuning

Visível apenas após a execução do auto-tuning. Exibe os dados internos do `TuningOutput` para que o usuário entenda a qualidade dos dados, o que foi corrigido e onde há problemas.

```
┌─ Análise do Auto-tuning ────────────────────────────────────────────────────┐
│                                                                               │
│  [ VE Lambda ] [ Amostras ] [ Confiança ] [ CV ] [ Correção % ] [ Convergência ]
│                                                                               │
│       400  800 1200 1600 2000 2400 2800 3200 3600 4000 ...                   │
│  200  ░░░  ░░░  ███  ███  ██▓  ██▓  ███  ███  ███  ░░░  ...                 │
│  180  ░░░  ░░░  ██▓  ██▓  ██░  ██░  ██▓  ██▓  ██▓  ░░░  ...                 │
│  ...                                                                          │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  WARNINGS                                                                    │
│  ⚠ 3 violações de monotonicidade  ·  2 gradientes excessivos  [▼ Detalhar] │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│  FILTROS DE DADOS                                                            │
│  12.430 pontos lidos · 8.741 aprovados (70.3%) · 141 outliers intra-célula  │
│                                                                               │
│  CLT insuf.    Loop aberto   Skip CL    Δ RPM    Δ MAP    Δ λ target  Δ pedal
│     1.203          892          412       78       103        891        110  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 Heatmaps diagnósticos

Seis modos de visualização, alternados por abas. Todos usam a mesma grade do mapa (MAP × RPM). Células sem dados aparecem em cinza em todos os modos.

| Aba | Dado | Escala de cor |
|-----|------|---------------|
| **VE Lambda** | `ve_lambda_map` — o VE que o log indica que deveria existir | Mesma escala quente do mapa editável |
| **Amostras** | `sample_count_map` — quantidade de amostras (pós-rejeição de outliers) | 0 = cinza → N ≥ 100 = azul saturado |
| **Confiança** | `confidence_map` — count_score × 0.7 + stability × 0.3 | 0 = vermelho → 1 = verde |
| **CV** | `cv_map` — coeficiente de variação; mede dispersão dentro da célula | 0 = verde → ≥ cv_threshold = vermelho |
| **Correção %** | `correction_pct_map` — variação aplicada em relação ao mapa atual | Divergente: azul = negativo, vermelho = positivo, branco = zero |
| **Convergência** | `convergence_map` — se o residual < convergence_threshold | Verde = convergida, amarelo = em progresso, cinza = sem dados |

**Tooltip (hover em qualquer modo):**

```
RPM: 3200 | MAP: 80 kPa
──────────────────────
VE atual:     851
VE Lambda:    883  (+3.8%)
Amostras:     47
Confiança:    0.74
CV:           0.09
Correção:     +2.1%
Convergida:   não (residual 6.3%)
```

O tooltip sempre exibe todos os campos, independente do modo ativo — o modo apenas determina qual dimensão é colorida.

---

### 3.2 Warnings

Painel colapsável que lista as violações detectadas na etapa de pós-processamento. Exibido mesmo quando a contagem é zero ("Nenhum warning").

```
┌─ Warnings ─────────────────────────────────────────────────────────────────┐
│  ⚠ Monotonicidade MAP (3)                                                  │
│     RPM 2800, MAP 90 kPa  — VE (720) < vizinho inferior (734)             │
│     RPM 2800, MAP 100 kPa — VE (718) < vizinho inferior (729)             │
│     RPM 3200, MAP 110 kPa — VE (801) < vizinho inferior (815)             │
│                                                                              │
│  ⚠ Gradiente excessivo (2)                                                 │
│     RPM 4000, MAP 80 kPa  — 24.3% vs vizinho RPM 3600 (mesmo MAP)         │
│     RPM 4400, MAP 60 kPa  — 21.8% vs vizinho MAP 70 kPa (mesmo RPM)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Clicar em qualquer linha do warning **destaca a célula** no heatmap ativo e na tabela do mapa editável
- Warnings não bloqueiam exportação — são informativos

---

### 3.3 Estatísticas de filtragem

Painel fixo (não colapsável) com o diagnóstico de quantos pontos do log foram usados e por quê cada grupo foi descartado.

```
┌─ Filtros de Dados ─────────────────────────────────────────────────────────┐
│  12.430 lidos  →  8.741 aprovados (70.3%)  →  141 outliers intra-célula   │
│                                                                              │
│  Descartados por critério:                                                   │
│  ┌──────────────────────┬───────┬───────────────────────┬────────┐          │
│  │ Critério             │   Qtd │ Critério              │    Qtd │          │
│  ├──────────────────────┼───────┼───────────────────────┼────────┤          │
│  │ CLT insuficiente     │ 1.203 │ Δ lambda vs. target   │    891 │          │
│  │ Loop aberto          │   892 │ Lambda máximo         │     48 │          │
│  │ Skip closed loop     │   412 │ Δ pedal               │    110 │          │
│  │ Skip bucket RPM      │     0 │ Fora do range do mapa │     83 │          │
│  │ Skip bucket MAP      │     0 │ Outlier intra-célula  │    141 │          │
│  │ Δ RPM                │    78 │                       │        │          │
│  │ Δ MAP                │   103 │                       │        │          │
│  └──────────────────────┴───────┴───────────────────────┴────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Critérios com valor zero ainda aparecem na tabela (valor "0"), para confirmar que o filtro está ativo mas não descartou nada
- Critérios desabilitados na config aparecem como "—" em vez de "0"

---

---

## Atalhos de teclado — Mapa Editável

A tabela do mapa editável replica o comportamento do Excel/Calc. Ao montar a tabela, a célula `[0,0]` é automaticamente selecionada — os atalhos funcionam imediatamente, sem necessidade de clicar primeiro.

### Navegação

| Atalho | Ação |
|--------|------|
| `↑` `↓` `←` `→` | Move o cursor para a célula adjacente |
| `Shift` + Seta | Estende a seleção (range) sem mover o âncora |
| `Tab` | Confirma edição e move para a próxima coluna |
| `Shift+Tab` | Confirma edição e move para a coluna anterior |
| `Enter` | Célula única: abre edição inline; Range: move para baixo |
| `Shift+Enter` | Move para cima |

### Edição inline (célula única)

| Atalho | Ação |
|--------|------|
| Duplo clique | Entra em edição inline com o valor atual selecionado |
| `0`–`9`, `-`, `.` | Inicia edição substituindo o valor pelo caractere digitado |
| `Enter` (dentro da edição) | Confirma e move para a linha abaixo |
| `Tab` (dentro da edição) | Confirma e move para a próxima coluna |
| `Shift+Tab` (dentro da edição) | Confirma e move para a coluna anterior |
| `↓` / `↑` (dentro da edição) | Confirma e navega para a linha abaixo / acima |
| `Escape` | Cancela a edição, restaura o valor anterior |

### Edição em massa — F2

| Atalho | Ação |
|--------|------|
| `F2` | Abre a modal de edição em massa para as células selecionadas |

A modal oferece **três campos alternativos** (preencher um limpa os outros automaticamente):

- **Percentual (%)** — ajusta cada célula individualmente pelo percentual informado.  
  Exemplos: `+5` aumenta 5%; `-10` reduz 10%. Fórmula: `novo = atual × (1 + pct/100)`.
- **Acrescentar um valor** — soma ou subtrai um delta fixo de cada célula.  
  Exemplos: `+5` adiciona 5 unidades; `-3` subtrai 3. Fórmula: `novo = atual + delta`.
- **Definir um valor** — sobrescreve todas as células do range com o mesmo valor.

Prioridade quando aplicado: acrescentar > definir > percentual.  
Confirmar com `Enter` ou o botão **Aplicar**. Cancelar com `Escape` ou clique fora.  
O resultado é registrado como **uma única entrada no histórico** (Ctrl+Z desfaz tudo de uma vez).

### Seleção

| Atalho | Ação |
|--------|------|
| Clique | Seleciona a célula (nova âncora) |
| `Shift+Clique` | Estende a seleção até a célula clicada |
| Clicar e arrastar | Seleciona um range arrastando o mouse |
| `Shift` + Seta | Estende o range a partir do âncora atual |

A célula âncora é indicada por um contorno azul (`box-shadow` inset). O restante do range selecionado recebe fundo azul semitransparente.

### Ajuste rápido de valor

| Atalho | Ação |
|--------|------|
| `Ctrl+I` | Aumenta todas as células selecionadas em 1% (multiplica por 1,01) |
| `Ctrl+U` | Diminui todas as células selecionadas em 1% (multiplica por 0,99) |

Opera sobre o range completo (âncora + extensão). Registra uma única entrada no histórico por acionamento.

### Área de transferência

| Atalho | Ação |
|--------|------|
| `Ctrl+C` | Copia a seleção como TSV — compatível com Excel e Google Sheets |
| `Ctrl+V` | Cola TSV a partir da célula âncora (aceita colagem direta do Excel) |

### Histórico (undo/redo)

| Atalho | Ação |
|--------|------|
| `Ctrl+Z` | Desfaz a última alteração |
| `Ctrl+Shift+Z` | Refaz |
| `Ctrl+Y` | Refaz (alternativa Windows) |

**Funcionam globalmente na página** — não requerem foco na tabela.  
Não agem quando o foco está num campo de texto (`<input>` / `<textarea>`), para não interferir com o undo nativo do navegador.

Ações que criam entrada no histórico (todas desfeitas por `Ctrl+Z`):

| Ação | Entradas no histórico |
|------|-----------------------|
| Edição de célula individual | 1 por célula confirmada |
| Edição em massa via F2 | 1 (range inteiro como único passo) |
| Cola via `Ctrl+V` | 1 (paste inteiro) |
| Delete / Backspace em range | 1 |
| Rodar Auto-tuning | 1 |
| Resetar mapa | 1 |

Limite: 50 passos. Histórico é apenas de sessão (não persiste ao recarregar a página).

### Limpar células

| Atalho | Ação |
|--------|------|
| `Delete` / `Backspace` (célula única) | Abre edição inline com campo vazio |
| `Delete` / `Backspace` (range) | Zera todas as células do range (valor → 0, clamped para 100 no backend) |

---

## Overlay de pontos do log (quando logs estão carregados)

Quando há logs e seleção de tempo, os pontos do log são plotados sobre os gráficos como scatter:
- Cada ponto representa uma amostra do datalog posicionada no seu RPM×MAP real
- A densidade de pontos por célula é indicada pela opacidade ou tamanho do ponto
- Células sem nenhum ponto de dados ficam com fundo hachurado no mapa editável (indicando que o auto-tuning não pode corrigir aquela célula)
