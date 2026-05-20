# Componente `TimeRail`

Barra de tempo fixa no topo da tela Datalog. Exibe os logs carregados como segmentos concatenados, cursor pontual, seleção de intervalo e uma sparkline do sinal escolhido. Totalmente controlado — estado no `useTimeStore`.

**Localização:** `frontend/src/components/TimeRail/` — `TimeRail.tsx`, `TimeRailCanvas.tsx`, `useTimeRailInteraction.ts`, `SparklineSVG.tsx`, `timeRailUtils.ts`

## Props

```typescript
/** Versão reduzida de LogEntry — só metadados para renderizar o rail. */
export interface LogSegment {
  hash: string
  filename: string
  startOffset_ms: number   // deslocamento na timeline concatenada
  duration_ms: number
  enabled: boolean         // false = fundo listrado, não usado no tuning
}

export interface TimeRailProps {
  /** Segmentos em ordem de concatenação. O pai calcula startOffset acumulando duration_ms. */
  segments: LogSegment[]
  totalDuration_ms: number
  cursor_ms: number | null
  selection: { start_ms: number; end_ms: number } | null
  sparklineSensor: string
  sparklineData: [number, number][]  // [timestamp_ms, value] ordenado; gerado pelo pai
  availableSensors: string[]          // interseção de sinais dos logs ativos
  onCursorChange: (ms: number) => void
  onSelectionChange: (sel: { start_ms: number; end_ms: number } | null) => void  // null = limpar
  onSparklineSensorChange: (sensor: string) => void
}
```

## Layout visual

`[Select sinal ▼]` + rail (~48px) com: sparkline SVG translúcida · faixa de seleção azul · separadores verticais pontilhados · cursor (linha vermelha + triângulo ▼). Abaixo, status bar com cursor, seleção e `[Limpar]`.

**Empilhamento por z-index:** fundo (`z-0`) → sparkline (`z-10`) → viewport band (`z-10/11`) → segmentos desabilitados (`z-15`) → faixa de seleção (`z-20`) → separadores de log (`z-25`) → cursor (`z-30`).

## Estrutura

`TimeRail.tsx` usa `useTimeRailInteraction` e renderiza, em camadas dentro do rail: `SparklineSVG` → `DisabledSegmentOverlay` (por segmento desabilitado) → `SelectionBand` (se há seleção) → `LogSeparator` (entre logs) → `CursorLine` (se cursor != null). Abaixo, `StatusBar`.

## Utilitários (`timeRailUtils.ts`)

```typescript
export function pxToMs(pxOffset: number, railWidth: number, totalDuration_ms: number): number {
  return Math.max(0, Math.min(totalDuration_ms, (pxOffset / railWidth) * totalDuration_ms))
}

export function msToPct(ms: number, totalDuration_ms: number): number {
  return totalDuration_ms === 0 ? 0 : (ms / totalDuration_ms) * 100
}

export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const millis  = Math.round(ms % 1000)
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`
}
```

## Cursor pontual

`CursorLine`: triângulo `▼` vermelho no topo + linha vertical (`bg-red-500`) + tempo formatado abaixo (`formatTime`). Posicionado em `left: ${msToPct(cursor_ms, total)}%`.

Interação:
- Clique no rail (fora de handle de seleção e do cursor) → move o cursor
- Drag no cursor → segue o mouse (threshold 0px)
- Cursor constrangido a `[0, totalDuration_ms]`
- Não move o cursor se o clique for **dentro** da faixa de seleção

## Seleção de intervalo

Drag em área livre: `mousedown` inicia → `mousemove` mostra a faixa em tempo real → `mouseup` confirma `onSelectionChange({ start_ms, end_ms })`. Drag direita→esquerda normaliza: `start = min(a,b)`, `end = max(a,b)`.

`SelectionBand`: faixa `bg-blue-500/20 border-x border-blue-400/60` entre `leftPct` e `rightPct`, com `SelectionHandle` esquerdo/direito (`cursor-ew-resize`, `stopPropagation` para não disparar nova seleção).

Regras: clique dentro da faixa (sem drag) não faz nada; clique fora move o cursor; drag fora cria nova seleção (substitui a anterior); drag de handle ajusta só aquele limite.

## Viewport band (zoom dos gráficos)

Quando `useTimeStore.chartZoom` está setado, o `ViewportBand` escurece as regiões **fora** da janela de zoom (`bg-gray-950/65`) e desenha a borda lateral azul. Desaparece quando `chartZoom` é `null`.

```tsx
function ViewportBand({ zoom, total }: { zoom: TimeSelection; total: number }) {
  const l = msToPct(zoom.start_ms, total), r = msToPct(zoom.end_ms, total)
  return (
    <>
      <div style={{ left: 0, width: `${l}%` }} className="absolute ... z-10 bg-gray-950/65" />
      <div style={{ left: `${r}%`, right: 0 }} className="absolute ... z-10 bg-gray-950/65" />
      <div style={{ left: `${l}%`, width: `${r-l}%` }} className="absolute ... z-11 border-x border-blue-400/50" />
    </>
  )
}
```

## Separadores e segmentos desabilitados

- **`LogSeparator`** — linha vertical pontilhada entre logs; tooltip com o nome do próximo arquivo no hover
- **`DisabledSegmentOverlay`** — overlay `repeating-linear-gradient(-45deg, ...)` cinza, `opacity: 0.7`, sobre o trecho do log desabilitado

## Sparkline SVG (`SparklineSVG`)

SVG puro (sem lib de charting), decorativa — sem eixos/grid/labels. `ResizeObserver` para dimensões. Normaliza os valores para o espaço do SVG:

```typescript
const minVal = Math.min(...values), maxVal = Math.max(...values)
const range  = maxVal - minVal || 1
const points = data.map(([t, v]) => {
  const x = (t / totalDuration_ms) * dims.width
  const y = dims.height - ((v - minVal) / range) * (dims.height * 0.8) - dims.height * 0.1
  return `${x.toFixed(1)},${y.toFixed(1)}`
}).join(' ')
```

Renderiza `<polygon>` (área preenchida `rgba(59,130,246,0.1)`) + `<polyline>` (contorno `rgba(59,130,246,0.45)`). Retorna `null` se `data.length < 2` ou largura 0.

## Hook de interação (`useTimeRailInteraction.ts`)

```typescript
type DragState =
  | { type: 'idle' } | { type: 'cursor' }
  | { type: 'selection'; startMs: number } | { type: 'handle'; side: 'left' | 'right' }

export function useTimeRailInteraction({ railRef, totalDuration_ms, cursor_ms, selection,
                                         onCursorChange, onSelectionChange }: Options) {
  const [dragState, setDragState] = useState<DragState>({ type: 'idle' })

  function getRailMs(clientX: number): number {
    const rect = railRef.current!.getBoundingClientRect()
    return pxToMs(Math.max(0, Math.min(clientX - rect.left, rect.width)), rect.width, totalDuration_ms)
  }
  function isCursorHit(clientX: number): boolean {  // hit area de 12px
    if (cursor_ms === null) return false
    const rect = railRef.current!.getBoundingClientRect()
    const cursorPx = (cursor_ms / totalDuration_ms) * rect.width
    return Math.abs((clientX - rect.left) - cursorPx) <= 6
  }
  function isInsideSelection(clientX: number): boolean {  // exclui handles (±8px)
    if (!selection) return false
    const rect = railRef.current!.getBoundingClientRect()
    const startPx = (selection.start_ms / totalDuration_ms) * rect.width
    const endPx   = (selection.end_ms   / totalDuration_ms) * rect.width
    const clickPx = clientX - rect.left
    return clickPx > startPx + 8 && clickPx < endPx - 8
  }

  const handlers = {
    onMouseDown(e: React.MouseEvent) {
      if (e.button !== 0) return
      e.preventDefault()
      if (isCursorHit(e.clientX)) setDragState({ type: 'cursor' })
      else if (!isInsideSelection(e.clientX)) {
        const ms = getRailMs(e.clientX)
        setDragState({ type: 'selection', startMs: ms })
        onCursorChange(ms)  // mouseup imediato = só move cursor; distinção no mousemove
      }
    },
    onMouseMove(e: React.MouseEvent) {
      if (dragState.type === 'cursor') onCursorChange(getRailMs(e.clientX))
      else if (dragState.type === 'selection') {
        const currentMs = getRailMs(e.clientX), startMs = dragState.startMs
        if (Math.abs(currentMs - startMs) > 500) {  // threshold mínimo 500ms para iniciar seleção
          onSelectionChange({ start_ms: Math.min(startMs, currentMs), end_ms: Math.max(startMs, currentMs) })
        }
      }
    },
    onMouseUp() { setDragState({ type: 'idle' }) },
    onMouseLeave() { if (dragState.type !== 'idle') setDragState({ type: 'idle' }) },
  }
  // touchHandlers mapeiam touch → mouse equivalente (touches[0].clientX)
  return { handlers: { ...handlers, ...touchHandlers }, dragState }
}
```

## Suporte a teclado

Rail focável (`tabIndex={0}`):

| Tecla | Ação |
|-------|------|
| `←` / `→` | Move cursor 100ms |
| `Shift+←` / `Shift+→` | Move cursor 1000ms |
| `Escape` | Limpa seleção |

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  if (cursor_ms === null) return
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      onCursorChange(Math.max(0, cursor_ms - (e.shiftKey ? 1000 : 100)))
      break
    case 'ArrowRight':
      e.preventDefault()
      onCursorChange(Math.min(totalDuration_ms, cursor_ms + (e.shiftKey ? 1000 : 100)))
      break
    case 'Escape':
      e.preventDefault(); onSelectionChange(null)
      break
  }
}
```

## Integração com `useTimeStore`

Controlado via `TimeRailContainer` (ver `stores/time-store.md`). O container monta `segments` (acumulando `startOffset`) e `sparklineData` (decimação 10:1 do sinal selecionado). O `TimeRail` fica fixo no topo de `DatalogPage`, sempre visível, sobre o `<Outlet>` das abas (que rola independentemente).
