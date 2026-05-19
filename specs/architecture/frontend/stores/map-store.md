# Store: `useMapStore`

Store Zustand responsável por todo o ciclo de vida do mapa: importação, armazenamento, edição manual e aplicação de resultados do auto-tuning.

---

## Estado completo

```typescript
// src/store/mapStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MapModel } from '@/types/map'

interface MapState {
  /** Modelo completo parseado client-side. Fonte de verdade imutável do mapa original.
   *  null = nenhum mapa carregado. */
  originalMap:  MapModel | null

  /** Cópia editável das células. O usuário edita aqui; o auto-tuning plota aqui.
   *  null = nenhum mapa carregado.
   *  Começa como cópia de originalMap.cells. */
  editableMap:  number[][] | null

  /** true se editableMap foi alterado em relação a originalMap.cells.
   *  Computed — derivado da comparação profunda. Não armazenado diretamente. */
  isDirty:      boolean

  /** true durante o parsing do CSV (client-side). Controla spinners na UI. */
  isLoading:    boolean

  /** Mensagem de erro do último upload ou operação. null = sem erro. */
  lastError:    string | null
}

interface MapActions {
  loadMap(file: File): Promise<void>
  resetEditable(): void
  updateCell(row: number, col: number, value: number): void
  applyTuningOutput(suggested: number[][]): void
  clear(): void

  /** Usado pelo sessionRestorer para popular o store sem re-executar o parsing. */
  hydrate(data: {
    originalModel: MapModel
    editableCells: number[][]
  }): void
}

type MapStore = MapState & MapActions
```

### Valores iniciais

```typescript
const initialState: MapState = {
  originalMap: null,
  editableMap: null,
  isDirty:     false,
  isLoading:   false,
  lastError:   null,
}
```

---

## Implementação do store

```typescript
// src/store/mapStore.ts (continuação)
import { parseMapClient }         from '@/parsers/mapParser'
import * as mapPersistence        from '@/persistence/mapPersistence'
import { useTuningStore }         from './tuningStore'
import { deepEqual }              from '@/utils/deepEqual'
import { debounce }               from '@/utils/debounce'

export const useMapStore = create<MapStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ── loadMap ──────────────────────────────────────────────────────────────
    async loadMap(file: File): Promise<void> {
      set({ isLoading: true, lastError: null })
      try {
        const model = await parseMapClient(file)

        const editableCells = model.cells.map(row => [...row])  // deep copy

        set({
          originalMap:  model,
          editableMap:  editableCells,
          isDirty:      false,
          isLoading:    false,
        })

        // Persiste no IndexedDB imediatamente após parsing bem-sucedido
        await mapPersistence.saveMap(model, editableCells, file)

        // Limpa o output do tuning anterior — mapa novo, output desatualizado
        useTuningStore.getState().clearOutput()

      } catch (err) {
        set({ isLoading: false, lastError: err instanceof Error ? err.message : 'Erro ao parsear o mapa.' })
      }
    },

    // ── resetEditable ────────────────────────────────────────────────────────
    resetEditable(): void {
      const { originalMap } = get()
      if (!originalMap) return

      const freshCopy = originalMap.cells.map(row => [...row])
      set({ editableMap: freshCopy, isDirty: false })
      // O subscriber de editableMap persiste de forma debounced (veja abaixo)
    },

    // ── updateCell ───────────────────────────────────────────────────────────
    updateCell(row: number, col: number, value: number): void {
      const { editableMap, originalMap } = get()
      if (!editableMap || !originalMap) return

      // Validação de range: hard limits do mapa da ECU
      const clamped = Math.max(100, Math.min(9999, Math.round(value)))
      if (clamped !== value) {
        // Valor inválido — a UI deve ter mostrado erro antes de chegar aqui,
        // mas fazemos clamp como fallback de segurança
      }

      // Cria nova referência da matriz para disparar re-renders corretamente
      const newMap = editableMap.map((r, ri) =>
        ri === row
          ? r.map((c, ci) => (ci === col ? clamped : c))
          : r
      )

      const isDirty = !deepEqual(newMap, originalMap.cells)
      set({ editableMap: newMap, isDirty })
      // A persistência no IndexedDB é feita pelo subscriber debounced (300ms)
    },

    // ── applyTuningOutput ─────────────────────────────────────────────────────
    applyTuningOutput(suggested: number[][]): void {
      const { originalMap } = get()
      if (!originalMap) return

      // Deep copy do sugerido para que futuras edições não mutem o TuningOutput
      const newMap = suggested.map(row => [...row])
      const isDirty = !deepEqual(newMap, originalMap.cells)

      set({ editableMap: newMap, isDirty })
      // O subscriber debounced persiste no IndexedDB
    },

    // ── clear ─────────────────────────────────────────────────────────────────
    async clear(): Promise<void> {
      set(initialState)
      await mapPersistence.clearMap()
      useTuningStore.getState().clearOutput()
    },

    // ── hydrate (usado pelo sessionRestorer) ──────────────────────────────────
    // Restaura o estado do store a partir do IndexedDB sem re-parsear o CSV.
    hydrate({ originalModel, editableCells }): void {
      const isDirty = !deepEqual(editableCells, originalModel.cells)
      set({
        originalMap:  originalModel,
        editableMap:  editableCells,
        isDirty,
        isLoading:    false,
        lastError:    null,
      })
    },
  }))
)
```

---

## Computed: `isDirty`

O `isDirty` é mantido **dentro do store como estado explícito** (não como seletor derivado externo) para que a UI possa subscrevê-lo diretamente sem recomputar o `deepEqual` a cada render.

A invariante é mantida por `updateCell` e `applyTuningOutput`: toda mutação de `editableMap` recalcula `isDirty` na mesma transação de `set()`.

```typescript
// Para ler isDirty na UI:
const isDirty = useMapStore((s) => s.isDirty)

// Para ler o estado do botão "Resetar":
const canReset = useMapStore((s) => s.isDirty && s.originalMap !== null)
```

---

## Persistência no IndexedDB

### Subscriber debounced para `editableMap`

Configurado fora do store (em `main.tsx` ou em um módulo `persistence/subscribers.ts` chamado na inicialização):

```typescript
// src/persistence/subscribers.ts
import { useMapStore }    from '@/store/mapStore'
import * as mapPersistence from './mapPersistence'
import { debounce }        from '@/utils/debounce'

const debouncedSaveEditableCells = debounce(
  async (cells: number[][]) => {
    try {
      await mapPersistence.updateEditableCells(cells)
    } catch (err) {
      console.warn('[mft] Falha ao persistir editableMap:', err)
    }
  },
  300  // 300ms após a última mudança
)

export function setupMapSubscribers(): void {
  useMapStore.subscribe(
    (state) => state.editableMap,
    (editableMap) => {
      if (editableMap !== null) {
        debouncedSaveEditableCells(editableMap)
      }
    }
  )
}
```

### Timing de persistência

| Dado | Quando é salvo | Como |
|------|---------------|------|
| `originalMap` + `csvBlob` | Imediatamente após `loadMap()` bem-sucedido | `mapPersistence.saveMap(model, editableCells, file)` dentro de `loadMap()` |
| `editableMap` | 300ms após a última chamada a `updateCell()` ou `applyTuningOutput()` | Subscriber debounced |
| Limpeza total | Quando `clear()` é chamado | `mapPersistence.clearMap()` dentro de `clear()` |

O debounce de 300ms garante que edições rápidas (usuário digitando em várias células em sequência) não gerem dezenas de writes no IndexedDB — apenas o estado final é persistido.

---

## Side effects: `originalMap` → `clearOutput`

Quando `originalMap` muda (novo mapa carregado), o output do auto-tuning anterior está obsoleto. Isso é tratado diretamente em `loadMap()`:

```typescript
// Dentro de loadMap():
useTuningStore.getState().clearOutput()
```

Usa `getState()` do Zustand (acesso direto ao estado sem hook) para evitar ciclos de render e para funcionar fora de componentes React. Nunca usar `useXxxStore()` (hook) dentro de um store — apenas `useXxxStore.getState()`.

---

## Seletores recomendados para componentes

```typescript
// Verificar se há mapa carregado (para guards e cards)
const hasMap = useMapStore((s) => s.originalMap !== null)

// Para o HeatmapTable do Mapa Original (somente leitura)
const originalCells    = useMapStore((s) => s.originalMap?.cells ?? null)
const rpmBreakpoints   = useMapStore((s) => s.originalMap?.rpmBreakpoints ?? [])
const mapBreakpoints   = useMapStore((s) => s.originalMap?.mapBreakpoints ?? [])

// Para o HeatmapTable do Mapa Editável
const editableMap      = useMapStore((s) => s.editableMap)

// Para o botão "Resetar"
const isDirty          = useMapStore((s) => s.isDirty)

// Para o botão "Exportar" na TopBar
const mapName          = useMapStore((s) => s.originalMap?.name ?? null)

// Para spinners de loading
const isLoading        = useMapStore((s) => s.isLoading)
const lastError        = useMapStore((s) => s.lastError)
```

---

## Células modificadas — como identificar

O `HeatmapTable` recebe `highlightedCells?: Set<string>` para destacar células com borda vermelha. O cálculo é feito no componente pai (não no store), comparando `editableMap` com `originalMap.cells`:

```typescript
// Em VETab.tsx ou no componente pai do HeatmapTable editável:
const editableMap   = useMapStore((s) => s.editableMap)
const originalCells = useMapStore((s) => s.originalMap?.cells)

const modifiedCells = useMemo(() => {
  if (!editableMap || !originalCells) return new Set<string>()
  const result = new Set<string>()
  editableMap.forEach((row, ri) => {
    row.forEach((val, ci) => {
      if (val !== originalCells[ri][ci]) {
        result.add(`${ri}:${ci}`)
      }
    })
  })
  return result
}, [editableMap, originalCells])
```

---

## Utilitário `deepEqual`

A comparação de matrizes `number[][]` é feita por `deepEqual`:

```typescript
// src/utils/deepEqual.ts

/**
 * Comparação de igualdade profunda otimizada para matrizes numéricas 2D.
 * Retorna true se todas as dimensões e valores forem iguais.
 */
export function deepEqual(a: number[][], b: number[][]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false
    }
  }
  return true
}
```

---

## Localização do arquivo

`src/store/mapStore.ts`
