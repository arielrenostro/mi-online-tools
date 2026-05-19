# Tipos TypeScript Compartilhados

Definições completas de todos os tipos compartilhados entre stores, componentes e a camada de API. Todos os arquivos ficam em `src/types/`. Os tipos em `camelCase` — a conversão de snake_case do backend acontece na camada `api/`, não aqui.

---

## `types/map.ts` — Tipos de mapa

```typescript
// src/types/map.ts

/**
 * Modelo completo do mapa retornado pelo backend após o parsing do CSV.
 * Fonte de verdade imutável — o usuário edita apenas uma cópia em `editableMap`.
 */
export interface MapModel {
  /** Nome do arquivo CSV original (ex.: "4bar - 1.csv") */
  name:            string

  /** Breakpoints de RPM lidos do campo #I20 do CSV.
   *  Ex.: [400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6200, 6800]
   *  Tamanho: número de colunas da tabela (n_rpm). */
  rpmBreakpoints:  number[]

  /** Breakpoints de MAP (kPa) lidos do campo #I21 do CSV.
   *  Ex.: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200]
   *  Tamanho: número de linhas da tabela (n_map). */
  mapBreakpoints:  number[]

  /** Valores das células: cells[map_i][rpm_j] = valor raw (100–9999).
   *  Índice 0 = menor MAP; índice (n_map-1) = maior MAP. Mesma convenção do backend.
   *  Shape: (n_map × n_rpm). */
  cells:           number[][]
}

/**
 * Tipo utilitário para identificar o tipo de mapa da ECU.
 * Espelha o enum MapType do backend (engines/ve_lambda/engine.py).
 */
export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
```

---

## `types/datalog.ts` — Tipos de datalog

```typescript
// src/types/datalog.ts

/**
 * Uma linha do datalog já convertida para unidades reais pelo backend.
 * O frontend nunca recebe valores raw de lambda, RPM, MAP etc. — apenas valores reais.
 * A única exceção é `veValueRaw`, que é mantido em formato raw porque a fórmula
 * VE Lambda opera nessa escala (igual ao mapa da ECU).
 */
export interface DatalogRow {
  /** Tempo em milissegundos relativo ao início do log. */
  timestamp_ms:    number

  /** RPM — rotações por minuto. */
  rpm:             number

  /** Pressão no coletor de admissão em kPa. */
  mapKpa:          number

  /** Lambda medido (sensor wideband). Ex.: 0.998 = levemente rico. */
  lambda1:         number

  /** Fuel trim da ECU como multiplicador. Sem correção = 1.000; +2% = 1.020. */
  lambdaCorrecao:  number

  /** Lambda alvo configurado na ECU. Ex.: 1.000 = estequiométrico. */
  lambdaTarget:    number

  /** VE em unidades raw do mapa (VE% × 10). Ex.: 59.2% → 592.
   *  Mantido em raw para compatibilidade direta com os valores do mapa da ECU. */
  veValueRaw:      number

  /** Temperatura do motor em graus Celsius (CLT = Coolant Temperature). */
  clt:             number

  /** Estado do loop lambda: 0 = open loop, 1 = closed loop. */
  lambdaLoop:      0 | 1

  /** Posição do pedal em percentual (0–100). null se a coluna não existir no CSV. */
  pedal:           number | null
}

/**
 * Modelo completo de um datalog retornado pelo backend após parsing.
 * Inclui todas as linhas, metadados e a lista de sinais disponíveis.
 */
export interface DatalogModel {
  /** Hash SHA-1 do arquivo CSV original. Formato: "sha1:<hexdigest>".
   *  Persiste entre sessões — identifica o log de forma estável independente do backend. */
  hash:         string

  /** Nome do arquivo CSV original. */
  filename:     string

  /** Todas as linhas do datalog, em ordem cronológica. */
  rows:         DatalogRow[]

  /** Duração total do log em milissegundos. */
  duration_ms:  number

  /** Nomes dos sinais (colunas) disponíveis neste log.
   *  Ex.: ["RPM", "MAP", "Lambda 1", "Lambda Target", "CLT", "Pedal", "VE"]
   *  Usado para popular seletores de sinal nos gráficos e na sparkline. */
  signals:      string[]
}

/**
 * Entrada de log no store — agrega metadados de UI ao DatalogModel.
 */
export interface LogEntry {
  /** Hash SHA-1 do arquivo CSV. Formato: "sha1:<hexdigest>".
   *  Identificador estável — não muda entre sessões nem após restore. */
  hash:        string

  /** Nome do arquivo original. */
  filename:    string

  /** Modelo completo com todas as linhas. */
  model:       DatalogModel

  /** Se true, este log está incluído na sessão ativa (TimeRail, auto-tuning, etc.).
   *  Se false, está carregado mas excluído temporariamente. */
  enabled:     boolean

  /** Duração em ms — cache de model.duration_ms para evitar acessos ao objeto model. */
  duration_ms: number
}

/**
 * Versão reduzida de um LogEntry para passar ao componente TimeRail.
 * Evita passar o modelo completo (com centenas de miles de linhas) para componentes de UI.
 */
export interface ActiveLog {
  hash:        string
  filename:    string
  duration_ms: number
  enabled:     boolean
}

/**
 * Seleção de intervalo de tempo no TimeRail.
 * Ambos os valores são em milissegundos relativos ao início do primeiro log ativo.
 */
export interface TimeSelection {
  start_ms: number
  end_ms:   number
}
```

---

## `types/engine.ts` — Tipos de motor de tuning

```typescript
// src/types/engine.ts

/**
 * Tipo de mapa que um engine sabe corrigir.
 */
export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'

/**
 * Informações de um motor de tuning registrado no backend.
 * Retornado por GET /api/engines e GET /api/engines/{id}.
 */
export interface EngineInfo {
  /** Identificador único e estável. Ex.: "ve_lambda". Usado em TuningRunRequest. */
  engineId:       string

  /** Nome legível para exibição. Ex.: "VE Lambda Tuning". */
  name:           string

  /** Explicação detalhada do algoritmo. Exibida no TuningConfigModal. */
  description:    string

  /** O que o engine tenta otimizar. Ex.: "Corrigir o mapa de VE...". */
  objective:      string

  /** Qual tipo de mapa este engine corrige. */
  targetMapType:  MapType

  /** Configuração padrão como objeto. Usado para inicializar o formulário. */
  defaultConfig:  Record<string, unknown>

  /** JSON Schema da configuração — usado para renderizar dinamicamente o modal.
   *  Ver tipo JSONSchema abaixo para a estrutura esperada. */
  configSchema:   JSONSchema
}

/**
 * Subconjunto do JSON Schema 7 relevante para a renderização do TuningConfigModal.
 * O modal suporta tipos: number, integer, boolean, string (com enum).
 */
export interface JSONSchema {
  $schema?:     string
  type:         'object'
  title?:       string
  description?: string
  properties:   Record<string, JSONSchemaProperty>
  required?:    string[]
}

export interface JSONSchemaProperty {
  type:         'number' | 'integer' | 'boolean' | 'string'
  title?:       string           // label do campo no formulário
  description?: string          // texto de ajuda abaixo do campo
  default?:     unknown         // valor padrão
  minimum?:     number          // validação de range mínimo
  maximum?:     number          // validação de range máximo
  enum?:        unknown[]       // valores possíveis (para selects)
  nullable?:    boolean         // se o campo aceita null (ex.: max_delta_pedal)
}
```

---

## `types/tuning.ts` — Tipos de tuning

### `TuningConfig`

Parâmetros configuráveis do motor de tuning. Espelha o dataclass `TuningConfig` do backend (`engines/ve_lambda/config.py`). Todos os campos têm defaults documentados como comentários.

```typescript
// src/types/tuning.ts

export interface TuningConfig {
  // ── Filtros de dados ──────────────────────────────────────────────────────
  /** Temperatura mínima do motor para incluir o ponto. Default: 80 (ºC) */
  min_clt:                    number

  /** Se true, descarta pontos em open loop (lambda_loop = 0). Default: true */
  lambda_loop_closed_only:    boolean

  /** Descarta os primeiros N pontos após entrar em closed loop. Default: 10 */
  skip_first_closed_loop:     number

  /** Descarta os primeiros N pontos após mudar de bucket de RPM. Default: 0 */
  skip_first_rpm_bucket:      number

  /** Descarta os primeiros N pontos após mudar de bucket de MAP. Default: 0 */
  skip_first_map_bucket:      number

  /** Descarta pontos onde abs(RPM[i] - RPM[i-1]) > valor. Default: 99999 (desabilitado) */
  max_delta_rpm:              number

  /** Descarta pontos onde abs(MAP[i] - MAP[i-1]) > valor (kPa). Default: 99999 (desabilitado) */
  max_delta_map:              number

  /** Descarta pontos onde abs(lambda1 - lambdaTarget) > valor (λ real). Default: 0.200 */
  max_delta_lambda_target:    number

  /** Descarta pontos com lambda1 > valor (λ real). Default: 1.090 */
  max_lambda:                 number

  /** Descarta pontos onde abs(pedal[i] - pedal[i-1]) > valor (%).
   *  null = desabilitado (quando coluna ausente no log ou usuário não quer filtrar). Default: null */
  max_delta_pedal:            number | null

  // ── Qualidade por célula ──────────────────────────────────────────────────
  /** Limiar para rejeição de outliers intra-célula: |v - mean| > sigma × std → descarta.
   *  Default: 2.0 */
  outlier_sigma:              number

  /** Coeficiente de variação máximo aceito para stability_score = 1.
   *  cv >= cv_threshold → stability_score cai linearmente para 0. Default: 0.15 (15%) */
  cv_threshold:               number

  // ── Correção ──────────────────────────────────────────────────────────────
  /** Parâmetro K na fórmula count_score = n / (n + K).
   *  K=40: 40 amostras → peso 0.5; 200 amostras → peso 0.83. Default: 40 */
  weight_sample_base:         number

  /** Correção máxima por iteração por célula (%). Células que precisariam de mais
   *  são clampeadas. Evita correções drásticas em uma única rodada. Default: 15.0 */
  max_correction_pct:         number

  // ── Convergência ─────────────────────────────────────────────────────────
  /** Percentual residual abaixo do qual a célula é considerada "convergida".
   *  residual = abs(ve_lambda_avg - new_value) / new_value × 100. Default: 5.0 */
  convergence_threshold:      number

  // ── Pós-processamento ─────────────────────────────────────────────────────
  /** Aplica a regra da coluna RPM 400: val_400 = val_800 × (1 - rpm400_discount). Default: true */
  rpm400_rule_enabled:        boolean

  /** Desconto aplicado sobre a coluna 800 RPM para calcular os valores de 400 RPM.
   *  Ex.: 0.045 = 4.5%. Default: 0.045 */
  rpm400_discount:            number

  /** Aplica a regra para linhas de MAP muito baixo sem dados: usa a linha superior
   *  com um desconto. Default: true */
  low_map_rule_enabled:       boolean

  /** Linhas de MAP até este valor (kPa) sem dados usam a linha superior como base.
   *  Default: 20 (kPa) */
  low_map_threshold:          number

  /** Desconto aplicado sobre a linha de MAP superior para linhas sem dados.
   *  Ex.: 0.025 = 2.5%. Default: 0.025 */
  low_map_discount:           number

  /** Percentual máximo de diferença entre células vizinhas antes de emitir warning.
   *  Não corrige — apenas sinaliza. Default: 20.0 */
  max_adjacent_gradient_pct:  number
}

/**
 * Configuração padrão — use como base para inicializar o store e o formulário.
 * Espelha os defaults do backend (engines/ve_lambda/config.py).
 */
export const DEFAULT_TUNING_CONFIG: TuningConfig = {
  min_clt:                    80,
  lambda_loop_closed_only:    true,
  skip_first_closed_loop:     10,
  skip_first_rpm_bucket:      0,
  skip_first_map_bucket:      0,
  max_delta_rpm:              99999,
  max_delta_map:              99999,
  max_delta_lambda_target:    0.200,
  max_lambda:                 1.090,
  max_delta_pedal:            null,
  outlier_sigma:              2.0,
  cv_threshold:               0.15,
  weight_sample_base:         40,
  max_correction_pct:         15.0,
  convergence_threshold:      5.0,
  rpm400_rule_enabled:        true,
  rpm400_discount:            0.045,
  low_map_rule_enabled:       true,
  low_map_threshold:          20,
  low_map_discount:           0.025,
  max_adjacent_gradient_pct:  20.0,
}
```

### `TuningRunRequest`

```typescript
/**
 * Corpo da requisição POST /api/tuning/run.
 */
export interface TuningRunRequest {
  /** ID do engine de tuning a executar. Ex.: "ve_lambda". */
  engineId:        string

  /** Breakpoints de RPM do mapa atual (ascending). */
  rpmBreakpoints:  number[]

  /** Breakpoints de MAP (kPa) do mapa atual (ascending). */
  mapBreakpoints:  number[]

  /** Células do mapa editável: cells[map_i][rpm_j] = valor raw (100–9999). Índice 0 = menor MAP. */
  cells:           number[][]

  /** Hashes SHA-1 dos logs a incluir na análise (apenas logs com enabled=true).
   *  Formato: ["sha1:<hex>", ...]. O backend localiza os datalogs em disco por hash.
   *  Os logs são enviados ao backend em logStore.ensureLogsOnBackend() antes desta chamada. */
  logHashes:       string[]

  /** Intervalo de tempo para análise. Se null, usa todos os pontos de todos os logs. */
  timeRange:       TimeSelection | null

  /** Configuração de parâmetros do engine. */
  config:          TuningConfig
}
```

### `TuningOutput`

```typescript
/**
 * Resultado completo retornado pelo engine de tuning.
 * Todas as matrizes têm a mesma shape do mapa: (n_map × n_rpm).
 */
export interface TuningOutput {
  /** Mapa sugerido — valores raw prontos para upload na ECU (100–9999). */
  suggestedMap:          number[][]

  /** VE Lambda médio por célula (pós-rejeição de outliers). null = sem dados. */
  veLambdaMap:           (number | null)[][]

  /** Número de amostras por célula após rejeição de outliers. */
  sampleCountMap:        number[][]

  /** Correção aplicada em cada célula, em %. Positivo = mapa aumentou. */
  correctionPctMap:      number[][]

  /** Fator de correção interpolado (1.0 = sem alteração, 1.05 = +5%). */
  cfMap:                 number[][]

  /** Confiança combinada por célula (0–1). null = sem dados.
   *  confidence = count_score × 0.7 + stability_score × 0.3 */
  confidenceMap:         (number | null)[][]

  /** Coeficiente de variação por célula. null = sem dados.
   *  cv = std / mean. Valores altos indicam célula ruidosa ou instável. */
  cvMap:                 (number | null)[][]

  /** Se a célula convergiu: residual < convergence_threshold. null = sem dados. */
  convergenceMap:        (boolean | null)[][]

  /** Células sem nenhuma amostra após filtragem. Coordenadas [row_i, col_j]. */
  cellsNoData:           [number, number][]

  /** Células preenchidas por extrapolação (não por dados reais do log). */
  cellsExtrapolated:     CellExtrapolation[]

  /** Células onde a monotonicidade MAP foi violada. Coordenadas [row_i, col_j]. */
  monotonicityWarnings:  [number, number][]

  /** Células com gradiente excessivo em relação a algum vizinho. */
  gradientWarnings:      GradientWarning[]

  /** Diagnóstico completo do pipeline de filtragem. */
  filterStats:           FilterStats
}

/**
 * Célula preenchida por uma regra de extrapolação, não por dados reais.
 */
export interface CellExtrapolation {
  /** Índice de linha (dimensão MAP). */
  rowI:  number

  /** Índice de coluna (dimensão RPM). */
  colJ:  number

  /** Qual regra preencheu a célula.
   *  "interpolation_2d" = scipy.griddata
   *  "rpm400" = coluna 400 RPM calculada a partir de 800 RPM
   *  "low_map" = linha de MAP baixo calculada a partir da linha superior */
  rule:  'interpolation_2d' | 'rpm400' | 'low_map'
}

/**
 * Warning de gradiente excessivo entre célula e um vizinho imediato.
 */
export interface GradientWarning {
  rowI:        number
  colJ:        number
  neighborI:   number
  neighborJ:   number
  /** Percentual de diferença: abs(val - neighbor) / neighbor × 100. */
  gradientPct: number
}

/**
 * Estatísticas de filtragem do pipeline — quantos pontos passaram e por que cada
 * grupo foi descartado.
 */
export interface FilterStats {
  /** Total de linhas lidas de todos os logs combinados. */
  totalRows:             number

  /** Linhas que passaram todos os filtros e foram usadas na análise. */
  passed:                number

  /** Descartadas por CLT < min_clt. */
  discardedClt:          number

  /** Descartadas por lambda_loop = 0 (open loop). */
  discardedOpenLoop:     number

  /** Descartadas por estar nos primeiros N pontos após entrar em closed loop. */
  discardedSkipCl:       number

  /** Descartadas por estar nos primeiros N pontos após mudar de bucket de RPM. */
  discardedSkipRpmBkt:   number

  /** Descartadas por estar nos primeiros N pontos após mudar de bucket de MAP. */
  discardedSkipMapBkt:   number

  /** Descartadas por delta de RPM excessivo entre amostras consecutivas. */
  discardedDeltaRpm:     number

  /** Descartadas por delta de MAP excessivo entre amostras consecutivas. */
  discardedDeltaMap:     number

  /** Descartadas por abs(lambda1 - lambdaTarget) > max_delta_lambda_target. */
  discardedDeltaLambda:  number

  /** Descartadas por lambda1 > max_lambda. */
  discardedMaxLambda:    number

  /** Descartadas por delta de pedal excessivo. 0 se max_delta_pedal = null. */
  discardedDeltaPedal:   number

  /** Descartadas por RPM ou MAP fora do range do mapa (snap retornou null). */
  discardedOutOfRange:   number

  /** Amostras rejeitadas como outliers intra-célula (etapa 4 do pipeline). */
  discardedOutlier:      number
}
```

---

## `types/ui.ts` — Tipos de UI

### `ChartLayout`

Representa a estrutura em árvore do layout de painéis na aba Gráficos. Cada nó é ou um painel folha ou um nó de divisão com filhos.

```typescript
// src/types/ui.ts

/**
 * Nó folha — um painel de gráfico com sinais configurados.
 */
export interface ChartPanel {
  type:    'panel'
  panelId: string          // UUID gerado no frontend — identifica o painel de forma estável
  signals: string[]        // lista de nomes de sinais exibidos neste painel
                           // Ex.: ["RPM", "MAP"] ou ["Lambda 1", "λ Target"]
}

/**
 * Nó de divisão — dois ou mais filhos dispostos horizontal ou verticalmente.
 */
export interface ChartSplit {
  type:      'split'
  direction: 'horizontal' | 'vertical'
                           // 'horizontal' = filhos lado a lado (dividir ↔)
                           // 'vertical'   = filhos empilhados (dividir ↕)
  children:  ChartLayout[] // pelo menos 2 filhos; nunca vazio
}

/**
 * Um nó no layout de gráficos — pode ser painel folha ou divisão.
 * Estrutura em árvore: a raiz pode ser qualquer tipo.
 *
 * Exemplo de layout com 3 painéis (A e B lado a lado, C embaixo):
 * {
 *   type: 'split', direction: 'vertical', children: [
 *     { type: 'split', direction: 'horizontal', children: [
 *       { type: 'panel', panelId: 'A', signals: ['RPM', 'MAP'] },
 *       { type: 'panel', panelId: 'B', signals: ['Lambda 1'] },
 *     ]},
 *     { type: 'panel', panelId: 'C', signals: ['CLT'] },
 *   ]
 * }
 */
export type ChartLayout = ChartPanel | ChartSplit
```

### Outros tipos de UI

```typescript
/**
 * Escala de cor para o HeatmapTable.
 */
export type ColorScale =
  | 'warm'         // azul → verde → amarelo → vermelho (mapas de VE, ignição, lambda)
  | 'diverging'    // azul (negativo) → branco (zero) → vermelho (positivo)
  | 'confidence'   // vermelho (0) → amarelo → verde (1) — confiança e CV
  | 'coverage'     // cinza (0) → azul saturado (N ≥ 100) — contagem de amostras
  | 'convergence'  // cinza (null) | amarelo (false) | verde (true)

/**
 * Modo ativo de heatmap na seção de Análise da aba VE.
 */
export type TuningAnalysisMode =
  | 've_lambda'    // VE Lambda médio por célula
  | 'samples'      // Contagem de amostras
  | 'confidence'   // Confiança combinada
  | 'cv'           // Coeficiente de variação
  | 'correction'   // Correção aplicada em %
  | 'convergence'  // Status de convergência

/**
 * Aba ativa no Datalog.
 */
export type DatalogTab = 'dashboard' | 'charts' | 'data'

/**
 * Série de sinais para o SyncedChart.
 * Cada série representa um sinal ao longo do tempo.
 */
export interface SignalSeries {
  /** Nome do sinal — coincide com os nomes em DatalogModel.signals. */
  name:  string

  /** Pares [timestamp_ms, valor]. Já ordenados por timestamp_ms. */
  data:  [number, number][]

  /** Cor em formato CSS. Se não fornecida, o componente escolhe automaticamente. */
  color?: string
}

/**
 * Ponto de scatter para overlay no MapChart.
 * Representa uma amostra do datalog posicionada no espaço RPM × MAP.
 */
export interface ScatterPoint {
  rpm:    number
  mapKpa: number
  /** Peso visual (0–1): controla tamanho ou opacidade do ponto.
   *  Derivado da densidade de amostras na célula. */
  weight?: number
}

/**
 * Conteúdo do tooltip exibido ao hover nas células do HeatmapTable.
 * Sempre exibe todos os campos disponíveis, independente do modo ativo.
 */
export interface TooltipContent {
  rpm:         number
  mapKpa:      number
  /** Valor atual no mapa editável (raw, 100–9999). */
  currentValue: number
  /** Campos adicionais exibidos quando TuningOutput está disponível. */
  tuning?: {
    veLambda:    number | null
    samples:     number
    confidence:  number | null
    cv:          number | null
    correction:  number        // %
    converged:   boolean | null
    residual?:   number        // % — exibido no tooltip de convergência
  }
}

/**
 * Estado completo de UI armazenado no useUIStore e persistido em localStorage.
 */
export interface UIState {
  /** Se o painel "Mapa Original" está colapsado na aba VE. Default: false */
  originalMapCollapsed: boolean

  /** Heatmap ativo na seção de Análise. Default: 've_lambda' */
  tuningAnalysisMode:   TuningAnalysisMode

  /** Aba ativa no Datalog. Default: 'dashboard' */
  datalogTab:           DatalogTab

  /** Visibilidade de colunas na aba Dados. Record<signalName, isVisible>.
   *  Ausência de uma chave = visível por padrão. */
  columnVisibility:     Record<string, boolean>

  /** Layout de painéis na aba Gráficos.
   *  Valor inicial: um único painel com signal ['RPM']. */
  chartLayout:          ChartLayout
}
```

---

## Tipos de `TimeSelection` — reutilizado de `types/datalog.ts`

O tipo `TimeSelection` é definido em `types/datalog.ts` e reutilizado em `types/tuning.ts` (para `TuningRunRequest.timeRange`) e em `useTimeStore`. Não duplicar.

```typescript
// Importar de types/datalog.ts onde necessário:
import type { TimeSelection } from '@/types/datalog'
```

---

## Resumo de localização dos arquivos

| Arquivo | Conteúdo |
|---------|----------|
| `src/types/map.ts` | `MapModel`, `MapType` |
| `src/types/datalog.ts` | `DatalogRow`, `DatalogModel`, `LogEntry`, `ActiveLog`, `TimeSelection` |
| `src/types/engine.ts` | `EngineInfo`, `JSONSchema`, `JSONSchemaProperty` |
| `src/types/tuning.ts` | `TuningConfig`, `DEFAULT_TUNING_CONFIG`, `TuningRunRequest`, `TuningOutput`, `CellExtrapolation`, `GradientWarning`, `FilterStats` |
| `src/types/ui.ts` | `ChartLayout`, `ChartPanel`, `ChartSplit`, `ColorScale`, `TuningAnalysisMode`, `DatalogTab`, `SignalSeries`, `ScatterPoint`, `TooltipContent`, `UIState` |
