import { useState } from 'react'
import { DraftNumberField } from '@/components/DraftNumberField'
import { useConstantsStore, selectCalibrationFactor } from '@/store/constantsStore'

const positive = (n: number) => Number.isFinite(n) && n > 0

export function ConstantsPanel() {
  const values = useConstantsStore(s => s.values)
  const k      = useConstantsStore(selectCalibrationFactor)
  const set    = useConstantsStore(s => s.set)
  const reset  = useConstantsStore(s => s.reset)

  // Remonta os campos após "Restaurar padrões" para descartar texto inválido em edição.
  const [resetCount, setResetCount] = useState(0)

  function field(
    id: 'displacementCc' | 'afr' | 'bsfc' | 'veAtFull',
    label: string, unit: string | undefined, labelWidth?: string, title?: string,
  ) {
    return (
      <DraftNumberField
        key={`${id}-${resetCount}`}
        label={label}
        unit={unit}
        labelWidth={labelWidth}
        title={title}
        value={values[id]}
        isValid={positive}
        invalidMessage="Informe um número maior que zero"
        onCommit={v => set({ [id]: v as number })}
      />
    )
  }

  return (
    <div className="mt-6 pt-5 border-t border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Constantes</h3>
        <button
          onClick={() => { reset(); setResetCount(c => c + 1) }}
          className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors"
        >
          Restaurar padrões
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Usadas para estimar Potência e Torque (VE Lambda Corrigido, Potência e Torque nas abas
        Dashboard, Gráficos, Dados e Dinamômetro). Não afetam o fator de correção do mapa.
      </p>

      <div className="flex flex-col gap-2">
        {field('displacementCc', 'Cilindrada', 'cc')}
        {field('afr', 'AFR estequiométrico', undefined)}
        {field('bsfc', 'BSFC', 'lb/cv·h')}
        {field('veAtFull', 'Qual o valor de VE atual onde a VE deveria ser 100%?', undefined, 'w-72')}
        <p className="text-xs text-gray-500 ml-1">
          Olhe no mapa a célula onde a VE deveria ser 100% e informe o valor que está lá hoje, na
          mesma escala da tabela (100% = 1000). Fator de calibração:{' '}
          <span className="text-gray-300 font-mono">k = {k.toFixed(3)}</span>
        </p>
      </div>
    </div>
  )
}
