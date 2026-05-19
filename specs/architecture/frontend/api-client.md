# API Client — Frontend

Camada de comunicação com o backend FastAPI. Responsável exclusivamente por HTTP, serialização/deserialização e tratamento de erros de rede. Sem lógica de negócio — quem chama decide o que fazer com o resultado ou com o erro.

---

## Organização dos arquivos

```
src/api/
├── client.ts       # fetch base, tratamento de erros, tipos de erro
├── datalog.ts      # uploadDatalog
├── engines.ts      # listEngines, getEngine
└── tuning.ts       # runTuning
```

> **Nota:** não existe `api/map.ts`. O parsing do CSV do mapa é feito em `parsers/mapParser.ts` e a exportação em `utils/mapExporter.ts`.

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
    throw new ApiError(response.status, detail, body)
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
  fieldName: string = 'file',
  extraHeaders?: Record<string, string>
): Promise<T> {
  const formData = new FormData()
  formData.append(fieldName, file)

  return apiFetch<T>(path, {
    method: 'POST',
    body: formData,
    headers: extraHeaders,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    // Não definir Content-Type manualmente — o browser gera o boundary correto
  })
}

/**
 * Calcula o hash SHA-1 de um arquivo usando a SubtleCrypto API do browser.
 * Retorna no formato "sha1:<hexdigest>" (ex.: "sha1:a3f2b1c4...").
 *
 * Usado antes do upload de datalogs para permitir cache server-side.
 * SHA-1 é adequado aqui — o objetivo é identificar arquivos idênticos,
 * não segurança criptográfica.
 */
export async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha1:${hex}`
}
```

---

## `api/datalog.ts`

### `uploadDatalog(file: File)`

Faz upload de um CSV de datalog. O backend parseia, converte raw → real e retorna o modelo completo com todas as linhas.

```typescript
// src/api/datalog.ts
import { apiUpload } from './client'
import type { DatalogModel, DatalogRow } from '@/types/datalog'

interface UploadDatalogResponse {
  hash:         string
  filename:     string
  duration_ms:  number
  signals:      string[]
  cached:       boolean
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
 * Envia o hash do arquivo no header X-Content-Hash para permitir cache server-side.
 * Se o backend já conhece o hash, retorna o modelo cacheado sem re-parsing.
 *
 * @param file  - arquivo CSV
 * @param hash  - hash SHA-1 no formato "sha1:<hex>" — calcular via computeHash() antes de chamar
 * @returns DatalogModel completo, hash do arquivo e flag `cached` (true = backend usou cache)
 *
 * @throws {ApiError} status 422 se o CSV não for reconhecido como datalog da MasterInjection
 * @throws {NetworkError} se o backend estiver inacessível
 * @throws {TimeoutError} se ultrapassar 120s (logs grandes podem demorar)
 */
export async function uploadDatalog(
  file: File,
  hash: string,
): Promise<{ hash: string; model: DatalogModel; cached: boolean }> {
  const raw = await apiUpload<UploadDatalogResponse>('/datalog/upload', file, 'file', {
    'X-Content-Hash': hash,
  })

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
    hash:        raw.hash,
    filename:    raw.filename,
    rows,
    duration_ms: raw.duration_ms,
    signals:     raw.signals,
  }

  return { hash: raw.hash, model, cached: raw.cached }
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
  engine_id:        string
  rpm_breakpoints:  number[]
  map_breakpoints:  number[]
  cells:            number[][]
  log_hashes:       string[]
  time_range:       { start_ms: number; end_ms: number } | null
  config:           Record<string, unknown>
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
 * @throws {ApiError} status 404 se algum hash de log não existir no disco do backend
 * @throws {ApiError} status 422 se a config for inválida para o engine selecionado
 * @throws {NetworkError} se o backend estiver inacessível
 * @throws {TimeoutError} se ultrapassar 120s
 */
export async function runTuning(req: TuningRunRequest): Promise<TuningOutput> {
  // Converte camelCase do frontend para snake_case do backend
  const body: TuningRunRequestRaw = {
    engine_id:        req.engineId,
    rpm_breakpoints:  req.rpmBreakpoints,
    map_breakpoints:  req.mapBreakpoints,
    cells:            req.cells,
    log_hashes:       req.logHashes,
    time_range:       req.timeRange,
    config:           req.config as Record<string, unknown>,
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

- `useMapStore.loadMap()` define `isLoading = true` antes de chamar `parseMapClient()` e `isLoading = false` após.
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
// Em useMapStore.ts — exemplo de como o store chama o parser client-side
import { parseMapClient } from '@/parsers/mapParser'

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
