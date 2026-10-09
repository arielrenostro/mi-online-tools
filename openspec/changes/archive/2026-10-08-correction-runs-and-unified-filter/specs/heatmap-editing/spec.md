## ADDED Requirements

### Requirement: Editable tables show original, current and difference on hover
Every editable map table that follows this contract — the VE, Ignição and Lambda tables — SHALL show,
when the pointer rests on a cell, a tooltip with three lines: the cell's original value (as imported),
its current value, and the difference between them as a signed percentage of the original
(`+5.0%`, `-5.0%`, `0.0%`). Values SHALL be formatted as the table formats them, except that the Lambda
table SHALL show three decimals so small differences are visible. When the original value is zero and
the cell changed, there is no base for a percentage and the difference SHALL be shown as "—".

#### Scenario: Hovering an edited cell
- **WHEN** a VE cell imported as 560 is now 588 and the user hovers it
- **THEN** the tooltip reads "Original: 560", "Atual: 588" and "Diferença: +5.0%"

#### Scenario: Hovering a cell that went down
- **WHEN** a cell imported as 560 is now 532 and the user hovers it
- **THEN** the difference reads "-5.0%"

#### Scenario: Hovering an untouched cell
- **WHEN** the user hovers a cell that was never edited
- **THEN** the original and current values are equal and the difference reads "0.0%"

#### Scenario: Tooltip follows edits and undo
- **WHEN** the user edits a cell, then undoes the edit
- **THEN** the tooltip shows the new current value after the edit and the original again after the undo

#### Scenario: Ignition and Lambda tables
- **WHEN** the user hovers a cell in the Ignição or Lambda editable table
- **THEN** the same three lines appear, with the Lambda values shown with three decimals

#### Scenario: Original value zero
- **WHEN** an Ignição cell imported as 0 is now 4 and the user hovers it
- **THEN** the tooltip shows "Original: 0", "Atual: 4" and "Diferença: —"

#### Scenario: Read-only tables
- **WHEN** the user hovers a cell of the original (read-only) map
- **THEN** no original/current/difference tooltip is shown, since the table only holds the original
