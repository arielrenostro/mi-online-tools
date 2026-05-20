import React, { useRef, useEffect, useState, useCallback, memo, useMemo, useContext } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { useUIStore, flattenPanels } from '@/store/uiStore'
import { useTimeStore } from '@/store/timeStore'
import { useLogStore, selectAllRows, selectAllSignals } from '@/store/logStore'
import { SIGNAL_MAP } from '@/signals/signalRegistry'
import type { ChartLayout, ChartPanel } from '@/types/ui'
import type { DatalogRow, TimeSelection } from '@/types/datalog'

const GROUP_ID = 'datalog-charts'

const SIGNAL_COLORS: Record<string, string> = {
  'RPM':           '#60a5fa',
  'MAP':           '#34d399',
  'Lambda 1':      '#fbbf24',
  'Lambda Target': '#a78bfa',
  'Lambda Corr':   '#f87171',
  'CLT':           '#fb923c',
  'Lambda Loop':   '#4ade80',
  'Pedal':         '#e879f9',
}
const PALETTE = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#fb923c', '#4ade80', '#e879f9']

function sigColor(signal: string, idx: number): string {
  return SIGNAL_COLORS[signal] ?? PALETTE[idx % PALETTE.length]
}

function findLastRow(rows: DatalogRow[], t: number): DatalogRow | null {
  if (!rows.length || rows[0].timestamp_ms > t) return null
  let lo = 0, hi = rows.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (rows[mid].timestamp_ms <= t) lo = mid
    else hi = mid - 1
  }
  return rows[lo]
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function buildOption(
  signals: string[],
  rows: DatalogRow[],
  selection: TimeSelection | null,
): object {
  if (signals.length === 0) return {}

  const rightCount = Math.max(0, signals.length - 1)
  const yAxes = signals.map((sig, i) => {
    const def = SIGNAL_MAP.get(sig)
    return {
      type:      'value',
      min:       def?.min,
      max:       def?.max,
      position:  i === 0 ? 'left' : 'right',
      offset:    i > 1 ? (i - 1) * 52 : 0,
      axisLabel: { color: sigColor(sig, i), fontSize: 9 },
      axisLine:  { show: true, lineStyle: { color: sigColor(sig, i) } },
      splitLine: { show: i === 0, lineStyle: { color: '#1f2937' } },
    }
  })

  const series = signals.map((sig, i) => ({
    name:           sig,
    type:           'line',
    yAxisIndex:     i,
    data:           rows.map(r => [r.timestamp_ms, r[sig] ?? NaN]),
    sampling:       'lttb',
    large:          true,
    largeThreshold: 2000,
    symbol:         'none',
    lineStyle:      { color: sigColor(sig, i), width: 1.5 },
    itemStyle:      { color: sigColor(sig, i) },
  }))

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { left: 52, right: rightCount > 0 ? rightCount * 52 + 20 : 20, top: 8, bottom: 28 },
    xAxis: {
      type: 'value',
      min:  selection?.start_ms ?? 'dataMin',
      max:  selection?.end_ms   ?? 'dataMax',
      axisLabel: { formatter: fmtMs, color: '#6b7280', fontSize: 9 },
      splitLine: { show: false },
      axisLine:  { lineStyle: { color: '#374151' } },
    },
    yAxis: yAxes,
    series,
    tooltip: {
      trigger:     'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#6b7280', type: 'dashed' },
        label: {
          backgroundColor: '#1f2937',
          color: '#9ca3af',
          fontSize: 9,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (params: any) => fmtMs(params.value as number),
        },
      },
      backgroundColor: 'rgba(17,24,39,0.95)',
      borderColor:     '#374151',
      textStyle:       { color: '#d1d5db', fontSize: 11 },
      formatter(params: any[]) {
        if (!params?.length) return ''
        const t = params[0].value[0] as number
        const row = findLastRow(rows, t)
        const lines: string[] = [`<span style="color:#6b7280;font-size:10px">t = ${fmtMs(t)}</span>`]
        signals.forEach((sig, i) => {
          const def = SIGNAL_MAP.get(sig)
          const value = row?.[sig]
          const v = typeof value === 'number' && !isNaN(value)
            ? (def ? def.format(value) : value.toFixed(3))
            : '—'
          lines.push(`<span style="color:${sigColor(sig, i)}">${sig}: ${v}</span>`)
        })
        return lines.join('<br/>')
      },
    },
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
  }
}

// ─── Signal Chip ──────────────────────────────────────────────────────────────

function SignalChip({ signal, idx, onRemove }: { signal: string; idx: number; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: sigColor(signal, idx) + '22',
        color:           sigColor(signal, idx),
        border:          `1px solid ${sigColor(signal, idx)}44`,
      }}
    >
      {signal}
      <button onClick={onRemove} className="hover:opacity-60 leading-none ml-0.5">×</button>
    </span>
  )
}

// ─── Add Signal Dropdown ──────────────────────────────────────────────────────

function AddSignalDropdown({ available, onAdd }: { available: string[]; onAdd: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (available.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
      >
        + Sinal ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-xl min-w-36 py-1 max-h-60 overflow-y-auto">
          {available.map(sig => (
            <button
              key={sig}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => { onAdd(sig); setOpen(false) }}
            >
              {sig}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panel View ───────────────────────────────────────────────────────────────

const PanelView = memo(function PanelView({
  panel,
  rows,
  cursor_ms,
  selection,
  allSignals,
  panelCount,
}: {
  panel:      ChartPanel
  rows:       DatalogRow[]
  cursor_ms:  number | null
  selection:  TimeSelection | null
  allSignals: string[]
  panelCount: number
}) {
  const chartRef = useRef<ReactECharts>(null)
  const cursorRef = useRef(cursor_ms)
  cursorRef.current = cursor_ms

  const syncCtx = useContext(ChartSyncContext)

  const updatePanelSignals = useUIStore(s => s.updatePanelSignals)
  const addChartPanel      = useUIStore(s => s.addChartPanel)
  const removeChartPanel   = useUIStore(s => s.removeChartPanel)

  const available = allSignals.filter(s => !panel.signals.includes(s))

  const option = useMemo(
    () => buildOption(panel.signals, rows, selection),
    [panel.signals, rows, selection],
  )

  const applyMarkLine = useCallback((inst: echarts.ECharts, ms: number | null) => {
    if (panel.signals.length === 0) return
    inst.setOption({
      series: [{
        markLine: ms !== null ? {
          silent:    true,
          symbol:    ['none', 'none'],
          lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
          data:      [{ xAxis: ms }],
          label:     { show: false },
        } : { data: [] },
      }],
    })
  }, [panel.signals.length])

  // Re-apply cursor whenever option rebuilds or cursor moves
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.()
    if (inst) applyMarkLine(inst, cursor_ms)
  }, [cursor_ms, option, applyMarkLine])

  const onChartReady = useCallback((inst: echarts.ECharts) => {
    inst.group = GROUP_ID
    echarts.connect(GROUP_ID)
    applyMarkLine(inst, cursorRef.current)
    syncCtx?.registerChart(panel.panelId, inst)
  }, [applyMarkLine, syncCtx, panel.panelId])

  // Unregister on unmount
  useEffect(() => {
    return () => { syncCtx?.unregisterChart(panel.panelId) }
  }, [syncCtx, panel.panelId])

  // Re-register when syncCtx changes (ensures datazoom listener is attached after context refresh)
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.()
    if (inst && syncCtx) syncCtx.registerChart(panel.panelId, inst)
  }, [syncCtx, panel.panelId])

  return (
    <div className="flex flex-col h-full min-h-0 border border-gray-700 rounded">
      {/* Control bar */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">
        {panel.signals.map((sig, i) => (
          <SignalChip
            key={sig}
            signal={sig}
            idx={i}
            onRemove={() => updatePanelSignals(panel.panelId, panel.signals.filter(s => s !== sig))}
          />
        ))}
        <AddSignalDropdown
          available={available}
          onAdd={sig => updatePanelSignals(panel.panelId, [...panel.signals, sig])}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => addChartPanel(panel.panelId, 'horizontal')}
            title="Dividir lado a lado"
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded"
          >↔</button>
          <button
            onClick={() => addChartPanel(panel.panelId, 'vertical')}
            title="Adicionar abaixo"
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded"
          >+ ↓</button>
          {panelCount > 1 && (
            <button
              onClick={() => removeChartPanel(panel.panelId)}
              title="Remover painel"
              className="px-1.5 py-0.5 text-xs text-red-500 hover:text-red-300 border border-gray-700 hover:border-red-700 rounded"
            >✕</button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {panel.signals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Adicione um sinal acima
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            notMerge={true}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onChartReady={onChartReady}
          />
        )}
      </div>
    </div>
  )
})

// ─── Vertical Divider ─────────────────────────────────────────────────────────

function VerticalDivider({ splitId, ratio }: { splitId: string; ratio: number }) {
  const updateSplitRatio = useUIStore(s => s.updateSplitRatio)
  const startRef = useRef<{ y: number; ratio: number; containerH: number } | null>(null)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const parent = (e.currentTarget as HTMLElement).parentElement
    const containerH = parent?.getBoundingClientRect().height ?? 1
    startRef.current = { y: e.clientY, ratio, containerH }
    function onMove(ev: MouseEvent) {
      if (!startRef.current) return
      const delta = ev.clientY - startRef.current.y
      const newRatio = Math.max(0.1, Math.min(0.9,
        startRef.current.ratio + delta / startRef.current.containerH,
      ))
      updateSplitRatio(splitId, newRatio)
    }
    function onUp() {
      startRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="flex-shrink-0 h-1.5 cursor-ns-resize flex items-center justify-center group hover:bg-blue-900/20"
      onMouseDown={onMouseDown}
    >
      <div className="w-8 h-0.5 rounded bg-gray-700 group-hover:bg-blue-400 transition-colors" />
    </div>
  )
}

// ─── Layout Renderer ──────────────────────────────────────────────────────────

function LayoutRenderer({
  layout,
  rows,
  cursor_ms,
  selection,
  allSignals,
  panelCount,
}: {
  layout:     ChartLayout
  rows:       DatalogRow[]
  cursor_ms:  number | null
  selection:  TimeSelection | null
  allSignals: string[]
  panelCount: number
}) {
  if (layout.type === 'panel') {
    return (
      <PanelView
        panel={layout}
        rows={rows}
        cursor_ms={cursor_ms}
        selection={selection}
        allSignals={allSignals}
        panelCount={panelCount}
      />
    )
  }

  if (layout.direction === 'vertical') {
    const ratio = layout.ratio ?? 0.5
    return (
      <div className="flex flex-col h-full">
        <div style={{ flex: ratio, minHeight: 0, minWidth: 0 }}>
          <LayoutRenderer layout={layout.children[0]} rows={rows} cursor_ms={cursor_ms} selection={selection} allSignals={allSignals} panelCount={panelCount} />
        </div>
        <VerticalDivider splitId={layout.splitId} ratio={ratio} />
        <div style={{ flex: 1 - ratio, minHeight: 0, minWidth: 0 }}>
          <LayoutRenderer layout={layout.children[1]} rows={rows} cursor_ms={cursor_ms} selection={selection} allSignals={allSignals} panelCount={panelCount} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-row gap-1 h-full">
      <div className="flex-1 min-h-0 min-w-0">
        <LayoutRenderer layout={layout.children[0]} rows={rows} cursor_ms={cursor_ms} selection={selection} allSignals={allSignals} panelCount={panelCount} />
      </div>
      <div className="flex-1 min-h-0 min-w-0">
        <LayoutRenderer layout={layout.children[1]} rows={rows} cursor_ms={cursor_ms} selection={selection} allSignals={allSignals} panelCount={panelCount} />
      </div>
    </div>
  )
}

// ─── SyncedChart (export) ─────────────────────────────────────────────────────

// Context to share chart instances for cross-chart hover sync
const ChartSyncContext = React.createContext<{
  registerChart:   (id: string, inst: echarts.ECharts) => void
  unregisterChart: (id: string) => void
  instancesRef:    React.MutableRefObject<Map<string, echarts.ECharts>>
} | null>(null)

export function SyncedChart() {
  const chartLayout    = useUIStore(s => s.chartLayout)
  const cursor_ms      = useTimeStore(s => s.cursor_ms)
  const selection      = useTimeStore(s => s.selection)
  const setChartZoom   = useTimeStore(s => s.setChartZoom)
  const clearChartZoom = useTimeStore(s => s.clearChartZoom)
  const allRows        = useLogStore(selectAllRows)
  const allSignals     = useLogStore(selectAllSignals)
  const panelCount     = flattenPanels(chartLayout).length

  const instancesRef    = useRef<Map<string, echarts.ECharts>>(new Map())
  const zoomListenerRef = useRef<{ inst: echarts.ECharts; handler: (p: unknown) => void } | null>(null)
  const lastTimeRef     = useRef<number | null>(null)

  const registerChart = useCallback((id: string, inst: echarts.ECharts) => {
    instancesRef.current.set(id, inst)
    // Only the first registered instance handles datazoom events
    if (zoomListenerRef.current) return
    const handler = (params: unknown) => {
      const p = params as {
        batch?: { startValue?: number; endValue?: number; start?: number; end?: number }[]
        startValue?: number; endValue?: number; start?: number; end?: number
      }
      const startPct = p.batch?.[0]?.start ?? p.start
      const endPct   = p.batch?.[0]?.end   ?? p.end
      if (startPct !== undefined && endPct !== undefined && startPct <= 0.5 && endPct >= 99.5) {
        clearChartZoom(); return
      }
      const startVal = p.batch?.[0]?.startValue ?? p.startValue
      const endVal   = p.batch?.[0]?.endValue   ?? p.endValue
      if (startVal == null || endVal == null) { clearChartZoom(); return }
      setChartZoom(startVal, endVal)
    }
    inst.on('datazoom', handler)
    zoomListenerRef.current = { inst, handler }
  }, [setChartZoom, clearChartZoom])

  const unregisterChart = useCallback((id: string) => {
    const inst = instancesRef.current.get(id)
    instancesRef.current.delete(id)
    const zl = zoomListenerRef.current
    if (zl && zl.inst === inst) {
      inst?.off('datazoom', zl.handler)
      zoomListenerRef.current = null
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const instances = Array.from(instancesRef.current.values()).filter(i => !i.isDisposed())
    if (instances.length === 0) return

    let timeMs: number | null = null
    for (const inst of instances) {
      const dom = inst.getDom()
      const rect = dom.getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        const converted = inst.convertFromPixel({ xAxisIndex: 0 }, e.clientX - rect.left)
        if (converted != null) { timeMs = converted as number; break }
      }
    }

    if (timeMs === null) {
      timeMs = lastTimeRef.current
      if (timeMs === null) return
    } else {
      lastTimeRef.current = timeMs
    }

    for (const inst of instances) {
      const dom = inst.getDom()
      const rect = dom.getBoundingClientRect()
      const pixelX = inst.convertToPixel({ xAxisIndex: 0 }, timeMs)
      if (pixelX != null) {
        inst.dispatchAction({ type: 'showTip', x: pixelX as number, y: rect.height / 2 })
      }
    }
  }, [])

  const handlePointerLeave = useCallback(() => {
    lastTimeRef.current = null
    for (const inst of instancesRef.current.values()) {
      if (!inst.isDisposed()) inst.dispatchAction({ type: 'hideTip' })
    }
  }, [])

  const ctx = useMemo(() => ({ registerChart, unregisterChart, instancesRef }), [registerChart, unregisterChart])

  return (
    <ChartSyncContext.Provider value={ctx}>
      <div
        className="h-full"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <LayoutRenderer
          layout={chartLayout}
          rows={allRows}
          cursor_ms={cursor_ms}
          selection={selection}
          allSignals={allSignals}
          panelCount={panelCount}
        />
      </div>
    </ChartSyncContext.Provider>
  )
}
