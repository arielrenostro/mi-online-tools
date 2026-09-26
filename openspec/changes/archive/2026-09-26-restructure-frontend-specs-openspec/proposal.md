## Why

The project's specs (`specs/`) were written ad hoc, mixing product behavior, implementation
detail (store internals, IndexedDB schema, exact file paths) and, in places, backend algorithm
detail — with no consistent capability boundary or requirement/scenario structure. This makes it
hard to tell what the frontend actually promises to the user versus what is incidental
implementation, and there is no OpenSpec-native inventory (`openspec/specs/`) to validate future
changes against. This change restructures the frontend-owned behavior into OpenSpec capabilities
with `Requirement`/`Scenario` (WHEN/THEN) format, so future changes can propose deltas against a
real spec baseline instead of hand-edited markdown.

## What Changes

- Extract all frontend-owned, browser-side behavior from `specs/features/**`, `specs/master/**`,
  and `specs/architecture/frontend/**` into 14 OpenSpec capabilities under `openspec/specs/`.
- Drop purely architectural/implementation content that is derivable from the code itself
  (folder layout, dependency versions, TypeScript type definitions, exact IndexedDB store/key
  names, generic API-client plumbing) — it is not restated as spec requirements.
- Keep the auto-tuning **algorithm** (`specs/features/tuning-engine.md`,
  `specs/features/tuning/research-insights.md`) and the backend architecture
  (`specs/architecture/backend/backend.md`) untouched and out of scope: per project decision, the
  tuning rule is backend-only and must not be duplicated or re-derived in frontend specs. The
  `tuning-ve` capability describes only that the frontend triggers auto-tuning and renders the
  returned `TuningOutput` — never the algorithm that produces it.
- Factor shared table-editing behavior (selection, keyboard shortcuts, clipboard, undo/redo,
  inline/bulk edit) into one `heatmap-editing` capability instead of duplicating it across the
  three map tabs; `tuning-ignition` and `tuning-lambda` reference it and only spell out their own
  differences (no auto-tune button, value range/scale differences), matching how the current docs
  already describe them.
- **BREAKING** (docs only, no code impact): once these capabilities are archived into
  `openspec/specs/`, the migrated files under `specs/features/**` and `specs/architecture/frontend/**`
  are deleted, along with `specs/master/map.md` (frontend-exclusive format), and the spec index
  table in the root `CLAUDE.md` is updated to point at `openspec/specs/<capability>/spec.md`. Kept
  as-is: `specs/features/tuning-engine.md`, `specs/features/tuning/research-insights.md`, and
  `specs/architecture/backend/backend.md` (backend-owned), `specs/master/datalog.md` (the backend's
  own datalog parser also depends on this format spec, not just the frontend), and `specs/overview.md`
  (project-wide scope/roadmap/target-users, not superseded by a capability inventory). See
  `tasks.md` for the exact file list.

## Capabilities

### New Capabilities

- `home`: Home screen (`/`) — entry cards for Tuning/Datalog, their enablement rules, and
  navigation into the two flows.
- `map-import-export`: Client-side parsing of the MasterInjection map CSV format, the TopBar's
  map import/replace control, and client-side export (download) of the updated CSV.
- `datalog-import`: Client-side parsing of the MasterInjection datalog CSV format, the Logs tab
  (drop zone, hash-based dedup, drag-to-reorder, enable/disable, remove), and the TopBar's logs
  panel.
- `datalog-timeline`: The TimeRail shared across all Datalog tabs — point cursor, interval
  selection, sparkline, multi-log concatenation, and its bidirectional sync with charts/zoom.
- `datalog-dashboard`: Datalog → Dashboard tab — grid of signal-value cards at the cursor instant.
- `datalog-charts`: Datalog → Gráficos tab — configurable synced line-chart panels, signal
  sidebar, split/resize behavior.
- `datalog-table`: Datalog → Dados tab — virtualized row table, column visibility, filtering by
  selection, CSV export.
- `heatmap-editing`: Shared N×M table interaction contract (selection, keyboard navigation,
  inline/bulk edit, clipboard, undo/redo) used by the VE/Ignition/Lambda map tabs.
- `tuning-ve`: Tuning → VE tab — editable VE map, running auto-tuning and rendering its output
  (diagnostic heatmaps, warnings, filter stats), reset, and the log-point overlay.
- `tuning-ignition`: Tuning → Ignition tab — manual-only editing of the ignition map (locked in
  v1); defers to `heatmap-editing` and documents only its own differences.
- `tuning-lambda`: Tuning → Lambda tab — manual-only editing of the lambda-target map with its
  scale conversion (locked in v1); defers to `heatmap-editing`.
- `tuning-config`: The tuning engine's config modal — dynamic schema-driven form, field
  dependencies, save/restore-defaults behavior.
- `navigation-guards`: Route structure, `RequireMap`/`RequireLog` guards, redirect rules, and the
  session-restoring spinner shown while a guard's decision is pending.
- `session-persistence`: Cross-cutting contract for what survives a reload, the restore order,
  invalidation rules (e.g., replacing the map clears the last tuning output), and the
  IndexedDB-unavailable fallback.

### Modified Capabilities

None — `openspec list --specs` returns no existing capabilities; this is a first-time baseline.

## Impact

- Documentation only: adds `openspec/specs/<capability>/spec.md` for the 14 capabilities above.
- No source code, API, or dependency changes.
- Follow-up (tracked in `tasks.md`, executed only after this change is approved and archived):
  deletes the migrated files under `specs/features/**`, `specs/master/**`, and
  `specs/architecture/frontend/**`, and updates the spec index table in the root `CLAUDE.md`.
