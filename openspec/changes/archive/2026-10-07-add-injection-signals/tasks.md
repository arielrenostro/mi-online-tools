## 1. Registry: new raw signals

- [x] 1.1 Add `Inj. Pulse` (÷100, ms), `Inj. DT` (÷1000, ms), `ACP` (column `ACP %`, kPa), `dACC` (column `dACC %`, `(raw − 5000) ÷ DACC_DIVISOR` with `DACC_DIVISOR = 100`, signed %), `Batt Volt.` (÷10, V) and `Pressão Óleo` (column `Lambda 2`, ÷100, bar) to `SIGNAL_DEFS` as `optional`, `defaultVisible: true`, with the ranges and formats from `design.md` decision 5; verify with a parser test that a row with `1337 / 1100 / 734 / 5000 / 140 / 173` yields 13.37, 1.1, 734, 0, 14.0, 1.73
- [x] 1.2 Parser test: a header lacking `ACP %` imports normally with no ACP signal and the others intact; a non-numeric `Inj. DT` field keeps the row without that value; `dACC %` 4900 → −1

## 2. Derived signal from optional inputs

- [x] 2.1 Add `inputs?: string[]` to `SignalDef`; in `datalogParser.ts` compute a derived signal on a row only when all its inputs are finite numbers there, and list it in `model.signals` only when all its inputs are listed; verify `VE Lambda` (no `inputs`) behaves exactly as before via the existing parser tests
- [x] 2.2 Add `Inj. Efetivo` (`Inj. Pulse − Inj. DT`, ms, `inputs: ['Inj. Pulse', 'Inj. DT']`, no clamp), placed after the raw signals; verify tests: 2.69/1.10 → 1.59; CSV without `Inj. DT` → no Inj. Efetivo signal; row with malformed Pulse kept without it
- [x] 2.3 Raise `PARSER_VERSION` to 3; verify `logMigration.test.ts` covers a log at version 2 being rebuilt with the new signals and a version-3 log without the columns not being rebuilt again

## 3. Grouped signal order

- [x] 3.1 Add `SIGNAL_GROUPS` (the ten groups from `design.md` decision 7) and `sortSignals(names)` to `signalRegistry.ts` (unknown names last, stable); verify unit tests: all-present order, a missing signal leaves the group contiguous, unknown name goes last, runtime signals placed next to their group
- [ ] 3.2 Apply it: build `DISPLAY_SIGNAL_DEFS` in grouped order and sort in `useDisplaySignals`; verify `DataTab` columns/menu, Dashboard cards and Gráficos sidebar/picker show VE, VE Lambda, VE Lambda Corrigido consecutively, using a log saved at the old order (restore, no reimport)
- [x] 3.3 Confirm parsing is unaffected by the display order (raw columns still read in `SIGNAL_DEFS` order) with the existing `datalogParser.test.ts` passing unchanged

## 4. Specs and docs (same change as the code)

- [x] 4.1 Update `specs/master/datalog.md`: move `Inj. Pulse`, `Inj. DT`, `Batt Volt.`, `ACP %`, `dACC %` and `Lambda 2` into the signal table with the conversions above (and fix the Pulse unit: 10 µs per unit), remove them from "present but unused"; verify no remaining mention treats them as unused
- [x] 4.2 Update `frontend/CLAUDE.md`: conversion table (new rows), note on derived signals with `inputs`, `PARSER_VERSION` 3, and the grouped display order; verify the document matches the code
- [x] 4.3 Add a line to `openspec/specs/datalog-table/spec.md` context only if the delta archive does not already cover "every available signal" wording (the new signals must count as available columns); verify `openspec validate --strict` still passes

## 5. Verification

- [x] 5.1 Run `npm run test` and `npm run build` in `frontend/` and confirm both pass
- [ ] 5.2 Import a real log from `Datalogs/dash` in the running app and confirm: the six new signals and Inj. Efetivo appear in Dados, Gráficos and Dashboard; Pulse ~2.7 ms and DT ~1.1 ms at idle; the grouped order holds in all three; reload keeps everything; a second, older saved log gains the signals after restore
