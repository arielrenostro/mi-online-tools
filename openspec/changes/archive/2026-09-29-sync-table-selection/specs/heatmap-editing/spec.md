## ADDED Requirements

### Requirement: Shared selection across tables of the same grid
When several tables are displayed over the same MAP×RPM grid, they SHALL share one selection
(anchor and rectangle): a selection made in any of them SHALL be shown identically in all of them.

#### Scenario: Selecting in one table shows the cursor in the others
- **WHEN** the user clicks, drags, or moves the selection by keyboard in any table of the grid
- **THEN** the same cell(s) are shown as selected in every other table of that grid, with the same
  anchor

#### Scenario: Selection is a session-only state
- **WHEN** the user reloads the browser
- **THEN** the shared selection is not restored (see `session-persistence`)

### Requirement: Selection survives focus changes between tables
The selection SHALL NOT be cleared merely because keyboard focus moves from one table of the shared
grid to another, or to a toolbar control or dialog belonging to them. It SHALL be cleared only by
Escape or by clicking outside every table of the grid.

#### Scenario: Moving focus to another table
- **WHEN** the user clicks a cell in a second table while another table of the same grid had focus
- **THEN** the selection is replaced by the clicked cell in all tables, and is not cleared in between

#### Scenario: Clicking outside all tables
- **WHEN** the user clicks somewhere that is not inside any table of the grid
- **THEN** the shared selection is cleared

#### Scenario: Escape clears the shared selection
- **WHEN** the user presses Escape outside of edit mode in any table of the grid
- **THEN** the selection is cleared in every table

### Requirement: Editing shortcuts act on the editable table from any table
The value-editing shortcuts of the editable table (F2, H, V, Ctrl+I/U, Delete/Backspace over a
range, Ctrl+C/V) SHALL work when keyboard focus is on a read-only table of the same grid, and SHALL
always act on the editable table using the shared selection, with the same behavior as when the
editable table itself has focus. Keys that would open an inline edit (Enter, digit entry,
Delete/Backspace on a single cell) SHALL NOT be delegated. Arrow keys, Tab, Enter navigation, and
Escape keep operating on the selection from whichever table has focus.

#### Scenario: F2 from a read-only table
- **WHEN** the user presses F2 with focus on a read-only table of the grid and a selection exists
- **THEN** the same bulk-edit dialog that F2 opens in the editable table is shown for the shared
  selection, confirming it changes only the editable table's cells, and closing it returns focus to
  the table that had it

#### Scenario: Interpolation from a read-only table
- **WHEN** the user presses H or V with focus on a read-only table of the grid
- **THEN** the corresponding interpolation runs on the editable table's cells over the shared
  selection, as one undo entry

#### Scenario: Read-only tables never edit themselves
- **WHEN** the user double-clicks a cell, presses Enter, or types a digit with focus on a read-only
  table
- **THEN** no inline edit opens in any table, and no value changes
