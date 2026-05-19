import { apiFetch } from './client'
import type { EngineInfo, JSONSchema } from '@/types/engine'

interface RawEngineInfo {
  engine_id:       string
  name:            string
  description:     string
  objective:       string
  target_map_type: string
  default_config:  Record<string, unknown>
  config_schema:   JSONSchema
}

function mapEngine(r: RawEngineInfo): EngineInfo {
  return {
    engineId:      r.engine_id,
    name:          r.name,
    description:   r.description,
    objective:     r.objective,
    targetMapType: r.target_map_type as EngineInfo['targetMapType'],
    defaultConfig: r.default_config,
    configSchema:  r.config_schema,
  }
}

export async function listEngines(): Promise<EngineInfo[]> {
  const raw = await apiFetch<RawEngineInfo[]>('/api/engines')
  return raw.map(mapEngine)
}

export async function getEngine(engineId: string): Promise<EngineInfo> {
  const raw = await apiFetch<RawEngineInfo>(`/api/engines/${engineId}`)
  return mapEngine(raw)
}
