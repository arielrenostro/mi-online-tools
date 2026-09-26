## Context

`openspec list --specs` returns nothing today — there is no OpenSpec capability inventory yet.
Everything the frontend does is instead documented in `specs/features/**`, `specs/master/**`, and
`specs/architecture/frontend/**`: ~30 files that mix product behavior (what the user sees and can
do), implementation detail (Zustand store shapes, IndexedDB key names, exact debounce timings,
folder layout, dependency versions), and — in `specs/features/tuning-engine.md` and
`specs/features/tuning/research-insights.md` — the backend auto-tuning algorithm itself. See
`proposal.md` — Why for the motivation; this only covers how the migration is structured.

## Goals / Non-Goals

**Goals:**
- Produce one OpenSpec capability per coherent piece of frontend-owned, browser-observable
  behavior, each with `Requirement`/`Scenario` (WHEN/THEN) content that could be validated against
  the running app.
- Preserve every behavior currently documented that a user or another engineer would need to know
  to reason about the app, minus content that is purely derivable from reading the code.
- Keep the backend auto-tuning rule entirely out of frontend capabilities.

**Non-Goals:**
- Not re-documenting the backend (`specs/features/tuning-engine.md`,
  `specs/features/tuning/research-insights.md`, `specs/architecture/backend/backend.md`) — those
  stay as they are.
- Not producing an architecture reference (folder layout, dependency list, TypeScript type
  definitions). That content is dropped, not relocated — see Decisions.
- Not changing any frontend behavior. This is a documentation-only change; `tasks.md` has no code
  tasks.

## Decisions

### Capability boundaries (14 total)

One capability per screen/tab plus four cross-cutting ones, matching what a user or another
engineer would think of as one coherent piece of behavior:

| Capability | Source spec(s) migrated |
|---|---|
| `home` | `features/home/home.md` |
| `map-import-export` | `master/map.md` (frontend-exclusive format — backend never parses the map); TopBar "Seção: Mapa" from `features/topbar/topbar.md` |
| `datalog-import` | Behavioral subset of `master/datalog.md` (the format spec itself is also used by the backend's own datalog parser and is kept, not deleted — see Decisions); `features/datalog/logs.md`; TopBar "Seção: Logs" from `features/topbar/topbar.md` |
| `datalog-timeline` | TimeRail section of `features/datalog/overview.md`; `architecture/frontend/components/time-rail.md`; `architecture/frontend/stores/time-store.md` (behavioral parts) |
| `datalog-dashboard` | `features/datalog/dashboard.md` |
| `datalog-charts` | `features/datalog/charts.md`; `architecture/frontend/components/synced-chart.md` |
| `datalog-table` | `features/datalog/data.md` |
| `heatmap-editing` | Keyboard/selection/editing sections of `features/tuning/ve.md`; `architecture/frontend/components/heatmap-table.md` |
| `tuning-ve` | `features/tuning/ve.md` (layout, auto-tuning trigger, analysis display, log overlay); `features/tuning/overview.md`; `architecture/frontend/components/map-chart.md` |
| `tuning-ignition` | `features/tuning/ignition.md` |
| `tuning-lambda` | `features/tuning/lambda.md` |
| `tuning-config` | `features/tuning/config.md` (field list/behavior only, not the algorithm meaning of each param); `architecture/frontend/components/tuning-config-modal.md` |
| `navigation-guards` | `architecture/frontend/routes.md`; `architecture/frontend/components/guards.md`; `architecture/frontend/components/tuning-tab-link.md`; `architecture/frontend/components/top-bar.md` (routing-relevant parts) |
| `session-persistence` | `architecture/frontend/persistence.md`; `architecture/overview.md` (persistence section); behavioral parts of `stores/map-store.md`, `stores/log-store.md`, `stores/tuning-store.md`, `stores/ui-store.md` |

Alternative considered: one capability per current file (~25+, including one per Zustand store and
UI component). Rejected — several of those files (e.g. `types.md`, most of `frontend.md`) contain
no independently-testable behavior distinct from the capability that uses them, and stores like
`useTuningStore`/`useMapStore` don't correspond to a single user-facing capability; splitting by
store would scatter one screen's behavior (e.g. VE tab) across three or four spec files.

Also considered: 3 capabilities (`home`, `tuning`, `datalog`) covering everything under each
top-level route. Rejected — it would force `heatmap-editing` to be duplicated three times inside
one file (VE/Ignition/Lambda) instead of referenced once, and would make each file unreasonably
long relative to how independently each tab already varies (locked tabs, different value scales).

### `heatmap-editing` as a shared capability

`tuning-ignition` and `tuning-lambda` do not restate the full keyboard/selection/editing contract;
their spec files state that they inherit `heatmap-editing`'s requirements and list only what
differs (no auto-tuning button, value range, decimal display/scale conversion for lambda). This
mirrors how the source docs already describe ignition/lambda ("Idêntico à aba VE... Diferenças:").
OpenSpec capabilities don't support formal inheritance, so this reference is prose, not tooling —
a future change to `heatmap-editing`'s requirements should prompt checking whether
`tuning-ignition`/`tuning-lambda` need a corresponding delta.

### What gets dropped, not migrated

Per user decision, content with no independently observable behavior — i.e., it could change
without any externally visible difference — is left out of the capability specs entirely, since it
is either derivable by reading the code or duplicates it:
- Folder layout, package/dependency lists, coding principles (`architecture/frontend/frontend.md`).
- TypeScript type definitions (`architecture/frontend/types.md`).
- Exact IndexedDB database/store/key names, debounce durations, and other storage-mechanism
  internals in `architecture/frontend/persistence.md` and the store specs — the *behavior*
  ("editing a cell is auto-saved and survives a reload") is kept in `session-persistence`; the
  *mechanism* (which object store, what debounce) is not.
- Generic API-client conventions (`architecture/frontend/api-client.md`) that aren't visible to the
  user — timeout durations that produce a user-visible error message are kept (folded into the
  capability that surfaces them, e.g. `datalog-import`'s upload-timeout scenario, `tuning-ve`'s
  run-timeout scenario); error-class names and snake_case/camelCase conversion are not.

### Backend boundary

`tuning-ve`'s requirements describe: the user can trigger auto-tuning, the app sends the current
map + active logs + config to the backend, and the app renders whatever `TuningOutput` fields the
backend returns (which heatmap modes exist, what the warnings panel shows, what the filter-stats
panel shows) — because the *existence and shape* of the response is a frontend/backend contract
the frontend spec must state. It does not restate *how* any field is computed (formula, weighting,
smoothing) — that stays exclusively in `specs/features/tuning-engine.md`.

## Risks / Trade-offs

- **Drift between `heatmap-editing` and the tabs that reference it** → mitigated only by the note
  above; no tooling enforces it. Acceptable since the source docs had the same risk already.
- **Dropped implementation detail (IndexedDB keys, debounce values) might be useful to an engineer
  debugging persistence** → mitigated by leaving it in the code itself (it's a direct read of
  `persistence/*.ts`); OpenSpec capability specs are a behavior contract, not an implementation
  index.
- **Deleting the old `specs/` tree (tasks.md) is a one-way doc change** → mitigated by doing it
  only after this change's specs are archived into `openspec/specs/` and spot-checked against the
  app, not before; `specs/master/datalog.md` and `specs/overview.md` are excluded from deletion
  because they are still load-bearing outside this change's scope (backend format reference and
  project-wide overview, respectively).

## Migration Plan

1. This change: write the 14 capability delta specs (`specs/<capability>/spec.md`) and `tasks.md`.
2. `openspec validate restructure-frontend-specs-openspec --strict` to confirm schema conformance.
3. User reviews and approves; `openspec archive restructure-frontend-specs-openspec` promotes the
   14 deltas into `openspec/specs/<capability>/spec.md`.
4. Only after archive: execute `tasks.md`'s cleanup — delete the migrated old spec files, update
   the CLAUDE.md spec index.

No code changes, so no rollback beyond `git revert` of the doc commit(s).
