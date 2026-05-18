# Store: `useTimeStore`

Store Zustand responsável por gerenciar o estado de navegação temporal: cursor pontual, seleção de intervalo e sinal exibido na sparkline do TimeRail.

---

## Estado completo

```typescript
// src/store/timeStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { TimeSelection } from '@/types/datalog'

interface TimeState {
  /** Instante atual em ms relativo ao início do primeiro log ativo.
   *  null = nenhum cursor posicionado (estado inicial antes do usuário interagir). */
  cursor_ms:       number | null

  /** Intervalo de tempo selecionado no TimeRail.
   *  null = nenhuma seleção — auto-tuning usa todos os pontos dos logs.
   *  start_ms e end_ms são relativos ao início do primeiro log ativo. */
  selection:       TimeSelection | null

  /** Nome do sinal exibido na sparkline do TimeRail.
   *  Deve estar presente em todos os logs ativos (interseção — ver logStore.allSignals).
   *  Default: "RPM" (invariavelmente disponível em logs MasterInjection). */
  sparklineSensor: string
}

interface TimeActions {
  setCursor(ms: number | null): void
  setSelection(start: number, end: number): void
  clearSelection(): void
  setSparklineSensor(signal: string): void

  /** Chamado pelo logStore quando a duração total dos logs ativos muda.
   *  Ajusta cursor e selection para caber no novo range. */
  onTotalDurationChanged(newTotal_ms: number): void

  /** Usado pelo sessionRestorer para restaurar o estado sem side effects. */
  hydrate(data: {
    cursor_ms:       number | null
    selection:       TimeSelection | null
    sparklineSensor: string
  }): void
}

type TimeStore = TimeState & TimeActions
```

### Valores iniciais

```typescript
const initialState: TimeState = {
  cursor_ms:       null,
  selection:       null,
  sparklineSensor: 'RPM',
}
```

---

## Implementação do store

```typescript
// src/store/timeStore.ts (continuação)
import { lsSet, lsGet, lsClear } from '@/persistence/localStorage'
import { useLogStore, selectAllSignals } from './logStore'

export const useTimeStore = create<TimeStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── setCursor ─────────────────────────────────────────────────────────────
    setCursor(ms: number | null): void {
      if (ms === null) {
        set({ cursor_ms: null })
        persistTime({ ...get(), cursor_ms: null })
        return
      }

      // Clampado ao range [0, totalDuration_ms]
      const totalDuration = getTotalDuration()
      const clamped = Math.max(0, Math.min(totalDuration, ms))

      set({ cursor_ms: clamped })
      persistTime({ ...get(), cursor_ms: clamped })

      // Não precisa notificar SyncedChart diretamente — os componentes assinam
      // este store e reagem à mudança de cursor_ms automaticamente via Zustand.
    },

    // ── setSelection ──────────────────────────────────────────────────────────
    setSelection(start: number, end: number): void {
      // Validação: start deve ser menor que end
      if (start >= end) {
        console.warn('[mft] setSelection: start deve ser menor que end')
        return
      }

      const totalDuration = getTotalDuration()

      // Ambos clampados ao range total
      const clampedStart = Math.max(0, Math.min(totalDuration, start))
      const clampedEnd   = Math.max(0, Math.min(totalDuration, end))

      // Após clamp, verificar novamente que start < end
      if (clampedStart >= clampedEnd) {
        console.warn('[mft] setSelection: seleção inválida após clamp')
        return
      }

      const selection: TimeSelection = { start_ms: clampedStart, end_ms: clampedEnd }
      set({ selection })
      persistTime({ ...get(), selection })
    },

    // ── clearSelection ────────────────────────────────────────────────────────
    clearSelection(): void {
      set({ selection: null })
      // Remove do localStorage — null não precisa ser armazenado
      persistTime({ ...get(), selection: null })
    },

    // ── setSparklineSensor ────────────────────────────────────────────────────
    setSparklineSensor(signal: string): void {
      // Valida que o sinal existe na interseção dos logs ativos
      const availableSignals = selectAllSignals(useLogStore.getState())
      if (!availableSignals.includes(signal)) {
        console.warn(`[mft] setSparklineSensor: sinal "${signal}" não disponível nos logs ativos`)
        return
      }

      set({ sparklineSensor: signal })
      persistTime({ ...get(), sparklineSensor: signal })
    },

    // ── onTotalDurationChanged ─────────────────────────────────────────────────
    onTotalDurationChanged(newTotal_ms: number): void {
      const { cursor_ms, selection } = get()
      let needsPersist = false
      const updates: Partial<TimeState> = {}

      // Ajusta cursor
      if (cursor_ms !== null) {
        if (newTotal_ms === 0) {
          updates.cursor_ms = null
          needsPersist = true
        } else if (cursor_ms > newTotal_ms) {
          updates.cursor_ms = newTotal_ms
          needsPersist = true
        }
      }

      // Ajusta selection
      if (selection !== null) {
        if (newTotal_ms === 0 || selection.start_ms >= newTotal_ms) {
          // Selection inteiramente fora do novo range → remove
          updates.selection = null
          needsPersist = true
        } else if (selection.end_ms > newTotal_ms) {
          // Selection parcialmente fora → ajusta o end
          updates.selection = {
            start_ms: selection.start_ms,
            end_ms:   newTotal_ms,
          }
          needsPersist = true
        }
        // Se selection.start_ms === selection.end_ms após ajuste → remove
        if (updates.selection && updates.selection.start_ms >= updates.selection.end_ms) {
          updates.selection = null
        }
      }

      // Valida sparklineSensor — se o sinal não está mais disponível, volta ao padrão
      const newAvailableSignals = selectAllSignals(useLogStore.getState())
      if (!newAvailableSignals.includes(get().sparklineSensor)) {
        const fallback = newAvailableSignals[0] ?? 'RPM'
        updates.sparklineSensor = fallback
        needsPersist = true
      }

      if (Object.keys(updates).length > 0) {
        set(updates)
        if (needsPersist) {
          persistTime({ ...get(), ...updates })
        }
      }
    },

    // ── hydrate (sessionRestorer) ─────────────────────────────────────────────
    hydrate({ cursor_ms, selection, sparklineSensor }): void {
      // Restaura sem validar contra o range atual — o range pode não estar disponível
      // ainda no momento do restore. O ajuste acontece quando onTotalDurationChanged
      // for chamado após os logs serem restaurados.
      set({ cursor_ms, selection, sparklineSensor })
    },
  }))
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTotalDuration(): number {
  return useLogStore.getState().logs
    .filter((l) => l.enabled)
    .reduce((acc, l) => acc + l.duration_ms, 0)
}

function persistTime(state: Partial<TimeState>): void {
  try {
    lsSet('mft:time', {
      cursor_ms:       state.cursor_ms ?? null,
      selection:       state.selection ?? null,
      sparklineSensor: state.sparklineSensor ?? 'RPM',
    })
  } catch (err) {
    console.warn('[mft] Falha ao persistir timeStore:', err)
  }
}
```

---

## Persistência no localStorage

O `cursor_ms` e a `selection` são persistidos no localStorage porque fazem parte do **fluxo de trabalho de tuning**:

1. O usuário carrega os logs e percorre a linha do tempo.
2. Identifica um trecho relevante (ex.: aceleração em pista) e cria uma seleção.
3. Fecha o browser para o dia.
4. No dia seguinte, reabre a aplicação e quer continuar com o mesmo intervalo selecionado para rodar o auto-tuning.

Perder a seleção a cada reload forçaria o usuário a repetir a navegação no TimeRail — experiência ruim para um fluxo de trabalho iterativo.

O `sparklineSensor` também é persistido pois é uma preferência de visualização do usuário.

**Chave localStorage:** `mft:time`

```json
{
  "cursor_ms": 253512,
  "selection": { "start_ms": 145000, "end_ms": 872000 },
  "sparklineSensor": "RPM"
}
```

---

## Como o `TimeRail` consome este store

O `TimeRail` é um componente controlado — recebe os valores do store como props e chama as actions para atualizar:

```tsx
// Em DatalogPage.tsx ou em TimeRailContainer.tsx:
import { useTimeStore }  from '@/store/timeStore'
import { useLogStore, selectActiveLogs, selectTotalDuration } from '@/store/logStore'

function TimeRailContainer() {
  const cursor_ms        = useTimeStore((s) => s.cursor_ms)
  const selection        = useTimeStore((s) => s.selection)
  const sparklineSensor  = useTimeStore((s) => s.sparklineSensor)
  const setCursor        = useTimeStore((s) => s.setCursor)
  const setSelection     = useTimeStore((s) => s.setSelection)
  const clearSelection   = useTimeStore((s) => s.clearSelection)
  const setSensor        = useTimeStore((s) => s.setSparklineSensor)

  const activeLogs       = useLogStore(selectActiveLogs)
  const totalDuration_ms = useLogStore(selectTotalDuration)
  const availableSensors = useLogStore(selectAllSignals)

  return (
    <TimeRail
      logs={activeLogs.map(l => ({
        logId:       l.logId,
        filename:    l.filename,
        duration_ms: l.duration_ms,
        enabled:     l.enabled,
      }))}
      totalDuration_ms={totalDuration_ms}
      cursor_ms={cursor_ms}
      selection={selection}
      sparklineSensor={sparklineSensor}
      availableSensors={availableSensors}
      onCursorChange={setCursor}
      onSelectionChange={(sel) =>
        sel ? setSelection(sel.start_ms, sel.end_ms) : clearSelection()
      }
      onSparklineSensorChange={setSensor}
    />
  )
}
```

O `TimeRail` internamente usa ECharts ou SVG para renderizar a linha do tempo, a sparkline e os handles de cursor/seleção. Cada interação de drag chama `onCursorChange` ou `onSelectionChange`.

---

## Sincronização com `SyncedChart`

Os gráficos na aba Gráficos (`SyncedChart`) sincronizam o cursor do `useTimeStore` com a linha vertical mostrada em todos os painéis:

```tsx
// Em SyncedChart.tsx:
const cursor_ms   = useTimeStore((s) => s.cursor_ms)
const setCursor   = useTimeStore((s) => s.setCursor)

// ECharts: quando o usuário move o mouse sobre o gráfico:
chart.on('mousemove', (params) => {
  setCursor(params.data[0])   // params.data[0] = timestamp_ms
})
```

Isso cria a sincronização bidirecional: arrastar o cursor no TimeRail move a linha em todos os SyncedCharts, e mover o mouse sobre qualquer SyncedChart move o cursor no TimeRail.

---

## Sincronização com `HeatmapTable` (aba Dados)

Na aba Dados, a tabela destaca a linha correspondente ao `cursor_ms`:

```tsx
// Em DataTab.tsx:
const cursor_ms = useTimeStore((s) => s.cursor_ms)

// Encontra a linha mais próxima do cursor na tabela
const highlightedRowIndex = useMemo(() => {
  if (cursor_ms === null || rows.length === 0) return null
  let best = 0
  let bestDiff = Math.abs(rows[0].timestamp_ms - cursor_ms)
  for (let i = 1; i < rows.length; i++) {
    const diff = Math.abs(rows[i].timestamp_ms - cursor_ms)
    if (diff < bestDiff) { bestDiff = diff; best = i }
  }
  return best
}, [cursor_ms, rows])
```

---

## Comportamento quando o range total muda

Diagrama de decisão em `onTotalDurationChanged`:

```
newTotal_ms recebido
       │
       ├── cursor_ms !== null
       │       ├── cursor_ms > newTotal_ms → clampado para newTotal_ms
       │       └── cursor_ms === 0 e newTotal_ms === 0 → cursor_ms = null
       │
       └── selection !== null
               ├── start_ms >= newTotal_ms → selection = null (inteiramente fora)
               ├── end_ms > newTotal_ms → end_ms = newTotal_ms (parcialmente fora)
               │       └── se após ajuste start_ms >= end_ms → selection = null
               └── ambos dentro → sem mudança
```

**Caso prático:** usuário tem 3 logs (total 30 min), seleção em [10min, 25min]. Remove o segundo log. Novo total = 20 min. Comportamento:
- `start_ms = 600_000` (10 min) < `newTotal = 1_200_000` (20 min): dentro do range.
- `end_ms = 1_500_000` (25 min) > `newTotal = 1_200_000` (20 min): clampado para 20 min.
- Nova seleção: [10min, 20min].

---

## Seletores recomendados para componentes

```typescript
// Para o TimeRail
const cursor_ms       = useTimeStore((s) => s.cursor_ms)
const selection       = useTimeStore((s) => s.selection)
const sparklineSensor = useTimeStore((s) => s.sparklineSensor)

// Para o TuningStore (ao montar o TuningRunRequest)
const timeRange = useTimeStore((s) => s.selection)
// timeRange === null → usa todos os pontos; !== null → usa o intervalo

// Para a aba Dados (highlight de linha)
const cursor_ms = useTimeStore((s) => s.cursor_ms)

// Para os SyncedCharts (zoom inicial e linha de cursor)
const selection   = useTimeStore((s) => s.selection)
const cursor_ms   = useTimeStore((s) => s.cursor_ms)
const setCursor   = useTimeStore((s) => s.setCursor)
```

---

## Localização do arquivo

`src/store/timeStore.ts`
