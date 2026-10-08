## MODIFIED Requirements

### Requirement: Correction-filtered points honor the visibility toggle
Every chart panel's series SHALL reflect the active highlight mask — the VE correction filters
defined by `tuning-ve-correction`, or the visual filter defined by `datalog-visual-filter` while one
is active — rendering excluded points according to the panel's visibility toggle.

#### Scenario: Visibility toggle set to "visible"
- **WHEN** the visibility toggle is set to keep excluded points visible
- **THEN** points failing the active mask render dimmed in place within their series, preserving the
  series' time continuity

#### Scenario: Visibility toggle set to "hidden"
- **WHEN** the visibility toggle is set to hide excluded points
- **THEN** points failing the active mask are dropped from the series data outright, without regard
  for the resulting time gap

#### Scenario: Filters are applied while a chart is open
- **WHEN** the user applies a change to the correction filters (see `tuning-ve-correction`) while
  viewing a chart panel
- **THEN** the panel's series immediately re-renders to reflect the new qualifying set

#### Scenario: Visual filter is applied or cleared while a chart is open
- **WHEN** the user applies or clears a visual filter (see `datalog-visual-filter`) while viewing a
  chart panel
- **THEN** the panel's series immediately re-render to reflect the visual filter's pass/fail state,
  or the correction filters' pass/fail state after clearing
