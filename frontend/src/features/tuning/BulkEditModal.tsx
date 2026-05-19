import { useState, useRef, useEffect } from 'react'

interface Props {
  cellCount: number
  onApply:   (type: 'pct' | 'fixed', value: number) => void
  onClose:   () => void
}

export default function BulkEditModal({ cellCount, onApply, onClose }: Props) {
  const [pct,   setPct]   = useState('')
  const [fixed, setFixed] = useState('')
  const pctRef = useRef<HTMLInputElement>(null)

  useEffect(() => { pctRef.current?.focus() }, [])

  function apply() {
    const fixedNum = parseFloat(fixed)
    const pctNum   = parseFloat(pct)
    if (!isNaN(fixedNum)) { onApply('fixed', fixedNum); return }
    if (!isNaN(pctNum))   { onApply('pct',   pctNum);   return }
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose() }
    if (e.key === 'Enter')  { e.stopPropagation(); e.preventDefault(); apply() }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKey}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-80 p-6">
        <h3 className="text-sm font-semibold text-gray-100 mb-0.5">Editar células selecionadas</h3>
        <p className="text-xs text-gray-500 mb-4">
          {cellCount} célula{cellCount !== 1 ? 's' : ''} selecionada{cellCount !== 1 ? 's' : ''}
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Percentual (%)</label>
            <input
              ref={pctRef}
              type="number"
              placeholder="+5 ou −10"
              value={pct}
              onChange={e => { setPct(e.target.value); setFixed('') }}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-600 mt-0.5">Ajusta cada célula pelo percentual indicado</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Valor fixo</label>
            <input
              type="number"
              placeholder="ex: 1000"
              value={fixed}
              onChange={e => { setFixed(e.target.value); setPct('') }}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-600 mt-0.5">Define todas as células para este valor</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={apply}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  )
}
