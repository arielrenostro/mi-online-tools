## MODIFIED Requirements

### Requirement: Cards flag correction-filter exclusion
A signal's card SHALL be visually flagged, distinctly from the out-of-range alarm style, when the
cursor's current instant fails the active highlight mask — the correction filters defined by
`tuning-ve-correction`, or the visual filter defined by `datalog-visual-filter` while one is
active — regardless of the visibility toggle.

#### Scenario: Cursor on an excluded instant
- **WHEN** the timeline cursor is at an instant that fails the active mask
- **THEN** every signal's card at that instant shows a distinct "excluded" style

#### Scenario: Cursor on a qualifying instant
- **WHEN** the timeline cursor is at an instant that passes the active mask
- **THEN** cards render normally, without the exclusion style

#### Scenario: Visual filter active
- **WHEN** a visual filter is active
- **THEN** the exclusion style follows the visual filter's pass/fail state at the cursor instant,
  not the correction filters'
