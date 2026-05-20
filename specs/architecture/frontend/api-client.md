# API Client — Frontend

Camada de comunicação com o backend FastAPI. Só HTTP, serialização e tratamento de erros — sem lógica de negócio.

```
src/api/
├── client.ts    # fetch base, erros, tipos de erro
├── datalog.ts   # uploadDatalog
├── engines.ts   # listEngines, getEngine
└── tuning.ts    # runTuning
```

> Não existe `api/map.ts`. Parsing do mapa fica em `parsers/mapParser.ts`, exportação em `utils/mapExporter.ts`.

## `client.ts`

### Base URL e timeouts

```typescript
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS = 30_000      // operações comuns
const UPLOAD_TIMEOUT_MS  = 120_000     // uploads (CSVs grandes)
```

### Tipos de erro

Três tipos distintos, tratáveis separadamente pelos callers:

```typescript
/** Erro do backend com status 4xx. `detail` = mensagem do FastAPI/Pydantic. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly raw?: unknown
  ) {
    super(`API ${status}: ${detail}`)
    this.name = 'ApiError'
  }
}

/** Conectividade — servidor não respondeu (fetch lança TypeError: CORS, servidor down). */
export class NetworkError extends Error {
  constructor(public readonly cause?: unknown) {
    super('Sem conexão com o servidor')
    this.name = 'NetworkError'
  }
}

/** Requisição excedeu o timeout. */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Requisição expirou após ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}
```

### `apiFetch`

```typescript
export interface FetchOptions extends RequestInit {
  /** Timeout em ms. Padrão: DEFAULT_TIMEOUT_MS (30s). Uploads usam 120s. */
  timeoutMs?: number
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = options
  const url = `${BASE_URL}/api${path}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, { ...fetchInit, signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') throw new TimeoutError(timeoutMs)
    throw new NetworkError(err)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let detail = `Erro ${response.status}`
    try {
      const body = await response.json()
      // FastAPI: { "detail": "..." } ou { "detail": [...] } (validação Pydantic)
      if (typeof body?.detail === 'string') detail = body.detail
      else if (Array.isArray(body?.detail)) detail = body.detail.map((e: { msg: string }) => e.msg).join('; ')
    } catch { /* corpo não é JSON */ }
    throw new ApiError(response.status, detail, body)
  }

  if (response.status === 204) return undefined as unknown as T
  return response.json() as Promise<T>
}
```

### Uploads multipart e hash

```typescript
/** Envia arquivo como multipart/form-data. Usa UPLOAD_TIMEOUT_MS automaticamente. */
export async function apiUpload<T>(
  path: string, file: File, fieldName = 'file', extraHeaders?: Record<string, string>
): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)
  return apiFetch<T>(path, {
    method: 'POST', body: formData, headers: extraHeaders, timeoutMs: UPLOAD_TIMEOUT_MS,
    // Não definir Content-Type — o browser gera o boundary
  })
}

/** SHA-1 do arquivo via SubtleCrypto. Retorna "sha1:<hexdigest>". Usado para cache server-side. */
export async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer)
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha1:${hex}`
}
```

## `api/datalog.ts` — `uploadDatalog(file, hash)`

Faz upload do CSV; o backend parseia, converte raw→real e retorna o modelo completo. Envia `hash` no header `X-Content-Hash` para cache server-side — se o backend já conhece o hash, retorna `cached: true` sem re-parsing.

- `@throws ApiError 422` se o CSV não for datalog MasterInjection · `NetworkError` · `TimeoutError` (>120s)

```typescript
interface UploadDatalogResponse {
  hash: string; filename: string; duration_ms: number; signals: string[]; cached: boolean
  rows: {
    timestamp_ms: number; rpm: number; map_kpa: number; lambda1: number
    lambda_correcao: number; lambda_target: number; ve_value_raw: number
    clt: number; lambda_loop: 0 | 1; pedal: number | null
  }[]
}

export async function uploadDatalog(
  file: File, hash: string,
): Promise<{ hash: string; model: DatalogModel; cached: boolean }> {
  const raw = await apiUpload<UploadDatalogResponse>('/datalog/upload', file, 'file', {
    'X-Content-Hash': hash,
  })
  const rows: DatalogRow[] = raw.rows.map((r) => ({
    timestamp_ms: r.timestamp_ms, rpm: r.rpm, mapKpa: r.map_kpa,
    lambda1: r.lambda1, lambdaCorrecao: r.lambda_correcao, lambdaTarget: r.lambda_target,
    veValueRaw: r.ve_value_raw, clt: r.clt, lambdaLoop: r.lambda_loop, pedal: r.pedal,
  }))
  const model: DatalogModel = {
    hash: raw.hash, filename: raw.filename, rows,
    duration_ms: raw.duration_ms, signals: raw.signals,
  }
  return { hash: raw.hash, model, cached: raw.cached }
}
```

## `api/engines.ts`

`listEngines()` lista todos os engines registrados (popula o seletor do `TuningConfigModal`). `getEngine(id)` retorna detalhes de um engine, incluindo `config_schema`. `@throws ApiError 404` se `engineId` não existe.

```typescript
interface EngineInfoRaw {
  engine_id: string; name: string; description: string; objective: string
  target_map_type: 'fuel_ve' | 'ignition' | 'lambda' | 'boost'
  default_config: Record<string, unknown>; config_schema: Record<string, unknown>
}

function toEngineInfo(raw: EngineInfoRaw): EngineInfo {
  return {
    engineId: raw.engine_id, name: raw.name, description: raw.description,
    objective: raw.objective, targetMapType: raw.target_map_type,
    defaultConfig: raw.default_config, configSchema: raw.config_schema,
  }
}

export async function listEngines(): Promise<EngineInfo[]> {
  return (await apiFetch<EngineInfoRaw[]>('/engines')).map(toEngineInfo)
}

export async function getEngine(engineId: string): Promise<EngineInfo> {
  return toEngineInfo(await apiFetch<EngineInfoRaw>(`/engines/${encodeURIComponent(engineId)}`))
}
```

## `api/tuning.ts` — `runTuning(req)`

Executa o engine selecionado. Operação mais pesada do app — resposta **síncrona** (sem polling), timeout 120s.

- `@throws ApiError 404` se algum hash de log não existe no disco do backend · `ApiError 422` config inválida · `NetworkError` · `TimeoutError`

Converte camelCase→snake_case no envio e snake_case→camelCase na resposta.

```typescript
interface TuningRunRequestRaw {
  engine_id: string; rpm_breakpoints: number[]; map_breakpoints: number[]
  cells: number[][]; log_hashes: string[]
  time_range: { start_ms: number; end_ms: number } | null
  config: Record<string, unknown>
}

// TuningOutputRaw: espelha TuningOutput em snake_case — matrizes (n_map × n_rpm),
// cells_no_data, cells_extrapolated, monotonicity_warnings, gradient_warnings, filter_stats.

export async function runTuning(req: TuningRunRequest): Promise<TuningOutput> {
  const body: TuningRunRequestRaw = {
    engine_id: req.engineId,
    rpm_breakpoints: req.rpmBreakpoints, map_breakpoints: req.mapBreakpoints,
    cells: req.cells, log_hashes: req.logHashes,
    time_range: req.timeRange, config: req.config as Record<string, unknown>,
  }
  const raw = await apiFetch<TuningOutputRaw>('/tuning/run', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), timeoutMs: 120_000,
  })
  // Mapeia raw (snake_case) → TuningOutput (camelCase):
  //   suggested_map→suggestedMap, ve_lambda_map→veLambdaMap, sample_count_map→sampleCountMap,
  //   correction_pct_map→correctionPctMap, cf_map→cfMap, confidence_map→confidenceMap,
  //   cv_map→cvMap, convergence_map→convergenceMap, cells_no_data→cellsNoData,
  //   cells_extrapolated[].{row_i,col_j,rule}→{rowI,colJ,rule},
  //   monotonicity_warnings→monotonicityWarnings,
  //   gradient_warnings[].{row_i,col_j,neighbor_i,neighbor_j,gradient_pct}→{rowI,colJ,neighborI,neighborJ,gradientPct},
  //   filter_stats.*→filterStats.* (cada discarded_* → discarded* camelCase)
  return { /* ...objeto convertido */ } as TuningOutput
}
```

## Convenções

- **Loading state não é do `api/`** — é dos stores/hooks. `useMapStore.loadMap()` define `isLoading`; `useTuningStore.runTuning()` define `isRunning`. O `api/` apenas lança erros tipados; o store armazena em `lastError`.
- **snake_case → camelCase** — backend usa snake_case nos JSONs; frontend usa camelCase. Cada módulo `api/` converte na entrada e na saída. Nunca expor snake_case fora do `api/`.
- **Re-export de tipos** — módulos `api/` não definem tipos próprios (exceto os `*Raw` internos). Tipos públicos vêm de `@/types/` — única fonte de verdade, facilita `openapi-typescript` no futuro.

## Exemplo de uso correto em um store

```typescript
async loadMap(file: File): Promise<void> {
  set({ isLoading: true, lastError: null })
  try {
    const model = await parseMapClient(file)
    set({ originalMap: model, editableMap: model.cells.map(row => [...row]), isLoading: false })
    // ... persiste no IndexedDB
  } catch (err) {
    set({ isLoading: false, lastError: err instanceof Error ? err.message : 'Erro ao parsear o mapa.' })
  }
}
```
