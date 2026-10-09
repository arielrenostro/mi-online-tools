import { useEffect, useRef, useState } from 'react'
import { useCorrectionStore, isRunCompatible } from '@/store/correctionStore'
import { useMapStore } from '@/store/mapStore'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { CorrectionRun } from '@/types/correction'
import { defaultRunName } from '@/utils/correctionGeneration'

function runLabel(run: CorrectionRun, compatible: boolean): string {
  // O nome padrão já é a data e hora de criação: só repete o horário quando o usuário renomeou.
  const renamed = run.name !== defaultRunName(run.createdAt)
  const when    = new Date(run.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const logs    = run.recipe.logs.length
  return [run.name, renamed ? when : null, `${logs} log${logs === 1 ? '' : 's'}`, compatible ? null : 'incompatível com o mapa']
    .filter(Boolean).join(' · ')
}

/** Seletor do histórico de runs da seção de correção: escolher, renomear e excluir. */
export function RunSelector() {
  const runs          = useCorrectionStore(s => s.runs)
  const selectedRunId = useCorrectionStore(s => s.selectedRunId)
  const select        = useCorrectionStore(s => s.select)
  const rename        = useCorrectionStore(s => s.rename)
  const remove        = useCorrectionStore(s => s.remove)
  const originalMap   = useMapStore(s => s.originalMap)

  const selected = runs.find(r => r.id === selectedRunId) ?? null

  const [editing, setEditing]           = useState(false)
  const [draftName, setDraftName]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  // Trocar de run descarta uma renomeação em andamento.
  useEffect(() => { setEditing(false) }, [selectedRunId])

  function startRename() {
    if (!selected) return
    setDraftName(selected.name)
    setEditing(true)
  }
  function commitRename() {
    if (selected) rename(selected.id, draftName)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        aria-label="Run de correção"
        value={selectedRunId ?? ''}
        onChange={e => select(e.target.value === '' ? null : e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 max-w-md"
      >
        {selected === null && <option value="">Selecione um run…</option>}
        {runs.map(r => (
          <option key={r.id} value={r.id}>{runLabel(r, isRunCompatible(r, originalMap))}</option>
        ))}
      </select>

      {selected && (editing ? (
        <input
          ref={inputRef}
          aria-label="Nome do run"
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="bg-gray-900 border border-blue-600 rounded px-2 py-1 text-xs text-gray-100 w-48"
        />
      ) : (
        <button onClick={startRename} className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors">
          Renomear
        </button>
      ))}

      {selected && (
        <button onClick={() => setConfirmDelete(true)} className="px-2 py-1 rounded bg-gray-800 hover:bg-red-900/60 text-xs text-gray-300 transition-colors">
          Excluir
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { if (selected) remove(selected.id); setConfirmDelete(false) }}
        title="Excluir run"
        message={`O run “${selected?.name ?? ''}” será removido do histórico. Isso não altera o mapa.`}
        confirmLabel="Excluir"
      />
    </div>
  )
}
