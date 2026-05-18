# API Client — Frontend

Camada de comunicação com o backend FastAPI. Responsável exclusivamente por HTTP, serialização/deserialização e tratamento de erros de rede. Sem lógica de negócio — quem chama decide o que fazer com o resultado ou com o erro.

---

## Organização dos arquivos

```
src/api/
├── client.ts       # fetch base, tratamento de erros, tipos de erro
├── map.ts          # uploadMap, exportMap
├── datalog.ts      # uploadDatalog
├── engines.ts      # listEngines, getEngine
└── tuning.ts       # runTuning
```

---

## `client.ts` — Base do cliente HTTP

### Configuração de base URL

A URL base é configurada via variável de ambiente do Vite:

```typescript
// src/api/client.ts

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const DEFAULT_TIMEOUT_MS = 30_000      // 30 segundos para operações comuns
const UPLOAD_TIMEOUT_MS  = 120_000     // 2 minutos para uploads (arquivos CSV grandes)
```

Em desenvolvimento: `VITE_API_URL=http://localhost:8000`  
Em produção: configurado no `.env.production` ou via variável de ambiente do host.

### Tipos de erro

Três tipos de erro distintos, cada um tratável separadamente pelos callers:

```typescript
// src/api/client.ts

/**
 * Erro retornado pelo backend com status 4xx.
 * O campo `detail` contém a mensagem de erro do FastAPI/Pydantic.
 */
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

/**
 * Erro de conectividade — servidor não respondeu ou rede inacessível.
 * Ocorre quando o fetch lança TypeError (ex.: CORS, servidor down).
 */
export class NetworkError extends Error {
  constructor(public readonly cause?: unknown) {
    super('Sem conexão com o servidor')
    this.name = 'NetworkError'
  }
}

/**
 * A requisição excedeu o tempo limite configurado.
 */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Requisição expirou após ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}
```

### Função base `apiFetch`

```typescript
// src/api/client.ts

export interface FetchOptions extends RequestInit {
  /** Timeout em ms. Padrão: DEFAULT_TIMEOUT_MS (30s). Uploads usam UPLOAD_TIMEOUT_MS (120s). */
  timeoutMs?: number
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = options
  const url = `${BASE_URL}/api${path}`

  // AbortController para implementar timeout
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(timeoutMs)
    }
    throw new NetworkError(err)
  } finally {
    clearTimeout(timer)
  }

  // Erros do backend: 4xx = ApiError com detail, 5xx = ApiError com mensagem genérica
  if (!response.ok) {
    let detail = `Erro ${response.status}`
    try {
      const body = await response.json()
      // FastAPI retorna { "detail": "..." } ou { "detail": [...] }
      if (typeof body?.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body?.detail)) {
        // Erros de validação Pydantic: array de objetos
        detail = body.detail.map((e: { msg: string }) => e.msg).join('; ')
      }
    } catch {
      // Corpo não é JSON — mantém mensagem genérica
    }
    throw new ApiError(response.status, detail)
  }

  // 204 No Content — retornar undefined
  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}
```

### Utilitário para uploads multipart

```typescript
// src/api/client.ts

/**
 * Envia um arquivo como multipart/form-data.
 * Usa timeout maior (UPLOAD_TIMEOUT_MS) automaticamente.
 */
export async function apiUpload<T>(
  path: string,
  file: File,
  fieldName: string = 'file'
): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)

  return apiFetch<T>(path, {
    method: 'POST',
    body: formData,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    // Não definir Content-Type manualmente — o browser gera o boundary correto
  })
}
```

---

## `api/map.ts`

### `uploadMap(file: File)`

Faz o upload do CSV do mapa da MasterInjection. O backend parseia o arquivo e retorna o modelo completo com breakpoints e células.

```typescript
// src/api/map.ts
import { apiUpload, apiFetch } from './client'
import type { MapModel } from '@/types/map'

interface UploadMapResponse {
  map_id:           string
  name:             string
  rpm_breakpoints:  number[]
  map_breakpoints:  number[]
  cells:            number[][]
}

/**
 * Faz upload do CSV do mapa ao backend.
 * Retorna o MapModel com os breakpoints e células parseadas, e o mapId para uso futuro.
 *
 * @throws {ApiError} status 422 se o CSV for inválido ou formato não reconhecido
 * @throws {NetworkError} se o backend estiver inacessível
 * @throws {TimeoutError} se ultrapassar 120s
 */
export async function uploadMap(file: File): Promise<{ mapId: string; model: MapModel }> {
  const raw = await apiUpload<UploadMapResponse>('/map/upload', file)

  // Converte snake_case do backend para camelCase do frontend
  const model: MapModel = {
    mapId:           raw.map_id,
    name:            raw.name,
    rpmBreakpoints:  raw.rpm_breakpoints,
    mapBreakpoints:  raw.map_breakpoints,
    cells:           raw.cells,
  }

  return { mapId: raw.map_id, model }
}
```

### `exportMap(mapId: string, cells: number[][])`

Solicita ao backend a geração do CSV atualizado com os valores do mapa editável. O backend preserva todas as linhas do CSV original e substitui apenas as linhas `#F01`–`#F16`.

```typescript
/**
 * Solicita o CSV exportado com as células do mapa editável.
 * Retorna um Blob pronto para download.
 *
 * @throws {ApiError} status 404 se mapId não encontrado no session store do backend
 * @throws {NetworkError} se o backend estiver inacessível
 */
export async function exportMap(mapId: string, cells: number[][]): Promise<Blob> {
  const params = new URLSearchParams({ cells: JSON.stringify(cells) })
  const url = `/map/${encodeURIComponent(mapId)}/export?${params}`

  // apiFetch padrão não serve para Blob — fazer fetch direto com tratamento de erro
  const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  const response = await fetch(`${BASE_URL}/api${url}`)

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail ?? `Erro ${response.status}`)
  }

  return response.blob()
}
```

> Nota: `exportMap` usa `fetch` diretamente porque precisa retornar um `Blob` em vez de JSON. A `apiFetch` genérica retorna JSON; neste caso, fazer a chamada manualmente com tratamento de erro equivalente é mais limpo do que adaptar a função genérica.

---

## `api/datalog.ts`

### `uploadDatalog(file: File)`

Faz upload de um CSV de datalog. O backend parseia, converte raw → real e retorna o modelo completo com todas as linhas.

```typescript
// src/api/datalog.ts
import { apiUpload } from './client'
import type { DatalogModel, DatalogRow } from '@/types/datalog'

interface UploadDatalogResponse {
  log_id:       string
  filename:     string
  duration_ms:  number
  signals:      string[]
  rows: {
    timestamp_ms:    number
    rpm:             number
    map_kpa:         number
    lambda1:         number
    lambda_correcao: number
    lambda_target:   number
    ve_value_raw:    number
    clt:             number
    lambda_loop:     0 | 1
    pedal:           number | null
  }[]
}

/**
 * Faz upload do CSV de datalog ao backend.
 * Retorna o DatalogModel completo (com todas as linhas) e o logId.
 *
 * O modelo já vem com os valores convertidos para unidades reais pelo backend.
 * O frontend não precisa converter — apenas exibir.
 *
 * @throws {ApiError} status 422 se o CSV não for reconhecido como datalog da MasterInjection
 * @throws {NetworkError} se o backend estiver inacessível
 * @throws {TimeoutError} se ultrapassar 120s (logs grandes podem demorar)
 */
export async function uploadDatalog(file: File): Promise<{ logId: string; model: DatalogModel }> {
  const raw = await apiUpload<UploadDatalogResponse>('/datalog/upload', file)

  const rows: DatalogRow[] = raw.rows.map((r) => ({
    timestamp_ms:    r.timestamp_ms,
    rpm:             r.rpm,
    mapKpa:          r.map_kpa,
    lambda1:         r.lambda1,
    lambdaCorrecao:  r.lambda_correcao,
    lambdaTarget:    r.lambda_target,
    veValueRaw:      r.ve_value_raw,
    clt:             r.clt,
    lambdaLoop:      r.lambda_loop,
    pedal:           r.pedal,
  }))

  const model: DatalogModel = {
    logId:       raw.log_id,
    filename:    raw.filename,
    rows,
    duration_ms: raw.duration_ms,
    signals:     raw.signals,
  }

  return { logId: raw.log_id, model }
}
```

---

## `api/engines.ts`

### `listEngines()`

Retorna todos os motores de tuning registrados no backend. Usado para popular o seletor de engine no `TuningConfigModal` e para buscar o schema de configuração.

```typescript
// src/api/engines.ts
import { apiFetch } from './client'
import type { EngineInfo } from '@/types/engine'

interface EngineInfoRaw {
  engine_id:        string
  name:             string
  description:      string
  objective:        string
  target_map_type:  'fuel_ve' | 'ignition' | 'lambda' | 'boost'
  default_config:   Record<string, unknown>
  config_schema:    Record<string, unknown>
}

function toEngineInfo(raw: EngineInfoRaw): EngineInfo {
  return {
    engineId:       raw.engine_id,
    name:           raw.name,
    description:    raw.description,
    objective:      raw.objective,
    targetMapType:  raw.target_map_type,
    defaultConfig:  raw.default_config,
    configSchema:   raw.config_schema,
  }
}

/**
 * Lista todos os motores de tuning disponíveis.
 * Chamado uma vez na inicialização para popular o seletor de engine.
 *
 * @throws {NetworkError} se o backend estiver inacessível
 */
export async function listEngines(): Promise<EngineInfo[]> {
  const raw = await apiFetch<EngineInfoRaw[]>('/engines')
  return raw.map(toEngineInfo)
}

/**
 * Retorna detalhes de um motor específico pelo ID.
 * Inclui o config_schema completo para renderizar o modal de configuração.
 *
 * @throws {ApiError} status 404 se engine_id não encontrado
 * @throws {NetworkError} se o backend estiver inacessível
 */
export async function getEngine(engineId: string): Promise<EngineInfo> {
  const raw = await apiFetch<EngineInfoRaw>(`/engines/${encodeURIComponent(engineId)}`)
  return toEngineInfo(raw)
}
```

---

## `api/tuning.ts`

### `runTuning(req: TuningRunRequest)`

Executa o motor de tuning selecionado. Esta é a operação mais pesada da aplicação — pode levar vários segundos dependendo do volume de logs. A resposta é **síncrona** (o backend processa e responde em uma única requisição HTTP — não há polling).

O timeout para esta chamada é de 120 segundos (mesmo que uploads), pois a análise de logs grandes pode ser computacionalmente intensiva.

```typescript
// src/api/tuning.ts
import { apiFetch } from './client'
import type { TuningRunRequest, TuningOutput } from '@/types/tuning'

interface TuningRunRequestRaw {
  engine_id:   string
  map_id:      string
  log_ids:     string[]
  time_range:  { start_ms: number; end_ms: number } | null
  config:      Record<string, unknown>
}

interface TuningOutputRaw {
  suggested_map:         number[][]
  ve_lambda_map:         (number | null)[][]
  sample_count_map:      number[][]
  correction_pct_map:    number[][]
  cf_map:                number[][]
  confidence_map:        (number | null)[][]
  cv_map:                (number | null)[][]
  convergence_map:       (boolean | null)[][]
  cells_no_data:         [number, number][]
  cells_extrapolated:    { row_i: number; col_j: number; rule: string }[]
  monotonicity_warnings: [number, number][]
  gradient_warnings:     { row_i: number; col_j: number; neighbor_i: number; neighbor_j: number; gradient_pct: number }[]
  filter_stats: {
    total_rows:              number
    passed:                  number
    discarded_clt:           number
    discarded_open_loop:     number
    discarded_skip_cl:       number
    discarded_skip_rpm_bkt:  number
    discarded_skip_map_bkt:  number
    discarded_delta_rpm:     number
    discarded_delta_map:     number
    discarded_delta_lambda:  number
    discarded_max_lambda:    number
    discarded_delta_pedal:   number
    discarded_out_of_range:  number
    discarded_outlier:       number
  }
}

/**
 * Executa o auto-tuning completo.
 * A requisição é síncrona — o backend processa e retorna o TuningOutput completo.
 * Não há polling de progresso na v1.
 *
 * @throws {ApiError} status 404 se mapId ou algum logId não estiver no session store
 * @throws {ApiError} status 422 se a config for inválida para o engine selecionado
 * @throws {NetworkError} se o backend estiver inacessível
 * @throws {TimeoutError} se ultrapassar 120s
 */
export async function runTuning(req: TuningRunRequest): Promise<TuningOutput> {
  // Converte camelCase do frontend para snake_case do backend
  const body: TuningRunRequestRaw = {
    engine_id:  req.engineId,
    map_id:     req.mapId,
    log_ids:    req.logIds,
    time_range: req.timeRange,
    config:     req.config as Record<string, unknown>,
  }

  const raw = await apiFetch<TuningOutputRaw>('/tuning/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  })

  // Converte snake_case da resposta para camelCase do frontend
  return {
    suggestedMap:          raw.suggested_map,
    veLambdaMap:           raw.ve_lambda_map,
    sampleCountMap:        raw.sample_count_map,
    correctionPctMap:      raw.correction_pct_map,
    cfMap:                 raw.cf_map,
    confidenceMap:         raw.confidence_map,
    cvMap:                 raw.cv_map,
    convergenceMap:        raw.convergence_map,
    cellsNoData:           raw.cells_no_data,
    cellsExtrapolated:     raw.cells_extrapolated.map(e => ({
      rowI:  e.row_i,
      colJ:  e.col_j,
      rule:  e.rule,
    })),
    monotonicityWarnings:  raw.monotonicity_warnings,
    gradientWarnings:      raw.gradient_warnings.map(w => ({
      rowI:        w.row_i,
      colJ:        w.col_j,
      neighborI:   w.neighbor_i,
      neighborJ:   w.neighbor_j,
      gradientPct: w.gradient_pct,
    })),
    filterStats: {
      totalRows:             raw.filter_stats.total_rows,
      passed:                raw.filter_stats.passed,
      discardedClt:          raw.filter_stats.discarded_clt,
      discardedOpenLoop:     raw.filter_stats.discarded_open_loop,
      discardedSkipCl:       raw.filter_stats.discarded_skip_cl,
      discardedSkipRpmBkt:   raw.filter_stats.discarded_skip_rpm_bkt,
      discardedSkipMapBkt:   raw.filter_stats.discarded_skip_map_bkt,
      discardedDeltaRpm:     raw.filter_stats.discarded_delta_rpm,
      discardedDeltaMap:     raw.filter_stats.discarded_delta_map,
      discardedDeltaLambda:  raw.filter_stats.discarded_delta_lambda,
      discardedMaxLambda:    raw.filter_stats.discarded_max_lambda,
      discardedDeltaPedal:   raw.filter_stats.discarded_delta_pedal,
      discardedOutOfRange:   raw.filter_stats.discarded_out_of_range,
      discardedOutlier:      raw.filter_stats.discarded_outlier,
    },
  }
}
```

---

## Responsabilidade sobre loading state

O `api/` **não gerencia loading state**. Essa é responsabilidade dos stores e hooks que chamam as funções:

- `useMapStore.loadMap()` define `isLoading = true` antes de chamar `uploadMap()` e `isLoading = false` após.
- `useTuningStore.runTuning()` define `isRunning = true` antes de chamar `api/tuning.runTuning()`.
- Os componentes leem `isLoading`/`isRunning` dos stores para exibir spinners e desabilitar botões.

O `api/` apenas lança erros tipados — o store captura e armazena em `lastError`.

---

## Convenção de nomes: snake_case → camelCase

O backend Python usa `snake_case` em todos os campos JSON. O frontend TypeScript usa `camelCase`. Cada módulo do `api/` faz a conversão no ponto de entrada (ao receber a resposta) e no ponto de saída (ao serializar o body da requisição).

Nunca expor `snake_case` para fora do `api/` — os tipos em `types/` usam exclusivamente `camelCase`.

---

## Re-export de tipos

Os módulos do `api/` **não definem tipos próprios** além dos tipos `*Raw` internos usados para a conversão. Todos os tipos públicos são importados de `@/types/`:

```typescript
// Correto:
import type { MapModel } from '@/types/map'
import type { TuningOutput } from '@/types/tuning'

// Incorreto (nunca duplicar tipos aqui):
interface MapModel { ... }   // ← NÃO fazer isso no api/
```

Isso garante uma única fonte de verdade para os tipos e facilita a geração automática via `openapi-typescript` no futuro.

---

## Exemplo de uso correto em um store

```typescript
// Em useMapStore.ts — exemplo de como o store chama o api/
import { uploadMap } from '@/api/map'
import { ApiError, NetworkError, TimeoutError } from '@/api/client'

async loadMap(file: File): Promise<void> {
  set({ isLoading: true, lastError: null })
  try {
    const { mapId, model } = await uploadMap(file)
    set({ mapId, originalModel: model, editableMap: model.cells, isLoading: false })
    // ... persiste no IndexedDB
  } catch (err) {
    let message = 'Erro desconhecido'
    if (err instanceof ApiError) {
      message = err.status === 422
        ? `CSV inválido: ${err.detail}`
        : `Erro do servidor: ${err.detail}`
    } else if (err instanceof NetworkError) {
      message = 'Sem conexão com o servidor. Verifique se o backend está rodando.'
    } else if (err instanceof TimeoutError) {
      message = 'O upload demorou muito. Tente novamente com um arquivo menor.'
    }
    set({ isLoading: false, lastError: message })
  }
}
```
