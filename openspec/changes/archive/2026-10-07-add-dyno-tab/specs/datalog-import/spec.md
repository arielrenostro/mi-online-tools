## ADDED Requirements

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
