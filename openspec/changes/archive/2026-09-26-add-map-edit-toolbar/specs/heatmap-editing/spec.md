## MODIFIED Requirements

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

## ADDED Requirements

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
