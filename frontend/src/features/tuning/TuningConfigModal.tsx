import { useState, useEffect } from 'react'
import type { TuningConfig } from '@/types/tuning'
import type { JSONSchema } from '@/types/engine'
import { DEFAULT_TUNING_CONFIG } from '@/types/tuning'

interface Props {
  open:         boolean
  onClose:      () => void
  config:       TuningConfig
  schema?:      JSONSchema
  onUpdate:     (partial: Partial<TuningConfig>) => void
  onReset:      () => void
}

const GROUPS: Record<string, string[]> = {
  'Filtros de dados': [
    'min_clt','lambda_loop_closed_only','skip_first_closed_loop',
    'skip_first_rpm_bucket','skip_first_map_bucket',
    'max_delta_rpm','max_delta_map','max_delta_lambda_target','max_lambda','max_delta_pedal',
  ],
  'Qualidade por célula': ['outlier_sigma','cv_threshold'],
  'Correção': ['weight_sample_base','max_correction_pct'],
  'Convergência': ['convergence_threshold'],
  'Pós-processamento': [
    'rpm400_rule_enabled','rpm400_discount',
    'low_map_rule_enabled','low_map_threshold','low_map_discount',
    'max_adjacent_gradient_pct',
  ],
}

export default function TuningConfigModal({ open, onClose, config, schema, onUpdate, onReset }: Props) {
  const [local, setLocal] = useState<TuningConfig>({ ...config })

  useEffect(() => { if (open) setLocal({ ...config }) }, [open, config])

  if (!open) return null

  function handleSave() {
    onUpdate(local)
    onClose()
  }

  function handleReset() {
    setLocal({ ...DEFAULT_TUNING_CONFIG })
    onReset()
  }

  function renderField(key: string) {
    const prop        = schema?.properties?.[key]
    const description = prop?.description ?? key
    const val         = local[key as keyof TuningConfig]
    const types       = Array.isArray(prop?.type) ? prop!.type : [prop?.type]
    const isNullable  = types.includes('null')
    const isBoolean   = types.includes('boolean')
    const isNumber    = types.includes('number') || types.includes('integer')

    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="text-xs text-gray-300 font-medium">{description}</label>
        {isBoolean ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(val)}
              onChange={e => setLocal(p => ({ ...p, [key]: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs text-gray-400">{val ? 'Ativado' : 'Desativado'}</span>
          </label>
        ) : isNullable ? (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={val !== null}
              onChange={e => setLocal(p => ({ ...p, [key]: e.target.checked ? (prop?.default ?? 0) : null }))}
              className="w-4 h-4 rounded"
            />
            <input
              type="number"
              value={val === null ? '' : (val as number)}
              disabled={val === null}
              step="any"
              onChange={e => setLocal(p => ({ ...p, [key]: parseFloat(e.target.value) || null }))}
              className="w-28 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 disabled:opacity-40"
            />
          </div>
        ) : isNumber ? (
          <input
            type="number"
            value={val as number}
            step="any"
            onChange={e => setLocal(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
            className="w-36 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100"
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Configurações de Tuning</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {Object.entries(GROUPS).map(([groupName, keys]) => (
            <div key={groupName}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{groupName}</h3>
              <div className="grid grid-cols-2 gap-4">
                {keys.map(k => renderField(k))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <button
            onClick={handleReset}
            className="text-sm text-gray-400 hover:text-gray-100 underline"
          >
            Restaurar padrões
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
