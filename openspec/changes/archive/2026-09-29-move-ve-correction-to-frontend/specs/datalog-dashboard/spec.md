## ADDED Requirements

### Requirement: Cards flag correction-filter exclusion
A signal's card SHALL be visually flagged, distinctly from the out-of-range alarm style, when the
cursor's current instant fails the correction filters defined by `tuning-ve-correction`, regardless
of that panel's visibility toggle.

#### Scenario: Cursor on an excluded instant
- **WHEN** the timeline cursor is at an instant that fails the current correction filters
- **THEN** every signal's card at that instant shows a distinct "excluded from correction" style

#### Scenario: Cursor on a qualifying instant
- **WHEN** the timeline cursor is at an instant that passes the current correction filters
- **THEN** cards render normally, without the exclusion style
