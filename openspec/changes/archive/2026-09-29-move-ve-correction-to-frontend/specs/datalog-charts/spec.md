## ADDED Requirements

### Requirement: Correction-filtered points honor the visibility toggle
Every chart panel's series SHALL reflect the correction filters defined by `tuning-ve-correction`,
rendering excluded points according to the panel's visibility toggle.

#### Scenario: Visibility toggle set to "visible"
- **WHEN** the correction filters' visibility toggle is set to keep filtered points visible
- **THEN** points failing the filters render dimmed in place within their series, preserving the
  series' time continuity

#### Scenario: Visibility toggle set to "hidden"
- **WHEN** the correction filters' visibility toggle is set to hide filtered points
- **THEN** points failing the filters are dropped from the series data outright, without regard for
  the resulting time gap

#### Scenario: Filters are applied while a chart is open
- **WHEN** the user applies a change to the correction filters (see `tuning-ve-correction`) while
  viewing a chart panel
- **THEN** the panel's series immediately re-renders to reflect the new qualifying set
