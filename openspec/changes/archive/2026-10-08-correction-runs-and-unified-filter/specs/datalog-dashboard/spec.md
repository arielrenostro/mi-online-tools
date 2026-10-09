## REMOVED Requirements

### Requirement: Cards flag correction-filter exclusion
**Reason**: Renamed and reworded: the highlight comes from the single filter, with no visual-filter
alternative.
**Migration**: See "Cards flag filter exclusion" below.

## ADDED Requirements

### Requirement: Cards flag filter exclusion
A signal's card SHALL be visually flagged, distinctly from the out-of-range alarm style, when the
cursor's current instant fails the applied filter (see `datalog-filter`), regardless of the
visibility toggle.

#### Scenario: Cursor on an excluded instant
- **WHEN** the timeline cursor is at an instant that fails the applied filter
- **THEN** every signal's card at that instant shows a distinct "excluded" style

#### Scenario: Cursor on a qualifying instant
- **WHEN** the timeline cursor is at an instant that passes the applied filter
- **THEN** cards render normally, without the exclusion style
