## 1. Validate the change

- [x] 1.1 Run `openspec validate restructure-frontend-specs-openspec --strict` and confirm it
      passes with no errors (every capability has a `## Purpose`, every requirement has at least
      one `#### Scenario`, headers use exactly four hashtags). Passed.
- [x] 1.2 Spot-check each of the 14 spec files in `specs/` against the source doc(s) listed in its
      row of `design.md`'s capability table, confirming no user-facing behavior was dropped and no
      backend algorithm detail was introduced. Found and fixed 4 fidelity issues: `session-persistence`
      had merged "change config" and "change engine" into one (source behavior differs — engine
      change clears the last output, config change only marks it outdated); `heatmap-editing` was
      missing the concrete 50-step undo depth and the cell-[0,0]-auto-selected-on-mount behavior;
      `datalog-table`'s CSV export lost the "opens correctly in spreadsheet software" contract;
      `datalog-import` was missing a large-file-doesn't-freeze scenario. Re-validated after fixes —
      still passes.

## 2. Review and archive

- [x] 2.1 Get user sign-off on `proposal.md`, `design.md`, and the 14 capability specs. Approved.
- [x] 2.2 Run `openspec archive restructure-frontend-specs-openspec` and verify
      `openspec list --specs` now lists all 14 capabilities. Archived as
      `2026-09-26-restructure-frontend-specs-openspec`; `openspec list --specs` confirms all 14
      with a combined 79 requirements.

## 3. Retire the migrated legacy specs (only after archive)

- [x] 3.1 Delete the migrated files, and verify `git status` shows exactly this list removed and
      nothing else under `specs/`. Done via `git rm -f`; `git status --short specs/` shows exactly
      these 31 `D` entries and nothing else:
      - `specs/features/home/home.md`
      - `specs/features/topbar/topbar.md`
      - `specs/features/overview.md`
      - `specs/features/tuning/overview.md`
      - `specs/features/tuning/ve.md`
      - `specs/features/tuning/ignition.md`
      - `specs/features/tuning/lambda.md`
      - `specs/features/tuning/config.md`
      - `specs/features/datalog/overview.md`
      - `specs/features/datalog/logs.md`
      - `specs/features/datalog/dashboard.md`
      - `specs/features/datalog/charts.md`
      - `specs/features/datalog/data.md`
      - `specs/master/map.md`
      - `specs/architecture/frontend/frontend.md`
      - `specs/architecture/frontend/api-client.md`
      - `specs/architecture/frontend/persistence.md`
      - `specs/architecture/frontend/routes.md`
      - `specs/architecture/frontend/types.md`
      - `specs/architecture/frontend/components/guards.md`
      - `specs/architecture/frontend/components/heatmap-table.md`
      - `specs/architecture/frontend/components/map-chart.md`
      - `specs/architecture/frontend/components/synced-chart.md`
      - `specs/architecture/frontend/components/time-rail.md`
      - `specs/architecture/frontend/components/top-bar.md`
      - `specs/architecture/frontend/components/tuning-config-modal.md`
      - `specs/architecture/frontend/components/tuning-tab-link.md`
      - `specs/architecture/frontend/stores/map-store.md`
      - `specs/architecture/frontend/stores/log-store.md`
      - `specs/architecture/frontend/stores/time-store.md`
      - `specs/architecture/frontend/stores/tuning-store.md`
      - `specs/architecture/frontend/stores/ui-store.md`
- [x] 3.2 Confirm these are explicitly **kept** (not deleted): `specs/overview.md`,
      `specs/master/datalog.md`, `specs/features/tuning-engine.md`,
      `specs/features/tuning/research-insights.md`, `specs/architecture/overview.md`,
      `specs/architecture/architecture.md`, `specs/architecture/backend/backend.md`. Confirmed —
      all 7 still present on disk after the deletions in 3.1.
- [x] 3.3 Remove now-empty directories left under `specs/`. `git rm` already removed
      `specs/features/home/`, `specs/features/topbar/`, and `specs/architecture/frontend/`
      automatically once empty (git doesn't track empty dirs); `specs/features/tuning/` correctly
      survives since it still holds `research-insights.md`.

## 4. Update the project index

- [x] 4.1 In the root `CLAUDE.md`, replace every row in "Geral e features", "Tuning", "Datalog",
      "Arquitetura — frontend" (including its `stores/` and `components/` sub-tables) that pointed
      at a deleted file with a row pointing at the matching `openspec/specs/<capability>/spec.md`,
      and verify every link in the updated table resolves to an existing file. Replaced with a
      "Frontend — capabilities (OpenSpec)" table (14 rows) plus trimmed "Geral" / "Motor de tuning"
      / "Formatos MasterInjection" / "Arquitetura — geral" / "Arquitetura — backend" sections.
- [x] 4.2 Keep the "Arquitetura — geral" and "Arquitetura — backend" rows unchanged, and keep (or
      add, if missing) a row pointing at `specs/master/datalog.md` and `specs/overview.md`. Done —
      both sections kept verbatim; `specs/master/datalog.md` and `specs/overview.md` each have a row.
- [x] 4.3 Verify no remaining file in the repo links to any of the paths deleted in step 3.1
      (`grep -rn` for each deleted path under `specs/`, `CLAUDE.md`, and `frontend/CLAUDE.md`).
      The sweep found 4 more dangling references beyond this task's original scope —
      `frontend/CLAUDE.md`, `backend/CLAUDE.md`, `frontend/README.md` (2 links), `backend/README.md`
      — surfaced to the user and fixed with their approval. Final sweep across the whole repo
      (excluding the archived change's own historical record) is clean.
