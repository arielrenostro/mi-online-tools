# Tuning › Aba VE

**Pré-requisito:** mapa carregado  
**Mapa da ECU:** Eficiência Volumétrica — instruções `#F01`–`#F16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM

---

## Layout

```
┌─ [Mapa Original — colapsável] ────────────────────────────── [▲ Colapsar] ─┐
│  (heatmap somente leitura)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Mapa Editável ──────────────────── [⚙ Config]  [Rodar Auto-tuning]  [Resetar] ─┐
│  (heatmap editável + resultado do auto-tuning)                                    │
└───────────────────────────────────────────────────────────────────────────────────┘

┌─ Análise do Auto-tuning ───────────────────────────────────────────────────┐
│  (heatmaps diagnósticos, warnings e estatísticas de filtragem)              │
│  Visível apenas após executar o auto-tuning                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Gráficos ─────────────────────────────────────────────────────────────────┐
│  [MAP × RPM]                    [RPM × MAP]                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Seção 1 — Mapa Original (colapsável)

Exibe o mapa exatamente como foi importado. Somente leitura — não pode ser editado aqui.

```
┌─ Mapa Original ──────────────────────────────────────────── [▲ Colapsar] ──┐
│                                                                               │
│  VE — valores originais (#F01–#F16)                                          │
│                                                                               │
│       400  800 1200 1600 2000 2400 2800 3200 3600 4000 4400 4800 5200 5600 6200 6800
│  200  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███  ███
│  180  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓
│  ...
│   10  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Comportamento do colapso:**
- Botão `[▲ Colapsar]` recolhe a seção, exibindo apenas o cabeçalho `Mapa Original [▼ Expandir]`
- Estado persiste em `localStorage` entre sessões
- Hover na tabela exibe tooltip: `RPM: 2000 | MAP: 80 kPa | Valor: 851`

---

## Seção 2 — Mapa Editável

Mapa onde o usuário faz edições manuais e onde o auto-tuning plota as correções sugeridas. Começa como cópia do mapa original. Células editadas ficam com um contorno vermelho, indicando alteração.

```
┌─ Mapa Editável ──────────────────── [⚙ Config]  [Rodar Auto-tuning]  [Resetar] ─┐
│                                                                                    │
│  Fonte: 2 logs · 14 min 33 s selecionados                                        │
│                                                                                    │
│       400  800 1200 1600 2000 2400 2800 3200 3600 4000 4400 4800 5200 5600 6200 6800
│  200  ███  ███  ███  ███  ███· ███  ███· ███  ███  ███  ███  ███  ███  ███  ███  ███
│  180  ██▓  ██▓  ██▓  ██▓  ██▓· ██▓ ██▓· ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓  ██▓
│  ...  (· = célula modificada)
│   10  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░  ░░░
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Edição de células

| Ação | Resultado |
|------|-----------|
| Hover | Tooltip: `Valor original: 851 | Diff: x%` |
| Clique simples | Seleciona a célula; destaca nos gráficos abaixo |
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

- Restaura todas as células ao valor do mapa original importado
- Exibe diálogo de confirmação antes de executar: "Isso irá descartar todas as edições manuais. Continuar?"

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

## Seção 4 — Gráficos

Dois heatmaps exibidos lado a lado, sempre refletindo o **mapa editável** atual em tempo real.

```
┌─ MAP × RPM ─────────────────────┐  ┌─ RPM × MAP ─────────────────────┐
│  Eixo X: RPM                    │  │  Eixo X: MAP (kPa)              │
│  Eixo Y: MAP (kPa)              │  │  Eixo Y: RPM                    │
│  Cor: valor da célula           │  │  Cor: valor da célula           │
│                                  │  │                                  │
│  [heatmap interativo]           │  │  [heatmap interativo]           │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

**Interações:**
- Hover em qualquer célula do gráfico destaca a mesma célula na tabela e no gráfico oposto
- Clique em célula seleciona na tabela (mesmo comportamento do clique direto na tabela)
- Gradiente de cores idêntico ao da tabela (calculado sobre o mesmo conjunto de dados)

---

## Overlay de pontos do log (quando logs estão carregados)

Quando há logs e seleção de tempo, os pontos do log são plotados sobre os gráficos como scatter:
- Cada ponto representa uma amostra do datalog posicionada no seu RPM×MAP real
- A densidade de pontos por célula é indicada pela opacidade ou tamanho do ponto
- Células sem nenhum ponto de dados ficam com fundo hachurado no mapa editável (indicando que o auto-tuning não pode corrigir aquela célula)
