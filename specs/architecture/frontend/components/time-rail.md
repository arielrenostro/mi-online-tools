# Componente `TimeRail`

Barra de tempo fixada no topo da tela Datalog. Exibe todos os logs carregados como segmentos concatenados, permite posicionar um cursor pontual e selecionar um intervalo de tempo, e renderiza uma sparkline do sinal escolhido no fundo. Componente totalmente controlado — todo estado persiste no `useTimeStore`.

**Localização:** `frontend/src/components/TimeRail/`  
**Arquivos:** `TimeRail.tsx`, `TimeRailCanvas.tsx`, `useTimeRailInteraction.ts`, `SparklineSVG.tsx`, `timeRailUtils.ts`

---

## Props

```typescript
// src/components/TimeRail/TimeRail.tsx
import type { ActiveLog, TimeSelection } from '@/types/datalog'

/**
 * Versão reduzida de LogEntry passada ao TimeRail.
 * Contém apenas os metadados necessários para renderizar o rail — não inclui as linhas do log.
 */
export interface LogSegment {
  hash: string
  filename: string
  /** Deslocamento em ms relativo ao início da timeline concatenada. */
  startOffset_ms: number
  duration_ms: number
  /** Se false, o segmento é exibido com fundo listrado — não será usado no tuning. */
  enabled: boolean
}

export interface TimeRailProps {
  /**
   * Segmentos de log em ordem de concatenação temporal.
   * Calculado pelo pai a partir do `useLogStore`:
   *   segments = activeLogs.reduce((acc, log) => {
   *     acc.push({ ...log, startOffset_ms: totalSoFar })
   *     totalSoFar += log.duration_ms
   *   }, [])
   */
  segments: LogSegment[]

  /** Duração total de todos os logs ativos concatenados, em ms. */
  totalDuration_ms: number

  /**
   * Posição atual do cursor em ms relativo ao início da timeline.
   * null = sem cursor posicionado.
   */
  cursor_ms: number | null

  /**
   * Intervalo selecionado em ms.
   * null = sem seleção.
   */
  selection: { start_ms: number; end_ms: number } | null

  /**
   * Nome do sinal exibido na sparkline (background do rail).
   * Deve ser um sinal disponível em todos os logs ativos.
   */
  sparklineSensor: string

  /**
   * Dados da sparkline: array de [timestamp_ms, value] já ordenado por timestamp_ms.
   * Gerado pelo pai a partir dos rows do datalog filtrados para o sinal selecionado.
   */
  sparklineData: [number, number][]

  /**
   * Lista de sinais disponíveis na interseção de todos os logs ativos.
   * Usado para popular o <Select> de sinal da sparkline.
   */
  availableSensors: string[]

  /** Novo valor de cursor solicitado pelo usuário. O pai persiste via useTimeStore.setCursor. */
  onCursorChange: (ms: number) => void

  /**
   * Nova seleção solicitada.
   * null = limpar seleção (botão "Limpar" ou Escape).
   */
  onSelectionChange: (sel: { start_ms: number; end_ms: number } | null) => void

  /** Novo sinal da sparkline selecionado pelo usuário. */
  onSparklineSensorChange: (sensor: string) => void
}
```

---

## Layout Visual

```
┌── [Select: RPM ▼] ─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  [sparkline SVG — fundo translúcido]                                 │   │  ← rail (altura: ~48px)
│  │  [seleção: faixa azul semi-transparente]                             │   │
│  │  [separadores verticais pontilhados entre logs]                      │   │
│  │  [cursor: linha vermelha + triângulo ▼ no topo]                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  Cursor: 04:23.512    Seleção: 04:12 – 18:45 (14 min 33 s)    [Limpar]    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Empilhamento por z-index (de baixo para cima):**
1. Fundo escuro do rail (`z-0`)
2. Sparkline SVG (`z-10`) — translúcida, só visual
3. **Viewport band** (`z-10/11`) — overlay escuro fora do zoom atual dos gráficos + borda azul
4. Segmentos desabilitados: fundo listrado (`z-15`)
5. Faixa de seleção azul semi-transparente (`z-20`)
6. Separadores de log (`z-25`) — linhas verticais pontilhadas
7. Cursor pontual (`z-30`) — linha + triângulo, arrastável

---

## Estrutura HTML / JSX

```tsx
// TimeRail.tsx
export function TimeRail({
  segments, totalDuration_ms, cursor_ms, selection,
  sparklineSensor, sparklineData, availableSensors,
  onCursorChange, onSelectionChange, onSparklineSensorChange,
}: TimeRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const { handlers, dragState } = useTimeRailInteraction({
    railRef, totalDuration_ms, cursor_ms, selection,
    onCursorChange, onSelectionChange,
  })

  return (
    <div className="bg-gray-900 border-b border-gray-700 select-none">
      {/* Linha superior: combobox + rail */}
      <div className="flex items-stretch gap-3 px-3 py-2">
        {/* Combobox de sinal da sparkline */}
        <SparklineSensorSelect
          value={sparklineSensor}
          options={availableSensors}
          onChange={onSparklineSensorChange}
        />

        {/* Rail principal */}
        <div
          ref={railRef}
          className="relative flex-1 h-12 rounded overflow-hidden cursor-crosshair bg-gray-800"
          {...handlers}
        >
          {/* Camada 1: sparkline */}
          <SparklineSVG
            data={sparklineData}
            totalDuration_ms={totalDuration_ms}
            className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          />

          {/* Camada 2: segmentos desabilitados */}
          {segments.filter(s => !s.enabled).map(seg => (
            <DisabledSegmentOverlay
              key={seg.hash}
              segment={seg}
              totalDuration_ms={totalDuration_ms}
            />
          ))}

          {/* Camada 3: seleção */}
          {selection && (
            <SelectionBand
              selection={selection}
              totalDuration_ms={totalDuration_ms}
              onHandleDrag={/* handler de drag das extremidades */}
            />
          )}

          {/* Camada 4: separadores de log */}
          {segments.slice(0, -1).map(seg => (
            <LogSeparator
              key={seg.hash}
              positionMs={seg.startOffset_ms + seg.duration_ms}
              nextFilename={segments[segments.indexOf(seg) + 1]?.filename ?? ''}
              totalDuration_ms={totalDuration_ms}
            />
          ))}

          {/* Camada 5: cursor */}
          {cursor_ms !== null && (
            <CursorLine
              cursor_ms={cursor_ms}
              totalDuration_ms={totalDuration_ms}
              isDragging={dragState.type === 'cursor'}
            />
          )}
        </div>
      </div>

      {/* Linha inferior: status */}
      <StatusBar
        cursor_ms={cursor_ms}
        selection={selection}
        onClearSelection={() => onSelectionChange(null)}
      />
    </div>
  )
}
```

---

## Cursor Pontual

### Visual

```tsx
// CursorLine.tsx
function CursorLine({ cursor_ms, totalDuration_ms, isDragging }: CursorLineProps) {
  const pct = (cursor_ms / totalDuration_ms) * 100

  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: `${pct}%` }}
    >
      {/* Triângulo ▼ no topo */}
      <div
        className="absolute top-0 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #ef4444',
        }}
      />

      {/* Linha vertical */}
      <div className="absolute top-1.5 bottom-0 -translate-x-px w-0.5 bg-red-500 opacity-90" />

      {/* Tempo formatado (aparece abaixo do triângulo, fora do rail) */}
      <div className="absolute top-full mt-0.5 -translate-x-1/2 text-[10px] text-red-400 whitespace-nowrap font-mono">
        {formatTime(cursor_ms)}
      </div>
    </div>
  )
}
```

### Interação

- **Clique dentro do rail (fora de handle de seleção e fora do cursor):** move o cursor para o ponto clicado
- **Drag no cursor:** o cursor segue o mouse; threshold de 0px (qualquer movimento ativa o drag)
- O cursor é constrangido a `[0, totalDuration_ms]`
- **Não** move o cursor se o clique for dentro da faixa de seleção (serve apenas para criar/mover seleção)

```typescript
// timeRailUtils.ts
export function pxToMs(pxOffset: number, railWidth: number, totalDuration_ms: number): number {
  return Math.max(0, Math.min(totalDuration_ms,
    (pxOffset / railWidth) * totalDuration_ms
  ))
}

export function msToPct(ms: number, totalDuration_ms: number): number {
  return totalDuration_ms === 0 ? 0 : (ms / totalDuration_ms) * 100
}

export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const millis  = Math.round(ms % 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}
```

---

## Seleção de Intervalo

### Comportamento do Drag

1. `mousedown` em área livre do rail (não sobre o cursor, não sobre handles de seleção) → inicia seleção
2. `mousemove` → a faixa azul aparece em tempo real, do ponto de início ao ponto atual
3. `mouseup` → seleção confirmada — chama `onSelectionChange({ start_ms, end_ms })`

Se o usuário arrastar da direita para a esquerda, `start_ms` e `end_ms` são normalizados: `start_ms = Math.min(a, b)`, `end_ms = Math.max(a, b)`.

```tsx
// SelectionBand.tsx
function SelectionBand({ selection, totalDuration_ms, onHandleDrag }: SelectionBandProps) {
  const leftPct  = msToPct(selection.start_ms, totalDuration_ms)
  const rightPct = msToPct(selection.end_ms, totalDuration_ms)
  const widthPct = rightPct - leftPct

  return (
    <div
      className="absolute top-0 bottom-0 z-20 bg-blue-500/20 border-x border-blue-400/60"
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
    >
      {/* Handle esquerdo */}
      <SelectionHandle side="left" onDrag={onHandleDrag} />
      {/* Handle direito */}
      <SelectionHandle side="right" onDrag={onHandleDrag} />
    </div>
  )
}

function SelectionHandle({ side, onDrag }: SelectionHandleProps) {
  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 w-2 cursor-ew-resize",
        "flex items-center justify-center",
        side === 'left' ? '-left-1' : '-right-1'
      )}
      onMouseDown={(e) => {
        e.stopPropagation()  // não dispara nova seleção
        onDrag(side, e)
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        onDrag(side, e)
      }}
    >
      <div className="w-0.5 h-6 bg-blue-400 rounded" />
    </div>
  )
}
```

### Regras da Seleção

- **Clique dentro da faixa de seleção** (sem drag): não move o cursor, não cria nova seleção
- **Clique fora da faixa, fora do cursor**: move o cursor (não cria seleção)
- **Drag fora da faixa e fora do cursor**: cria nova seleção, substitui a anterior
- **Drag de handle**: ajusta apenas o limite correspondente

---

## Viewport Band (zoom dos gráficos)

Quando o usuário faz zoom nos gráficos (scroll), o `useTimeStore.chartZoom` é atualizado. O TimeRail exibe um `ViewportBand` que escurece as regiões **fora** da janela de zoom, tornando visualmente óbvio qual trecho da timeline está sendo visualizado nos gráficos.

```tsx
function ViewportBand({ zoom, total }: { zoom: TimeSelection; total: number }) {
  const l = msToPct(zoom.start_ms, total)
  const r = msToPct(zoom.end_ms, total)
  return (
    <>
      {/* Overlay escuro à esquerda do viewport */}
      <div style={{ left: 0, width: `${l}%` }} className="absolute top-0 bottom-0 z-10 bg-gray-950/65 pointer-events-none" />
      {/* Overlay escuro à direita do viewport */}
      <div style={{ left: `${r}%`, right: 0 }} className="absolute top-0 bottom-0 z-10 bg-gray-950/65 pointer-events-none" />
      {/* Borda lateral da janela de zoom */}
      <div style={{ left: `${l}%`, width: `${r - l}%` }} className="absolute top-0 bottom-0 z-11 border-x border-blue-400/50 pointer-events-none" />
    </>
  )
}
```

O `ViewportBand` desaparece automaticamente quando `chartZoom` é `null` (zoom padrão — toda a timeline visível).

---

## Separadores de Log

```tsx
// LogSeparator.tsx
function LogSeparator({ positionMs, nextFilename, totalDuration_ms }: LogSeparatorProps) {
  const pct = msToPct(positionMs, totalDuration_ms)
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="absolute top-0 bottom-0 z-25 -translate-x-px cursor-default group"
      style={{ left: `${pct}%` }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Linha vertical pontilhada */}
      <div className="absolute inset-0 w-px border-l border-dashed border-gray-500 opacity-60" />

      {/* Tooltip com nome do próximo arquivo */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50
                        bg-gray-800 text-gray-200 text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
          {nextFilename}
        </div>
      )}
    </div>
  )
}
```

---

## Segmentos Desabilitados

```tsx
// DisabledSegmentOverlay.tsx
function DisabledSegmentOverlay({ segment, totalDuration_ms }: DisabledSegmentOverlayProps) {
  const leftPct  = msToPct(segment.startOffset_ms, totalDuration_ms)
  const widthPct = msToPct(segment.duration_ms, totalDuration_ms)

  return (
    <div
      className="absolute top-0 bottom-0 z-15 pointer-events-none"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        // Listrado diagonal cinza escuro
        background: 'repeating-linear-gradient(-45deg, #1a1a1a, #1a1a1a 4px, #2d2d2d 4px, #2d2d2d 10px)',
        opacity: 0.7,
      }}
    />
  )
}
```

---

## Sparkline SVG

Renderizada em SVG para controle total de pontos sem dependência de biblioteca de charting.

```tsx
// SparklineSVG.tsx
interface SparklineSVGProps {
  data: [number, number][]  // [timestamp_ms, value]
  totalDuration_ms: number
  className?: string
}

function SparklineSVG({ data, totalDuration_ms, className }: SparklineSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 48 })

  // ResizeObserver para dimensões do SVG
  useEffect(() => {
    if (!svgRef.current) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ width, height })
    })
    observer.observe(svgRef.current.parentElement!)
    return () => observer.disconnect()
  }, [])

  if (data.length < 2 || dims.width === 0) return null

  // Normaliza os valores para o espaço do SVG
  const values = data.map(([, v]) => v)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range  = maxVal - minVal || 1

  const points = data.map(([t, v]) => {
    const x = (t / totalDuration_ms) * dims.width
    const y = dims.height - ((v - minVal) / range) * (dims.height * 0.8) - dims.height * 0.1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg
      ref={svgRef}
      className={className}
      preserveAspectRatio="none"
    >
      {/* Área preenchida */}
      <polygon
        points={`0,${dims.height} ${points} ${dims.width},${dims.height}`}
        fill="rgba(59, 130, 246, 0.1)"
      />
      {/* Linha de contorno */}
      <polyline
        points={points}
        fill="none"
        stroke="rgba(59, 130, 246, 0.45)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

**Nota:** a sparkline não exibe eixos, grid ou labels — é puramente decorativa/orientativa. O usuário usa os gráficos da aba Gráficos para análise detalhada.

---

## Combobox de Sinal

```tsx
// SparklineSensorSelect.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function SparklineSensorSelect({ value, options, onChange }: SparklineSensorSelectProps) {
  return (
    <div className="flex-none w-28">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-full bg-gray-800 border-gray-700 text-gray-300 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-700">
          {options.map(sensor => (
            <SelectItem
              key={sensor}
              value={sensor}
              className="text-xs text-gray-300 focus:bg-gray-700"
            >
              {sensor}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

---

## Status Bar

```tsx
// StatusBar.tsx (sub-componente dentro do TimeRail)
function StatusBar({ cursor_ms, selection, onClearSelection }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-3 pb-2 text-xs text-gray-400 font-mono">
      {/* Cursor */}
      {cursor_ms !== null ? (
        <span>
          <span className="text-gray-500">Cursor:</span>{' '}
          <span className="text-red-400">{formatTime(cursor_ms)}</span>
        </span>
      ) : (
        <span className="text-gray-600">Cursor: —</span>
      )}

      {/* Seleção */}
      {selection ? (
        <>
          <span>
            <span className="text-gray-500">Seleção:</span>{' '}
            <span className="text-blue-400">{formatTime(selection.start_ms)}</span>
            {' – '}
            <span className="text-blue-400">{formatTime(selection.end_ms)}</span>
            {' '}
            <span className="text-gray-500">({formatDuration(selection.end_ms - selection.start_ms)})</span>
          </span>
          <button
            onClick={onClearSelection}
            className="text-gray-500 hover:text-gray-200 underline underline-offset-2"
          >
            Limpar
          </button>
        </>
      ) : (
        <span className="text-gray-600">Seleção: nenhuma</span>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds} s`
  if (seconds === 0) return `${minutes} min`
  return `${minutes} min ${seconds} s`
}
```

---

## Hook de Interação

```typescript
// useTimeRailInteraction.ts
type DragState =
  | { type: 'idle' }
  | { type: 'cursor' }
  | { type: 'selection'; startMs: number }
  | { type: 'handle'; side: 'left' | 'right' }

interface UseTimeRailInteractionOptions {
  railRef: React.RefObject<HTMLDivElement>
  totalDuration_ms: number
  cursor_ms: number | null
  selection: { start_ms: number; end_ms: number } | null
  onCursorChange: (ms: number) => void
  onSelectionChange: (sel: { start_ms: number; end_ms: number } | null) => void
}

export function useTimeRailInteraction({
  railRef, totalDuration_ms, cursor_ms, selection,
  onCursorChange, onSelectionChange,
}: UseTimeRailInteractionOptions) {
  const [dragState, setDragState] = useState<DragState>({ type: 'idle' })

  function getRailMs(clientX: number): number {
    const rect = railRef.current!.getBoundingClientRect()
    const pxOffset = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return pxToMs(pxOffset, rect.width, totalDuration_ms)
  }

  function isCursorHit(clientX: number): boolean {
    if (cursor_ms === null) return false
    const rect = railRef.current!.getBoundingClientRect()
    const cursorPx = (cursor_ms / totalDuration_ms) * rect.width
    const clickPx  = clientX - rect.left
    return Math.abs(clickPx - cursorPx) <= 6  // hit area de 12px total
  }

  function isInsideSelection(clientX: number): boolean {
    if (!selection) return false
    const rect    = railRef.current!.getBoundingClientRect()
    const startPx = (selection.start_ms / totalDuration_ms) * rect.width
    const endPx   = (selection.end_ms   / totalDuration_ms) * rect.width
    const clickPx = clientX - rect.left
    return clickPx > startPx + 8 && clickPx < endPx - 8  // exclui handles
  }

  const handlers = {
    onMouseDown(e: React.MouseEvent) {
      if (e.button !== 0) return
      e.preventDefault()

      if (isCursorHit(e.clientX)) {
        setDragState({ type: 'cursor' })
      } else if (!isInsideSelection(e.clientX)) {
        // Inicia nova seleção ou move cursor
        const ms = getRailMs(e.clientX)
        // Se não houver drag (mouseup imediato), apenas move o cursor
        // A distinção cursor/seleção acontece no mousemove
        setDragState({ type: 'selection', startMs: ms })
        onCursorChange(ms)
      }
    },
    onMouseMove(e: React.MouseEvent) {
      if (dragState.type === 'cursor') {
        onCursorChange(getRailMs(e.clientX))
      } else if (dragState.type === 'selection') {
        const currentMs = getRailMs(e.clientX)
        const startMs   = dragState.startMs
        if (Math.abs(currentMs - startMs) > 500) {  // threshold mínimo de 500ms para iniciar seleção
          onSelectionChange({
            start_ms: Math.min(startMs, currentMs),
            end_ms:   Math.max(startMs, currentMs),
          })
        }
      }
    },
    onMouseUp() {
      setDragState({ type: 'idle' })
    },
    onMouseLeave() {
      if (dragState.type !== 'idle') {
        setDragState({ type: 'idle' })
      }
    },
  }

  // Touch support — mapeia touch para mouse equivalente
  const touchHandlers = {
    onTouchStart(e: React.TouchEvent) {
      const touch = e.touches[0]
      handlers.onMouseDown({ ...e, button: 0, clientX: touch.clientX } as any)
    },
    onTouchMove(e: React.TouchEvent) {
      const touch = e.touches[0]
      handlers.onMouseMove({ ...e, clientX: touch.clientX } as any)
    },
    onTouchEnd() {
      handlers.onMouseUp()
    },
  }

  return { handlers: { ...handlers, ...touchHandlers }, dragState }
}
```

---

## Suporte a Teclado

Eventos de teclado capturados quando o rail está em foco (`tabIndex={0}`):

```typescript
// Dentro de TimeRail.tsx
function handleKeyDown(e: React.KeyboardEvent) {
  if (cursor_ms === null) return

  switch (e.key) {
    case 'ArrowLeft': {
      e.preventDefault()
      const step = e.shiftKey ? 1000 : 100  // ms
      onCursorChange(Math.max(0, cursor_ms - step))
      break
    }
    case 'ArrowRight': {
      e.preventDefault()
      const step = e.shiftKey ? 1000 : 100
      onCursorChange(Math.min(totalDuration_ms, cursor_ms + step))
      break
    }
    case 'Escape': {
      e.preventDefault()
      onSelectionChange(null)
      break
    }
  }
}
```

| Tecla | Ação |
|-------|------|
| `←` | Move cursor 100ms para trás |
| `→` | Move cursor 100ms para frente |
| `Shift+←` | Move cursor 1000ms para trás |
| `Shift+→` | Move cursor 1000ms para frente |
| `Escape` | Limpa seleção |

---

## Integração com `useTimeStore`

O `TimeRail` é sempre controlado via container:

```tsx
// Em DatalogPage.tsx ou TimeRailContainer.tsx
import { useTimeStore }  from '@/store/timeStore'
import { useLogStore, selectActiveLogs, selectTotalDuration, selectAllSignals } from '@/store/logStore'
import { useMemo } from 'react'

function TimeRailContainer() {
  const cursor_ms        = useTimeStore(s => s.cursor_ms)
  const selection        = useTimeStore(s => s.selection)
  const sparklineSensor  = useTimeStore(s => s.sparklineSensor)
  const setCursor        = useTimeStore(s => s.setCursor)
  const setSelection     = useTimeStore(s => s.setSelection)
  const clearSelection   = useTimeStore(s => s.clearSelection)
  const setSensor        = useTimeStore(s => s.setSparklineSensor)

  const activeLogs       = useLogStore(selectActiveLogs)
  const totalDuration_ms = useLogStore(selectTotalDuration)
  const availableSensors = useLogStore(selectAllSignals)
  const allRows          = useLogStore(selectAllRows)  // todas as linhas dos logs ativos

  // Monta segmentos com startOffset calculado
  const segments: LogSegment[] = useMemo(() => {
    let offset = 0
    return activeLogs.map(log => {
      const seg = {
        hash: log.hash,
        filename: log.filename,
        startOffset_ms: offset,
        duration_ms: log.duration_ms,
        enabled: log.enabled,
      }
      offset += log.duration_ms
      return seg
    })
  }, [activeLogs])

  // Dados da sparkline: filtra as linhas do log para o sinal selecionado
  const sparklineData = useMemo<[number, number][]>(() => {
    return allRows
      .filter((_, i) => i % 10 === 0)  // decimação 10:1 para performance
      .map(row => [row.timestamp_ms, (row as any)[sparklineSensor] ?? 0])
  }, [allRows, sparklineSensor])

  return (
    <TimeRail
      segments={segments}
      totalDuration_ms={totalDuration_ms}
      cursor_ms={cursor_ms}
      selection={selection}
      sparklineSensor={sparklineSensor}
      sparklineData={sparklineData}
      availableSensors={availableSensors}
      onCursorChange={setCursor}
      onSelectionChange={sel => sel ? setSelection(sel.start_ms, sel.end_ms) : clearSelection()}
      onSparklineSensorChange={setSensor}
    />
  )
}
```

---

## Posicionamento na Página

O `TimeRail` fica fixo no topo da `DatalogPage`, sempre visível independente da aba ativa:

```tsx
// pages/DatalogPage.tsx
function DatalogPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* TimeRail sempre visível no topo */}
      <TimeRailContainer />

      {/* Conteúdo das abas — rola independentemente */}
      <div className="flex-1 overflow-auto">
        <Outlet />  {/* Dashboard / Gráficos / Dados */}
      </div>
    </div>
  )
}
```
