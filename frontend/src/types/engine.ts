export type MapType = 'fuel_ve' | 'ignition' | 'lambda' | 'boost'

export interface JSONSchemaProperty {
  type:         'number' | 'integer' | 'boolean' | 'string' | string | string[]
  title?:       string
  description?: string
  default?:     unknown
  minimum?:     number
  maximum?:     number
  enum?:        unknown[]
  nullable?:    boolean
}

export interface JSONSchema {
  $schema?:    string
  type:        'object'
  title?:      string
  properties:  Record<string, JSONSchemaProperty>
  required?:   string[]
}

export interface EngineInfo {
  engineId:       string
  name:           string
  description:    string
  objective:      string
  targetMapType:  MapType
  defaultConfig:  Record<string, unknown>
  configSchema:   JSONSchema
}
