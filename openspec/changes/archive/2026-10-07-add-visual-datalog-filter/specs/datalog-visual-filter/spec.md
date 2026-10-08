## Purpose

Lets the user temporarily highlight arbitrary signal-range conditions (e.g. a MAP and RPM window)
across the Datalog charts, table and dashboard, without touching the VE correction filters or the
correction factor derived from them.

## ADDED Requirements

### Requirement: Visual filter button next to the help button
The Datalog screen SHALL show a "Filtro visual" button in the top-right of the tab bar, immediately
beside the "?" help button, that opens the visual filter modal.

#### Scenario: Opening the modal
- **WHEN** the user activates the "Filtro visual" button
- **THEN** a modal opens listing the available ranges, and it can be dismissed with Escape or by
  closing it without applying

#### Scenario: Button reflects an active filter
- **WHEN** a visual filter is active
- **THEN** the button is visibly highlighted (distinct from its idle style), on every Datalog tab

#### Scenario: Button idle
- **WHEN** no visual filter is active
- **THEN** the button renders in its idle style

### Requirement: Selectable optional ranges
The modal SHALL offer one range row each for MAP, RPM, Lambda 1, Lambda Corr and Pedal. Each row
SHALL have an enable checkbox plus a minimum and a maximum field, both optional. The user SHALL NOT
be required to enable any particular row or all of them.

#### Scenario: Enabling a subset of ranges
- **WHEN** the user enables only the MAP and RPM rows and leaves the others unchecked
- **THEN** only the MAP and RPM ranges take part in the filter; unchecked rows are ignored even if
  their fields hold values

#### Scenario: Open-ended range
- **WHEN** an enabled row has only a minimum, or only a maximum, filled in
- **THEN** that row constrains only the filled side; the empty side is unbounded

#### Scenario: Enabled row with both bounds empty
- **WHEN** an enabled row has neither bound filled in
- **THEN** that row constrains nothing (every point passes it)

#### Scenario: Inverted range is rejected
- **WHEN** an enabled row has a minimum greater than its maximum
- **THEN** the row is flagged as invalid and "Aplicar" is unavailable until it is fixed

### Requirement: Lambda Loop state selection
The modal SHALL also offer a Lambda Loop row with an enable checkbox and three state checkboxes:
open ("Aberto"), closed ("Fechado") and closed with auto-correction ("Fechado + auto-correção"). When
the row is enabled, a point SHALL satisfy it only if its Lambda Loop state is one of the checked
states. Like the ranges, the row is optional and independent of the others.

#### Scenario: Selecting a subset of loop states
- **WHEN** the Lambda Loop row is enabled with only "Fechado" and "Fechado + auto-correção" checked
- **THEN** only points whose Lambda Loop is closed or closed with auto-correction satisfy that row;
  points in open loop fail it

#### Scenario: Loop row disabled
- **WHEN** the Lambda Loop row's enable checkbox is unchecked
- **THEN** the row is ignored, whatever state checkboxes are checked

#### Scenario: Loop row enabled with no state checked
- **WHEN** the Lambda Loop row is enabled but none of its state checkboxes is checked
- **THEN** the row is flagged as invalid and "Aplicar" is unavailable until a state is checked or the
  row is disabled

#### Scenario: Loop row combines with the ranges
- **WHEN** the Lambda Loop row and one or more signal ranges are enabled
- **THEN** a point passes only if it satisfies the loop selection and every enabled range

### Requirement: Applied visual filter replaces the highlight mask
While a visual filter is active — at least one range enabled or the Lambda Loop row enabled — a point
SHALL count as "passing" if and only if it satisfies every enabled range (inclusive of both bounds)
and, when enabled, the Lambda Loop state selection — all combine with AND. This pass/fail state SHALL
replace the pass/fail state derived from the VE correction filters (including its delta and
skip-after-transition components) in the Charts, Data and Dashboard tabs; the two are not combined.
A point whose value for an enabled range's signal (or whose Lambda Loop value) is not a number SHALL
fail that row.

#### Scenario: Applying a single range
- **WHEN** the user enables the MAP row with minimum 80 and maximum 120 and activates "Aplicar"
- **THEN** only points with MAP between 80 and 120 inclusive pass; every other point is treated as
  excluded, regardless of whether the VE correction filters would have accepted it

#### Scenario: Multiple ranges combine with AND
- **WHEN** the MAP and RPM rows are both enabled with bounds and applied
- **THEN** a point passes only if both its MAP and its RPM fall inside their respective ranges

#### Scenario: VE correction filters do not combine
- **WHEN** a point fails the VE correction filters but satisfies every enabled visual range
- **THEN** it passes while the visual filter is active

#### Scenario: Applying with no row enabled
- **WHEN** the user activates "Aplicar" with no row enabled (no range and no Lambda Loop)
- **THEN** it behaves as "Limpar": no visual filter becomes active

### Requirement: Existing visibility toggle applies to the visual filter
The visibility toggle for excluded points defined by `tuning-ve-correction` SHALL apply to the
visual filter's failing points exactly as it applies to correction-filtered points.

#### Scenario: Toggle set to visible
- **WHEN** a visual filter is active and the visibility toggle keeps excluded points visible
- **THEN** points failing the visual filter render dimmed in Charts and Data, and the Dashboard
  flags them as excluded

#### Scenario: Toggle set to hidden
- **WHEN** a visual filter is active and the visibility toggle hides excluded points
- **THEN** points failing the visual filter are omitted from Charts and Data

### Requirement: Clearing restores the correction filters
The modal SHALL provide a "Limpar" action that removes the visual filter entirely and resets its
fields, after which the Charts, Data and Dashboard tabs SHALL again reflect the applied VE
correction filters.

#### Scenario: Clearing an active filter
- **WHEN** a visual filter is active and the user activates "Limpar"
- **THEN** the visual filter is no longer active, the button returns to its idle style, and the
  highlight reverts to the pass/fail state of the applied VE correction filters

#### Scenario: Reopening after applying
- **WHEN** the user reopens the modal while a visual filter is active
- **THEN** the modal shows the currently applied ranges, enabled rows and bounds

#### Scenario: Closing without applying
- **WHEN** the user edits fields in the modal and closes it without activating "Aplicar"
- **THEN** the active (or inactive) visual filter is unchanged

### Requirement: Visual filter never affects the correction factor
The visual filter SHALL be purely a display aid. It SHALL NOT change the VE correction filters (draft
or applied), the qualifying-point count used by "Gerar fator de correção", the generated snapshot,
or the editable map.

#### Scenario: Generating while a visual filter is active
- **WHEN** a visual filter is active and the user activates "Gerar fator de correção"
- **THEN** the snapshot is computed from the applied VE correction filters and time selection,
  exactly as if no visual filter existed

#### Scenario: Correction filters stay intact
- **WHEN** a visual filter is applied and later cleared
- **THEN** the draft and applied VE correction filters hold the same values as before

### Requirement: Visual filter is session-only
The visual filter SHALL live only in memory for the current page session; it SHALL NOT be restored
after a reload.

#### Scenario: Reload
- **WHEN** the user reloads the page while a visual filter is active
- **THEN** the filter is inactive after the app restores its session, and highlighting reflects the
  applied VE correction filters
