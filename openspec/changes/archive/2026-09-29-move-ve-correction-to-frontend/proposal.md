## Why

The backend's 12-step auto-tuning engine has never worked well in practice and won't be revisited.
Meanwhile, the user needs a trustworthy, transparent way to see how the current VE map compares to
what the datalogs actually observed, configure exactly which datalog points count before spending
the effort to compute that, and apply the result. A client-side, on-demand "generate" flow —
paired with the ability to preview the effect of the filters on the very data the Datalog screen
already shows — serves that far better than a one-shot backend run behind a "Run Auto-tuning"
button, and removes an entire service the project no longer benefits from.

## What Changes

- **BREAKING**: Remove the backend entirely (`backend/`) — FastAPI service, the `VELambdaEngine`
  12-step pipeline, `/api/engines`, `/api/datalog/upload`, `/api/tuning/run`. The app becomes a
  fully static, backend-less SPA.
- **BREAKING**: Remove the "Run Auto-tuning" flow from the VE tab — the confirmation dialog, the
  run summary, the backend-sourced diagnostic heatmaps (`AnalysisSection`), the post-processing
  warnings panel, and the filter-statistics panel. None of these have a client-side equivalent;
  they are replaced by the new correction flow described below.
- **BREAKING**: Remove the tuning engine config modal (`tuning-config`) — it existed to render a
  form from the backend engine's JSON schema, which no longer exists.
- Add a **filter panel** to the Logs tab, below the log list and visually separated from it: Lambda
  Loop (multi-select: open, closed, closed + auto-correção), min CLT, min/max Lambda, max TPS delta
  and max MAP delta (each a 200 ms trailing-window amplitude, on the Pedal and MAP signals
  respectively), max |Lambda − Lambda Target| delta, and skip-first-N after entering closed loop and
  after entering open loop (two independent counters, each resetting per log). Edits are a draft
  until "Aplicar filtros" is activated; only then do they take effect, combined with the timeline's
  time selection when one exists, on which points
  qualify globally across the Dashboard, Charts, and Data tabs. Leaving the Logs tab with an
  unapplied draft prompts for confirmation.
  - A "Mostrar pontos filtrados" toggle on the same panel controls how excluded points render
    everywhere: **visible** dims them (Data tab: dimmed row; Charts: dimmed point, keeping the
    series' time continuity) or **hidden** removes them outright (Data tab: row omitted; Charts:
    point dropped from the series with no gap-awareness).
  - The Dashboard's per-signal card always gets a distinct flag when the cursor's current instant
    fails the filters, regardless of the visibility toggle.
- Add a **"Gerar fator de correção"** action next to the filter panel that computes, once, a
  read-only correction snapshot from the currently qualifying points: each point is attributed to
  up to 4 surrounding MAP×RPM cells by bilinear interpolation (matching how the ECU itself reads
  the table) instead of snapping to the nearest breakpoint; each cell gets an effective sample
  count (sum of bilinear weights), a mean, and a median of its points' per-point VE Lambda values.
- The VE tab displays the last generated snapshot as a read-only heatmap below the editable map,
  with:
  - Two color modes (by sample count; by value — divergent, 1.00 neutral) and two value modes
    (Direct: raw factor `cell VE Lambda ÷ current map value`; Weighted: that factor damped toward
    1.0 by `w = n / (n + 100)`, a fixed constant with no UI control) — all four combinations read
    instantly from the same snapshot, no regeneration needed.
  - The snapshot's provenance: which logs, which time range (or "all points"), and which filter
    values produced it.
  - A staleness flag when the filters, active log set, or time selection change after generating
    (the snapshot stays displayed until regenerated); editing the map does **not** trigger
    staleness, since the factor is cheaply recomputed live against the snapshot's stored values.
  - "Apply corrections to map," which multiplies each map cell with data by its current factor as
    one undo step (cells with no data are left unchanged). The heatmap itself is not editable.
- Add a new derived signal, **VE Lambda** (`(Lambda1 − LambdaTarget + 1 + LambdaCorr/100) × VE`),
  available everywhere signals are today: the Data tab, Charts, and Dashboard.
- Change the Data tab's default column set from a curated subset to **all columns visible** by
  default.
- Remove the now-meaningless persisted state (last auto-tuning result, tuning config, selected
  engine) and its invalidation rules; persist the last generated correction snapshot (with its
  provenance) and the filter panel's settings instead.

## Capabilities

### New Capabilities
- `tuning-ve-correction`: the correction filter panel and "Gerar" action (on the Logs tab), and the
  generated snapshot's read-only heatmap, provenance, staleness, and "Apply corrections" action (on
  the VE tab).

### Modified Capabilities
- `tuning-ve`: three-section layout keeps its shape (original map, editable map, correction section
  that only appears once generated) but the third section is now `tuning-ve-correction`'s output
  instead of a backend run's; removes the config access point.
- `datalog-table`: default column set becomes "all columns" (including VE Lambda); rows also honor
  the correction filters and visibility toggle, on top of the existing time-selection filter.
- `datalog-charts`: series points honor the correction filters and visibility toggle (dimmed or
  dropped).
- `datalog-dashboard`: a signal's card flags when the cursor's current instant fails the correction
  filters.
- `datalog-import`: the Logs tab hosts the correction filter panel; rewords the "auto-tuning input"
  scenario to name the correction snapshot instead.
- `datalog-timeline`: rewords the "auto-tuning" scenario to describe scoping the correction
  snapshot's generation instead of a one-shot backend run.
- `session-persistence`: drops persistence and invalidation rules for the last auto-tuning result,
  tuning config, and selected engine; persists the last generated correction snapshot (with
  provenance) and the filter panel's settings, with staleness (not discarding) on filter/log/
  selection changes.
- `tuning-config`: **removed** entirely — no backend engine schema left to drive its form.

## Impact

- **Removed**: `backend/` (entire directory: FastAPI app, engine, parsers, tests, requirements)
  and its root-level run instructions.
- **Frontend removed**: `AutoTuningModal.tsx`, `AnalysisSection.tsx`, `TuningConfigForm.tsx`,
  `TuningConfigModal.tsx`, `store/tuningStore.ts`, `api/tuning.ts`, `api/engines.ts`, the
  backend-upload path in `api/datalog.ts` and `store/logStore.ts`'s `ensureLogsOnBackend()`.
- **Frontend added**: a correction-filter module (shared by Dashboard/Charts/Data tabs and the
  generation step), a generation module (bilinear attribution → per-cell aggregation → snapshot),
  a filter-panel component on the Logs tab, a heatmap+provenance component on the VE tab, and a
  derived-signal mechanism in `signals/signalRegistry.ts` (signals computed from other
  already-converted signals, not straight from a CSV column).
- **Docs**: root and frontend `CLAUDE.md` lose the backend subproject and its run instructions;
  `specs/architecture/overview.md`, `specs/architecture/backend/backend.md`,
  `specs/features/tuning-engine.md`, and `specs/features/tuning/research-insights.md` (all outside
  the OpenSpec capability system) are removed or rewritten to drop backend/engine references —
  handled as direct file edits in `tasks.md`, not as OpenSpec deltas.
- **Env vars**: `MIOT_CACHE_DIR` and `VITE_API_URL` no longer apply.
