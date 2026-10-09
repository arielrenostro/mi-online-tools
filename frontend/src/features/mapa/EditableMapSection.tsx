import { useMemo, useState } from 'react'
import MapWithChart from '@/components/MapWithChart'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Selection } from '@/utils/mapEditOps'
import { formatCellDiffTitle } from '@/utils/mapDiff'

interface Props {
  cells:          number[][]
  originalCells:  number[][]
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  isDirty:        boolean
  onCellChange:   (row: number, col: number, value: number) => void
  onBulkChange:   (changes: { row: number; col: number; value: number }[]) => void
  onReset:        () => void
  formatValue?:   (v: number | boolean | null) => string
  /** Formato dos valores no hover (original/atual); padrão: o mesmo da tabela. */
  formatTitleValue?: (v: number) => string
  onUndo?:        () => void
  onRedo?:        () => void
  canUndo?:       boolean
  canRedo?:       boolean
  selection?:         Selection
  onSelectionChange?: (selection: Selection) => void
  keyHandlerRef?:    { current: ((e: React.KeyboardEvent) => void) | null }
}

export default function EditableMapSection({
  cells, originalCells, rpmBreakpoints, mapBreakpoints,
  isDirty, onCellChange, onBulkChange, onReset, formatValue, formatTitleValue,
  onUndo, onRedo, canUndo, canRedo,
  selection, onSelectionChange, keyHandlerRef,
}: Props) {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  const modifiedCells = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (cells[r][c] !== originalCells[r][c]) s.add(`${r}:${c}`)
      }
    }
    return s
  }, [cells, originalCells])

  const fmt = formatValue ?? (v => v === null ? '—' : String(v as number))
  const fmtTitle = formatTitleValue ?? ((v: number) => fmt(v))

  // Hover de cada célula: valor original, atual e a diferença em percentual (VE, Ignição e Lambda).
  const cellTitle = (row: number, col: number) => {
    const original = originalCells[row]?.[col]
    const current  = cells[row]?.[col]
    if (original === undefined || current === undefined) return undefined
    return formatCellDiffTitle(original, current, fmtTitle)
  }

  return (
    <section className="px-5 pb-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Mapa Editável
      </h2>

      <MapWithChart
        cells={cells}
        rowHeaders={mapBreakpoints}
        colHeaders={rpmBreakpoints}
        colorScale="warm"
        readOnly={false}
        onCellChange={onCellChange}
        onBulkChange={onBulkChange}
        modifiedCells={modifiedCells}
        formatValue={fmt}
        cellTitle={cellTitle}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onReset={() => setConfirmResetOpen(true)}
        resetDisabled={!isDirty}
        selection={selection}
        onSelectionChange={onSelectionChange}
        keyHandlerRef={keyHandlerRef}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={() => { onReset(); setConfirmResetOpen(false) }}
        title="Resetar mapa"
        message="Todas as edições serão descartadas e o mapa voltará ao estado original. Deseja continuar?"
        confirmLabel="Resetar"
      />
    </section>
  )
}
