# datalog-import Specification

## Purpose
Parses MasterInjection datalog CSVs into signal rows the rest of the app consumes, and lets the
user manage the set of logs active in the current session (add, remove, reorder, enable/disable)
from both the Logs tab and the global TopBar. The Logs tab also hosts the VE correction filter
panel (see `tuning-ve-correction`) and the Constantes section (see `datalog-constants`).

## Requirements

### Requirement: Datalog CSV parsing tolerates real-world log files
Importing a datalog CSV SHALL identify columns by header name (not position), tolerate a header
reappearing mid-file, synthesize timestamps when the file has none, and discard malformed rows
instead of failing the whole import.

#### Scenario: Header reappears mid-file
- **WHEN** the logging software restarted during capture and rewrote the header partway through
  the file
- **THEN** the parser keeps reading, remapping columns from the new header from that point onward

#### Scenario: No timestamp column
- **WHEN** the CSV has no `Timestamp` column
- **THEN** the app generates one, starting at `0` and incrementing by 100 ms per row

#### Scenario: Malformed row
- **WHEN** a row has a different field count than the active header, or its RPM/MAP/Timestamp
  fields are not valid numbers
- **THEN** that row is discarded and the rest of the file continues to be parsed

#### Scenario: Known signals converted to real units
- **WHEN** the file contains recognized signal columns (RPM, MAP, Lambda 1, CLT, IAT, Lambda
  Target, Lambda Corr, ACC %, Lambda Loop, etc.)
- **THEN** each is converted from its raw encoding to its real-world unit before being used
  anywhere else in the app

#### Scenario: Large log file
- **WHEN** the imported file has tens of thousands of rows (e.g. a long road session logged at high
  frequency)
- **THEN** the import completes without freezing or crashing the browser tab

### Requirement: Duplicate log detection
Importing a file whose content matches an already-loaded log SHALL be rejected with a clear
message instead of creating a duplicate entry.

#### Scenario: Re-importing the same file
- **WHEN** the user imports a CSV whose content is identical to a log already in the session
- **THEN** the import is rejected and an error message identifies it as already loaded

### Requirement: Logs tab list management
The Logs tab SHALL let the user see every imported log with its name and duration, toggle each
log's inclusion in the active session, reorder logs, and remove a log permanently.

#### Scenario: Toggling a log inactive
- **WHEN** the user toggles a log to inactive
- **THEN** the log is visually dimmed and excluded from the active session's timeline, charts, and
  correction snapshot generation (see `tuning-ve-correction`), without being deleted

#### Scenario: Removing a log
- **WHEN** the user removes a log
- **THEN** the log is permanently deleted from the session and can no longer be re-enabled without
  re-importing the file

#### Scenario: Reordering logs
- **WHEN** the user drags a log to a new position in the list
- **THEN** the concatenation order used by the timeline and all downstream views updates to match,
  without discarding any log's data

### Requirement: Logs importable without a map
The Logs tab and Datalog screen SHALL be reachable and usable without any map ever being imported.

#### Scenario: Importing logs with no map loaded
- **WHEN** the user has not imported a map
- **THEN** the user can still import logs, and the Logs tab reflects them normally

### Requirement: TopBar logs control
The global TopBar SHALL let the user import logs when none are loaded, and manage active logs
through a dropdown panel once one or more are loaded.

#### Scenario: No logs loaded
- **WHEN** no logs have been imported
- **THEN** the TopBar shows an "Import Log" control accepting multiple `.csv` files at once

#### Scenario: Logs loaded
- **WHEN** one or more logs are active
- **THEN** the TopBar shows a control labeled with the log count, which opens a dropdown listing
  every log with a checkbox for inclusion, a drag handle for reordering, a remove control, and the
  total selected duration

#### Scenario: Changing logs from the TopBar panel
- **WHEN** the user checks/unchecks, reorders, or removes a log from the TopBar dropdown
- **THEN** every component that consumes log data (timeline, charts, dashboard, table) updates
  automatically without a page reload

### Requirement: Logs tab sections
The Logs tab SHALL be organized, in order, as the log import area and list, the VE correction filter
panel (see `tuning-ve-correction`) and the "Constantes" section (see `datalog-constants`). The
Constantes section SHALL NOT require any log or map to be present.

#### Scenario: Logs tab with logs loaded
- **WHEN** the user opens the Logs tab with one or more logs imported
- **THEN** the log list, the correction filter panel and the Constantes section are all visible on
  the same tab

#### Scenario: Logs tab with nothing loaded
- **WHEN** the user opens the Logs tab before importing anything
- **THEN** the import area, the correction filter panel and the Constantes section are visible

### Requirement: Gear signal from the trailing "0" column
Importing a datalog CSV SHALL read the gear (Marcha) from the last column whose header is named `0`
(the CSV has two such columns; the last one carries the gear), as an integer, and expose it as the
"Marcha" signal like any other signal. The column SHALL be optional: a log without it SHALL still
import, and its rows and signal list simply have no Marcha.

#### Scenario: Log with the gear column
- **WHEN** the CSV header ends with two columns named `0` and a row ends with `...;0;3`
- **THEN** that row's Marcha is 3 and Marcha is listed among the log's signals

#### Scenario: Log without the gear column
- **WHEN** the CSV header has no column named `0`
- **THEN** the log imports normally, without a Marcha signal

#### Scenario: Gear value is not a number
- **WHEN** a row's gear field is empty or not numeric
- **THEN** that row is kept, without a Marcha value, instead of being discarded

### Requirement: Injection, electrical and pressure signals
Importing a datalog CSV SHALL read, when their columns are present, the injector pulse width, injector
dead time, battery voltage, A/C compressor pressure, oil pressure and accelerator-change columns, and
expose each as a signal converted to its real unit, like any other signal:

| Signal | CSV column | Raw → real | Unit |
|--------|------------|------------|------|
| Inj. Pulse | `Inj. Pulse` | raw ÷ 100 (1337 → 13.37) | ms |
| Inj. DT | `Inj. DT` | raw ÷ 1000 (1100 → 1.1) | ms |
| ACP | `ACP %` | raw (the header says `%` but the value is a pressure) | kPa |
| dACC | `dACC %` | (raw − 5000) ÷ 100 | % |
| Batt Volt. | `Batt Volt.` | raw ÷ 10 | V |
| Pressão Óleo | `Lambda 2` | raw ÷ 100 (173 → 1.73) | bar |

Every one of these columns SHALL be optional: a log without a column SHALL still import, and its
rows and signal list simply have no such signal. A row whose field for one of them is empty or not
numeric SHALL be kept, without that signal's value, instead of being discarded.

The raw value 5000 of `dACC %` means "no accelerator change"; a positive dACC means the pedal is
rising and a negative one that it is being released. The divisor of dACC is the best available
reading and has not been verified against the ECU: it is a display scale, not a calibrated
percentage, and SHALL NOT be used by any computation.

#### Scenario: Log with all the columns
- **WHEN** a row has `Inj. Pulse` 1337, `Inj. DT` 1100, `ACP %` 734, `dACC %` 5000, `Batt Volt.` 140
  and `Lambda 2` 173
- **THEN** that row's Inj. Pulse is 13.37 ms, Inj. DT is 1.1 ms, ACP is 734 kPa, dACC is 0 %, Batt
  Volt. is 14.0 V and Pressão Óleo is 1.73 bar, and all six are listed among the log's signals

#### Scenario: Pedal released
- **WHEN** a row has `dACC %` 4900
- **THEN** that row's dACC is -1 %

#### Scenario: Log without one of the columns
- **WHEN** the CSV header has no `ACP %` column
- **THEN** the log imports normally, without an ACP signal, and its other signals are unaffected

#### Scenario: Value is not a number
- **WHEN** a row's `Inj. DT` field is empty or not numeric
- **THEN** that row is kept, without an Inj. DT value, instead of being discarded

### Requirement: Effective injection time signal
The app SHALL provide a derived "Inj. Efetivo" signal, in ms, equal to Inj. Pulse minus Inj. DT — the
part of the logged pulse that delivers fuel, since the logged pulse already includes the dead time.
It SHALL exist only for logs that carry both Inj. Pulse and Inj. DT, and be listed among a log's
signals only then.

#### Scenario: Both inputs present
- **WHEN** a row has Inj. Pulse 2.69 ms and Inj. DT 1.10 ms
- **THEN** that row's Inj. Efetivo is 1.59 ms

#### Scenario: A log lacks one of the inputs
- **WHEN** the CSV has no `Inj. DT` column
- **THEN** the log imports normally and has no Inj. Efetivo signal

#### Scenario: A row lacks one of the inputs
- **WHEN** a row's Inj. Pulse or Inj. DT value is missing because the field was not numeric
- **THEN** that row has no Inj. Efetivo value, and the row is still kept

### Requirement: Related signals are listed together
Every place that lists the available signals — the Dashboard cards, the Gráficos signal sidebar and
signal picker, and the Dados columns and column menu — SHALL list them in one shared order in which
related signals are adjacent, regardless of the order in which the CSV columns appear or in which a
log was saved. The groups, in order, are:

1. RPM, MAP, Boost, Turbo Target
2. Pedal, dACC
3. Lambda 1, Lambda Target, Lambda Corr, Lambda Loop
4. VE, VE Lambda, VE Lambda Corrigido
5. Inj. Pulse, Inj. DT, Inj. Efetivo, Inj. Utiliz.
6. Ign. Adv.
7. CLT, IAT
8. Batt Volt., ACP, Pressão Óleo
9. KM/H, Marcha
10. Potência, Torque

A signal that is not available (a log without its column, or a runtime signal without its inputs)
is simply absent from the list; the others keep their relative order. A signal not named above is
listed after all the named ones.

#### Scenario: VE signals are adjacent
- **WHEN** the user opens any signal list with VE, VE Lambda and VE Lambda Corrigido available
- **THEN** those three appear consecutively, in that order

#### Scenario: Runtime signals sit with their group
- **WHEN** the Constantes-derived signals are available
- **THEN** VE Lambda Corrigido is listed right after VE Lambda, and Potência and Torque are
  listed together after the other signals' groups, not mixed into them

#### Scenario: Log saved before the grouped order existed
- **WHEN** a log restored from a previous session had its signals stored in a different order
- **THEN** the lists still show the grouped order

#### Scenario: Missing signal does not break its group
- **WHEN** a log has no Inj. DT column
- **THEN** the injection group shows Inj. Pulse and Inj. Utiliz. adjacent, with no gap or placeholder
