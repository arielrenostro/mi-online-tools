import { useState } from 'react'
import { DraftNumberField } from '@/components/DraftNumberField'
import { useCorrectionSettingsStore, isValidConfidenceK } from '@/store/correctionSettingsStore'

/** Seção "Correção — Ponderado" da tela Configurações: a constante k de confiança. */
export function WeightingPanel() {
  const k     = useCorrectionSettingsStore(s => s.values.confidenceK)
  const set   = useCorrectionSettingsStore(s => s.set)
  const reset = useCorrectionSettingsStore(s => s.reset)

  // Remonta o campo após "Restaurar padrão" para descartar texto inválido em edição.
  const [resetCount, setResetCount] = useState(0)

  return (
    <section aria-labelledby="weighting-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="weighting-title" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Correção — Ponderado</h2>
        <button
          onClick={() => { reset(); setResetCount(c => c + 1) }}
          className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 transition-colors"
        >
          Restaurar padrão
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        A tabela <strong className="text-gray-300">Ponderado</strong> da aba Eficiência Volumétrica amortece a correção direta de cada célula pela
        quantidade de amostras <span className="font-mono">n</span>: <span className="font-mono text-gray-300">peso = n / (n + k)</span>,
        e o fator ponderado é <span className="font-mono text-gray-300">1 + (direto − 1) × peso</span>. Quanto maior o k, mais
        amostras são necessárias para confiar na correção (uma célula com n = k aplica metade dela). Com k = 0 o ponderado
        fica igual ao direto. Vale para os runs já gerados e para o que “Aplicar correções no mapa” escreve; não altera os runs.
      </p>

      <DraftNumberField
        key={`k-${resetCount}`}
        label="k — constante de confiança"
        labelWidth="w-56"
        value={k}
        isValid={isValidConfidenceK}
        invalidMessage="Informe um número maior ou igual a zero"
        onCommit={v => set({ confidenceK: v as number })}
      />
    </section>
  )
}
