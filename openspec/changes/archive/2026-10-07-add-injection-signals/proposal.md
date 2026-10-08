## Why

The datalog CSV carries injector timing, battery voltage, A/C compressor pressure, oil pressure and
pedal-change columns that the app discards at import, so none of them can be charted, tabulated or
used to reason about fueling. Injector pulse width and dead time matter most right now: with both
available, the app can show how much of each pulse actually delivers fuel, and how dead time moves
with battery voltage — context needed when judging VE and lambda deviations.

## What Changes

- Import six more signals from the CSV, all **optional** (a log without the column still imports,
  just without that signal), converted to real units at parse time:

  | Signal | CSV column | Conversion | Unit |
  |---|---|---|---|
  | Inj. Pulse | `Inj. Pulse` | `raw / 100` (1337 = 13.37 ms) | ms |
  | Inj. DT | `Inj. DT` | `raw / 1000` (1100 = 1.1 ms) | ms |
  | ACP | `ACP %` | `raw` (A/C compressor pressure; the header says `%`, the unit is kPa) | kPa |
  | dACC | `dACC %` | `(raw - 5000) / 100` (5000 = no pedal change) | % |
  | Batt Volt. | `Batt Volt.` | `raw / 10` | V |
  | Pressão Óleo | `Lambda 2` | `raw / 100` (173 = 1.73 bar) | bar |

- Add one derived signal, **Inj. Efetivo** = `Inj. Pulse - Inj. DT` (ms): the part of the pulse that
  actually delivers fuel (the logged pulse already includes dead time). It exists only when both
  inputs exist; a log lacking either column simply has no Inj. Efetivo.
- Derived signals can now depend on optional signals: a derived signal is computed and listed only
  when all of its inputs are present in the log.
- The `dACC` scale is **unverified** — 5000 = zero and the sign (positive = pedal rising) are
  established from real logs, the `/100` divisor is the user's best reading. The spec records this
  so the divisor is a one-line change if the real reading differs.
- List related signals next to each other everywhere signals are listed (Dashboard cards, Gráficos
  sidebar and signal picker, Dados columns and column menu), instead of the current accidental
  order that puts, for example, VE and VE Lambda far apart and appends the runtime signals at the
  end. One canonical grouped order (VE, VE Lambda, VE Lambda Corrigido; Lambda 1/Target/Corr/Loop;
  Inj. Pulse/DT/Efetivo/Utiliz.; ...) applies to the existing and the new signals alike.
- Raise the CSV reader version so logs saved before this change are rebuilt from their stored CSV on
  restore and gain the new signals without reimporting.
- Move these columns out of "present but unused" in `specs/master/datalog.md` into the documented
  signal table (and fix the `Inj. Pulse` unit: it is 10 µs per unit, not µs).

Not in scope: using any new signal in correction filters, the correction snapshot or the dyno, or
adding other still-unmodelled columns (`Load %`, `Knock`, `Ign. Dwell`, `Strobo Angle`, ...).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `datalog-import`: new requirements for the injection/electrical/pressure signals (conversions,
  optional columns, derived Inj. Efetivo, unverified dACC scale) and for the grouped signal order
  shared by every signal list.
- `datalog-table`: the default-columns requirement names Inj. Efetivo among the derived signals and
  states that columns and the toggle menu follow the grouped order.
- `session-persistence`: the "older CSV reader" requirement stops naming Marcha as the only example
  and covers these signals.

## Impact

- `frontend/src/signals/signalRegistry.ts`: new `SignalDef` entries and an `inputs` declaration on
  derived signals.
- `frontend/src/parsers/datalogParser.ts`: conditional computation/listing of derived signals;
  `PARSER_VERSION` 2 → 3.
- New `frontend/src/signals/injectionEffective.ts` (or alongside `veLambdaFormula.ts`) for the
  derived formula, with tests; parser tests for the new columns.
- Dashboard, Gráficos and Dados pick up the signals through `SIGNAL_MAP`/`DISPLAY_SIGNAL_DEFS`; the
  grouped order is applied where those lists are built (`DISPLAY_SIGNAL_DEFS`, `useDisplaySignals`),
  so no tab component is expected to change.
- `specs/master/datalog.md` and `frontend/CLAUDE.md` (conversion notes) updated in step with the code.
- No new dependencies, no network, no change to the correction snapshot or filters.
