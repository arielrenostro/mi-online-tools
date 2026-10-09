import { useMemo, useRef, useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useSessionStore } from '@/store/sessionStore'
import { SessionRestoringSpinner } from '@/components/guards/SessionRestoringSpinner'
import ConfirmDialog from '@/components/ConfirmDialog'
import { exportMapCsv, downloadCsv } from '@/utils/mapExporter'
import { summarizeMap, type MapInfo } from '@/utils/mapInfo'

const isCsv = (f: File) => f.name.toLowerCase().endsWith('.csv')

function UploadIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function editedLabel(n: number): string {
  if (n === 0) return 'sem edições'
  return `${n} ${n === 1 ? 'célula editada' : 'células editadas'}`
}

function InfoRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2 border-b border-gray-800 last:border-b-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`text-sm text-right ${muted ? 'text-gray-500' : 'text-gray-200'} break-all`}>{value}</dd>
    </div>
  )
}

function MapInfoCard({ info }: { info: MapInfo }) {
  return (
    <section className="rounded-2xl border border-gray-700 bg-gray-900 px-5 py-3">
      <h2 className="text-sm font-semibold text-gray-300 py-2">Informações do mapa</h2>
      <dl>
        <InfoRow label="Arquivo" value={info.name} />
        <InfoRow label="Grade" value={`${info.rpmCount} colunas de RPM × ${info.mapCount} linhas de MAP`} />
        <InfoRow label="Faixa de RPM" value={`${info.rpmMin} – ${info.rpmMax}`} />
        <InfoRow label="Faixa de MAP" value={`${info.mapMin} – ${info.mapMax} kPa`} />
        <InfoRow label="VE" value={editedLabel(info.editedVe)} muted={info.editedVe === 0} />
        <InfoRow label="Ignição" value={editedLabel(info.editedIgnition)} muted={info.editedIgnition === 0} />
        <InfoRow label="Lambda alvo" value={editedLabel(info.editedLambda)} muted={info.editedLambda === 0} />
      </dl>
    </section>
  )
}

export function ArquivoTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  const isRestoring         = useSessionStore(s => s.isRestoring)
  const originalMap         = useMapStore(s => s.originalMap)
  const editableMap         = useMapStore(s => s.editableMap)
  const editableIgnitionMap = useMapStore(s => s.editableIgnitionMap)
  const editableLambdaMap   = useMapStore(s => s.editableLambdaMap)
  const hasEdits            = useMapStore(s => s.isDirty || s.isDirtyIgnition || s.isDirtyLambda)
  const isLoading           = useMapStore(s => s.isLoading)
  const lastError           = useMapStore(s => s.lastError)
  const loadMap             = useMapStore(s => s.loadMap)
  const clear               = useMapStore(s => s.clear)

  const info = useMemo(
    () => (originalMap ? summarizeMap(originalMap, editableMap, editableIgnitionMap, editableLambdaMap) : null),
    [originalMap, editableMap, editableIgnitionMap, editableLambdaMap],
  )

  if (isRestoring) return <SessionRestoringSpinner />

  const hasMap = originalMap !== null

  async function requestLoad(file: File | undefined) {
    if (!file || !isCsv(file) || isLoading) return
    if (hasMap && hasEdits) setPendingFile(file)
    else await loadMap(file)
  }

  async function confirmReplace() {
    const file = pendingFile
    setPendingFile(null)
    if (file) await loadMap(file)
  }

  async function confirmRemove() {
    setRemoveOpen(false)
    await clear()
  }

  function handleExport() {
    if (!originalMap || !editableMap) return
    const content = exportMapCsv(originalMap.rawLines, editableMap, editableIgnitionMap, editableLambdaMap)
    downloadCsv(content, `${originalMap.name.replace(/\.csv$/i, '')}_tuned.csv`)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const csv = Array.from(e.dataTransfer.files).find(isCsv)
    void requestLoad(csv)
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    await requestLoad(file)
  }

  const btn = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-5">
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handlePick} />

      {lastError && (
        <p role="alert" className="text-sm text-red-400 bg-red-950 rounded-lg p-3">{lastError}</p>
      )}

      {!hasMap && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-5 text-center rounded-2xl border border-dashed border-gray-700 px-6 py-16"
        >
          <UploadIcon className="w-12 h-12 text-gray-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-300">Nenhum mapa carregado</h2>
            <p className="text-sm text-gray-500 mt-1">
              Importe um arquivo CSV da MasterInjection, ou solte-o aqui.
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isLoading}
            className={`${btn} bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5`}
          >
            {isLoading ? 'Importando…' : 'Importar mapa'}
          </button>
        </div>
      )}

      {hasMap && info && (
        <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="flex flex-col gap-5">
          <MapInfoCard info={info} />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isLoading}
              className={`${btn} bg-gray-800 hover:bg-gray-700 text-gray-200`}
            >
              {isLoading ? 'Importando…' : 'Importar mapa'}
            </button>
            <button onClick={handleExport} className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`}>
              Exportar mapa
            </button>
            <button
              onClick={() => setRemoveOpen(true)}
              disabled={isLoading}
              className={`${btn} ml-auto bg-gray-800 hover:bg-red-900 text-red-300`}
            >
              Remover mapa
            </button>
          </div>
          <p className="text-xs text-gray-600">Você também pode soltar um CSV nesta área para substituir o mapa.</p>
        </div>
      )}

      <ConfirmDialog
        open={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        onConfirm={confirmReplace}
        title="Importar novo mapa?"
        message="O mapa atual tem edições, que serão perdidas ao carregar o novo arquivo. Exporte antes se quiser guardá-las."
        confirmLabel="Importar"
      />
      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={confirmRemove}
        title="Remover mapa?"
        message={
          hasEdits
            ? 'O mapa e as edições feitas nele serão descartados. Exporte antes se quiser guardá-las. Logs e runs de correção não são afetados.'
            : 'O mapa será descartado. Logs e runs de correção não são afetados.'
        }
        confirmLabel="Remover"
      />
    </div>
  )
}
