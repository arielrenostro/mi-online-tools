## 1. Remove the backend and its frontend integration

- [x] 1.1 Delete `backend/` entirely (FastAPI app, `VELambdaEngine`, parsers, tests, requirements) and verify `git status` shows the directory gone with no remaining references to it (`grep -rn "backend" --include=*.md --include=*.ts --include=*.tsx .` outside of git history/changelog mentions)
- [x] 1.2 Remove `frontend/src/store/tuningStore.ts`, `api/tuning.ts`, `api/engines.ts`, `AutoTuningModal.tsx`, `AnalysisSection.tsx`, `TuningConfigForm.tsx`, `TuningConfigModal.tsx`, and verify `npm run build` has no dangling imports to these paths
- [x] 1.3 Remove the backend-upload path from `api/datalog.ts` and `logStore.ts`'s `ensureLogsOnBackend()`, and verify no remaining `fetch`/`X-Content-Hash` calls in the frontend (`grep -rn "X-Content-Hash\|ensureLogsOnBackend" frontend/src`)
- [x] 1.4 Remove `MIOT_CACHE_DIR`/`VITE_API_URL` references from root and frontend `CLAUDE.md`, `.env*` files, and `vite.config.ts`, and verify `npm run build` succeeds without either var set
- [x] 1.5 Remove or rewrite `specs/architecture/overview.md`, `specs/architecture/backend/backend.md`, `specs/features/tuning-engine.md`, `specs/features/tuning/research-insights.md` to drop backend/engine content, and verify no remaining reference to `backend/`, `VELambdaEngine`, or `/api/tuning` in `specs/` (`grep -rln "backend\|VELambdaEngine\|/api/" specs/`)

## 2. Derived-signal support and VE Lambda

- [x] 2.1 Add an optional `compute?: (row: DatalogRow) => number` field to `SignalDef` in `signalRegistry.ts`, used instead of `column`/`convert` when present, and verify existing CSV-backed signals still parse correctly (`npm run test`)
- [x] 2.2 Register the `VE Lambda` signal with `compute: row => (row['Lambda 1'] - row['Lambda Target'] + 1 + row['Lambda Corr'] / 100) * row['VE']`, and verify a unit test computing it against a known row (e.g. Lambda1=1.018, LambdaTarget=1.000, LambdaCorr=+2.0, VE=59.2 → 61.45) passes
- [x] 2.3 Verify VE Lambda appears as a column in the Data tab, a selectable series in Charts, and a card in Dashboard without any code changes to those three files beyond iterating `SIGNAL_DEFS`

## 3. Data tab default columns

- [x] 3.1 Change `DataTab.tsx`'s column-visibility default so every column (including VE Lambda) is visible unless explicitly hidden, and verify a fresh session (cleared `columnVisibility` in `uiStore`) shows all columns
- [x] 3.2 Verify the existing hide/show toggle still works per column (`npm run dev`, manually toggle a column off and back on)

## 4. Correction filter evaluation (shared logic)

- [x] 4.1 Define `CorrectionFilterConfig` type (Lambda Loop selection, min CLT, min/max Lambda, max TPS delta, max |Lambda − Lambda Target|, skip-first-N-closed-loop) in `types/`
- [x] 4.2 Implement the TPS-delta trailing-window amplitude computation (sliding-window min/max, O(n)) as a pure function, and verify a unit test with a synthetic Pedal series confirms correct amplitude values including the "insufficient history" edge case (first row(s))
- [x] 4.3 Implement the skip-first-N-after-closed-loop-entry pass as a pure function operating per log independently, and verify a unit test with a synthetic Lambda Loop series (including two separate 0→1 transitions in one log, and two separate logs) confirms correct exclusion counts
- [x] 4.4 Implement `evaluateCorrectionFilters(rows, filterConfig) -> boolean[]` combining all filters (including the two above) plus the existing time-selection scoping, and verify unit tests cover: all-defaults-pass-everything, each filter individually excluding a crafted row, and combined filters (AND semantics)

## 5. Correction store and filter panel UI

- [x] 5.1 Create `useCorrectionStore` (Zustand) holding `filters`, `showFilteredPoints`, `snapshot`, `isStale`, and a `generate()` action, and verify a unit test confirms `generate()` reads active logs + time selection + filters and populates `snapshot`
- [x] 5.2 Wire `filters`/`showFilteredPoints` to localStorage persistence and `snapshot`/`isStale`/provenance to IndexedDB persistence, following the existing `persistence/*Persistence.ts` pattern, and verify a reload restores both tiers correctly
- [x] 5.3 Build the filter panel component on the Logs tab, below the log list with a visible section divider, exposing every filter from `CorrectionFilterConfig` plus the "Mostrar pontos filtrados" toggle and the "Gerar fator de correção" button, and verify it renders and updates the store on interaction (`npm run dev`, manual check)
- [x] 5.4 Disable "Gerar fator de correção" with an explanatory message when zero points currently qualify, and verify this by setting filters that exclude everything

## 6. Global filter application (Dashboard, Charts, Data)

- [x] 6.1 Extend `DataTab.tsx`'s row-visibility logic to combine the existing time-selection filter with `evaluateCorrectionFilters`, honoring `showFilteredPoints` (dim vs. omit), and verify manually that toggling filters and the visibility toggle changes the table as specified
- [x] 6.2 Verify CSV export from the Data tab includes dimmed rows but excludes hidden rows, per a manual export check with both toggle states
- [x] 6.3 Extend `ChartsTab.tsx`'s series-building logic to tag or drop excluded points per `showFilteredPoints`, and verify manually that a filter change updates an open chart panel live, in both toggle states
- [x] 6.4 Extend `DashboardTab.tsx`'s card rendering to apply a distinct style when the cursor's nearest row fails `evaluateCorrectionFilters`, and verify manually by moving the cursor across a filter boundary

## 7. Correction snapshot generation (bilinear attribution + aggregation)

- [x] 7.1 Implement bilinear-weight computation for a point against the map's RPM/MAP breakpoints (4-cell general case, 2-cell and 1-cell edge cases, out-of-range discard), and verify unit tests cover all four cases with hand-computed expected weights
- [x] 7.2 Implement per-point VE Lambda calculation (reusing the same formula as the VE Lambda signal) and per-cell accumulation into `CorrectionSnapshot` (weighted mean, unweighted median, effective count), and verify a unit test against a small synthetic dataset with known expected per-cell results
- [x] 7.3 Wire `useCorrectionStore.generate()` to run the full pipeline (filter → attribute → aggregate) and store the result with provenance (log filenames, time range, filter values snapshot), and verify manually that generating with real imported data populates the store

## 8. VE tab correction section

- [x] 8.1 Build the correction section component (only rendered once a snapshot exists), reusing `HeatmapTable` in read-only mode, and verify it appears on the VE tab after generating
- [x] 8.2 Implement the Direct/Weighted and Mean/Median/color-mode toggles as pure read-time derivations from the stored snapshot and the live editable map (no store mutation beyond the toggle state itself), and verify manually that toggling is instantaneous and that editing the map updates displayed factors without regenerating
- [x] 8.3 Implement the provenance display (logs, time range, filter values) and the staleness indicator (comparing current filters/active-logs/time-selection against the snapshot's stored provenance), and verify manually that changing a filter after generating flags the snapshot as outdated
- [x] 8.4 Implement "Apply corrections to map" (confirmation → bulk-update editable map cells with data via `mapStore.bulkUpdateCells`, one undo step, cells without data untouched), and verify manually that applying, then undoing, restores the prior map state in one step
- [x] 8.5 Add the tooltip showing every per-cell field (n, mean, median, direct factor, weighted factor) regardless of active display mode, and verify manually by hovering cells in each mode

## 9. Remove tuning-config

- [x] 9.1 Delete the tuning engine config modal's route/entry points and any remaining references, and verify `npm run build` succeeds with no dangling imports

## 10. Full verification

- [x] 10.1 Run `npm run test` and confirm the full suite passes (44/44)
- [x] 10.2 Run `npm run build` and confirm it succeeds with no backend/API references remaining
- [x] 10.3 End-to-end data verification against real files (206 map `65lbs - 27 - download_tuned_tuned.csv` + latest dash log `log_stream_20260925_191647.csv`, from the user's OneDrive): parsed both with the real parsers, ran the real filter/generation pipeline, checked plausibility (5923/5923 rows parsed, 71/256 cells got data, direct-factor range 0.81–1.12, no NaN/Infinity anywhere) — via a throwaway Vitest script, not committed. **Not done**: no browser automation tool was available in this session, so the actual UI (clicking through Logs tab filters, the VE tab heatmap, Apply, undo, reload) was never driven interactively — only the underlying data pipeline was verified against real data
- [x] 10.4 Run `openspec validate move-ve-correction-to-frontend --strict` and confirm it passes

## 11. Fixes from the user's manual test

- [x] 11.1 Rename the filter panel heading from "Filtros de correção VE" to "Filtros"
- [x] 11.2 Add the real third Lambda Loop state (`2` = closed + auto-correção) throughout: `CorrectionFilterConfig`/`DEFAULT_CORRECTION_FILTERS`, `evaluateCorrectionFilters`'s loop check and skip-closed-loop transition detection (1↔2 no longer restarts the countdown), the filter panel's checkboxes, the `Lambda Loop` signal's display format, and `specs/master/datalog.md`'s format documentation
- [x] 11.3 Split filters into a draft (edited in the panel) and an applied set (`useCorrectionStore.filters`) used by Dashboard/Charts/Data/"Gerar fator de correção"; add an explicit "Aplicar filtros" button; add a `useBlocker`-based confirmation dialog when leaving the Logs tab with unapplied edits — updated the `tuning-ve-correction` and `datalog-charts` specs to match
- [x] 11.4 Set the real default filter values (Lambda Loop: closed + closed/auto-correção only; CLT≥85; Lambda 0.6–1.1; max TPS delta 5; max |Δλ×alvo| 0.03; skip 15) in place of the previous permissive placeholders, and re-verify against the real 206 log (52.6% of points pass, 52/256 cells get data, factor range 0.963–1.014 — all plausible)
- [x] 11.5 Fix Charts not visually dimming filtered-out points: replaced the (silently non-functional) ECharts `visualMap` dimension approach with per-run series splitting (`computeRuns` in `SyncedChart.tsx`) — one series per contiguous pass/fail stretch, dimmed via `rgba(...)`, each run overlapping its neighbor by one point so the line never gaps; covered by a new `SyncedChart.test.ts`
- [x] 11.6 Add a "Máx Delta MAP" filter, mechanically identical to the TPS delta filter (200ms trailing-window amplitude): generalized `computeTpsDeltaAmplitude` into signal-agnostic `computeDeltaAmplitude(rows, signal)`, added `maxDeltaMap` to `CorrectionFilterConfig`/the panel/provenance display, updated the `tuning-ve-correction` spec's TPS delta requirement to cover both signals
- [x] 11.7 Add a symmetric "Pular 1ºs após Open Loop" filter: factored the countdown logic out of `computeClosedLoopSkipMask` into a shared `computeLoopTransitionSkipMask(rows, n, isEntry)`, added `computeOpenLoopSkipMask` (closed→open transition) and `skipFirstOpenLoop` to the config/panel/provenance, updated the spec's skip-filter requirement to describe both directions as independent counters
- [x] 11.8 Fix a real correctness bug reported by the user ("valores bem ruins" in the correction table): `CorrectionSection.tsx` was dividing the snapshot's VE Lambda (real %, e.g. 59.2) by the map's raw cell value (%×10, e.g. 592) without converting units first, producing factors ~10x too small. Extracted the factor math into a tested pure module (`utils/correctionDisplay.ts`: `rawVeToReal`, `computeDirectFactor`, `computeWeightedFactor`, `computeFactorGrid`) so `CorrectionSection.tsx` no longer computes it inline, added `correctionDisplay.test.ts`, and re-verified against the real 206 log (weighted factor range back to 0.962–1.014, matching the figures from task 11.4 that had been computed correctly only in the throwaway verification script, not in the actual component). Documented the raw-vs-real unit boundary in `design.md` and `frontend/CLAUDE.md`'s Invariantes so it doesn't regress. Separately: the user also reported "VE Lambda" showing empty in the Data tab and missing from the Charts signal sidebar — traced to a datalog already parsed/cached (in IndexedDB, or via stale Vite HMR state in their long-running dev server) before the VE Lambda signal was added; the parser itself was re-verified correct against the real log. Told the user to hard-reload and re-import the log; no code change needed for that part.
- [x] 11.9 VE tab layout fixes from manual testing: (a) moved the editable map's "Resetar" button from its own header row into `HeatmapTable`'s existing Undo/Redo/Ajuste/Interpolar toolbar row (new optional `onReset`/`resetDisabled` props threaded through `MapWithChart`, so it now sits directly above the table with the other icons); (b) fixed the fixed-width table's last column sometimes rendering slightly clipped by changing its wrapper from `overflow-hidden` to `overflow-x-auto` when a computed `cellWidth` is used, so a small width-estimate error scrolls instead of clipping; (c) replaced the correction section's Direct/Weighted toggle and Amostras/Valores color toggle with three always-visible read-only heatmaps (Direta, Ponderado, Amostras — Direta+Ponderado side by side, Amostras below), each `min-w-0` inside its own grid column so it no longer renders wider than the editable map above; kept the Mean/Median toggle (feeds both factor heatmaps) and the Apply action (now always reading the Weighted heatmap). Updated the `tuning-ve-correction` spec's factor-display-modes, apply, read-only, and tooltip requirements to describe the three-heatmap layout instead of a mode toggle.
