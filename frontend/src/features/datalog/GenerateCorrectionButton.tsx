import { useMemo, useState } from 'react'
import { useLogStore } from '@/store/logStore'
import { useMapStore } from '@/store/mapStore'
import { useFilterMask } from '@/hooks/useFilterMask'
import { countQualifyingPoints, generateBlockReason, GENERATE_BLOCK_MESSAGES } from '@/utils/generationSummary'
import { GenerateCorrectionDialog } from './GenerateCorrectionDialog'

/**
 * "Gerar Correção" do cabeçalho do Datalog (qualquer aba, menos Dinamômetro). Só o rótulo: o resumo
 * do que será usado e a escolha de considerar o intervalo da TimeRail ficam no diálogo de confirmação.
 */
export function GenerateCorrectionButton() {
  const [open, setOpen] = useState(false)
  const logs   = useLogStore(s => s.logs)
  const hasMap = useMapStore(s => s.originalMap !== null)
  const mask   = useFilterMask()

  // Bloqueio só pelo filtro (sem intervalo): o diálogo trata o caso do intervalo vazio.
  const passing = useMemo(() => countQualifyingPoints(logs, mask, null), [logs, mask])
  const reason  = generateBlockReason(hasMap, passing)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={reason !== null}
        title={reason ? GENERATE_BLOCK_MESSAGES[reason] : 'Gera um run de correção com os pontos que passam no filtro'}
        className="px-3 h-6 flex items-center rounded-full bg-blue-700 hover:bg-blue-600 text-xs font-medium text-white transition-colors disabled:opacity-40 disabled:hover:bg-blue-700 disabled:cursor-not-allowed"
      >
        Gerar Correção
      </button>
      <GenerateCorrectionDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
