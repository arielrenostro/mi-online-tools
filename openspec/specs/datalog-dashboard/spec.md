# datalog-dashboard Specification

## Purpose
Gives an at-a-glance, live view of every signal's value at the timeline's current cursor instant.

## Requirements

### Requirement: Signal grid reflects the cursor instant
The Dashboard SHALL display every available signal as a card showing its value at the current
cursor position, updating live as the cursor moves.

#### Scenario: Moving the cursor
- **WHEN** the user moves the timeline cursor
- **THEN** every signal card updates to the value at the new cursor instant

#### Scenario: No cursor positioned yet
- **WHEN** the Dashboard is opened and no cursor position has been set yet
- **THEN** it displays the values at the first instant of the active timeline

### Requirement: Out-of-range values are visually flagged
A signal whose current value falls outside its configured normal range SHALL be visually
highlighted on its card.

#### Scenario: Signal in alarm range
- **WHEN** a signal's value at the cursor instant is outside its normal range
- **THEN** that signal's card is rendered with a distinct alarm style

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
