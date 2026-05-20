# Store: `useMapStore`

Ciclo de vida do mapa: importação, armazenamento, edição manual e aplicação de resultados do auto-tuning.

**Arquivo:** `src/store/mapStore.ts`

## Estado

```typescript
interface MapState {
  originalMap:  MapModel | null    // modelo parseado client-side; fonte de verdade imutável
  editableMap:  number[][] | null  // cópia editável; começa como cópia de originalMap.cells
  isDirty:      boolean            // editableMap difere de originalMap.cells (estado explícito)
  isLoading:    boolean            // parsing do CSV em andamento
  lastError:    string | null
}

interface MapActions {
  loadMap(file: File): Promise<void>
  resetEditable(): void
  updateCell(row: number, col: number, value: number): void
  applyTuningOutput(suggested: number[][]): void
  clear(): void
  hydrate(data: { originalModel: MapModel; editableCells: number[][] }): void  // sessionRestorer
}
```

Valores iniciais: tudo `null`/`false`.

## Implementação

```typescript
export const useMapStore = create<MapStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    async loadMap(file: File): Promise<void> {
      set({ isLoading: true, lastError: null })
      try {
        const model = await parseMapClient(file)
        const editableCells = model.cells.map(row => [...row])  // deep copy
        set({ originalMap: model, editableMap: editableCells, isDirty: false, isLoading: false })
        await mapPersistence.saveMap(model, editableCells, file)  // persiste imediato
        useTuningStore.getState().clearOutput()  // mapa novo → output desatualizado
      } catch (err) {
        set({ isLoading: false, lastError: err instanceof Error ? err.message : 'Erro ao parsear o mapa.' })
      }
    },

    resetEditable(): void {
      const { originalMap } = get()
      if (!originalMap) return
      set({ editableMap: originalMap.cells.map(row => [...row]), isDirty: false })
    },

    updateCell(row, col, value): void {
      const { editableMap, originalMap } = get()
      if (!editableMap || !originalMap) return
      const clamped = Math.max(100, Math.min(9999, Math.round(value)))  // hard limits, fallback
      const newMap = editableMap.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? clamped : c)) : r)  // nova referência → re-render
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells) })
      // persistência IndexedDB via subscriber debounced (300ms)
    },

    applyTuningOutput(suggested): void {
      const { originalMap } = get()
      if (!originalMap) return
      const newMap = suggested.map(row => [...row])  // deep copy — não mutar o TuningOutput
      set({ editableMap: newMap, isDirty: !deepEqual(newMap, originalMap.cells) })
    },

    async clear(): Promise<void> {
      set(initialState)
      await mapPersistence.clearMap()
      useTuningStore.getState().clearOutput()
    },

    hydrate({ originalModel, editableCells }): void {
      set({
        originalMap: originalModel, editableMap: editableCells,
        isDirty: !deepEqual(editableCells, originalModel.cells),
        isLoading: false, lastError: null,
      })
    },
  }))
)
```

## `isDirty`

Mantido como **estado explícito** no store (não seletor derivado) — a UI pode subscrevê-lo sem recomputar `deepEqual` a cada render. `updateCell` e `applyTuningOutput` recalculam `isDirty` na mesma transação de `set()`.

## Persistência no IndexedDB

Subscriber debounced para `editableMap`, configurado na inicialização (`persistence/subscribers.ts`):

```typescript
const debouncedSaveEditableCells = debounce(async (cells: number[][]) => {
  try { await mapPersistence.updateEditableCells(cells) }
  catch (err) { console.warn('[mft] Falha ao persistir editableMap:', err) }
}, 300)

export function setupMapSubscribers(): void {
  useMapStore.subscribe(
    (state) => state.editableMap,
    (editableMap) => { if (editableMap !== null) debouncedSaveEditableCells(editableMap) }
  )
}
```

| Dado | Quando | Como |
|------|--------|------|
| `originalMap` + `csvBlob` | Após `loadMap()` | `mapPersistence.saveMap()` dentro de `loadMap()` |
| `editableMap` | 300ms após `updateCell`/`applyTuningOutput` | Subscriber debounced |
| Limpeza total | `clear()` | `mapPersistence.clearMap()` |

O debounce de 300ms evita dezenas de writes quando o usuário edita várias células em sequência.

## Side effects

Quando `originalMap` muda (novo mapa), o output anterior fica obsoleto — `loadMap()` chama `useTuningStore.getState().clearOutput()`. Usar `getState()` (acesso direto, sem hook) dentro de stores — nunca `useXxxStore()`.

## Seletores recomendados

```typescript
const hasMap         = useMapStore((s) => s.originalMap !== null)
const originalCells  = useMapStore((s) => s.originalMap?.cells ?? null)
const rpmBreakpoints = useMapStore((s) => s.originalMap?.rpmBreakpoints ?? [])
const mapBreakpoints = useMapStore((s) => s.originalMap?.mapBreakpoints ?? [])
const editableMap    = useMapStore((s) => s.editableMap)
const isDirty        = useMapStore((s) => s.isDirty)
const mapName        = useMapStore((s) => s.originalMap?.name ?? null)
const isLoading      = useMapStore((s) => s.isLoading)
const lastError      = useMapStore((s) => s.lastError)
```

## Células modificadas

`HeatmapTable` recebe `highlightedCells?: Set<string>`. O cálculo é feito no pai (não no store), comparando `editableMap` com `originalMap.cells`:

```typescript
const modifiedCells = useMemo(() => {
  if (!editableMap || !originalCells) return new Set<string>()
  const result = new Set<string>()
  editableMap.forEach((row, ri) => {
    row.forEach((val, ci) => {
      if (val !== originalCells[ri][ci]) result.add(`${ri}:${ci}`)
    })
  })
  return result
}, [editableMap, originalCells])
```

## Utilitário `deepEqual`

```typescript
// src/utils/deepEqual.ts — comparação de matrizes numéricas 2D
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
