# Tipos TypeScript Compartilhados

Tipos compartilhados entre stores, componentes e a camada API. Ficam em `src/types/`. Sempre `camelCase` — a conversão de snake_case acontece na camada `api/`.

## `types/map.ts`

```typescript
/** Modelo do mapa após parsing do CSV. Fonte de verdade imutável; o usuário edita só `editableMap`. */
export interface MapModel {
  name:            string      // nome do CSV original
  rpmBreakpoints:  number[]    // #I20; tamanho = n_rpm (colunas)
  mapBreakpoints:  number[]    // #I21 (kPa); tamanho = n_map (linhas)
  cells:           number[][]  // VE (#F01–#F16); cells[map_i][rpm_j] = raw 100–9999; índice 0 = menor MAP
  ignitionCells:   number[][]  // Ignição (#I01–#I16); mesma grade; inteiros 0–100
  lambdaCells:     number[][]  // Lambda alvo (#A01–#A16); mesma grade; inteiros 0–2000
  rawLines:        string[]    // todas as linhas originais do CSV, em ordem (reuso na exportação)
}

/** Espelha o enum MapType do backend (engines/ve_lambda/engine.py). */
export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
```

## `types/datalog.ts`

```typescript
/** Linha do datalog convertida para unidades reais. Exceção: veValueRaw fica em raw
 *  (a fórmula VE Lambda opera nessa escala, igual ao mapa da ECU). */
export interface DatalogRow {
  timestamp_ms:    number       // ms relativo ao início do log
  rpm:             number
  mapKpa:          number       // kPa
  lambda1:         number       // lambda medido (wideband). Ex: 0.998
  lambdaCorrecao:  number       // fuel trim como multiplicador. Sem correção=1.000; +2%=1.020
  lambdaTarget:    number       // lambda alvo da ECU. Ex: 1.000
  veValueRaw:      number       // VE raw (VE% × 10). Ex: 59.2% → 592
  clt:             number       // °C (Coolant Temperature)
  lambdaLoop:      0 | 1         // 0=open loop, 1=closed loop
  pedal:           number | null // % (0–100); null se coluna ausente
}

/** Modelo de um datalog após parsing. */
export interface DatalogModel {
  hash:         string          // SHA-1 "sha1:<hexdigest>"; estável entre sessões
  filename:     string
  rows:         DatalogRow[]     // ordem cronológica
  duration_ms:  number
  signals:      string[]        // nomes das colunas; popula seletores de sinal
}

/** Entrada de log no store — DatalogModel + metadados de UI. */
export interface LogEntry {
  hash:        string           // SHA-1; identificador estável
  filename:    string
  model:       DatalogModel
  enabled:     boolean           // true = incluído na sessão ativa (TimeRail, tuning)
  duration_ms: number            // cache de model.duration_ms
}

/** Versão reduzida de LogEntry para o TimeRail — evita passar o modelo completo. */
export interface ActiveLog {
  hash:        string
  filename:    string
  duration_ms: number
  enabled:     boolean
}

/** Seleção de intervalo no TimeRail. Valores em ms relativos ao início do primeiro log ativo. */
export interface TimeSelection {
  start_ms: number
  end_ms:   number
}
```

## `types/engine.ts`

```typescript
export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'

/** Info de um engine. Retornado por GET /api/engines e /api/engines/{id}. */
export interface EngineInfo {
  engineId:       string         // ID único. Ex: "ve_lambda"
  name:           string         // nome legível
  description:    string         // exibido no TuningConfigModal
  objective:      string         // o que o engine otimiza
  targetMapType:  MapType
  defaultConfig:  Record<string, unknown>  // inicializa o formulário
  configSchema:   JSONSchema      // renderiza o modal dinamicamente
}

/** Subconjunto do JSON Schema 7 para o TuningConfigModal.
 *  Tipos suportados: number, integer, boolean, string (com enum). */
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
  title?:       string           // label do campo
  description?: string           // texto de ajuda
  default?:     unknown
  minimum?:     number
  maximum?:     number
  enum?:        unknown[]         // valores para selects
  nullable?:    boolean           // aceita null (ex.: max_delta_pedal)
}
```

## `types/tuning.ts`

### `TuningConfig`

Espelha o dataclass `TuningConfig` do backend (`engines/ve_lambda/config.py`).

```typescript
export interface TuningConfig {
  // Filtros de dados
  min_clt:                    number   // ºC. Default 80
  lambda_loop_closed_only:    boolean  // descarta open loop. Default true
  skip_first_closed_loop:     number   // ignora N pontos após entrar em closed loop. Default 10
  skip_first_rpm_bucket:      number   // ignora N pontos após mudar bucket RPM. Default 0
  skip_first_map_bucket:      number   // ignora N pontos após mudar bucket MAP. Default 0
  max_delta_rpm:              number   // descarta se abs(ΔRPM) > valor. Default 99999 (off)
  max_delta_map:              number   // descarta se abs(ΔMAP kPa) > valor. Default 99999 (off)
  max_delta_lambda_target:    number   // descarta se abs(lambda1-lambdaTarget) λ > valor. Default 0.200
  max_lambda:                 number   // descarta se lambda1 λ > valor. Default 1.090
  max_delta_pedal:            number | null  // descarta se abs(Δpedal %) > valor. null=off. Default null
  // Qualidade por célula
  outlier_sigma:              number   // |v-mean| > sigma×std → descarta. Default 2.0
  cv_threshold:               number   // CV >= threshold → stability_score cai a 0. Default 0.15
  // Correção
  weight_sample_base:         number   // K em count_score = n/(n+K). Default 40
  max_correction_pct:         number   // correção máx por iteração por célula (%). Default 15.0
  // Convergência
  convergence_threshold:      number   // residual abaixo do qual a célula "convergiu". Default 5.0
  // Pós-processamento
  rpm400_rule_enabled:        boolean  // val_400 = val_800 × (1-rpm400_discount). Default true
  rpm400_discount:            number   // desconto sobre 800 RPM. Default 0.045
  low_map_rule_enabled:       boolean  // linhas MAP baixo sem dados usam linha superior. Default true
  low_map_threshold:          number   // kPa máximo para a regra. Default 20
  low_map_discount:           number   // desconto sobre a linha superior. Default 0.025
  max_adjacent_gradient_pct:  number   // % máx entre vizinhas antes do warning. Default 20.0
  // Propagação estrutural (etapas 8+9)
  shape_propagation_enabled:  boolean  // ativa tendências estruturais. Default true
  shape_rpm_weight:           number   // peso α da tendência por RPM. Default 0.50
  shape_map_weight:           number   // peso β da tendência por MAP. Default 0.30
  shape_gradient_weight:      number   // peso (1-α-β) do gradiente. Default 0.20
  global_shape_weight:        number   // peso do fator global no cf_final. Default 0.10
  gradient_min_samples:       number   // mín. de pontos p/ computar gradiente. Default 2
}

/** Defaults — base para o store e o formulário. Espelha o backend. */
export const DEFAULT_TUNING_CONFIG: TuningConfig = {
  min_clt: 80, lambda_loop_closed_only: true,
  skip_first_closed_loop: 10, skip_first_rpm_bucket: 0, skip_first_map_bucket: 0,
  max_delta_rpm: 99999, max_delta_map: 99999,
  max_delta_lambda_target: 0.200, max_lambda: 1.090, max_delta_pedal: null,
  outlier_sigma: 2.0, cv_threshold: 0.15,
  weight_sample_base: 40, max_correction_pct: 15.0,
  convergence_threshold: 5.0,
  rpm400_rule_enabled: true, rpm400_discount: 0.045,
  low_map_rule_enabled: true, low_map_threshold: 20, low_map_discount: 0.025,
  max_adjacent_gradient_pct: 20.0,
  shape_propagation_enabled: true,
  shape_rpm_weight: 0.50, shape_map_weight: 0.30, shape_gradient_weight: 0.20,
  global_shape_weight: 0.10, gradient_min_samples: 2,
}
```

### `TuningRunRequest`

```typescript
/** Corpo de POST /api/tuning/run. */
export interface TuningRunRequest {
  engineId:        string         // ex: "ve_lambda"
  rpmBreakpoints:  number[]        // RPM do mapa atual (ascending)
  mapBreakpoints:  number[]        // MAP kPa do mapa atual (ascending)
  cells:           number[][]      // mapa editável: cells[map_i][rpm_j] = raw 100–9999
  logHashes:       string[]        // SHA-1 dos logs enabled; backend localiza por hash em disco
  timeRange:       TimeSelection | null  // null = todos os pontos
  config:          TuningConfig
}
```

### `TuningOutput`

Todas as matrizes têm shape (n_map × n_rpm).

```typescript
export interface TuningOutput {
  suggestedMap:          number[][]              // raw pronto para a ECU (100–9999)
  veLambdaMap:           (number | null)[][]     // VE Lambda médio (pós-outlier); null=sem dados
  sampleCountMap:        number[][]              // amostras por célula pós-outlier
  correctionPctMap:      number[][]              // correção aplicada em %
  cfMap:                 number[][]              // fator interpolado (1.0=sem alteração)
  confidenceMap:         (number | null)[][]     // confiança 0–1 = count_score×0.7 + stability×0.3
  cvMap:                 (number | null)[][]     // CV = std/mean
  convergenceMap:        (boolean | null)[][]    // residual < convergence_threshold
  cellsNoData:           [number, number][]      // [row_i, col_j] sem amostras
  cellsExtrapolated:     CellExtrapolation[]
  monotonicityWarnings:  [number, number][]      // [row_i, col_j] monotonicidade violada
  gradientWarnings:      GradientWarning[]
  filterStats:           FilterStats
}

export interface CellExtrapolation {
  rowI:  number
  colJ:  number
  /** "interpolation_2d" (scipy.griddata) | "rpm400" | "low_map" */
  rule:  'interpolation_2d' | 'rpm400' | 'low_map'
}

export interface GradientWarning {
  rowI:        number
  colJ:        number
  neighborI:   number
  neighborJ:   number
  gradientPct: number   // abs(val-neighbor)/neighbor × 100
}

/** Diagnóstico de filtragem — quantos pontos passaram e por que cada grupo foi descartado. */
export interface FilterStats {
  totalRows:             number   // total de linhas de todos os logs
  passed:                number   // passaram todos os filtros
  discardedClt:          number   // CLT < min_clt
  discardedOpenLoop:     number   // lambda_loop = 0
  discardedSkipCl:       number   // primeiros N após entrar em closed loop
  discardedSkipRpmBkt:   number   // primeiros N após mudar bucket RPM
  discardedSkipMapBkt:   number   // primeiros N após mudar bucket MAP
  discardedDeltaRpm:     number
  discardedDeltaMap:     number
  discardedDeltaLambda:  number   // abs(lambda1-lambdaTarget) > max_delta_lambda_target
  discardedMaxLambda:    number   // lambda1 > max_lambda
  discardedDeltaPedal:   number   // 0 se max_delta_pedal = null
  discardedOutOfRange:   number   // RPM/MAP fora do range (snap retornou null)
  discardedOutlier:      number   // outliers intra-célula (etapa 4)
}
```

## `types/ui.ts`

### `ChartLayout`

Árvore de painéis da aba Gráficos. Cada nó é painel folha ou nó de divisão.

```typescript
/** Nó folha — painel com sinais. */
export interface ChartPanel {
  type:    'panel'
  panelId: string          // UUID gerado no frontend
  signals: string[]        // nomes de sinais. Ex: ["RPM", "MAP"]
}

/** Nó de divisão — 2+ filhos. 'horizontal' = lado a lado (↔); 'vertical' = empilhados (↕). */
export interface ChartSplit {
  type:      'split'
  direction: 'horizontal' | 'vertical'
  children:  ChartLayout[] // ≥ 2 filhos
}

/** Nó da árvore — painel folha ou divisão. A raiz pode ser qualquer tipo.
 *  Ex.: A e B lado a lado, C embaixo:
 *  { type:'split', direction:'vertical', children: [
 *    { type:'split', direction:'horizontal', children: [
 *      { type:'panel', panelId:'A', signals:['RPM','MAP'] },
 *      { type:'panel', panelId:'B', signals:['Lambda 1'] } ]},
 *    { type:'panel', panelId:'C', signals:['CLT'] } ] } */
export type ChartLayout = ChartPanel | ChartSplit
```

### Outros tipos de UI

```typescript
/** Escala de cor do HeatmapTable. */
export type ColorScale =
  | 'warm'         // azul→verde→amarelo→vermelho (mapas VE, ignição, lambda)
  | 'diverging'    // azul (neg) → branco (zero) → vermelho (pos)
  | 'confidence'   // vermelho (0) → amarelo → verde (1) — confiança e CV
  | 'coverage'     // cinza (0) → azul saturado (N≥100) — contagem de amostras
  | 'convergence'  // cinza (null) | amarelo (false) | verde (true)

/** Modo de heatmap na seção Análise da aba VE. */
export type TuningAnalysisMode =
  | 've_lambda' | 'samples' | 'confidence' | 'cv' | 'correction' | 'convergence'

export type DatalogTab = 'dashboard' | 'charts' | 'data'

/** Série de sinais para o SyncedChart. Ver components/synced-chart.md. */
export interface SignalSeries {
  name:   string             // coincide com DatalogModel.signals
  unit:   string             // exibição no eixo Y/tooltip. Ex: "kPa", "λ"
  data:   [number, number][] // [timestamp_ms, valor], ordenado por timestamp
  color?: string             // CSS; auto se omitido
  yAxis?: 'left' | 'right'   // padrão 'left'
}

/** Ponto de scatter para overlay no MapChart. */
export interface ScatterPoint {
  rpm:     number
  mapKpa:  number
  weight?: number            // 0–1; controla tamanho/opacidade (densidade da célula)
}

/** Conteúdo do tooltip do HeatmapTable. Sempre exibe todos os campos disponíveis. */
export interface TooltipContent {
  rpm:          number
  mapKpa:       number
  currentValue: number       // valor atual no mapa editável (raw 100–9999)
  tuning?: {                 // exibido quando TuningOutput está disponível
    veLambda:   number | null
    samples:    number
    confidence: number | null
    cv:         number | null
    correction: number       // %
    converged:  boolean | null
    residual?:  number       // % — no tooltip de convergência
  }
}

/** Estado de UI no useUIStore, persistido em localStorage (`miot:ui`). */
export interface UIState {
  originalMapCollapsed: boolean             // painel "Mapa Original" colapsado. Default false
  tuningAnalysisMode:   TuningAnalysisMode  // heatmap ativo na Análise. Default 've_lambda'
  datalogTab:           DatalogTab          // aba ativa no Datalog. Default 'dashboard'
  columnVisibility:     Record<string, boolean>  // colunas da aba Dados; ausência = visível
  chartLayout:          ChartLayout         // layout de painéis; inicial: painel único ['RPM']
  chartsHeight:         number              // altura da área de gráficos (px). Default 400
  chartSidebarOpen:     boolean             // sidebar de sinais aberta. Default true
}
```

## `TimeSelection` reutilizado

`TimeSelection` é definido em `types/datalog.ts` e reutilizado em `types/tuning.ts` (`TuningRunRequest.timeRange`) e `useTimeStore`. Não duplicar — importar de `@/types/datalog`.

## Localização dos arquivos

| Arquivo | Conteúdo |
|---------|----------|
| `types/map.ts` | `MapModel`, `MapType` |
| `types/datalog.ts` | `DatalogRow`, `DatalogModel`, `LogEntry`, `ActiveLog`, `TimeSelection` |
| `types/engine.ts` | `EngineInfo`, `JSONSchema`, `JSONSchemaProperty` |
| `types/tuning.ts` | `TuningConfig`, `DEFAULT_TUNING_CONFIG`, `TuningRunRequest`, `TuningOutput`, `CellExtrapolation`, `GradientWarning`, `FilterStats` |
| `types/ui.ts` | `ChartLayout`, `ChartPanel`, `ChartSplit`, `ColorScale`, `TuningAnalysisMode`, `DatalogTab`, `SignalSeries`, `ScatterPoint`, `TooltipContent`, `UIState` |
