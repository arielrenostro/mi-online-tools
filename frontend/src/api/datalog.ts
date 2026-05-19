import { apiFetch, UPLOAD_TIMEOUT_MS } from './client'
import type { DatalogModel, DatalogRow } from '@/types/datalog'

interface RawDatalogRow {
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
}

interface RawUploadResponse {
  hash:        string
  filename:    string
  duration_ms: number
  signals:     string[]
  cached:      boolean
  rows:        RawDatalogRow[]
}

function mapRow(r: RawDatalogRow): DatalogRow {
  return {
    timestamp_ms:   r.timestamp_ms,
    rpm:            r.rpm,
    mapKpa:         r.map_kpa,
    lambda1:        r.lambda1,
    lambdaCorrecao: r.lambda_correcao,
    lambdaTarget:   r.lambda_target,
    veValueRaw:     r.ve_value_raw,
    clt:            r.clt,
    lambdaLoop:     r.lambda_loop,
    pedal:          r.pedal,
  }
}

export async function uploadDatalog(
  file: File,
  hash: string,
): Promise<DatalogModel & { cached: boolean }> {
  const body = new FormData()
  body.append('file', file)

  const raw = await apiFetch<RawUploadResponse>('/api/datalog/upload', {
    method:    'POST',
    body,
    headers:   { 'X-Content-Hash': hash },
    timeoutMs: UPLOAD_TIMEOUT_MS,
  })

  return {
    hash:        raw.hash,
    filename:    raw.filename,
    duration_ms: raw.duration_ms,
    signals:     raw.signals,
    rows:        raw.rows.map(mapRow),
    cached:      raw.cached,
  }
}
