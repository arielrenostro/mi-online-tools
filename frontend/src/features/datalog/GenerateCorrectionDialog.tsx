import { useEffect, useMemo, useState } from 'react'
import { runWithBusy } from '@/utils/runWithBusy'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@/components/Switch'
import { useLogStore } from '@/store/logStore'
import { useTimeStore } from '@/store/timeStore'
import { useFilterStore } from '@/store/filterStore'
import { useCorrectionStore } from '@/store/correctionStore'
import { useToastStore } from '@/store/toastStore'
import { useFilterMask } from '@/hooks/useFilterMask'
import { countEnabled } from '@/types/filter'
import { countQualifyingPoints } from '@/utils/generationSummary'
import { fmtClock } from '@/utils/runRecipe'

interface Props {
  open:    boolean
  onClose: () => void
}

/** O corpo só existe com o diálogo aberto: cada abertura recalcula o padrão do switch do intervalo. */
export function GenerateCorrectionDialog({ open, onClose }: Props) {
  if (!open) return null
  return <GenerateCorrectionDialogBody onClose={onClose} />
}

function GenerateCorrectionDialogBody({ onClose }: { onClose: () => void }) {
  const navigate  = useNavigate()
  const logs      = useLogStore(s => s.logs)
  const selection = useTimeStore(s => s.selection)
  const filter    = useFilterStore(s => s.filter)
  const mask      = useFilterMask()
  const generate  = useCorrectionStore(s => s.generate)
  const select    = useCorrectionStore(s => s.select)

  const hasSelection = selection !== null
  const [useSelection, setUseSelection] = useState(hasSelection)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeLogs = useMemo(() => logs.filter(l => l.enabled), [logs])
  const qualifying = useMemo(
    () => countQualifyingPoints(logs, mask, hasSelection && useSelection ? selection : null),
    [logs, mask, selection, hasSelection, useSelection],
  )
  const criteria = countEnabled(filter)

  function handleConfirm() {
    // Fecha a dialog antes: gerar o run percorre todos os pontos (síncrono) e a dialog não pode ficar travada na tela.
    const useTimeSelection = hasSelection && useSelection
    onClose()
    runWithBusy('Gerando correção…', () => {
      const run = generate({ useTimeSelection })
      if (!run) return
      useToastStore.getState().show({
        message:     `Run “${run.name}” gerado`,
        actionLabel: 'Ver em Eficiência Volumétrica →',
        onAction:    () => { select(run.id); navigate('/mapa/ve') },
      })
    })
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Gerar Correção" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-gray-100">Gerar Correção</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Cria um <strong className="text-gray-100">run de correção</strong> com os pontos dos logs ativos que passam no filtro
            atual. O run guarda, por célula do mapa, a quantidade de amostras e a média, mediana e moda do VE Lambda; os
            fatores são sempre calculados na aba Eficiência Volumétrica contra o mapa carregado. Runs anteriores não são alterados.
          </p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-gray-500">Pontos que qualificam</dt>
            <dd className="text-gray-200 tabular-nums" data-testid="qualifying">{qualifying.toLocaleString()}</dd>
            <dt className="text-gray-500">Critérios do filtro</dt>
            <dd className="text-gray-200">{criteria} ligados</dd>
            <dt className="text-gray-500">Logs ativos</dt>
            <dd className="text-gray-200 break-words">{activeLogs.map(l => l.filename).join(', ') || '—'}</dd>
          </dl>

          <div className="flex items-start gap-3 rounded-lg border border-gray-700 bg-gray-950/60 px-4 py-3">
            <Switch
              checked={hasSelection && useSelection}
              onChange={setUseSelection}
              disabled={!hasSelection}
              label="Considerar o intervalo selecionado na linha do tempo"
            />
            <div className="text-xs">
              <p className="text-gray-200">Considerar o intervalo selecionado na linha do tempo</p>
              <p className="text-gray-500 mt-0.5">
                {hasSelection
                  ? `Intervalo ${fmtClock(selection.start_ms)}–${fmtClock(selection.end_ms)}. Desligado, todos os pontos dos logs ativos que passam no filtro entram.`
                  : 'Nenhum intervalo selecionado na linha do tempo — todos os pontos dos logs ativos que passam no filtro entram.'}
              </p>
            </div>
          </div>

          {qualifying === 0 && (
            <p role="alert" className="text-xs text-yellow-500">
              Nenhum ponto qualifica com o filtro{hasSelection && useSelection ? ' e o intervalo atuais' : ' atual'}.
              {hasSelection && useSelection ? ' Desligue o intervalo para considerar todos os pontos.' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={qualifying === 0}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-sm font-medium text-white transition-colors"
          >
            Gerar Correção
          </button>
        </div>
      </div>
    </div>
  )
}
