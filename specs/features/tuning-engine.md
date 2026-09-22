# Motor de Tuning — VE (Tuning Engine)

Algoritmo de auto-tuning do mapa de VE. Baseado na planilha `4Bar - 30 - subida serra.xlsx` (workflow manual do usuário).

## Pipeline

```
[Datalog rows]
  1. Filtragem de pontos (Log Refinado)
  2. Snap para breakpoints (RPM/MAP Escalonado)
  3. Cálculo de VE Lambda por ponto
  4. Agregação por célula (rejeição ±2σ → média + desvio padrão)
  5. Peso de correção (count_score) e confiança combinada
  6. Fator de correção por célula (âncoras esparsas)
  7. Campo de correção suave ancorado
  8. Aplicação ao mapa
  9. Limites absolutos
  10. Pós-processamento
[Mapa VE sugerido]
```

## Contrato de interface

Função pura e stateless: `run(input: TuningInput) -> TuningOutput`. Sem leitura/escrita de estado externo. Mesmo input → mesmo output.

### Entrada — `TuningInput`

```python
@dataclass
class TuningInput:
    current_map:     list[list[int]]   # mapa atual; shape (n_map × n_rpm); raw 100–9999
    rpm_breakpoints: list[int]         # de #I20; tamanho n_rpm
    map_breakpoints: list[int]         # de #I21; tamanho n_map
    datalog_rows:    list[DatalogRow]  # linhas já parseadas
    config:          TuningConfig
```

#### `DatalogRow` — em unidades reais (conversão raw→real é do parser, não da engine)

```python
@dataclass
class DatalogRow:
    timestamp_ms:    int
    rpm:             float
    map_kpa:         float
    lambda1:         float        # lambda medido real (ex: 1.018)
    lambda_correcao: float        # fuel trim como multiplicador (sem correção=1.000; +2%=1.020)
    lambda_target:   float        # lambda alvo real (ex: 1.000)
    ve_value_raw:    int          # VE raw do mapa (VE% × 10; ex: 59.2% → 592)
    clt:             float        # °C
    lambda_loop:     int          # 0=open, 1=closed
    pedal:           float | None # % (0–100); None se coluna ausente
```

> `ve_value_raw` fica em raw porque a fórmula VE Lambda opera nessa escala (comparável ao `current_map`). Demais campos são reais para facilitar os filtros.

#### `TuningConfig` — parâmetros (ver [tuning/config.md](tuning/config.md))

```python
@dataclass
class TuningConfig:
    # Filtros de dados
    min_clt:                    float = 80.0
    lambda_loop_closed_only:    bool  = True
    skip_first_closed_loop:     int   = 10
    skip_first_rpm_bucket:      int   = 0
    skip_first_map_bucket:      int   = 0
    max_delta_rpm:              float = 99999
    max_delta_map:              float = 99999
    max_delta_lambda_target:    float = 0.200
    max_lambda:                 float = 1.090
    max_delta_pedal:            float | None = None   # None = desabilitado
    # Qualidade por célula
    outlier_sigma:              float = 2.0
    cv_threshold:               float = 0.15
    # Correção
    weight_sample_base:         int   = 40
    max_correction_pct:         float = 15.0
    # Campo de correção (etapa 7)
    smoothing_strength:         float = 0.5
    # Convergência
    convergence_threshold:      float = 5.0
    # Pós-processamento
    rpm400_rule_enabled:        bool  = True
    rpm400_discount:            float = 0.045
    low_map_rule_enabled:       bool  = True
    low_map_threshold:          int   = 20
    low_map_discount:           float = 0.025
    max_adjacent_gradient_pct:  float = 20.0
```

### Saída — `TuningOutput`

```python
@dataclass
class TuningOutput:
    # Mapa resultante
    suggested_map:        list[list[int]]          # shape (n_map × n_rpm); raw aplicável à ECU
    # Dados por célula — mesma shape
    ve_lambda_map:        list[list[float | None]]  # VE Lambda médio (pós-outlier); None=sem dados
    sample_count_map:     list[list[int]]           # amostras pós-outlier
    correction_pct_map:   list[list[float]]         # correção aplicada, %
    cf_map:               list[list[float]]         # fator de correção interpolado (1.0=sem alteração)
    confidence_map:       list[list[float | None]]  # confiança 0–1; None=sem dados
    cv_map:               list[list[float | None]]  # coeficiente de variação; None=sem dados
    convergence_map:      list[list[bool | None]]   # True=residual<threshold; None=sem dados
    # Listas de células
    cells_no_data:        list[tuple[int, int]]     # (row_i, col_j) sem amostras
    cells_extrapolated:   list[CellExtrapolation]   # células preenchidas por regra
    # Warnings (não bloqueantes)
    monotonicity_warnings: list[tuple[int, int]]
    gradient_warnings:     list[GradientWarning]
    # Diagnóstico
    filter_stats:         FilterStats


@dataclass
class CellExtrapolation:
    row_i: int
    col_j: int
    rule:  str   # "smoothing_field" | "rpm400" | "low_map"


@dataclass
class GradientWarning:
    row_i: int
    col_j: int
    neighbor_i: int
    neighbor_j: int
    gradient_pct: float


@dataclass
class FilterStats:
    total_rows:              int
    passed:                  int
    discarded_clt:           int
    discarded_open_loop:     int
    discarded_skip_cl:       int
    discarded_skip_rpm_bkt:  int
    discarded_skip_map_bkt:  int
    discarded_delta_rpm:     int
    discarded_delta_map:     int
    discarded_delta_lambda:  int
    discarded_max_lambda:    int
    discarded_delta_pedal:   int
    discarded_out_of_range:  int
    discarded_outlier:       int   # outliers intra-célula da etapa 4
```

## 1. Filtragem de pontos

Replica os filtros da aba "Log Refinado". Valores brutos são convertidos para unidades reais antes de filtrar.

| Parâmetro | Padrão | Descarte | Razão |
|-----------|--------|----------|-------|
| `min_clt` | 80 ºC | `CLT < min_clt` | Motor frio (enriquecimento de partida) |
| `lambda_loop` | closed only | `Lambda Loop ≠ 1` | Loop aberto sem feedback confiável |
| `skip_first_closed_loop` | 10 | Primeiros N pontos após entrar em closed loop | ECU demora a estabilizar |
| `skip_first_rpm_bucket` | 0 | Primeiros N pontos após mudar bucket RPM | Transiente |
| `skip_first_map_bucket` | 0 | Primeiros N pontos após mudar bucket MAP | Transiente |
| `max_delta_rpm` | 99999 | `abs(RPM[i]-RPM[i-1]) > valor` | Transiente brusco |
| `max_delta_map` | 99999 | `abs(MAP[i]-MAP[i-1]) > valor` | Transiente brusco |
| `max_delta_lambda_target` | 0.200 λ | `abs(Lambda1-LambdaTarget) > valor` (λ real) | Leitura fora do alvo |
| `max_lambda` | 1.090 λ | `Lambda1 > valor` (λ real) | Leitura excessivamente pobre |
| `max_delta_pedal` | desabilitado | `abs(Pedal[i]-Pedal[i-1]) > valor` (%) | Pedal em movimento (transiente) |

> `max_delta_pedal` requer a coluna de pedal no log; se ausente, o filtro é ignorado silenciosamente.

## 2. Snap para breakpoints

Os breakpoints (`#I20`, `#I21`) vêm do CSV da ECU. A engine nunca assume intervalos fixos — usa os breakpoints reais.

```python
def snap_to_breakpoints(value: float, breakpoints: list[int]) -> int | None:
    """Retorna o breakpoint mais próximo; None se value fora do range (descarta)."""
    if value < breakpoints[0] or value > breakpoints[-1]:
        return None
    return min(breakpoints, key=lambda bp: abs(bp - value))
```

```python
rpm_snapped = snap_to_breakpoints(row.rpm, rpm_breakpoints)
map_snapped = snap_to_breakpoints(row.map_kpa, map_breakpoints)
if rpm_snapped is None or map_snapped is None:
    discard(row, reason="fora do range do mapa")
    continue
```

Internamente a engine trabalha com **índices** de linha/coluna; os valores físicos são usados apenas no snap.

```python
row_i = map_breakpoints.index(map_snapped)
col_j = rpm_breakpoints.index(rpm_snapped)
```

## 3. Cálculo de VE Lambda por ponto

**Fórmula central.** Traduz o feedback de lambda para o espaço de VE do mapa.

```
VE Lambda = (Lambda1_raw + LambdaCorrecao_raw - LambdaTarget_raw) × VEValue_raw / 1000
```

Todos os valores são **brutos** do datalog:
- `Lambda1_raw` — lambda × 1000 (λ=1.018 → 1018)
- `LambdaCorrecao_raw` — fuel trim raw (+2% → 1020; sem correção → 1000)
- `LambdaTarget_raw` — lambda alvo × 1000 (λ=1.000 → 1000)
- `VEValue_raw` — VE × 10 (VE=59.2% → 592)

| Situação | Resultado | Significado |
|----------|-----------|-------------|
| Lambda=target, sem trim | `= VE` | Mapa correto |
| Lambda>target (pobre), trim negativo | `> VE` | Mapa precisa de mais combustível |
| Lambda<target (rico), trim positivo | `< VE` | Mapa precisa de menos combustível |

O VE Lambda é o valor que o mapa deveria ter naquele ponto para atingir o lambda alvo, já considerando a correção da ECU.

## 4. Agregação por célula

Para cada célula `(map_snap, rpm_snap)`, coletar os pontos filtrados, rejeitar outliers intra-célula e calcular a média.

### 4.1 Rejeição de outliers (±2σ)

```python
raw_values = [ve_lambda for each point in this cell]
if len(raw_values) >= 5:   # mínimo para significado estatístico
    mean_raw = mean(raw_values); std_raw = std(raw_values)
    sigma = config.outlier_sigma   # 2.0
    ve_lambda_values = [v for v in raw_values if abs(v - mean_raw) <= sigma * std_raw]
else:
    ve_lambda_values = raw_values  # poucos pontos: não rejeitar
```

### 4.2 Média e estatísticas

```python
n = len(ve_lambda_values)
ve_lambda_avg = mean(ve_lambda_values)
ve_lambda_std = std(ve_lambda_values) if n >= 2 else 0.0
```

Células com `n=0` não recebem correção automática — marcadas "sem dados", tratadas pelas etapas 7 e 12.

## 5. Peso de correção e confiança

Produz dois valores por célula:
- **`weight` (count_score)** — usado no blending (etapa 6); controla o quanto o log puxa o mapa
- **`confidence`** — exibido na UI; combina quantidade de amostras e estabilidade

### 5.1 Peso de correção (count_score)

```python
K = config.weight_sample_base   # 40
count_score = n / (n + K)
```

| n | count_score (K=40) |
|---|---|
| 0 | 0.00 |
| 10 | 0.20 |
| 20 | 0.33 |
| 40 | 0.50 |
| 100 | 0.71 |
| 200 | 0.83 |
| ∞ | 1.00 |

### 5.2 Estabilidade (stability_score)

CV (= std/média) quantifica dispersão. 50 amostras ruidosas valem menos que 20 consistentes.

```python
cv = ve_lambda_std / ve_lambda_avg if ve_lambda_avg > 0 else 0.0
stability_score = max(0.0, 1.0 - cv / config.cv_threshold)
# cv_threshold padrão 0.15 → stability 1.0 quando cv=0, 0.0 quando cv>=0.15
```

### 5.3 Confiança combinada

```python
confidence = count_score * 0.7 + stability_score * 0.3
```

`confidence` vai para a UI; `count_score` vai para o blending (célula consistente mas com poucas amostras não deve puxar o mapa só por ser estável).

## 6. Fator de correção por célula (âncoras esparsas)

A engine opera no **espaço do fator de correção** (multiplicador). Cada célula **com dados** produz uma âncora; células sem dados ficam ausentes do dicionário e são preenchidas na etapa 7.

```python
# Célula com dados (n > 0):
cf_raw = ve_lambda_avg / current_map_value          # 1.05 = mapa 5% baixo
cf_val = 1 + count_score * (cf_raw - 1)             # amortecido por count_score
cf_sparse[(map, rpm)] = clamp(cf_val, 1 ± max_correction_pct/100)
# Célula sem dados (n = 0): ausente de cf_sparse
```

`count_score` amortece células com poucas amostras (poucos dados → `cf` perto de 1.0). O `clamp` garante que a âncora nunca puxe o campo (etapa 7) além do limite de correção por rodada.

## 7. Campo de correção suave ancorado

Substitui a antiga interpolação 2D + propagação estrutural. Mecanismo único de **preservação de forma**, **anti-spike** e **propagação de tendência**.

### Princípio

O mapa de correção é um campo que **(1) gruda nas células confiáveis — a fonte da verdade — e (2) é o mais liso possível em todo o resto**. Resolve-se o campo `cf` que minimiza:

```
E = Σ_células  W·(cf - cf_sparse)²   +   μ·Σ_arestas (cf_a - cf_b)²
```

- **1º termo (âncora):** puxa o campo para o `cf` medido nas células com dados.
- **2º termo (suavidade):** penaliza a diferença entre células vizinhas da grade → campo liso, sem spikes; `μ = smoothing_strength`.

### Peso da âncora

```python
W = clip(confidence / (1 - confidence), 0, 100)   # célula com dados
W = 0                                              # célula sem dados
```

A razão de chances faz a confiança alta dominar: confiança 0.95 → W≈19, 0.99 → W≈99 (célula praticamente imóvel = verdade); confiança 0.3 (ruidosa) → W≈0.43 (âncora fraca, será suavizada); sem dados → W=0 (preenchida apenas pela suavidade).

### Resolução

Minimizar `E` é um sistema linear:

```
(diag(W) + μ·L)·cf = W·cf_sparse        L = Laplaciano da grade (4-vizinhança)
```

Resolvido direto (`np.linalg.solve`) — a grade VE é 16×16, determinístico. A suavidade é célula-a-célula na grade (não em coordenadas físicas): o alvo é uma tabela de calibração lisa e a grade do motor é quase uniforme; ao contrário da interpolação, aqui o índice é o critério correto.

### Comportamento

| Situação | Resultado |
|----------|-----------|
| Célula de alta confiança | `cf ≈ cf medido` — verdade aplicada integralmente |
| Entre duas âncoras | rampa lisa ligando-as → tendência observada preservada |
| Além das âncoras (sem dados) | campo achata e segura no valor da âncora mais próxima → tendência mantida, sem disparar |
| Célula ruidosa, baixa confiança | puxada para a média dos vizinhos → spike eliminado |
| `new = current × cf` | forma das curvas do mapa atual preservada onde não há dados |

Não há mais componente global, estrutural nem composição ponderada: **o campo resolvido é o fator final**. Células com dados não são diluídas por médias de coluna/linha nem por um fator global — o "tradeoff" foi removido.

## 8. Aplicação do fator ao mapa

```python
for row_i, map_kpa in enumerate(map_breakpoints):
    for col_j, rpm in enumerate(rpm_breakpoints):
        cf = cf_full[row_i][col_j]
        current = current_map[row_i][col_j]
        new_value = round(current * cf)
        correction_pct = (cf - 1) * 100
        if sample_count[row_i][col_j] > 0:
            residual_pct = abs(ve_lambda_avg_map[row_i][col_j] - new_value) / new_value * 100
            converged[row_i][col_j] = residual_pct < config.convergence_threshold  # padrão 5.0%
```

`residual_pct` mede quanto o mapa ainda precisa evoluir: com weight baixo o `new_value` fica perto do `current` e o residual pode ser alto (mais rodadas necessárias).

## 9. Limites absolutos

```python
# Limite de correção por rodada
if abs(correction_pct) > config.max_correction_pct:
    clamped_cf = 1 + (config.max_correction_pct / 100) * sign(correction_pct)
    new_value  = round(current_map_value * clamped_cf)
# Hard limits do mapa
new_value = max(100, min(9999, new_value))
```

## 10. Pós-processamento

Regras específicas do motor e verificações de consistência para casos que o campo de correção não cobre.

### 10.1 RPM 400 (idle instável)

400 RPM raramente tem dados. Sobrescrever explicitamente com base na coluna de 800 RPM:

```python
if config.rpm400_rule_enabled:
    for row_i in range(n_map):
        col_800 = suggested_map[row_i][idx_rpm_800]
        suggested_map[row_i][idx_rpm_400] = round(col_800 * (1 - config.rpm400_discount))
        # rpm400_discount padrão 0.045 (4.5%)
```

### 10.2 MAP muito baixo sem dados (ex.: 20 kPa)

Linhas de MAP baixo sem nenhuma amostra extrapolam da linha imediatamente superior:

```python
if config.low_map_rule_enabled:
    for row_i, map_kpa in enumerate(map_breakpoints):
        if map_kpa <= config.low_map_threshold and sample_count_row[row_i] == 0:
            next_row = row_i + 1
            for col_j in range(n_rpm):
                suggested_map[row_i][col_j] = round(
                    suggested_map[next_row][col_j] * (1 - config.low_map_discount))
        # low_map_threshold padrão 20 kPa; low_map_discount padrão 0.025 (2.5%)
```

### 10.3 Verificação de monotonicidade MAP

Em motor turbo, VE cresce monotonicamente com a pressão. Verificar e sinalizar violações (não corrige):

```python
for col_j in range(n_rpm):
    for row_i in range(1, n_map):
        if map_breakpoints[row_i] < 40:
            continue   # abaixo de 40 kPa o comportamento pode inverter
        if suggested_map[row_i][col_j] < suggested_map[row_i - 1][col_j]:
            emit_warning(row_i, col_j, "monotonicidade MAP violada")
```

A UI exibe como warning — o usuário decide se suaviza.

### 10.4 Verificação de gradiente entre vizinhos

Spike isolado indica dado ruim ou descontinuidade improvável. Verifica a magnitude (não só direção):

```python
for row_i in range(n_map):
    for col_j in range(n_rpm):
        current_val = suggested_map[row_i][col_j]
        for (ni, nj) in [(row_i-1, col_j), (row_i+1, col_j),
                         (row_i, col_j-1), (row_i, col_j+1)]:
            if 0 <= ni < n_map and 0 <= nj < n_rpm:
                neighbor_val = suggested_map[ni][nj]
                gradient_pct = abs(current_val - neighbor_val) / neighbor_val * 100
                if gradient_pct > config.max_adjacent_gradient_pct:  # padrão 20%
                    emit_warning(row_i, col_j, f"gradiente {gradient_pct:.1f}% vs vizinho ({ni},{nj})")
```

Gradientes excessivos são **warnings**, não correções automáticas.

## Configuração padrão

```python
TuningConfig(
    min_clt=80, lambda_loop_closed_only=True,
    skip_first_closed_loop=10, skip_first_rpm_bucket=0, skip_first_map_bucket=0,
    max_delta_rpm=99999, max_delta_map=99999,
    max_delta_lambda_target=0.200, max_lambda=1.090, max_delta_pedal=None,
    outlier_sigma=2.0, cv_threshold=0.15,
    weight_sample_base=40, max_correction_pct=15,
    smoothing_strength=0.5,
    convergence_threshold=5.0,
    rpm400_rule_enabled=True, rpm400_discount=0.045,
    low_map_rule_enabled=True, low_map_threshold=20, low_map_discount=0.025,
    max_adjacent_gradient_pct=20,
)
```

## Iteratividade

Uso iterativo: rodar o carro → subir log → rodar auto-tuning → revisar e aplicar → exportar → subir na ECU → repetir. Cada rodada reduz os desvios residuais; após convergir, `ve_lambda_map` se aproxima dos valores do mapa atual.
