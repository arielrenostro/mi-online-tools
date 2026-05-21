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

## Comportamento das actions

- **`loadMap`** — parseia o CSV (`parseMapClient`), define `originalMap` + `editableMap` (deep copy de `cells`), persiste no IndexedDB e chama `useTuningStore.clearOutput()` (mapa novo invalida o output anterior).
- **`resetEditable`** — restaura `editableMap` para uma cópia de `originalMap.cells`; `isDirty = false`.
- **`updateCell`** — clampa o valor a `[100, 9999]` (hard limit, fallback), substitui a célula gerando **nova referência** de matriz (re-render), recalcula `isDirty`. Persistido no IndexedDB via subscriber debounced (300ms).
- **`applyTuningOutput`** — substitui `editableMap` por uma deep copy do `suggested` (não mutar o `TuningOutput`), recalcula `isDirty`.
- **`clear`** — zera o store, limpa o IndexedDB e o output do tuning.
- **`hydrate`** — aplica o estado restaurado e recalcula `isDirty`.

## `isDirty`

Mantido como **estado explícito** no store (não seletor derivado) — a UI pode subscrevê-lo sem recomputar `deepEqual` a cada render. `updateCell` e `applyTuningOutput` o recalculam na mesma transação de `set()`, comparando `editableMap` com `originalMap.cells` via `deepEqual` (comparação de matrizes numéricas 2D, `utils/deepEqual.ts`).

## Persistência (IndexedDB)

| Dado | Quando | Como |
|------|--------|------|
| `originalMap` + `csvBlob` | Após `loadMap()` | `mapPersistence.saveMap()` |
| `editableMap` | 300ms após `updateCell`/`applyTuningOutput` | Subscriber debounced |
| Limpeza total | `clear()` | `mapPersistence.clearMap()` |

O debounce de 300ms evita dezenas de writes ao editar células em sequência.

## Acesso a outros stores

Side effects (ex.: `loadMap` → `clearOutput`) usam `useXxxStore.getState()` (acesso direto) dentro do store — nunca os hooks `useXxxStore()` — para evitar ciclos e re-renders.

## Células modificadas

O cálculo do `Set<string>` de células modificadas (`"row:col"`) é feito no **pai** (não no store), em `useMemo`, comparando `editableMap` com `originalMap.cells`. Passado ao `HeatmapTable` como `highlightedCells` / `modifiedCells`.
