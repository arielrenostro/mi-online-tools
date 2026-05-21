# Store: `useTimeStore`

Gerencia a navegação temporal: cursor pontual, seleção de intervalo e sinal da sparkline.

**Arquivo:** `src/store/timeStore.ts`

## Estado

```typescript
interface TimeState {
  cursor_ms:       number | null      // instante atual (ms relativo ao início do 1º log ativo); null=sem cursor
  selection:       TimeSelection | null  // zoom range + intervalo de análise; null = visão completa
  sparklineSensor: string             // sinal da sparkline; deve estar em todos os logs ativos. Default "RPM"
}

interface TimeActions {
  setCursor(ms: number | null): void
  setSelection(start: number, end: number): void
  clearSelection(): void
  setSparklineSensor(signal: string): void
  /** Chamado pelo logStore quando a duração total muda; ajusta cursor/selection ao novo range. */
  onTotalDurationChanged(newTotal_ms: number): void
  hydrate(data: { cursor_ms; selection; sparklineSensor }): void  // sessionRestorer
}
```

Valores iniciais: `cursor_ms: null`, `selection: null`, `sparklineSensor: 'RPM'`.

## Implementação

```typescript
export const useTimeStore = create<TimeStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setCursor(ms: number | null): void {
      if (ms === null) {
        set({ cursor_ms: null }); persistTime({ ...get(), cursor_ms: null }); return
      }
      const clamped = Math.max(0, Math.min(getTotalDuration(), ms))  // clampa a [0, total]
      set({ cursor_ms: clamped }); persistTime({ ...get(), cursor_ms: clamped })
    },

    setSelection(start: number, end: number): void {
      if (start >= end) { console.warn('[mft] setSelection: start deve ser < end'); return }
      const total = getTotalDuration()
      const clampedStart = Math.max(0, Math.min(total, start))
      const clampedEnd   = Math.max(0, Math.min(total, end))
      if (clampedStart >= clampedEnd) {
        console.warn('[mft] setSelection: seleção inválida após clamp'); return
      }
      const selection: TimeSelection = { start_ms: clampedStart, end_ms: clampedEnd }
      set({ selection }); persistTime({ ...get(), selection })
    },

    clearSelection(): void {
      set({ selection: null }); persistTime({ ...get(), selection: null })
    },

    setSparklineSensor(signal: string): void {
      const available = selectAllSignals(useLogStore.getState())
      if (!available.includes(signal)) {
        console.warn(`[mft] setSparklineSensor: "${signal}" não disponível`); return
      }
      set({ sparklineSensor: signal }); persistTime({ ...get(), sparklineSensor: signal })
    },

    onTotalDurationChanged(newTotal_ms: number): void {
      const { cursor_ms, selection } = get()
      const updates: Partial<TimeState> = {}
      let needsPersist = false

      // cursor: clampa ou anula
      if (cursor_ms !== null) {
        if (newTotal_ms === 0) { updates.cursor_ms = null; needsPersist = true }
        else if (cursor_ms > newTotal_ms) { updates.cursor_ms = newTotal_ms; needsPersist = true }
      }
      // selection: remove se inteiramente fora; ajusta end se parcialmente fora
      if (selection !== null) {
        if (newTotal_ms === 0 || selection.start_ms >= newTotal_ms) {
          updates.selection = null; needsPersist = true
        } else if (selection.end_ms > newTotal_ms) {
          updates.selection = { start_ms: selection.start_ms, end_ms: newTotal_ms }
          needsPersist = true
        }
        if (updates.selection && updates.selection.start_ms >= updates.selection.end_ms) {
          updates.selection = null
        }
      }
      // sparklineSensor: volta ao primeiro disponível (ou 'RPM') se o sinal sumiu
      const available = selectAllSignals(useLogStore.getState())
      if (!available.includes(get().sparklineSensor)) {
        updates.sparklineSensor = available[0] ?? 'RPM'; needsPersist = true
      }
      if (Object.keys(updates).length > 0) {
        set(updates)
        if (needsPersist) persistTime({ ...get(), ...updates })
      }
    },

    hydrate({ cursor_ms, selection, sparklineSensor }): void {
      // não valida contra o range — o range pode não estar disponível no restore;
      // o ajuste vem depois via onTotalDurationChanged quando os logs forem restaurados
      set({ cursor_ms, selection, sparklineSensor })
    },
  }))
)

function getTotalDuration(): number {
  return useLogStore.getState().logs
    .filter((l) => l.enabled).reduce((acc, l) => acc + l.duration_ms, 0)
}

function persistTime(state: Partial<TimeState>): void {
  try {
    lsSet('miot:time', {
      cursor_ms: state.cursor_ms ?? null,
      selection: state.selection ?? null,
      sparklineSensor: state.sparklineSensor ?? 'RPM',
    })
  } catch (err) { console.warn('[mft] Falha ao persistir timeStore:', err) }
}
```

## Persistência (`miot:time`)

`cursor_ms` e `selection` são persistidos: fazem parte do fluxo iterativo de tuning (o usuário identifica um trecho, fecha o browser, e quer continuar com a mesma seleção depois). `sparklineSensor` é uma preferência de visualização.

```json
{ "cursor_ms": 253512, "selection": { "start_ms": 145000, "end_ms": 872000 }, "sparklineSensor": "RPM" }
```

## Consumo pelo `TimeRail`

Componente controlado via container. O container lê os stores, monta os props e passa as actions:

```tsx
function TimeRailContainer() {
  const cursor_ms       = useTimeStore((s) => s.cursor_ms)
  const selection       = useTimeStore((s) => s.selection)
  const sparklineSensor = useTimeStore((s) => s.sparklineSensor)
  const setCursor       = useTimeStore((s) => s.setCursor)
  const setSelection    = useTimeStore((s) => s.setSelection)
  const clearSelection  = useTimeStore((s) => s.clearSelection)
  const setSensor       = useTimeStore((s) => s.setSparklineSensor)

  const activeLogs       = useLogStore(selectActiveLogs)
  const totalDuration_ms = useLogStore(selectTotalDuration)
  const availableSensors = useLogStore(selectAllSignals)

  return (
    <TimeRail
      logs={activeLogs.map(l => ({ hash: l.hash, filename: l.filename,
                                   duration_ms: l.duration_ms, enabled: l.enabled }))}
      totalDuration_ms={totalDuration_ms}
      cursor_ms={cursor_ms} selection={selection}
      sparklineSensor={sparklineSensor} availableSensors={availableSensors}
      onCursorChange={setCursor}
      onSelectionChange={(sel) => sel ? setSelection(sel.start_ms, sel.end_ms) : clearSelection()}
      onSparklineSensorChange={setSensor}
    />
  )
}
```

## Sincronização com outros componentes

- **`SyncedChart`** — bidirecional:
  - TimeRail drag → `setSelection` → `SyncedChart` detecta mudança e faz `dispatchAction({ type: 'dataZoom' })` no ECharts
  - ECharts `datazoom` event → `setSelection` (ou `clearSelection` se volta a 0–100%)
  - CTRL+drag no gráfico → cria selection visual → `setSelection` ao soltar
  - Pan/scroll no gráfico → `datazoom` → `setSelection` → TimeRail mostra ViewportBand + SelectionBand
- **`HeatmapTable` (aba Dados)** — destaca a linha mais próxima do `cursor_ms` e filtra por `selection` (= zoom range).

## `onTotalDurationChanged` — comportamento

```
newTotal_ms recebido
  cursor_ms !== null
    cursor_ms > newTotal_ms        → clampa para newTotal_ms
    cursor_ms === 0 e newTotal === 0 → cursor_ms = null
  selection !== null
    start_ms >= newTotal_ms        → selection = null (inteiramente fora)
    end_ms > newTotal_ms           → end_ms = newTotal_ms (parcialmente fora)
      se após ajuste start >= end  → selection = null
    ambos dentro                   → sem mudança
```

Caso prático: 3 logs (30 min), seleção [10min, 25min], remove o 2º log → novo total 20 min → seleção vira [10min, 20min].

## Seletores recomendados

```typescript
const cursor_ms       = useTimeStore((s) => s.cursor_ms)
const selection       = useTimeStore((s) => s.selection)
const sparklineSensor = useTimeStore((s) => s.sparklineSensor)
const timeRange       = useTimeStore((s) => s.selection)  // p/ TuningRunRequest; null = todos os pontos
const setCursor       = useTimeStore((s) => s.setCursor)
```
