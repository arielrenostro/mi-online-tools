## Context

Signals are declared once in `SIGNAL_DEFS` (`signalRegistry.ts`) and everything downstream reads
them from the registry (`SIGNAL_MAP`/`DISPLAY_SIGNAL_DEFS`): Dados builds its columns from it,
`DataTab` falls back to `defaultVisible` for any column absent from the persisted
`columnVisibility`, and Gráficos/Dashboard list `model.signals`. The parser applies every `convert`
then every `compute` per row, and today `compute` is only used by `VE Lambda`, whose inputs are all
required columns. The Marcha change already established the pattern for an optional raw column
(`optional: true`, `PARSER_VERSION` bump, `upgradeLogEntry` rebuild from `csvBlob`).

New here: a derived signal whose inputs are themselves optional. `compute` currently runs
unconditionally on every row and a derived signal is always listed, which would produce `NaN` rows and a
dangling signal for a log without `Inj. DT`.

See `proposal.md` for the signal table and `specs/` for the behavior.

## Goals / Non-Goals

**Goals:**
- Add the six raw signals and `Inj. Efetivo` with the least new mechanism.
- Make "derived from optional inputs" a general, declarative capability of the registry, not a
  special case in the parser.

**Non-Goals:**
- Any use of the new signals in correction filters, snapshot generation, the dyno or runtime
  signals.
- Per-signal alarms, colors or thresholds.
- Making `VE Lambda` conditional (its inputs are required columns, so it is always computable).

## Decisions

**1. Derived signals declare `inputs`, instead of `compute` guarding itself.**
`SignalDef` gains `inputs?: string[]` (names of the signals the `compute` reads). The parser lists a
derived signal only if every input is in the log's signal list, and computes it on a row only if
every input is a finite number on that row; otherwise the row simply has no value.
*Alternative:* `compute` returns `NaN` and the parser drops non-finite results. Rejected: the signal
list would still need a separate rule (scan rows, or a second flag) and the "is it available"
question has no single source of truth. Declaring inputs also lets a test assert the contract.
A derived signal without `inputs` (VE Lambda) behaves exactly as today.

**2. `Inj. Efetivo` is computed at parse time and persisted in the model.**
It depends only on same-row values, never on editable runtime constants, so it follows the
`VE Lambda` path, not the runtime-signal path (`runtimeSignals.ts`). Consequence: it is part of
`model.rows`, hence the `PARSER_VERSION` bump to 3 so existing logs are rebuilt on restore.
`generateCorrectionSnapshot`/`useCorrectionMask` read the same rows but only the signals they know,
so the extra keys do not affect the correction.

**3. All conversion math lives in the `convert` of each `SignalDef`; `dACC`'s divisor is a named
constant.** `(raw - 5000) / 100` is the only unverified one, so it is a single, documented
`DACC_DIVISOR` next to the def; changing the reading is a one-line change plus a version bump.

**4. No clamp on `Inj. Efetivo`.** Across 91 real logs (1,174,564 rows) `Pulse - DT` never went
negative (min 0.23 ms), so clamping would only hide a real anomaly (a wrong DT) if one ever occurs.

**5. Visibility and ranges.** Every new signal is `defaultVisible: true`, as the Data table spec
requires ("every available signal as a column by default"); persisted visibility needs no migration
because `DataTab` falls back to `defaultVisible` for columns it has never seen. Chart ranges:
Pulse/Efetivo 0–20 ms, DT 0–2 ms, ACP 0–2000 kPa, dACC −5…+5, Batt 8–16 V, Óleo 0–8 bar. Formats:
2 decimals for ms, bar and dACC (signed); 1 decimal for V; integer for kPa.

**6. Signal names.** App names are `Inj. Pulse`, `Inj. DT`, `Inj. Efetivo`, `ACP`, `dACC`,
`Batt Volt.`, `Pressão Óleo` — `ACP`/`dACC` drop the misleading `%` from the CSV column name, and
`Pressão Óleo` is the meaning of the `Lambda 2` column (not a second lambda reading).

**7. One canonical display order, applied when lists are built, not stored.**
Today the order is an accident of three places: `SIGNAL_DEFS` order (which drives `model.signals`
and the Dados columns), then the runtime signals appended at the end (`withRuntimeSignals`), so VE
and VE Lambda sit far apart and VE Lambda Corrigido is last. Instead, `signalRegistry.ts` exports one
ordered list of groups (`SIGNAL_GROUPS`) and a `sortSignals(names)` helper; unknown names go last,
keeping their relative order. It is applied wherever a list is built for display: `DISPLAY_SIGNAL_DEFS`
(Dados columns and column menu) and `useDisplaySignals` (Dashboard cards, Gráficos sidebar and
picker). Groups, in order:

| Group | Signals |
|---|---|
| Engine / boost | RPM, MAP, Boost, Turbo Target |
| Pedal | Pedal, dACC |
| Lambda | Lambda 1, Lambda Target, Lambda Corr, Lambda Loop |
| VE | VE, VE Lambda, VE Lambda Corrigido |
| Injection | Inj. Pulse, Inj. DT, Inj. Efetivo, Inj. Utiliz. |
| Ignition | Ign. Adv. |
| Temperature | CLT, IAT |
| Electrical / pressures | Batt Volt., ACP, Pressão Óleo |
| Vehicle | KM/H, Marcha |
| Output | Potência, Torque |

*Alternatives:* (a) just reorder `SIGNAL_DEFS`, rejected: it cannot place the runtime signals
(they live in `RUNTIME_SIGNAL_DEFS` and are appended later) and the stored `model.signals` order
would be stale for logs saved before the change; (b) store the order in the model, rejected for the
same staleness. Sorting at read time costs a trivial sort over ≤ 25 names and survives future
additions. Parsing is unaffected: raw columns are still read in `SIGNAL_DEFS` order, so reordering
for display never changes parse behavior. The grouping is a proposal the user can re-cut: it is
data in one array.

## Risks / Trade-offs

- [The `dACC` divisor is a guess; observed range (−2.75…+1.32 with ÷100) is far from the stated
  ±100] → recorded in the spec as unverified and not used by any computation; one-line fix plus
  version bump.
- [A future log with a different `Lambda 2` meaning (an actual second lambda sensor)] → the
  column-to-meaning mapping is a documented assumption of this car/ECU setup; renaming later is
  one registry edit and a version bump.
- [Rebuilding old logs on restore costs time for very large sessions] → same mechanism and cost as
  the Marcha migration; a failed rebuild keeps the log as stored.
- [`Inj. Efetivo` rows disappear if either input field is malformed] → intended; the row is kept.

## Migration Plan

`PARSER_VERSION` 2 → 3. On the next restore, `upgradeLogEntry` reparses each older log from its
stored CSV and rewrites it to IndexedDB. No user action, no change to `localStorage` keys. Rollback
is reverting the commit; logs rebuilt with version 3 simply carry extra signals older code ignores.
