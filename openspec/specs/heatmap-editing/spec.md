# heatmap-editing Specification

## Purpose
Defines the shared interaction contract for editing an N×M ECU map table (selection, keyboard
navigation, inline and bulk editing, clipboard, undo/redo) that the VE, Ignition, and Lambda tuning
tabs all build on, so that editing feels identical across all three.

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
additive delta, or a fixed value to every selected cell as one action.

#### Scenario: Opening the bulk editor
- **WHEN** two or more cells are selected and the user presses Enter or the bulk-edit shortcut
- **THEN** a bulk-edit control appears with percentage, "add", and "set" fields

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
actions, scoped independently per map table and not preserved across a page reload.

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
