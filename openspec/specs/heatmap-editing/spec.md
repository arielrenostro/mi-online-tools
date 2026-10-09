# heatmap-editing Specification

## Purpose
Defines the shared interaction contract for editing an N×M ECU map table (selection, keyboard
navigation, inline and bulk editing, clipboard, undo/redo) that the Eficiência Volumétrica, Ignition, and Lambda tabs of
Mapa all build on, so that editing feels identical across all three.

## Requirements

### Requirement: Cell selection
An editable map table SHALL support single-cell, rectangular, and multi-cell-toggle selection via
mouse.

#### Scenario: Single click
- **WHEN** the user clicks a cell
- **THEN** only that cell is selected and becomes the selection anchor

#### Scenario: Table is immediately keyboard-usable
- **WHEN** the table first mounts, before any user interaction
- **THEN** its first cell is already selected as the anchor, so keyboard shortcuts work without
  requiring a click first

#### Scenario: Shift+click
- **WHEN** the user shift+clicks a cell
- **THEN** the selection becomes the rectangle from the current anchor to the clicked cell

#### Scenario: Ctrl/Cmd+click
- **WHEN** the user Ctrl/Cmd+clicks a cell
- **THEN** that individual cell is added to or removed from the selection, and becomes the new
  anchor

#### Scenario: Click and drag
- **WHEN** the user presses on a cell and drags to another
- **THEN** the rectangle between the press and current drag position is selected in real time

### Requirement: Keyboard navigation and selection
An editable map table SHALL support full keyboard navigation and range selection when it has
focus and is not in edit mode.

#### Scenario: Arrow keys move the selection
- **WHEN** the user presses an arrow key
- **THEN** the selection (and anchor) moves one cell in that direction, clamped to the grid edges

#### Scenario: Shift+arrow extends the range
- **WHEN** the user presses Shift+arrow
- **THEN** the selection extends as a rectangle from the anchor to the new position

#### Scenario: Tab/Shift+Tab moves focus
- **WHEN** the user presses Tab or Shift+Tab
- **THEN** any active inline edit is confirmed and the selection moves to the next/previous cell,
  wrapping to the next/previous row at row boundaries

#### Scenario: Home/End/PageUp/PageDown
- **WHEN** the user presses Home, End, PageUp, or PageDown
- **THEN** the selection jumps to the first/last column of the row, or the first/last row of the
  column, respectively (extending the range if Shift is held)

#### Scenario: Escape clears selection
- **WHEN** the user presses Escape outside of edit mode
- **THEN** the current selection is cleared

### Requirement: Single-cell inline editing
Double-clicking a cell, or pressing Enter with exactly one cell selected, SHALL open inline editing
for that cell, accepting an absolute value or a relative percentage.

#### Scenario: Opening inline edit
- **WHEN** the user double-clicks a cell, or presses Enter with one cell selected
- **THEN** the cell becomes an editable input pre-filled with its current value (double-click) or
  ready for digit entry to replace it (typing a digit/`-`/`.`)

#### Scenario: Accepted value formats
- **WHEN** the user types an absolute integer, a signed integer, a relative percentage (e.g.
  `+5%`), or a float
- **THEN** the app resolves it to a concrete new value (percentage relative to the cell's current
  value; float rounded to an integer) before validating it

#### Scenario: Value outside the valid range
- **WHEN** the resolved value falls outside the table's valid range
- **THEN** the input is shown with an error indicator and the edit is not confirmed

#### Scenario: Confirming an edit
- **WHEN** the user presses Enter, Tab/Shift+Tab, an arrow key, or clicks outside the cell while a
  valid value is entered
- **THEN** the edit is confirmed, the cell's value updates, and (for Enter/Tab/arrow keys) the
  selection moves accordingly

#### Scenario: Cancelling an edit
- **WHEN** the user presses Escape while editing
- **THEN** the edit is discarded and the cell keeps its previous value

### Requirement: Bulk editing multiple cells
With two or more cells selected, opening the bulk editor SHALL let the user apply a percentage, an
additive delta, or a fixed value to every selected cell as one action, or trigger a horizontal or
vertical interpolation across the selection.

#### Scenario: Opening the bulk editor
- **WHEN** two or more cells are selected and the user presses Enter, the bulk-edit shortcut, or
  the toolbar's adjustment icon
- **THEN** a bulk-edit control appears with percentage, "add", and "set" fields, plus
  "Interpolar horizontal" and "Interpolar vertical" actions

#### Scenario: Field precedence
- **WHEN** the user fills more than one of percentage/add/set
- **THEN** "add" takes precedence over "set", which takes precedence over percentage

#### Scenario: Percentage uses each cell's own value
- **WHEN** the user applies a percentage change to a multi-cell selection
- **THEN** each cell's new value is computed from its own current value, not a shared base

#### Scenario: Out-of-range results are clamped
- **WHEN** a bulk edit would push a cell's value outside the valid range
- **THEN** that cell's value is clamped to the nearest valid bound instead of being rejected

#### Scenario: Bulk edit is one undo step
- **WHEN** a bulk edit is confirmed
- **THEN** it is recorded as a single entry in the undo history, regardless of how many cells
  changed

#### Scenario: Interpolate actions require no numeric input
- **WHEN** the user activates "Interpolar horizontal" or "Interpolar vertical" inside the bulk
  editor
- **THEN** the corresponding interpolation runs immediately against the current selection and the
  editor closes, without requiring any percentage/add/set value to be filled

#### Scenario: Interpolate actions respect the same span thresholds
- **WHEN** the current selection does not span enough columns (for horizontal) or rows (for
  vertical) to have an interior cell
- **THEN** the corresponding interpolate action is disabled in the bulk editor

### Requirement: Quick percentage adjustment
A dedicated increase/decrease shortcut SHALL apply a fixed ±1% change to every selected cell as one
undo step.

#### Scenario: Increasing selected cells
- **WHEN** the user activates the increase shortcut with a selection active
- **THEN** every selected cell's value increases by 1%, recorded as one undo entry

#### Scenario: Decreasing selected cells
- **WHEN** the user activates the decrease shortcut with a selection active
- **THEN** every selected cell's value decreases by 1%, recorded as one undo entry

### Requirement: Clipboard copy and paste
The table SHALL support copying the current selection as tab-separated values compatible with
spreadsheet software, and pasting such values back starting at the selection anchor.

#### Scenario: Copying a selection
- **WHEN** the user copies a rectangular selection
- **THEN** the clipboard receives the values as tab-separated rows, in the same visual order shown
  on screen (top to bottom, left to right)

#### Scenario: Pasting values
- **WHEN** the user pastes tab-separated values with a cell selected as the anchor
- **THEN** the values are written starting at the anchor, extending down and right to match the
  pasted shape, each cell validated/clamped individually

### Requirement: Delete/Backspace clears cells
Delete or Backspace SHALL behave differently for a single cell versus a range.

#### Scenario: Single cell
- **WHEN** the user presses Delete/Backspace with one cell selected
- **THEN** inline editing opens for that cell with an empty value

#### Scenario: Range
- **WHEN** the user presses Delete/Backspace with a multi-cell range selected
- **THEN** every cell in the range is set to the table's minimum valid value, as one undo entry

### Requirement: Undo and redo history
Every discrete editing action on the table SHALL be undoable for at least the 50 most recent
actions, scoped independently per map table and not preserved across a page reload. The undo/redo
keyboard shortcuts SHALL act only on the editable table of the tab currently being viewed.

#### Scenario: Undo
- **WHEN** the user triggers undo while the page (not a text field) has focus
- **THEN** the most recent editing action on the currently viewed table is reverted

#### Scenario: History depth
- **WHEN** the user has made more than 50 editing actions on one table in the current session
- **THEN** undo remains available for at least the 50 most recent actions

#### Scenario: Redo
- **WHEN** the user triggers redo after an undo
- **THEN** the reverted action is re-applied

#### Scenario: History does not survive reload
- **WHEN** the user reloads the browser
- **THEN** the undo/redo history for every table starts empty, even though the table's current
  values are restored (see `session-persistence`)

#### Scenario: Undo is inactive while typing
- **WHEN** a text input elsewhere on the page has focus
- **THEN** the undo/redo shortcuts do not affect the table

#### Scenario: Each table keeps its own history
- **WHEN** the user edits one map table (e.g. VE) and then switches to another (e.g. Ignition)
- **THEN** undo/redo on each table only affects that table's own history

#### Scenario: Shortcuts follow the active tab
- **WHEN** the user presses Ctrl/Cmd+Z (or Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z) on the Eficiência Volumétrica, Ignition or
  Lambda tab
- **THEN** only that tab's editable table is undone (or redone); the tables of the other tabs are
  not changed

#### Scenario: Tab without an editable table
- **WHEN** the user presses the undo or redo shortcut on the Arquivo tab, which has no editable table
- **THEN** no table changes

### Requirement: Cell visual states communicate edit status
A cell SHALL visually indicate, simultaneously if applicable, whether it has been modified, has a
warning, has no underlying data, or was filled in by an extrapolation rule.

#### Scenario: Modified cell
- **WHEN** a cell's current value differs from its original imported value
- **THEN** the cell shows a modified indicator

#### Scenario: Cell with a warning
- **WHEN** a cell has an associated warning
- **THEN** the cell shows a warning indicator, and hovering it surfaces the warning message

#### Scenario: Cell with no data
- **WHEN** a cell has no underlying data available
- **THEN** the cell is shown in a distinct "no data" style and is not editable even when the table
  is otherwise editable

#### Scenario: Extrapolated cell
- **WHEN** a cell's value was filled in by an extrapolation rule rather than measured directly
- **THEN** the cell shows an extrapolation indicator, coexisting with the modified indicator if the
  user further edits it

### Requirement: Tooltip always shows full cell context
Hovering any cell SHALL show a tooltip with every available field for that cell, independent of
which visual mode is currently selected for the table's coloring.

#### Scenario: Hovering in any color mode
- **WHEN** the user hovers a cell while the table is showing any particular color/analysis mode
- **THEN** the tooltip lists all fields available for that cell, not only the one driving the
  current color

### Requirement: Interpolate horizontal
With a rectangular selection spanning at least three columns, interpolating horizontally SHALL
replace every interior column of each selected row with the value linearly interpolated between
that row's own leftmost and rightmost selected values, positioned by the interior column's index
within the selection (not by axis breakpoint value). The two edge columns are left unchanged.

#### Scenario: Interpolating a selection
- **WHEN** the user triggers interpolate horizontal on a selection spanning 3 or more columns
- **THEN** each interior column of each selected row is set to the value linearly interpolated
  between that row's own leftmost and rightmost selected values, positioned by the column's index
  within the selection, while the two edge columns keep their current values

#### Scenario: Keyboard shortcut
- **WHEN** the user presses `H` (no modifier key) while the table has focus and is not in edit
  mode
- **THEN** interpolate horizontal runs against the current selection, identical to activating it
  from the toolbar icon or the bulk editor

#### Scenario: Selection too narrow
- **WHEN** interpolate horizontal is triggered on a selection spanning 2 or fewer columns
- **THEN** no cell value changes and no undo entry is recorded

#### Scenario: Row with a non-numeric edge
- **WHEN** a selected row's leftmost or rightmost selected value has no underlying data
- **THEN** that row is left unchanged by the operation, while other rows in the selection are
  still interpolated

#### Scenario: One undo step
- **WHEN** interpolate horizontal changes any cell
- **THEN** the entire operation is recorded as a single undo entry, regardless of how many rows or
  cells changed

### Requirement: Interpolate vertical
With a rectangular selection spanning at least three rows, interpolating vertically SHALL replace
every interior row of each selected column with the value linearly interpolated between that
column's own topmost and bottommost selected values, positioned by the interior row's index within
the selection (not by axis breakpoint value). The two edge rows are left unchanged.

#### Scenario: Interpolating a selection
- **WHEN** the user triggers interpolate vertical on a selection spanning 3 or more rows
- **THEN** each interior row of each selected column is set to the value linearly interpolated
  between that column's own topmost and bottommost selected values, positioned by the row's index
  within the selection, while the two edge rows keep their current values

#### Scenario: Keyboard shortcut
- **WHEN** the user presses `V` (no modifier key) while the table has focus and is not in edit
  mode
- **THEN** interpolate vertical runs against the current selection, identical to activating it
  from the toolbar icon or the bulk editor

#### Scenario: Selection too narrow
- **WHEN** interpolate vertical is triggered on a selection spanning 2 or fewer rows
- **THEN** no cell value changes and no undo entry is recorded

#### Scenario: Column with a non-numeric edge
- **WHEN** a selected column's topmost or bottommost selected value has no underlying data
- **THEN** that column is left unchanged by the operation, while other columns in the selection
  are still interpolated

#### Scenario: One undo step
- **WHEN** interpolate vertical changes any cell
- **THEN** the entire operation is recorded as a single undo entry, regardless of how many columns
  or cells changed

### Requirement: Icon toolbar for map editing actions
An editable map table SHALL show an icon toolbar above the table with five actions: open the
adjustment dialog, interpolate horizontal, interpolate vertical, undo, and redo.

#### Scenario: Toolbar visible only when editable
- **WHEN** the table is read-only
- **THEN** the toolbar is not shown

#### Scenario: Opening the adjustment dialog
- **WHEN** the user clicks the adjustment icon
- **THEN** the same bulk-edit dialog that F2 opens is shown

#### Scenario: Interpolate icons run immediately
- **WHEN** the user clicks the interpolate horizontal or interpolate vertical icon
- **THEN** the corresponding interpolation runs immediately against the current selection, without
  opening the adjustment dialog

#### Scenario: Interpolate icons disabled below threshold
- **WHEN** the current selection does not span enough columns (for horizontal) or rows (for
  vertical) to have an interior cell
- **THEN** the respective icon is shown disabled

#### Scenario: Undo/redo icons reflect history availability
- **WHEN** no undo (or redo) history is available for the table being viewed
- **THEN** the respective icon is shown disabled; when available, clicking it undoes or redoes
  exactly as the keyboard shortcut would

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
