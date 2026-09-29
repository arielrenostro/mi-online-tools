import { useCallback, useEffect, useRef, useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import OriginalMapSection from '@/features/tuning/OriginalMapSection'
import EditableMapSection from '@/features/tuning/EditableMapSection'
import CorrectionSection from '@/features/tuning/CorrectionSection'
import { isInsideMapGrid } from '@/utils/mapGridSelection'
import type { Selection } from '@/utils/mapEditOps'

export function VETab() {
  const originalMap     = useMapStore(s => s.originalMap)
  const editableMap     = useMapStore(s => s.editableMap)
  const updateCell      = useMapStore(s => s.updateCell)
  const bulkUpdateCells = useMapStore(s => s.bulkUpdateCells)
  const resetEditable   = useMapStore(s => s.resetEditable)
  const isDirty         = useMapStore(s => s.isDirty)
  const undo            = useMapStore(s => s.undo)
  const redo            = useMapStore(s => s.redo)
  const canUndo         = useMapStore(s => s.history.length > 0)
  const canRedo         = useMapStore(s => s.future.length > 0)

  // One cursor for the original map, the editable map, their charts and the correction tables.
  // Session-only; cleared by Escape or by a click outside every table (see below).
  const [selection, setSelection] = useState<Selection>(null)

  // The editable map registers its value-editing shortcuts here; read-only tables forward to it.
  const editKeyRef = useRef<((e: React.KeyboardEvent) => void) | null>(null)
  const delegateKey = useCallback((e: React.KeyboardEvent) => { editKeyRef.current?.(e) }, [])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!isInsideMapGrid(e.target)) setSelection(null)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  if (!originalMap || !editableMap) return null

  return (
    <div className="max-w-screen-2xl mx-auto py-4 space-y-4">
      <OriginalMapSection
        cells={originalMap.cells}
        rpmBreakpoints={originalMap.rpmBreakpoints}
        mapBreakpoints={originalMap.mapBreakpoints}
        selection={selection}
        onSelectionChange={setSelection}
        onKeyDelegate={delegateKey}
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
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        selection={selection}
        onSelectionChange={setSelection}
        keyHandlerRef={editKeyRef}
      />
      <CorrectionSection
        selection={selection}
        onSelectionChange={setSelection}
        onKeyDelegate={delegateKey}
      />
    </div>
  )
}
