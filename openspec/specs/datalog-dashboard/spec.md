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
