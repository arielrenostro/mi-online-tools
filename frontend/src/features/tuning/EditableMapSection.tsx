import { useMemo, useState } from 'react'
import MapWithChart from '@/components/MapWithChart'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Props {
  cells:          number[][]
  originalCells:  number[][]
  rpmBreakpoints: number[]
  mapBreakpoints: number[]
  isDirty:        boolean
  onCellChange:   (row: number, col: number, value: number) => void
  onBulkChange:   (changes: { row: number; col: number; value: number }[]) => void
  onReset:        () => void
  onOpenAutoTuning?: () => void
  formatValue?:   (v: number | boolean | null) => string
}

export default function EditableMapSection({
  cells, originalCells, rpmBreakpoints, mapBreakpoints,
  isDirty, onCellChange, onBulkChange, onReset, onOpenAutoTuning, formatValue,
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

  return (
    <section className="px-5 pb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Mapa Editável
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmResetOpen(true)}
            disabled={!isDirty}
            className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Resetar
          </button>
          {onOpenAutoTuning && (
            <button
              onClick={onOpenAutoTuning}
              className="px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs text-white transition-colors"
            >
              Auto Tuning
            </button>
          )}
        </div>
      </div>

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
