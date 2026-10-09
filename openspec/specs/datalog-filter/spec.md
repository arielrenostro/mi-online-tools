# datalog-filter Specification

## Purpose
Defines the single Datalog filter: a set of switchable criteria, edited in a modal reachable from every
Datalog tab, whose result decides which points are highlighted in the Dashboard, Gráficos and Dados
tabs and which points feed a correction run. It replaces the former separate "visual filter" and VE
correction filters.

## Requirements

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
  Lambda Corr, Pedal, CLT, IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost;
- the accepted Lambda Loop states (open, closed, closed with auto-correção);
- the maximum TPS delta and the maximum MAP delta (amplitudes defined by `mapa-ve-correction`);
- the maximum absolute difference between Lambda 1 and Lambda Target;
- skip the first N points after entering closed loop, skip the first N points after entering open
  loop, skip the N points before entering closed loop, and skip the N points before entering open
  loop (all four defined by `mapa-ve-correction`).

A point whose value for an enabled range's signal, or whose Lambda Loop value, is not a number SHALL
fail that criterion. This includes the optional signals (Batt Volt., Inj. DT, Inj. Pulse) when a log
has no such column.

#### Scenario: Ranges follow the Gráficos signal order
- **WHEN** the user opens the filter modal
- **THEN** the "Faixas" section lists the ranges in the same order as the signals in the Gráficos
  sidebar: RPM, MAP, Boost, Pedal, Lambda 1, Lambda Target, Lambda Corr, Inj. Pulse, Inj. DT,
  Inj. Utiliz., CLT, IAT, Batt Volt.

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

#### Scenario: Range on an injector or electrical signal
- **WHEN** the user enables the Batt Volt. range with minimum 12 and maximum 15
- **THEN** a point passes that criterion only if its battery voltage, in volts, is between 12 and 15
  inclusive

#### Scenario: Range on a signal the log does not have
- **WHEN** the Inj. DT range is enabled and a log has no Inj. DT column
- **THEN** every point of that log fails the filter

#### Scenario: Boost and Lambda Target ranges
- **WHEN** the user enables a Boost maximum of 150 and a Lambda Target minimum of 0.8
- **THEN** a point passes only if its boost is at most 150 kPa and its Lambda Target is at least 0.8 λ

#### Scenario: "Before" and "after" skips combine
- **WHEN** both the "before entering closed loop" and the "after entering closed loop" skips are
  enabled
- **THEN** a point fails if it falls in either window, and the window around each transition is
  excluded on both sides

#### Scenario: Invalid skip count
- **WHEN** an enabled skip criterion (before or after) has a count that is not an integer greater
  than or equal to zero
- **THEN** that criterion is shown as invalid and "Aplicar" is unavailable

### Requirement: Default filter
The default filter SHALL have enabled: Lambda Loop with closed and closed-with-auto-correção
accepted, CLT with minimum 85, Lambda 1 with minimum 0.6 and maximum 1.1, maximum TPS delta 5,
maximum MAP delta 5, maximum |Lambda 1 − Lambda Target| 0.03, skip 5 points after entering closed
loop and skip 10 after entering open loop; and disabled: the MAP, RPM, Pedal and Lambda Corr ranges,
the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges, and the skips of
points before entering closed loop (count 5) and before entering open loop (count 10). The MAP, RPM,
Pedal, Lambda Corr, IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges
SHALL have empty minimum and maximum (no default value).

#### Scenario: First use
- **WHEN** the app starts with no saved filter
- **THEN** the applied filter is the default above

#### Scenario: "Before" skips off by default
- **WHEN** the filter is the default
- **THEN** no point is excluded for preceding a Lambda Loop transition

#### Scenario: New ranges are off and empty by default
- **WHEN** the filter is the default and the user opens the modal
- **THEN** the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges are each
  unchecked, with empty "mín" and "máx" fields, and the "Filtro" button count is unchanged by them

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

### Requirement: Loop-transition skips laid out as Antes / Depois pairs
The "Transições de Lambda Loop" section of the modal SHALL have one row per kind of transition —
Closed Loop and Open Loop — and each row SHALL show the "Antes" skip and the "Depois" skip side by
side on the same line, each with its own enable switch and its own point count. "Antes" is the skip of
points before entering that state; "Depois" is the skip of points after entering it.

#### Scenario: Two rows, two fields each
- **WHEN** the user opens the filter modal
- **THEN** the section shows a Closed Loop row and an Open Loop row, and in each one the "Antes" and
  "Depois" controls appear next to each other on the same line

#### Scenario: Antes and Depois are independent
- **WHEN** the user enables "Antes" and disables "Depois" on the Closed Loop row
- **THEN** only the "Antes" count is editable and applied, and the "Depois" count stays locked while
  keeping its value

### Requirement: Filters saved before the "before" skips existed still load
A filter saved without the "before" skip criteria (an older session, or a correction run's recipe)
SHALL be read with those two criteria disabled and at their default counts, and every other saved
criterion SHALL keep its saved value.

#### Scenario: Reload with an old saved filter
- **WHEN** the app restores a saved filter that has no "before" skip fields
- **THEN** the applied filter equals the saved one with both "before" skips disabled, so the same
  points pass as before the upgrade

#### Scenario: Run recipe from an older run
- **WHEN** a correction run saved before this change is shown
- **THEN** its recipe chips list the criteria it did store and none for the "before" skips

### Requirement: Filters saved before the new ranges existed still load
A filter saved without the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost
ranges (an older session, or a correction run's recipe) SHALL be read with those ranges disabled and
empty, and every other saved criterion SHALL keep its saved value. A saved filter that includes them
SHALL restore their enable state and bounds.

#### Scenario: Reload with an old saved filter
- **WHEN** the app restores a saved filter that has none of the seven new ranges
- **THEN** the applied filter equals the saved one with the seven ranges disabled and empty, so the same
  points pass as before the upgrade

#### Scenario: Reload with new ranges applied
- **WHEN** the user applies an enabled Boost range with a minimum and reloads the page
- **THEN** the Boost range is restored enabled with the same minimum

#### Scenario: Run recipe from an older run
- **WHEN** a correction run saved before this change is shown
- **THEN** its recipe chips list the criteria it did store, none for the new ranges, and nothing fails to render

#### Scenario: Run recipe lists an enabled new range
- **WHEN** a run is generated with the Inj. Utiliz. range enabled with a maximum of 85
- **THEN** its recipe shows a chip for that range with the limit

### Requirement: Applying the filter does not freeze the dialog
Applying the filter, or toggling "Mostrar pontos filtrados", recalculates every screen that depends
on it, which takes noticeable time on a large log. The dialog SHALL close (or, for the toggle, the
checkbox SHALL change) immediately when the user acts, and a visible "working" indicator SHALL be
shown until the recalculation is finished, instead of the dialog staying on screen unresponsive.

#### Scenario: Applying a changed filter on a large log
- **WHEN** the user presses "Aplicar" with a changed filter on a large log
- **THEN** the dialog closes right away, an indicator such as "Aplicando filtro…" is shown while the
  screens recalculate, and the indicator disappears when they are done

#### Scenario: Toggling the visibility of filtered points
- **WHEN** the user toggles "Mostrar pontos filtrados" on a large log
- **THEN** the checkbox changes immediately and an indicator is shown while the charts and tables
  are redrawn
