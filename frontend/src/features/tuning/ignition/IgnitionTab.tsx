import { useMapStore } from '@/store/mapStore'
import OriginalMapSection from '@/features/tuning/OriginalMapSection'
import EditableMapSection from '@/features/tuning/EditableMapSection'

export function IgnitionTab() {
  const originalMap         = useMapStore(s => s.originalMap)
  const editableIgnitionMap = useMapStore(s => s.editableIgnitionMap)
  const updateIgnitionCell  = useMapStore(s => s.updateIgnitionCell)
  const bulkUpdateIgnition  = useMapStore(s => s.bulkUpdateIgnitionCells)
  const resetIgnition       = useMapStore(s => s.resetIgnition)
  const isDirtyIgnition     = useMapStore(s => s.isDirtyIgnition)

  if (!originalMap || !editableIgnitionMap) return null

  return (
    <div className="max-w-screen-2xl mx-auto py-4 space-y-4">
      <OriginalMapSection
        cells={originalMap.ignitionCells}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
      />
      <EditableMapSection
        cells={editableIgnitionMap}
        originalCells={originalMap.ignitionCells}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
        isDirty={isDirtyIgnition}
        onCellChange={updateIgnitionCell}
        onBulkChange={bulkUpdateIgnition}
        onReset={resetIgnition}
      />
    </div>
  )
}
