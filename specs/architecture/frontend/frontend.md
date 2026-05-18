# Arquitetura — Frontend

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + ECharts + Zustand + React Router v6

---

## Estrutura de pastas

```
frontend/src/
├── api/                        # Camada de comunicação com o backend
│   ├── client.ts               # fetch base com tratamento de erro e tipos
│   ├── map.ts                  # uploadMap, exportMap
│   ├── datalog.ts              # uploadDatalog, getSignals
│   ├── tuning.ts               # runTuning
│   └── engines.ts              # listEngines, getEngine
│
├── components/                 # Componentes compartilhados (ver seção abaixo)
│   ├── HeatmapTable/
│   ├── MapChart/
│   ├── TimeRail/
│   ├── SyncedChart/
│   ├── TuningConfigModal/
│   └── ui/                     # shadcn/ui wrappers (Button, Modal, etc.)
│
├── store/                      # Zustand stores (ver seção abaixo)
│   ├── mapStore.ts
│   ├── logStore.ts
│   ├── timeStore.ts
│   ├── tuningStore.ts
│   └── uiStore.ts
│
├── persistence/                # Camada de persistência (ver seção abaixo)
│   ├── db.ts                   # IndexedDB setup (idb-keyval ou Dexie)
│   ├── mapPersistence.ts       # salvar/restaurar mapa
│   ├── logPersistence.ts       # salvar/restaurar logs
│   └── sessionRestorer.ts      # orquestra a restauração completa ao abrir o app
│
├── pages/
│   ├── HomePage.tsx
│   ├── TuningPage.tsx          # layout + abas VE / Ignition / Lambda
│   └── DatalogPage.tsx         # layout + TimeRail + abas Dashboard / Gráficos / Dados
│
├── features/                   # Lógica de cada tela (hooks + subcomponentes de tela)
│   ├── tuning/
│   │   ├── ve/
│   │   │   ├── VETab.tsx
│   │   │   ├── AnalysisSection.tsx   # Seção 3: heatmaps diagnósticos + warnings + filtros
│   │   │   └── useVETuning.ts
│   │   └── hooks/
│   │       └── useTuningRun.ts
│   └── datalog/
│       ├── dashboard/
│       ├── charts/
│       │   ├── ChartsTab.tsx
│       │   └── useChartLayout.ts
│       └── data/
│           └── DataTab.tsx
│
├── types/                      # Tipos TypeScript compartilhados
│   ├── map.ts
│   ├── datalog.ts
│   ├── tuning.ts               # TuningInput, TuningOutput, TuningConfig, etc.
│   └── engine.ts               # EngineInfo
│
├── hooks/                      # Hooks genéricos reutilizáveis
│   ├── useFileUpload.ts
│   └── useLocalStorage.ts
│
├── App.tsx                     # Router + layout raiz
└── main.tsx
```

---

## Rotas

| Path | Componente | Guard | Descrição |
|------|-----------|-------|-----------|
| `/` | `HomePage` | — | Tela inicial com cards de acesso |
| `/tuning` | `TuningPage` | mapa carregado | Redireciona para `/tuning/ve` |
| `/tuning/ve` | `TuningPage` → aba VE | mapa carregado | Mapa VE + análise |
| `/tuning/ignition` | `TuningPage` → aba Ignition | mapa carregado | 🔒 bloqueado na v1 |
| `/tuning/lambda` | `TuningPage` → aba Lambda | mapa carregado | 🔒 bloqueado na v1 |
| `/datalog` | `DatalogPage` | 1+ logs | Redireciona para `/datalog/dashboard` |
| `/datalog/dashboard` | `DatalogPage` → Dashboard | 1+ logs | Painel de instrumentos |
| `/datalog/charts` | `DatalogPage` → Gráficos | 1+ logs | Gráficos configuráveis |
| `/datalog/data` | `DatalogPage` → Dados | 1+ logs | Tabela de dados brutos |

**Guards:** se o pré-requisito não for atendido, redireciona para `/` com mensagem explicativa (não exibe tela de erro).

---

## Estado global — Zustand Stores

Cada store é um slice independente. A persistência (localStorage / IndexedDB) é configurada por store, conforme o volume e criticidade dos dados.

### `useMapStore`

```typescript
interface MapState {
  mapId:        string | null        // ID no backend (inválido após reload → re-upload)
  originalMap:  MapModel | null      // parseado pelo backend; fonte de verdade imutável
  editableMap:  number[][] | null    // cópia editável pelo usuário e pelo auto-tuning
  isDirty:      boolean              // true se editableMap ≠ originalMap.fuel_map.cells
}

interface MapActions {
  loadMap(file: File): Promise<void>          // upload → backend → armazena
  resetEditable(): void                       // restaura editableMap = originalMap.cells
  updateCell(row: number, col: number, value: number): void
  applyTuningOutput(suggested: number[][]): void
  clear(): void
}
```

**Persistência:** `originalMap` e `editableMap` → IndexedDB. `mapId` não persiste (re-upload transparente na restauração).

---

### `useLogStore`

```typescript
interface LogEntry {
  logId:       string          // ID no backend
  filename:    string
  model:       DatalogModel    // conteúdo parseado
  enabled:     boolean         // incluído na sessão ativa
  duration_ms: number
}

interface LogState {
  logs: LogEntry[]             // em ordem de concatenação temporal
}

interface LogActions {
  addLog(file: File): Promise<void>
  removeLog(logId: string): void
  toggleLog(logId: string): void
  reorder(orderedIds: string[]): void
}

// Computed (seletores)
const activeLogs = (state) => state.logs.filter(l => l.enabled)
const totalDuration = (state) => activeLogs(state).reduce((acc, l) => acc + l.duration_ms, 0)
```

**Persistência:** lista completa (com modelo) → IndexedDB. Ordem e estado `enabled` → localStorage.

---

### `useTimeStore`

```typescript
interface TimeState {
  cursor_ms:       number | null
  selection:       { start_ms: number; end_ms: number } | null
  sparklineSensor: string        // sinal exibido na miniatura do TimeRail (padrão: "RPM")
}

interface TimeActions {
  setCursor(ms: number | null): void
  setSelection(start: number, end: number): void
  clearSelection(): void
  setSparklineSensor(signal: string): void
}
```

**Persistência:** `sparklineSensor` → localStorage. `cursor_ms` e `selection` não persistem (estado de navegação pontual).

---

### `useTuningStore`

```typescript
interface TuningState {
  config:           TuningConfig
  selectedEngineId: string           // padrão: "ve_lambda"
  lastOutput:       TuningOutput | null
  isRunning:        boolean
}

interface TuningActions {
  updateConfig(partial: Partial<TuningConfig>): void
  resetConfig(): void
  setEngine(engineId: string): void
  runTuning(): Promise<void>         // usa mapStore + logStore + timeStore internamente
  clearOutput(): void
}
```

**Persistência:** `config` e `selectedEngineId` → localStorage. `lastOutput` → IndexedDB (pode ser grande).

---

### `useUIStore`

```typescript
interface UIState {
  originalMapCollapsed: boolean
  tuningAnalysisMode:   've_lambda' | 'samples' | 'confidence' | 'cv' | 'correction' | 'convergence'
  datalogTab:           'dashboard' | 'charts' | 'data'
  columnVisibility:     Record<string, boolean>   // colunas visíveis na aba Dados
  chartLayout:          ChartLayout               // layout dos painéis de gráficos
}
```

**Persistência:** tudo → localStorage.

---

## Persistência de estado (F5 / reiniciar o navegador)

O usuário nunca deve perder o trabalho ao fechar ou recarregar o navegador. A estratégia usa dois mecanismos:

| Dado | Volume | Onde persiste |
|------|--------|---------------|
| Arquivo CSV do mapa (blob) | ~100 KB | IndexedDB |
| Modelo parseado do mapa | ~50 KB JSON | IndexedDB |
| Mapa editável atual | ~50 KB JSON | IndexedDB |
| Arquivos CSV dos logs (blobs) | MB+ | IndexedDB |
| Modelos parseados dos logs | MB+ | IndexedDB |
| Último TuningOutput | ~200 KB JSON | IndexedDB |
| TuningConfig, engine selecionado | < 1 KB | localStorage |
| Ordem e estado enabled dos logs | < 1 KB | localStorage |
| Estado de UI (abas, colunas, layout) | < 5 KB | localStorage |
| sparklineSensor | < 1 KB | localStorage |

### Fluxo de restauração ao abrir o app

O `sessionRestorer.ts` executa na inicialização do app (antes do primeiro render), orquestrando a restauração:

```
1. Ler localStorage → restaurar UIState, TuningConfig, log ordering
2. Ler IndexedDB → restaurar originalMap, editableMap, logs (com modelos)
3. Se dados encontrados:
   a. Re-upload silencioso do mapa ao backend → obter novo mapId
   b. Re-upload silencioso de cada log ao backend → obter novos logIds
   c. Atualizar stores com novos IDs
   d. Exibir indicador "Sessão restaurada" (toast)
4. Se IndexedDB vazio → estado inicial limpo
```

O re-upload ao backend é transparente — o usuário vê um indicador de progresso discreto e, em seguida, encontra a aplicação exatamente como deixou.

### Invalidação de estado

| Evento | O que é limpo |
|--------|--------------|
| Substituir mapa | editableMap, lastOutput; logs preservados |
| Remover log | lastOutput (resultados anteriores podem estar desatualizados) |
| Alterar TuningConfig | lastOutput (indicador visual no botão "Rodar Auto-tuning") |

---

## Componentes compartilhados

### `HeatmapTable`

Tabela N×M com gradiente de cores. O componente mais central da aplicação — usado em seis contextos diferentes na aba VE.

```typescript
type ColorScale =
  | 'warm'         // azul → verde → amarelo → vermelho (mapas de VE, ignição, lambda)
  | 'diverging'    // azul (negativo) → branco (zero) → vermelho (positivo) — correção %
  | 'confidence'   // vermelho (0) → amarelo → verde (1) — confiança e CV
  | 'coverage'     // cinza (0) → azul saturado (N ≥ 100) — contagem de amostras
  | 'convergence'  // cinza (null) | amarelo (false) | verde (true) — bool por célula

interface HeatmapTableProps {
  data:             (number | null)[][]
  rowLabels:        number[]                        // MAP breakpoints
  colLabels:        number[]                        // RPM breakpoints
  colorScale:       ColorScale
  editable?:        boolean                         // padrão: false
  highlightedCells?: Set<string>                    // "row:col" — ex.: warnings
  selectedCells?:   Set<string>                     // seleção do usuário
  onCellClick?:     (row: number, col: number) => void
  onCellChange?:    (row: number, col: number, value: number) => void
  onHover?:         (row: number, col: number) => void
  tooltip?:         (row: number, col: number) => TooltipContent | null
}
```

**Usos:**
| Contexto | editable | colorScale | Observação |
|----------|----------|-----------|------------|
| Mapa Original | false | warm | somente leitura |
| Mapa Editável | true | warm | borda vermelha em células modificadas |
| Análise › VE Lambda | false | warm | dado do log |
| Análise › Amostras | false | coverage | — |
| Análise › Confiança | false | confidence | — |
| Análise › CV | false | confidence | invertido: verde=baixo CV |
| Análise › Correção % | false | diverging | — |
| Análise › Convergência | false | convergence | booleano |

---

### `MapChart`

Heatmap ECharts para visualização do mapa nos dois eixos. Sempre reflete o mapa editável atual.

```typescript
interface MapChartProps {
  data:             number[][]
  rowLabels:        number[]               // MAP breakpoints
  colLabels:        number[]               // RPM breakpoints
  orientation:      'map_x_rpm' | 'rpm_x_map'
  overlayPoints?:   ScatterPoint[]         // pontos do log (scatter sobre o heatmap)
  highlightedCell?: { row: number; col: number }
  onCellHover?:     (row: number, col: number) => void
  onCellClick?:     (row: number, col: number) => void
}
```

Hover em um `MapChart` dispara `onCellHover`, que o pai usa para destacar a mesma célula no outro `MapChart` e na `HeatmapTable` (sincronização bidirecional).

---

### `TimeRail`

Componente fixo no topo da tela de Datalog. Sempre visível dentro dessa rota.

```typescript
interface TimeRailProps {
  logs:                   ActiveLog[]
  totalDuration_ms:       number
  cursor_ms:              number | null
  selection:              { start_ms: number; end_ms: number } | null
  sparklineSensor:        string
  availableSensors:       string[]
  onCursorChange:         (ms: number) => void
  onSelectionChange:      (sel: { start_ms: number; end_ms: number } | null) => void
  onSparklineSensorChange:(sensor: string) => void
}
```

**Capacidades:**
- Arrastar cursor pontual (`▼`)
- Clicar e arrastar em área livre → cria seleção de intervalo
- Exibe separadores verticais entre logs concatenados
- Sparkline do sinal selecionado renderizada no fundo do rail (SVG)
- Combobox para trocar o sinal da sparkline
- Botão `[Limpar]` para remover seleção

---

### `SyncedChart`

Gráfico de linha para a aba Gráficos. Vários painéis podem ser exibidos simultaneamente com eixo X (tempo) compartilhado.

```typescript
interface SyncedChartProps {
  signals:       SignalSeries[]           // cada série = { name, data: [ms, value][] }
  cursor_ms:     number | null
  timeRange:     { start_ms: number; end_ms: number }
  onCursorChange:(ms: number) => void
}
```

**Capacidades:**
- Tooltip vertical compartilhado: mover o mouse em um painel move o cursor em todos
- Zoom horizontal (ECharts dataZoom) — sincronizado entre todos os painéis
- Múltiplas séries por painel com cores distintas
- Linha vertical no instante do `cursor_ms` do TimeRail

---

### `TuningConfigModal`

Modal de configuração dos parâmetros do motor de tuning. Gerado a partir do `config_schema` retornado pelo endpoint `GET /api/engines/{id}`.

```typescript
interface TuningConfigModalProps {
  open:    boolean
  config:  TuningConfig
  schema:  JSONSchema              // do backend — define campos, tipos, defaults, labels
  onSave:  (config: TuningConfig) => void
  onClose: () => void
}
```

O formulário é renderizado dinamicamente a partir do `schema`, garantindo que qualquer novo engine registrado no backend tenha seu modal de config sem alteração no frontend.

---

## API Client

Cada módulo em `api/` exporta funções tipadas. Não há lógica de negócio — apenas HTTP + serialização.

```typescript
// api/client.ts
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>

// api/map.ts
uploadMap(file: File): Promise<{ mapId: string; model: MapModel }>
exportMap(mapId: string, editableCells: number[][]): Promise<Blob>

// api/datalog.ts
uploadDatalog(file: File): Promise<{ logId: string; model: DatalogModel }>

// api/engines.ts
listEngines(): Promise<EngineInfo[]>
getEngine(engineId: string): Promise<EngineInfo>

// api/tuning.ts
runTuning(req: TuningRunRequest): Promise<TuningOutput>
```

```typescript
interface TuningRunRequest {
  engineId:   string
  mapId:      string
  logIds:     string[]
  timeRange:  { start_ms: number; end_ms: number } | null
  config:     TuningConfig
}
```

---

## Tipos TypeScript compartilhados

Os tipos espelham os modelos Pydantic do backend — gerados manualmente na v1, automatizáveis via `openapi-typescript` no futuro.

```typescript
// types/map.ts
interface MapModel {
  mapId:           string
  name:            string
  rpmBreakpoints:  number[]
  mapBreakpoints:  number[]
  cells:           number[][]      // [map_i][rpm_j] = valor raw
}

// types/datalog.ts
interface DatalogRow {
  timestamp_ms:    number
  rpm:             number
  map_kpa:         number
  lambda1:         number
  lambdaCorrecao:  number
  lambdaTarget:    number
  veValueRaw:      number
  clt:             number
  lambdaLoop:      0 | 1
  pedal:           number | null
}

interface DatalogModel {
  logId:        string
  filename:     string
  rows:         DatalogRow[]
  duration_ms:  number
  signals:      string[]          // nomes de colunas disponíveis
}

// types/engine.ts
interface EngineInfo {
  engineId:       string
  name:           string
  description:    string
  objective:      string
  targetMapType:  'fuel_ve' | 'ignition' | 'lambda' | 'boost'
  configSchema:   JSONSchema
}

// types/tuning.ts  (espelha TuningOutput do tuning-engine.md)
interface TuningOutput {
  suggestedMap:          number[][]
  veLambdaMap:           (number | null)[][]
  sampleCountMap:        number[][]
  correctionPctMap:      number[][]
  cfMap:                 number[][]
  confidenceMap:         (number | null)[][]
  cvMap:                 (number | null)[][]
  convergenceMap:        (boolean | null)[][]
  cellsNoData:           [number, number][]
  cellsExtrapolated:     CellExtrapolation[]
  monotonicityWarnings:  [number, number][]
  gradientWarnings:      GradientWarning[]
  filterStats:           FilterStats
}
```
