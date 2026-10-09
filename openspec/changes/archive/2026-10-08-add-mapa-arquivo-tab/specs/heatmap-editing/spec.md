## MODIFIED Requirements

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
