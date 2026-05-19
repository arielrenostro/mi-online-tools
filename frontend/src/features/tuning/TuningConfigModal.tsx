import { useState, useEffect } from 'react'
import type { TuningConfig } from '@/types/tuning'
import type { JSONSchema } from '@/types/engine'
import { DEFAULT_TUNING_CONFIG } from '@/types/tuning'
import TuningConfigForm from './TuningConfigForm'

interface Props {
  open:     boolean
  onClose:  () => void
  config:   TuningConfig
  schema?:  JSONSchema
  onUpdate: (partial: Partial<TuningConfig>) => void
  onReset:  () => void
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Configurações de Tuning</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <TuningConfigForm local={local} schema={schema} setLocal={setLocal} />

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
