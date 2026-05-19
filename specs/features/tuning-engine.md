# Motor de Tuning — VE (Tuning Engine)

Especificação do algoritmo de auto-tuning do mapa de eficiência volumétrica (VE). Baseado na planilha de referência `4Bar - 30 - subida serra.xlsx`, que representa o workflow manual consolidado pelo usuário.

---

## Visão geral do pipeline

```
[Datalog rows]
      │
      ▼
 1. Filtragem de pontos (Log Refinado)
      │
      ▼
 2. Snap para breakpoints (RPM Escalonado / MAP Escalonado)
      │
      ▼
 3. Cálculo de VE Lambda por ponto
      │
      ▼
 4. Agregação por célula (rejeição de outliers ±2σ → média + desvio padrão)
      │
      ▼
 5. Peso de correção (count_score) e confiança combinada (count + stability)
      │
      ▼
6. Fator de correção ponderado por célula
      │
      ▼
7. Interpolação 2D local do fator de correção
      │
      ▼
8. Extração de tendências estruturais (RPM / MAP / gradiente)
      │
      ▼
9. Composição do fator final preservando forma do mapa
      │
      ▼
10. Aplicação ao mapa
      │
      ▼
11. Limites absolutos
      │
      ▼
12. Pós-processamento
      │
      ▼
[Mapa VE sugerido]
```

---

## Contrato de interface

O tuning engine é uma **função pura e stateless**: recebe todos os dados necessários como entrada, executa o pipeline completo e retorna o resultado. Não lê nem escreve estado externo — sem arquivos, sem banco de dados, sem variáveis globais. Chamadas sucessivas com o mesmo input produzem sempre o mesmo output.

```
run(input: TuningInput) -> TuningOutput
```

---

### Entrada — `TuningInput`

```python
@dataclass
class TuningInput:
    current_map:     list[list[int]]   # mapa atual da ECU; shape (n_map × n_rpm); raw (100–9999)
    rpm_breakpoints: list[int]         # breakpoints de RPM lidos de #I20; tamanho n_rpm
    map_breakpoints: list[int]         # breakpoints de MAP lidos de #I21; tamanho n_map
    datalog_rows:    list[DatalogRow]  # linhas do log já parseadas (ver abaixo)
    config:          TuningConfig      # parâmetros de filtragem, correção e pós-processamento
```

#### `DatalogRow` — linha do datalog já convertida para unidades reais

Todos os campos estão em unidades de engenharia. A conversão de raw → real é responsabilidade do parser de datalog, **não do tuning engine**.

```python
@dataclass
class DatalogRow:
    timestamp_ms:    int          # tempo em ms relativo ao início do log
    rpm:             float        # rotações por minuto
    map_kpa:         float        # pressão no coletor, kPa
    lambda1:         float        # lambda medido, real (ex: 1.018)
    lambda_correcao: float        # fuel trim como multiplicador (sem correção = 1.000; +2% = 1.020)
    lambda_target:   float        # lambda alvo real (ex: 1.000)
    ve_value_raw:    int          # VE em unidades raw do mapa (VE% × 10; ex: 59.2% → 592)
    clt:             float        # temperatura do motor, °C
    lambda_loop:     int          # 0 = open loop, 1 = closed loop
    pedal:           float | None # posição do pedal, % (0–100); None se coluna ausente no log
```

> `ve_value_raw` é mantido em formato raw porque a fórmula VE Lambda opera nessa escala e o resultado precisa ser diretamente comparável aos valores do `current_map` (também raw). Todos os demais campos são reais para facilitar os filtros de qualidade.

#### `TuningConfig` — parâmetros configuráveis

Definidos em [tuning/config.md](tuning/config.md). Referência rápida dos campos relevantes ao engine:

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

    # Convergência
    convergence_threshold:      float = 5.0

    # Pós-processamento
    rpm400_rule_enabled:        bool  = True
    rpm400_discount:            float = 0.045
    low_map_rule_enabled:       bool  = True
    low_map_threshold:          int   = 20
    low_map_discount:           float = 0.025
    max_adjacent_gradient_pct:  float = 20.0

    # Propagação estrutural
    shape_propagation_enabled: bool = True

    shape_rpm_weight: float = 0.50
    shape_map_weight: float = 0.30
    shape_gradient_weight: float = 0.20

    global_shape_weight: float = 0.10

    gradient_min_samples: int = 2
```

---

### Saída — `TuningOutput`

```python
@dataclass
class TuningOutput:
    # Mapa resultante
    suggested_map:        list[list[int]]          # shape (n_map × n_rpm); valores raw aplicáveis à ECU

    # Dados por célula — mesma shape do mapa
    ve_lambda_map:        list[list[float | None]]  # VE Lambda médio (pós-outlier); None = sem dados
    sample_count_map:     list[list[int]]           # amostras por célula (pós-outlier)
    correction_pct_map:   list[list[float]]         # correção aplicada, %
    cf_map:               list[list[float]]         # fator de correção interpolado (1.0 = sem alteração)
    confidence_map:       list[list[float | None]]  # confiança combinada 0–1; None = sem dados
    cv_map:               list[list[float | None]]  # coeficiente de variação; None = sem dados
    convergence_map:      list[list[bool | None]]   # True = residual < threshold; None = sem dados

    # Listas de células por categoria
    cells_no_data:        list[tuple[int, int]]     # (row_i, col_j) sem nenhuma amostra
    cells_extrapolated:   list[CellExtrapolation]   # células preenchidas por regra, com qual regra

    # Warnings de qualidade (não bloqueantes)
    monotonicity_warnings: list[tuple[int, int]]   # (row_i, col_j) com monotonicidade violada
    gradient_warnings:     list[GradientWarning]   # células com gradiente excessivo vs. vizinho

    # Diagnóstico do pipeline
    filter_stats:         FilterStats              # contagem de pontos descartados por critério


@dataclass
class CellExtrapolation:
    row_i:  int
    col_j:  int
    rule:   str   # "interpolation_2d" | "rpm400" | "low_map"


@dataclass
class GradientWarning:
    row_i:        int
    col_j:        int
    neighbor_i:   int
    neighbor_j:   int
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
    discarded_outlier:       int   # outliers intra-célula rejeitados na etapa 4
```

---

## 1. Filtragem de pontos

Replica os filtros da aba "Log Refinado" da planilha de referência. Todos os parâmetros são configuráveis pelo usuário (ver [tuning/config.md](tuning/config.md)).

| Parâmetro | Padrão | Condição de descarte | Razão |
|-----------|--------|----------------------|-------|
| `min_clt` | 80 ºC | `CLT < min_clt` | Motor frio → enriquecimento de partida ativo |
| `lambda_loop` | 1 (closed only) | `Lambda Loop ≠ 1` | Loop aberto não tem feedback de lambda confiável para este método |
| `skip_first_closed_loop` | 10 amostras | Primeiros N pontos após entrar em closed loop | ECU demora para estabilizar a correção |
| `skip_first_rpm_bucket` | 0 amostras | Primeiros N pontos após mudar de bucket de RPM | Transiente de RPM |
| `skip_first_map_bucket` | 0 amostras | Primeiros N pontos após mudar de bucket de MAP | Transiente de MAP |
| `max_delta_rpm` | 99999 | `abs(RPM[i] - RPM[i-1]) > max_delta_rpm` | Transiente brusco |
| `max_delta_map` | 99999 | `abs(MAP[i] - MAP[i-1]) > max_delta_map` | Transiente brusco |
| `max_delta_lambda_target` | 0.200 λ | `abs(Lambda1 - LambdaTarget) > max_delta_lambda_target` (em λ real) | Leitura muito fora do alvo = sinal ruidoso ou transiente |
| `max_lambda` | 1.090 λ | `Lambda1 > max_lambda` (em λ real) | Leitura excessivamente pobre = provavelmente inválida |
| `max_delta_pedal` | desabilitado | `abs(Pedal[i] - Pedal[i-1]) > max_delta_pedal` (em %) | Pedal em movimento — mesmo que a posição absoluta pareça estável, uma variação suave ainda é transiente |

> **Nota:** os valores brutos do datalog são convertidos para unidades reais antes de aplicar os filtros (ex.: `Lambda1_real = Lambda1_raw / 1000`). O filtro `max_delta_pedal` requer a coluna de posição do pedal no log; se ausente, o filtro é ignorado silenciosamente.

---

## 2. Snap para breakpoints (RPM Escalonado / MAP Escalonado)

Os breakpoints do mapa — listas de RPM (`#I20`) e MAP (`#I21`) lidos do CSV da ECU — são passados como entrada da engine. A engine nunca assume intervalos fixos; ela usa os breakpoints reais do mapa carregado para encontrar a célula correta para cada ponto do log.

```python
# Entradas obrigatórias da engine (lidas do mapa da ECU):
rpm_breakpoints: list[int]   # ex.: [400, 800, 1200, ..., 6800]
map_breakpoints: list[int]   # ex.: [20, 30, 40, ..., 200]
```

### Algoritmo de snap

Para cada eixo, o snap encontra o breakpoint **mais próximo** usando os valores reais do mapa:

```python
def snap_to_breakpoints(value: float, breakpoints: list[int]) -> int | None:
    """
    Retorna o breakpoint mais próximo de `value`.
    Retorna None se value estiver fora do range do mapa (descarta o ponto).
    """
    if value < breakpoints[0] or value > breakpoints[-1]:
        return None   # fora do range — descartar
    return min(breakpoints, key=lambda bp: abs(bp - value))
```

Aplicação por ponto do log:

```python
rpm_snapped = snap_to_breakpoints(row.rpm, rpm_breakpoints)
map_snapped = snap_to_breakpoints(row.map_kpa, map_breakpoints)

if rpm_snapped is None or map_snapped is None:
    discard(row, reason="fora do range do mapa")
    continue

cell = (map_snapped, rpm_snapped)
```

### Breakpoints como índice, não como valor

Internamente, a engine trabalha com **índices de linha/coluna** na matriz do mapa, não com os valores físicos de RPM/kPa. Os valores físicos são usados apenas para o snap inicial e para a interpolação 2D da etapa 7 (onde as posições relativas dos breakpoints importam).

```python
row_i = map_breakpoints.index(map_snapped)
col_j = rpm_breakpoints.index(rpm_snapped)
cell_index = (row_i, col_j)
```

---

## 3. Cálculo de VE Lambda por ponto

**Esta é a fórmula central do motor de tuning.** Traduz o feedback de lambda diretamente para o espaço de VE do mapa, tornando as correções comparáveis célula a célula com os valores atuais do mapa.

```
VE Lambda = (Lambda1_raw + LambdaCorrecao_raw - LambdaTarget_raw) × VEValue_raw / 1000
```

Onde todos os valores são os **valores brutos** do datalog (sem converter para unidades reais):
- `Lambda1_raw` — lambda medido × 1000 (ex.: λ=1.018 → raw=1018)
- `LambdaCorrecao_raw` — fuel trim raw (ex.: trim=+2% → raw=1020; sem correção → raw=1000)
- `LambdaTarget_raw` — lambda alvo × 1000 (ex.: λ=1.000 → raw=1000)
- `VEValue_raw` — VE × 10 (ex.: VE=59.2% → raw=592)

**Interpretação:**

| Situação | Resultado | Significado |
|----------|-----------|-------------|
| Lambda = target, sem trim | `(target + 1000 - target) × VE / 1000 = VE` | Mapa correto, sem correção necessária |
| Lambda > target (pobre), ECU já corrige com trim negativo | `(lambda + trim - target) × VE / 1000 > VE` | Mapa precisa de mais combustível |
| Lambda < target (rico), ECU já corrige com trim positivo | `(lambda + trim - target) × VE / 1000 < VE` | Mapa precisa de menos combustível |

O VE Lambda representa **o valor que o mapa deveria ter** naquele ponto de operação para atingir exatamente o lambda alvo, já considerando a correção que a ECU está aplicando.

---

## 4. Agregação por célula

Para cada célula `(map_snap, rpm_snap)`, coletar todos os pontos filtrados que caem nela, rejeitar outliers intra-célula e calcular a média resultante.

### 4.1 Rejeição de outliers intra-célula (±2σ)

Antes de calcular a média, amostras muito afastadas do centro da célula são descartadas. Um único transiente não filtrado (ruído de sensor, instabilidade momentânea) não deve distorcer toda a célula.

```python
raw_values = [ve_lambda for each point in this cell]

if len(raw_values) >= 5:   # mínimo para ter significado estatístico
    mean_raw = mean(raw_values)
    std_raw  = std(raw_values)
    sigma    = config.outlier_sigma   # padrão: 2.0
    ve_lambda_values = [v for v in raw_values if abs(v - mean_raw) <= sigma * std_raw]
else:
    ve_lambda_values = raw_values    # poucos pontos: não rejeitar nenhum
```

### 4.2 Cálculo da média e estatísticas

```python
n = len(ve_lambda_values)           # n pós-filtragem de outliers
ve_lambda_avg = mean(ve_lambda_values)
ve_lambda_std = std(ve_lambda_values) if n >= 2 else 0.0
```

Células com `n = 0` não recebem correção automática — ficam marcadas como "sem dados" e são tratadas pela interpolação 2D (etapa 7) e pelo pós-processamento (etapa 10).

---

## 5. Peso de correção e confiança por célula

Esta etapa produz dois valores distintos por célula:

- **`weight`** — usado na fórmula de blending (etapa 6); controla o quanto o log "puxa" o mapa
- **`confidence`** — exibido na UI; combina quantidade de amostras *e* estabilidade da célula

### 5.1 Peso de correção (count_score)

```python
K = config.weight_sample_base   # padrão: 40
count_score = n / (n + K)       # weight para blending
```

Comportamento com `K=40`:
| Amostras (n) | count_score |
|---|---|
| 0 | 0.00 (sem correção) |
| 10 | 0.20 |
| 20 | 0.33 |
| 40 | 0.50 |
| 100 | 0.71 |
| 200 | 0.83 |
| ∞ | 1.00 |

### 5.2 Estabilidade da célula (stability_score)

Uma célula com 50 amostras mas alta dispersão (sensor ruidoso, motor instável naquele ponto) é menos confiável do que 20 amostras consistentes. O coeficiente de variação (CV = desvio padrão / média) quantifica isso.

```python
cv = ve_lambda_std / ve_lambda_avg if ve_lambda_avg > 0 else 0.0

# stability_score: 1.0 quando cv=0 (perfeito), 0.0 quando cv >= cv_threshold
stability_score = max(0.0, 1.0 - cv / config.cv_threshold)
# config.cv_threshold padrão: 0.15  (15% de variação relativa → instável)
```

### 5.3 Confiança combinada

```python
confidence = count_score * 0.7 + stability_score * 0.3
```

A **confiança** é o valor exibido na UI (heatmap de confiança, tooltip). O **count_score** é o que entra na fórmula de blending — uma célula com dados consistentes mas poucos não deve "puxar" o mapa com mais força só porque é estável; ela ainda precisa de mais amostras.

---

## 6. Fator de correção ponderado por célula

Em vez de calcular diretamente o valor novo, o motor opera no **espaço do fator de correção** — uma matriz de multiplicadores que expressa o quanto cada célula precisa ser ajustada. Isso é o que permite propagar correções de forma suave para células sem dados (etapa 7).

```python
# Para cada célula com dados (n > 0):
cf_raw   = ve_lambda_avg / current_map_value   # fator bruto: 1.05 = mapa 5% baixo
cf[map][rpm] = 1 + count_score * (cf_raw - 1)  # suavizado pelo count_score (etapa 5.1)

# Para células sem dados (n = 0):
cf[map][rpm] = None   # a ser preenchido na etapa 7
```

**Equivalência com blending direto:** matematicamente, `round(current × cf)` é idêntico a `round(count_score × ve_lambda_avg + (1 - count_score) × current)` para células com dados. A diferença está nas células sem dados: operar com `cf` permite interpolar o multiplicador antes de aplicá-lo, enquanto o blending direto deixaria essas células inalteradas.

| weight | cf_raw | cf ponderado | efeito |
|--------|--------|-------------|--------|
| 0.0 | qualquer | 1.00 | sem alteração |
| 0.5 | 1.10 | 1.05 | metade da correção |
| 1.0 | 1.10 | 1.10 | correção total |

---

## 7. Interpolação 2D do fator de correção

Este é o mecanismo central de **preservação de forma** e **anti-spike**.

### O problema que resolve

Um motor turbo típico tem dados em duas regiões disjuntas:
- **Cruzeiro**: 2000–3600 RPM × 30–70 kPa
- **WOT**: 3600–6800 RPM × 100–200 kPa

A região **5000 RPM × 100 kPa** não existe no log (o turbo já pressuriza em RPM alto). Se aplicarmos correções apenas nas células com dados, criamos **spikes** nas bordas — uma "parede" abrupta entre células corrigidas e inalteradas.

Além disso, se identificarmos que em **3200 RPM** o motor tem consistentemente +4% de VE em todo range de MAP coberto (40–80 kPa), esse padrão **deve se propagar** para os níveis de MAP não cobertos (90–200 kPa) naquela coluna. Caso contrário, o mapa terá um "buraco" artificial na mesma RPM em MAP alto.

### Solução: interpolar o fator, não os valores

```python
# Células com dados têm cf definido (etapa 6).
# Células sem dados recebem cf = 1.0 (sem alteração) como âncora de contorno.
# Depois: interpolação preenche todas as células None.

data_points = [(map_kpa, rpm, cf_value)
               for (row_i, col_j), cf_value in cf.items() if cf_value is not None
               for map_kpa, rpm in [(map_breakpoints[row_i], rpm_breakpoints[col_j])]]

# Células fora do convex hull dos dados → cf = 1.0 (conservador)
cf_full = interpolate_cf(data_points, map_breakpoints, rpm_breakpoints, fill_value=1.0)
```

> **Por que usar os valores físicos (RPM/kPa) em vez dos índices?**
> Os breakpoints não são uniformemente espaçados — por exemplo, MAP tem espaçamento de 10 kPa abaixo de 120 kPa e 20 kPa acima. Usar índices trataria todos os intervalos como iguais, distorcendo a interpolação. Usar os valores reais de RPM e kPa garante que a interpolação respeita a distância física entre células.

### Por que funciona

| Garantia | Mecanismo |
|----------|-----------|
| **Sem spikes nas bordas** | O cf transita suavemente de ~1.0 (borda, sem dados) até o valor corrigido no centro da zona de dados. Não há salto abrupto. |
| **Preservação de forma** | `new_value = current × cf_interp`. O mapa original já tem a topologia correta (monotonicidade, simetria, padrões por RPM). Multiplicar por um cf suave mantém essas relações. |
| **Propagação de padrões por coluna** | Se 3200 RPM tem cf ≈ 1.04 em MAP 40–80 kPa, a interpolação estende cf ≈ 1.04 para MAP 90–200 kPa na mesma coluna, carregando o padrão para o território não coberto. |
| **Conservadorismo fora dos dados** | O fill_value = 1.0 garante que células muito afastadas de qualquer dado não recebem correção — apenas as bordas do convex hull interpolam suavemente de correto → 1.0. |


## Preservação de forma do mapa (Shape Preservation)

A engine assume que mapas VE representam uma superfície física contínua:

```text
VE = f(RPM, MAP)
```

Portanto regiões sem amostra não devem permanecer invariáveis nem receber apenas interpolação local; elas devem herdar:

1. tendências por RPM;
2. tendências por carga (MAP);
3. inclinações observadas da superfície;
4. desvios globais do motor.

O objetivo é reproduzir o comportamento esperado de um calibrador humano:

> "Se uma região do mapa precisa mais VE e existe continuidade física com regiões adjacentes, o restante da superfície deve acompanhar mantendo o formato original."


### Implementação (Python)

```python
from scipy.interpolate import griddata
import numpy as np

def interpolate_cf(
    data_points: list[tuple[int, int, float]],  # (map_kpa, rpm, cf_value)
    map_breakpoints: list[int],
    rpm_breakpoints: list[int],
    fill_value: float = 1.0,
) -> np.ndarray:
    """
    Retorna matriz (n_map × n_rpm) com cf interpolado para todas as células.
    Usa os valores físicos de kPa e RPM como coordenadas para respeitar
    o espaçamento real entre breakpoints.
    """
    map_kpas, rpms, values = zip(*data_points)
    points = np.column_stack([map_kpas, rpms])

    # Grade de destino usando os breakpoints reais do mapa
    grid_map, grid_rpm = np.meshgrid(map_breakpoints, rpm_breakpoints, indexing='ij')

    cf_interp = griddata(points, values, (grid_map, grid_rpm),
                         method='linear', fill_value=fill_value)
    return cf_interp  # shape: (n_map, n_rpm)
```

---

# 8. Extração de tendências estruturais (Shape Propagation)

A interpolação local (etapa 7) evita descontinuidades, porém não preserva padrões globais do motor quando regiões inteiras do mapa não possuem amostras.

Exemplos:

```text
3000RPM × 30kPa → -8%
3000RPM ×130kPa → +2%
```

ou:

```text
2000RPM ×60kPa → 0%
2400RPM ×60kPa → -10%
3000RPM ×60kPa → +1%
```

Nestes casos existe informação sobre a **inclinação da superfície VE**, mesmo sem cobertura completa.

A engine passa então a modelar três componentes adicionais:

---

## 8.1 Tendência por RPM (rpm_cf)

Representa quanto determinada coluna tende a corrigir independentemente da carga.

```python
rpm_cf[col_j] =
weighted_mean(
    cf[row_i][col_j]
    for todas células válidas da coluna
)
```

Peso:

```python
weight =
sample_count *
confidence
```

Resultado:

```text
2000RPM → 1.00
2400RPM → 0.90
3000RPM → 1.01
```

---

## 8.2 Tendência por MAP (map_cf)

Representa tendência da correção conforme carga do motor.

```python
map_cf[row_i] =
weighted_mean(
    cf[row_i][col_j]
    para todas células válidas da linha
)
```

Exemplo:

```text
30kPa → 0.92
130kPa → 1.02
```

---

## 8.3 Gradiente local (slope propagation)

Em vez de considerar apenas o valor absoluto da correção, modelar também sua variação ao longo dos eixos.

Gradiente RPM:

```python
rpm_gradient =
(cf2 - cf1) /
(rpm2 - rpm1)
```

Gradiente MAP:

```python
map_gradient =
(cf2 - cf1) /
(map2 - map1)
```

Exemplo:

Dados:

```text
3000RPM ×30kPa  → -8%
3000RPM ×130kPa → +2%
```

Gradiente:

```text
(+10%) / (100kPa)

=
0.10% por kPa
```

Permite estimar:

```text
3000RPM ×180kPa

≈ +7%
```

mesmo sem amostra.

---

## 8.4 Campo estrutural previsto

Combinar tendências:

```python
cf_structural =
rpm_cf[col]^α *
map_cf[row]^β *
gradient_cf^(1-α-β)
```

Valores sugeridos:

```python
alpha = 0.50
beta  = 0.30
gradient_weight = 0.20
```

Configuração:

```python
shape_rpm_weight      = 0.50
shape_map_weight      = 0.30
shape_gradient_weight = 0.20
```

---

# 9. Composição do fator final

O fator aplicado ao mapa deixa de ser apenas interpolação local.

Antes:

```python
cf_final =
cf_interp
```

Novo:

```python
cf_final =
(
cf_interp^w_local
*
cf_structural^w_shape
*
cf_global^w_global
)
```

Onde:

---

### Componente local

Correção derivada diretamente das células medidas.

```python
w_local =
confidence
```

Maior confiança → maior peso.

---

### Componente estrutural

Propaga comportamento da superfície VE.

```python
w_shape =
1 - confidence
```

Regiões sem dado:

```text
confidence → 0

=> estrutura domina
```

---

### Componente global

Corrige desvios uniformes do mapa inteiro.

Útil quando:

* troca de injetores
* mudança de combustível
* erro global de VE

```python
cf_global =
weighted_mean(
todos cf observados
)
```

Peso pequeno:

```python
global_shape_weight = 0.10
```

---

### Fórmula final sugerida

```python
cf_final =
(
cf_interp^confidence
*
cf_structural^(1-confidence)
*
cf_global^0.10
)
```

ou equivalente em blending linear:

```python
cf_final =
1
+
confidence*(cf_interp-1)
+
shape_weight*(cf_structural-1)
+
global_weight*(cf_global-1)
```

---

## 10. Aplicação do fator ao mapa

```python
for row_i, map_kpa in enumerate(map_breakpoints):
    for col_j, rpm in enumerate(rpm_breakpoints):
        cf = cf_full[row_i][col_j]
        current = current_map[row_i][col_j]
        new_value = round(current * cf)
        correction_pct = (cf - 1) * 100

        # Indicador de convergência (apenas para células com dados reais)
        if sample_count[row_i][col_j] > 0:
            residual_pct = abs(ve_lambda_avg_map[row_i][col_j] - new_value) / new_value * 100
            converged[row_i][col_j] = residual_pct < config.convergence_threshold
            # config.convergence_threshold padrão: 5.0 (%)
```

O `residual_pct` mede quanto o mapa ainda precisa evoluir nessa célula: com weight baixo (poucos dados), o `new_value` fica próximo do `current` e o residual pode ser alto — indicando que mais rodadas são necessárias. Com weight alto e log consistente, o residual converge para zero.

---

## 11. Aplicação de limites absolutos

```python
# Limite de correção máxima por rodada (segurança)
if abs(correction_pct) > config.max_correction_pct:
    clamped_cf = 1 + (config.max_correction_pct / 100) * sign(correction_pct)
    new_value   = round(current_map_value * clamped_cf)

# Hard limits do mapa (definidos em master/map.md)
new_value = max(100, min(9999, new_value))
```

---

## 10. Pós-processamento

Após a aplicação do fator interpolado, regras específicas do motor e verificações de consistência são aplicadas como ajuste final. Estas regras tratam casos que a interpolação não cobre (coluna de RPM fisicamente impossível, linha de MAP sem dados em nenhum log).

### 10.1 RPM 400 (coluna de idle instável)

> "400 RPM é onde o motor não se sustenta. Usar coluna de 800 RPM menos 4-5%."

A coluna de 400 RPM raramente tem dados — o motor não permanece nessa rotação. A interpolação usaria 800 RPM como vizinho, mas o comportamento físico nesse ponto é singular. Sobrescrever explicitamente:

```python
if config.rpm400_rule_enabled:
    for row_i in range(n_map):
        col_800 = suggested_map[row_i][idx_rpm_800]
        suggested_map[row_i][idx_rpm_400] = round(col_800 * (1 - config.rpm400_discount))
        # config.rpm400_discount padrão: 0.045 (4.5%)
```

### 10.2 MAP muito baixo sem dados (ex.: 20 kPa)

> "Se não houver dado, pegar a linha seguinte e tirar 2-3%."

Para linhas de MAP muito baixo (tipicamente 20 kPa) sem nenhuma amostra em nenhuma coluna, extrapolar a partir da linha imediatamente superior. A interpolação pode não cobrir esse caso quando a linha inteira está fora do convex hull dos dados.

```python
if config.low_map_rule_enabled:
    for row_i, map_kpa in enumerate(map_breakpoints):
        if map_kpa <= config.low_map_threshold and sample_count_row[row_i] == 0:
            next_row = row_i + 1   # linha de MAP imediatamente superior
            for col_j in range(n_rpm):
                suggested_map[row_i][col_j] = round(
                    suggested_map[next_row][col_j] * (1 - config.low_map_discount)
                )
        # config.low_map_threshold padrão: 20 kPa
        # config.low_map_discount padrão: 0.025 (2.5%)
```

### 10.3 Verificação de monotonicidade MAP

Para um motor turbo em regime normal, a VE aumenta monotonicamente com a pressão de admissão. A interpolação do fator de correção preserva a topologia do mapa original — se o mapa já era monótono, continuará sendo após a aplicação. Porém, verificar explicitamente e sinalizar violações:

```python
for col_j in range(n_rpm):
    for row_i in range(1, n_map):
        map_kpa = map_breakpoints[row_i]
        if map_kpa < 40:
            continue   # exceção: abaixo de 40 kPa o comportamento pode inverter
        if suggested_map[row_i][col_j] < suggested_map[row_i - 1][col_j]:
            emit_warning(row_i, col_j, "monotonicidade MAP violada")
```

A UI exibe violações como warnings — **não corrige automaticamente**. O usuário decide se suaviza ou mantém (pode ser um comportamento genuíno do motor).

### 10.4 Verificação de gradiente entre vizinhos

Além da monotonicidade (direção), verificar a **magnitude** da diferença entre células adjacentes. Um spike isolado — uma célula muito discrepante das suas vizinhas — indica dado ruim que escapou dos filtros ou descontinuidade física improvável.

```python
for row_i in range(n_map):
    for col_j in range(n_rpm):
        current_val = suggested_map[row_i][col_j]

        for (ni, nj) in [(row_i-1, col_j), (row_i+1, col_j),
                         (row_i, col_j-1), (row_i, col_j+1)]:
            if 0 <= ni < n_map and 0 <= nj < n_rpm:
                neighbor_val = suggested_map[ni][nj]
                gradient_pct = abs(current_val - neighbor_val) / neighbor_val * 100
                if gradient_pct > config.max_adjacent_gradient_pct:
                    emit_warning(row_i, col_j, f"gradiente {gradient_pct:.1f}% vs vizinho ({ni},{nj})")
        # config.max_adjacent_gradient_pct padrão: 20 (%)
```

Assim como a monotonicidade, gradientes excessivos são **warnings**, não correções automáticas. A UI deve destacar visualmente as células afetadas para que o usuário avalie se é um comportamento real do motor ou um artefato.

---

## 11. Configuração padrão

```python
TuningConfig(
    # Filtros de dados
    min_clt=80,
    lambda_loop_closed_only=True,
    skip_first_closed_loop=10,
    skip_first_rpm_bucket=0,
    skip_first_map_bucket=0,
    max_delta_rpm=99999,
    max_delta_map=99999,
    max_delta_lambda_target=0.200,
    max_lambda=1.090,
    max_delta_pedal=None,          # % entre amostras; None = desabilitado

    # Qualidade por célula
    outlier_sigma=2.0,             # rejeita amostras > N×std da média da célula
    cv_threshold=0.15,             # CV > 15% → stability_score começa a cair

    # Correção
    weight_sample_base=40,         # K na fórmula count_score = n / (n + K)
    max_correction_pct=15,

    # Convergência
    convergence_threshold=5.0,     # % de residual abaixo do qual a célula é "convergida"

    # Pós-processamento
    rpm400_rule_enabled=True,
    rpm400_discount=0.045,
    low_map_rule_enabled=True,
    low_map_threshold=20,
    low_map_discount=0.025,
    max_adjacent_gradient_pct=20,  # % máximo entre células vizinhas (warning)
)
```

---

## 12. Iteratividade

O motor é projetado para uso iterativo:

1. Usuário roda o carro, captura datalog
2. Sobe o log, roda o auto-tuning, revisa o mapa sugerido
3. Aplica as correções (total ou apenas células confiantes)
4. Exporta o mapa, sobe na ECU
5. Roda o carro novamente, captura novo log
6. Repete — cada iteração reduz os desvios residuais

Após cada rodada, o `ve_lambda_map` deve convergir para os valores do mapa atual, indicando que o mapa está correto.
