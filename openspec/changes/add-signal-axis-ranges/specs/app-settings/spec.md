## ADDED Requirements

### Requirement: Signal ranges section
The Configurações screen SHALL have its own section, "Faixa dos sinais", separate from the Constantes
and Ponderado sections, listing every displayable signal — those read from the CSV, those derived at
import and those computed from the constants (VE Lambda Corrigido, Potência, Torque) — in the same
grouped display order used by the Dashboard and the Gráficos signal sidebar. Each signal SHALL have a
"mínimo" field and a "máximo" field, labeled with the signal's name and unit, initially holding the
signal's default range. The section SHALL be available without a map or any log, and edits SHALL take
effect immediately, with no separate apply step. The section SHALL say that the range only frames the
chart axes and does not change data, filters or the correction.

#### Scenario: Opening with no prior configuration
- **WHEN** the user opens the Configurações screen for the first time
- **THEN** the Faixa dos sinais section lists every signal, including VE Lambda Corrigido, Potência
  and Torque, each with its default minimum and maximum (for example RPM 0 and 7000, Lambda 1 0.7
  and 1.3)

#### Scenario: Section available without logs or a map
- **WHEN** no log and no map have been imported
- **THEN** the section is still visible and editable, listing every signal

#### Scenario: Editing a range
- **WHEN** the user changes the minimum or the maximum of a signal to a valid value
- **THEN** the new range takes effect immediately in the charts that show that signal, without
  reimporting any log

#### Scenario: Range does not alter data
- **WHEN** the user changes the range of any signal
- **THEN** the values in the Dashboard, Dados and Dinamômetro, the applied filter and every
  correction run in the history stay unchanged

### Requirement: Signal range validation
A signal's minimum and maximum SHALL each be a finite number (negative and zero allowed), and the
minimum SHALL be strictly less than the maximum. An empty, non-numeric or inconsistent entry (minimum
greater than or equal to maximum) SHALL be flagged as invalid on that signal and SHALL NOT replace the
last valid range in effect for it.

#### Scenario: Entering an invalid value
- **WHEN** the user clears a field or types text in a signal's minimum or maximum
- **THEN** the field is visibly flagged as invalid and the charts keep using the last valid range of
  that signal

#### Scenario: Minimum not below maximum
- **WHEN** the user sets a signal's minimum to a value greater than or equal to its maximum
- **THEN** that signal is flagged as invalid with a message saying the minimum must be less than the
  maximum, and the last valid range keeps being used

#### Scenario: Negative or zero bounds
- **WHEN** the user sets the minimum of Lambda Corr to -50
- **THEN** the value is accepted as valid

#### Scenario: Correcting an invalid value
- **WHEN** the user then enters values that form a valid range
- **THEN** the flag disappears and the new range takes effect

### Requirement: Restoring signal ranges
The Faixa dos sinais section SHALL offer a control to restore a single signal to its default range and
a control to restore all signals to their default ranges. A signal whose range equals its default
SHALL have its single-signal restore control unavailable.

#### Scenario: Restoring one signal
- **WHEN** the user changes the range of MAP and activates the restore control of that row
- **THEN** MAP returns to its default range and the other signals keep their edited ranges

#### Scenario: Restoring all signals
- **WHEN** the user activates the restore-all control
- **THEN** every signal returns to its default range and any invalid text being edited is discarded

#### Scenario: Signal already at its default
- **WHEN** a signal's range equals its default
- **THEN** its restore control is unavailable
