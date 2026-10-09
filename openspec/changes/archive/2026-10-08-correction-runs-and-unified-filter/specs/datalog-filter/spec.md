## Purpose

Defines the single Datalog filter: a set of switchable criteria, edited in a modal reachable from every
Datalog tab, whose result decides which points are highlighted in the Dashboard, Gráficos and Dados
tabs and which points feed a correction run. It replaces the former separate "visual filter" and VE
correction filters.

## ADDED Requirements

### Requirement: Filter button in the Datalog header
The Datalog screen SHALL show a "Filtro" button in the top-right of the tab bar, next to the
"Gerar Correção" button and the help button, that opens the filter modal, on every Datalog tab except
Dinamômetro, where it SHALL be hidden because the filter has no effect there. The button SHALL show
how many criteria are enabled, and SHALL be visibly highlighted while the applied filter differs from
the default.

#### Scenario: Opening the modal
- **WHEN** the user activates the "Filtro" button on any tab where it is shown
- **THEN** the filter modal opens over the current tab, without changing the route

#### Scenario: Button reflects the applied filter
- **WHEN** the applied filter has 8 criteria enabled and differs from the default
- **THEN** the button shows the count 8 and renders in its highlighted style

#### Scenario: Default filter
- **WHEN** the applied filter equals the default
- **THEN** the button renders in its idle style, still showing the count of enabled criteria

#### Scenario: Dinamômetro tab
- **WHEN** the user opens the Dinamômetro tab
- **THEN** the "Filtro" button is not shown, and when the user goes back to another Datalog tab it is
  shown again with the same applied filter

### Requirement: Switchable criteria combined with AND
The modal SHALL offer these criteria, each with its own enable switch, and a point SHALL pass the
filter if and only if it satisfies every enabled criterion (AND; disabled criteria are ignored even if
their fields hold values):

- a range with optional minimum and maximum, inclusive of both bounds, for each of MAP, RPM, Lambda 1,
  Lambda Corr, Pedal and CLT;
- the accepted Lambda Loop states (open, closed, closed with auto-correção);
- the maximum TPS delta and the maximum MAP delta (amplitudes defined by `tuning-ve-correction`);
- the maximum absolute difference between Lambda 1 and Lambda Target;
- skip the first N points after entering closed loop, and skip the first N points after entering open
  loop (defined by `tuning-ve-correction`).

A point whose value for an enabled range's signal, or whose Lambda Loop value, is not a number SHALL
fail that criterion.

#### Scenario: Enabling a subset of criteria
- **WHEN** the user enables only the MAP and RPM ranges and disables everything else
- **THEN** a point passes only if both its MAP and its RPM are inside their ranges

#### Scenario: Open-ended range
- **WHEN** an enabled range has only a minimum, or only a maximum, filled in
- **THEN** it constrains only the filled side

#### Scenario: Enabled range with both bounds empty
- **WHEN** an enabled range has neither bound filled in
- **THEN** it constrains nothing

#### Scenario: Disabled criterion keeps its values
- **WHEN** a criterion is disabled while its fields still hold values
- **THEN** it is ignored by the filter and the values are kept for when it is enabled again

#### Scenario: Fields are locked while the criterion is off
- **WHEN** a criterion's enable switch is unchecked
- **THEN** every field of that criterion (bounds, limit, count or accepted Lambda Loop states) is
  disabled and cannot be edited, and typing is not possible until the switch is checked again

#### Scenario: Enabling unlocks the fields
- **WHEN** the user checks the criterion's enable switch
- **THEN** its fields become editable, holding the values they had

#### Scenario: Value is not a number
- **WHEN** a point has no numeric value for the signal of an enabled range
- **THEN** that point fails the filter

### Requirement: Default filter
The default filter SHALL have enabled: Lambda Loop with closed and closed-with-auto-correção
accepted, CLT with minimum 85, Lambda 1 with minimum 0.6 and maximum 1.1, maximum TPS delta 5,
maximum MAP delta 5, maximum |Lambda 1 − Lambda Target| 0.03, skip 5 points after entering closed
loop and skip 10 after entering open loop; and disabled: the MAP, RPM, Pedal and Lambda Corr ranges.

#### Scenario: First use
- **WHEN** the app starts with no saved filter
- **THEN** the applied filter is the default above

### Requirement: Edits are local to the modal until applied
Editing a field SHALL change only the modal's draft; the applied filter, the highlight in the tabs and
the points used by "Gerar Correção" SHALL keep reflecting the last applied filter until the user
activates "Aplicar". Closing the modal with Escape, its close button or a click outside SHALL discard
the draft. "Aplicar" SHALL be unavailable while a criterion is invalid or while the draft equals the
applied filter. While open, the modal SHALL show how many points would pass the draft out of the
total, next to how many pass the applied filter.

#### Scenario: Editing without applying
- **WHEN** the user changes a field and closes the modal without applying
- **THEN** the applied filter, the highlight and the points the "Gerar Correção" dialog counts are unchanged and a
  later reopening starts from the applied filter

#### Scenario: Applying
- **WHEN** the user activates "Aplicar"
- **THEN** the draft becomes the applied filter, the modal closes, and the Dashboard, Gráficos and
  Dados tabs and the points the "Gerar Correção" dialog counts immediately reflect it

#### Scenario: Preview of the draft
- **WHEN** the modal is open with an edited draft
- **THEN** it shows how many points would pass the draft and how many pass the applied filter, out
  of the same total

#### Scenario: Inverted range
- **WHEN** an enabled range has a minimum greater than its maximum
- **THEN** the range is flagged as invalid and "Aplicar" is unavailable until it is fixed

#### Scenario: Lambda Loop with no state
- **WHEN** the Lambda Loop criterion is enabled with no state accepted
- **THEN** it is flagged as invalid and "Aplicar" is unavailable until a state is accepted or the
  criterion is disabled

#### Scenario: Leaving a tab with an open draft
- **WHEN** the modal has an unapplied draft and the user closes it or navigates elsewhere
- **THEN** no confirmation is requested and the draft is discarded

### Requirement: Restore the default filter
The modal SHALL provide a "Restaurar padrão" action that resets its draft to the default filter,
leaving the applied filter unchanged until "Aplicar" is activated.

#### Scenario: Restoring defaults
- **WHEN** the user activates "Restaurar padrão" and then "Aplicar"
- **THEN** the applied filter becomes the default and the "Filtro" button returns to its idle style

### Requirement: One mask for highlighting and for correction runs
The pass/fail state defined by the applied filter SHALL be the only one used to highlight points in
the Dashboard, Gráficos and Dados tabs and the only one used to select the points of a correction
run (see `correction-runs`); there SHALL be no highlight-only filter. When a time interval is
selected on the timeline, a point qualifies for a run only if it is inside the interval and passes
the applied filter; with no selection, qualification depends only on the applied filter, evaluated
over every active log.

#### Scenario: Highlight equals generation set
- **WHEN** the user applies a MAP range and generates a run
- **THEN** the run uses exactly the points shown as passing in the Gráficos and Dados tabs inside the
  selection

#### Scenario: Combined with a time selection
- **WHEN** a time interval is selected and the applied filter is active
- **THEN** only points inside the interval that also pass the filter qualify for a run

#### Scenario: No time selection
- **WHEN** no time interval is selected
- **THEN** qualification depends only on the applied filter, over every active log

### Requirement: "Mostrar pontos filtrados" in the filter modal
The filter modal SHALL include the visibility toggle for points failing the applied filter: when set
to visible they remain in the Data tab and the Charts, dimmed; when set to hidden they are omitted from
the Data tab and dropped from the chart series. The toggle SHALL take effect immediately, without
"Aplicar".

#### Scenario: Visible (dimmed)
- **WHEN** the toggle keeps filtered points visible
- **THEN** the Data tab renders failing rows dimmed instead of omitting them, and Charts render failing
  points dimmed in place, preserving the series' time continuity

#### Scenario: Hidden
- **WHEN** the toggle hides filtered points
- **THEN** the Data tab omits failing rows entirely, and Charts drop failing points from the series
  without regard to the resulting time gap

#### Scenario: Toggling with the modal open
- **WHEN** the user flips the toggle while the modal is open
- **THEN** the tabs behind it reflect the new setting right away

### Requirement: The applied filter and the toggle persist
The applied filter and the "Mostrar pontos filtrados" setting SHALL persist across reloads. A saved
filter written in the format used before this capability existed SHALL be converted to the equivalent
filter with the same criteria and limits; an unreadable or missing saved filter SHALL fall back to the
default without showing an error.

#### Scenario: Reload
- **WHEN** the user applies a filter and reloads the page
- **THEN** the same filter is applied after the session is restored

#### Scenario: Filter saved by the previous version
- **WHEN** the app restores a saved correction filter in the old format
- **THEN** the restored filter has the same limits enabled as before, with the MAP, RPM, Pedal and
  Lambda Corr ranges disabled

#### Scenario: Unreadable saved filter
- **WHEN** the stored filter cannot be read
- **THEN** the default filter is used and no error is shown
