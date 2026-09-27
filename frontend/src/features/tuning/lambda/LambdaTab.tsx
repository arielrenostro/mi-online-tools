import { useMemo } from 'react'
import { useMapStore } from '@/store/mapStore'
import OriginalMapSection from '@/features/tuning/OriginalMapSection'
import EditableMapSection from '@/features/tuning/EditableMapSection'

const SCALE = 1000

function fmtLambda(v: number | boolean | null): string {
  if (v === null) return '—'
  return (v as number).toFixed(2)
}

export function LambdaTab() {
  const originalMap       = useMapStore(s => s.originalMap)
  const editableLambdaMap = useMapStore(s => s.editableLambdaMap)
  const updateLambdaCell  = useMapStore(s => s.updateLambdaCell)
  const bulkUpdateLambda  = useMapStore(s => s.bulkUpdateLambdaCells)
  const resetLambda       = useMapStore(s => s.resetLambda)
  const isDirtyLambda     = useMapStore(s => s.isDirtyLambda)
  const undoLambda        = useMapStore(s => s.undoLambda)
  const redoLambda        = useMapStore(s => s.redoLambda)
  const canUndo           = useMapStore(s => s.historyLambda.length > 0)
  const canRedo           = useMapStore(s => s.futureLambda.length > 0)

  const displayOriginalLambda = useMemo(
    () => originalMap?.lambdaCells.map(row => row.map(v => v / SCALE)) ?? [],
    [originalMap],
  )

  const displayLambdaMap = useMemo(
    () => editableLambdaMap?.map(row => row.map(v => v / SCALE)) ?? null,
    [editableLambdaMap],
  )

  if (!originalMap || !displayLambdaMap) return null

  function handleCellChange(row: number, col: number, value: number) {
    updateLambdaCell(row, col, Math.round(value * SCALE))
  }

  function handleBulkChange(changes: { row: number; col: number; value: number }[]) {
    bulkUpdateLambda(changes.map(ch => ({ ...ch, value: Math.round(ch.value * SCALE) })))
  }

  return (
    <div className="max-w-screen-2xl mx-auto py-4 space-y-4">
      <OriginalMapSection
        cells={displayOriginalLambda}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
        formatValue={fmtLambda}
      />
      <EditableMapSection
        cells={displayLambdaMap}
        originalCells={displayOriginalLambda}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
        isDirty={isDirtyLambda}
        onCellChange={handleCellChange}
        onBulkChange={handleBulkChange}
        onReset={resetLambda}
        formatValue={fmtLambda}
        onUndo={undoLambda}
        onRedo={redoLambda}
        canUndo={canUndo}
        canRedo={canRedo}
      />
    </div>
  )
}
