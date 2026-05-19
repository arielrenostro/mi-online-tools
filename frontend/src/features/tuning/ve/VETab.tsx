import { useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import OriginalMapSection from '@/features/tuning/OriginalMapSection'
import EditableMapSection from '@/features/tuning/EditableMapSection'
import AutoTuningModal from '@/features/tuning/AutoTuningModal'

export function VETab() {
  const [autoTuningOpen, setAutoTuningOpen] = useState(false)

  const originalMap     = useMapStore(s => s.originalMap)
  const editableMap     = useMapStore(s => s.editableMap)
  const updateCell      = useMapStore(s => s.updateCell)
  const bulkUpdateCells = useMapStore(s => s.bulkUpdateCells)
  const resetEditable   = useMapStore(s => s.resetEditable)
  const isDirty         = useMapStore(s => s.isDirty)

  if (!originalMap || !editableMap) return null

  return (
    <div className="max-w-screen-2xl mx-auto py-4 space-y-4">
      <OriginalMapSection
        cells={originalMap.cells}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
      />
      <EditableMapSection
        cells={editableMap}
        originalCells={originalMap.cells}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
        isDirty={isDirty}
        onCellChange={updateCell}
        onBulkChange={bulkUpdateCells}
        onReset={resetEditable}
        onOpenAutoTuning={() => setAutoTuningOpen(true)}
      />
      <AutoTuningModal open={autoTuningOpen} onClose={() => setAutoTuningOpen(false)} />
    </div>
  )
}
