## Purpose

Defines the correction run: a compiled, map-independent (except for its breakpoints) result generated
from the loaded datalogs, kept in a short history the user picks from on the VE tab, and generated
from a single button reachable on every Datalog tab. It is the one contract between the Datalog
screen (which produces runs) and the Tuning screen (which consumes them).

## ADDED Requirements

### Requirement: A run is a compiled result, independent of the logs and the map's values
Each generation SHALL create a correction run holding, for every cell of the map's MAP×RPM grid, the
effective sample count and the mean, median and mode of the VE Lambda values attributed to it (see
`tuning-ve-correction`), plus the MAP and RPM breakpoints of the map it was generated against, its
creation instant, its name, and — for display only — the filenames of the logs used, the time range
used per log, and the filter settings used. A run SHALL NOT store correction factors: factors are
always derived on display against the map currently loaded. After generation a run SHALL NOT depend
on the logs: removing, deactivating or reordering a log, or changing the filter or the time
selection, SHALL NOT change or flag any existing run.

#### Scenario: Factors follow the loaded map
- **WHEN** a run is selected and the user edits the editable map or loads another map with the same
  breakpoints
- **THEN** the displayed factors are recomputed from the run's stored values and the map's current
  values, with no regeneration

#### Scenario: Removing a log used by a run
- **WHEN** the user removes or deactivates a log that was used to generate a run
- **THEN** the run is unchanged and still selectable, showing the filenames it was generated from

#### Scenario: Changing filters after generating
- **WHEN** the user changes the filter or the time selection after a run exists
- **THEN** no existing run changes and none is flagged as outdated

### Requirement: Run compatibility with the loaded map
A run SHALL be usable only with a map whose MAP and RPM breakpoints are exactly the ones stored in the
run. With any other map loaded, the run SHALL be listed and selectable but shown as incompatible with
the loaded map, with no factors displayed and no correction applicable; it SHALL NOT be reinterpreted
against the other map's grid. Loading, replacing or clearing the map SHALL NOT delete any run.

#### Scenario: Another map with the same breakpoints
- **WHEN** the user loads a different map whose breakpoints equal the run's
- **THEN** the run displays factors computed against the newly loaded map's values, showing how much
  that map would be corrected by the same logs

#### Scenario: Another map with different breakpoints
- **WHEN** the user loads a map whose MAP or RPM breakpoints differ from the selected run's
- **THEN** the correction section states that the run is incompatible with the loaded map, shows no
  factors, offers no apply action, and the run remains in the history

#### Scenario: Switching to a compatible run
- **WHEN** the selected run is incompatible and the history holds a compatible run
- **THEN** selecting the compatible run displays its factors normally

#### Scenario: Replacing the map keeps the history
- **WHEN** the user imports a new map
- **THEN** every run is still in the history

### Requirement: "Gerar Correção" action in the Datalog header
The Datalog screen SHALL show a "Gerar Correção" button in its header, next to the filter button and
the help button, on every Datalog tab except Dinamômetro, where it SHALL be hidden. The button SHALL
carry only that label (no counts or other text). Activating it SHALL open the confirmation dialog
described below; the run is only created when the user confirms there. The button SHALL be disabled,
with a message saying why, when no map is loaded (the breakpoints are needed) or when no point passes
the applied filter.

#### Scenario: Button on every tab but Dinamômetro
- **WHEN** the user is on the Logs, Dashboard, Gráficos or Dados tab
- **THEN** the "Gerar Correção" button is visible and enabled when a map is loaded and at least one
  point passes the applied filter

#### Scenario: Dinamômetro tab
- **WHEN** the user opens the Dinamômetro tab
- **THEN** the "Gerar Correção" button is not shown while the help button remains

#### Scenario: Plain label
- **WHEN** the button is shown
- **THEN** it reads only "Gerar Correção", whatever the filter, selection or logs

#### Scenario: Activating opens the dialog without generating
- **WHEN** the user activates the button
- **THEN** the confirmation dialog opens and no run exists yet

#### Scenario: No map loaded
- **WHEN** no map has been imported
- **THEN** the button is disabled and its message says a map is needed to define the cell grid

#### Scenario: No point passes the filter
- **WHEN** the applied filter leaves no point
- **THEN** the button is disabled and its message says no point qualifies

### Requirement: Confirmation dialog before generating
Before creating a run, the app SHALL show a confirmation dialog that describes what will be generated
— that a correction run is created from the active logs' points that pass the applied filter, and
that factors are always calculated against the loaded map — and shows what it will use: the number of
points that qualify, the number of enabled filter criteria and the active logs. The dialog SHALL
include a switch "Considerar o intervalo selecionado na linha do tempo" that decides whether the time
interval selected on the timeline limits the points. The switch SHALL be on by default when an
interval is selected; when no interval is selected it SHALL be off and unavailable, with a note saying
so. The shown number of qualifying points SHALL follow the switch. The dialog SHALL offer "Cancelar"
and "Gerar Correção"; confirming SHALL be unavailable while no point would qualify.

#### Scenario: Dialog content
- **WHEN** the dialog opens with 12 000 points passing a filter of 8 enabled criteria and two active
  logs
- **THEN** it describes the run and shows 12 000 points, 8 criteria and the two log names

#### Scenario: Interval selected, switch on
- **WHEN** an interval is selected on the timeline and the dialog opens
- **THEN** the switch is on, shows the interval, and the count covers only points inside it

#### Scenario: Turning the interval off
- **WHEN** the user turns the switch off
- **THEN** the count covers every point that passes the filter in the active logs, and the run that
  gets generated records every log as used in full

#### Scenario: No interval selected
- **WHEN** no interval is selected on the timeline
- **THEN** the switch is off and unavailable, with a note that there is no selected interval

#### Scenario: Cancelling
- **WHEN** the user cancels or presses Escape
- **THEN** the dialog closes and no run is created

#### Scenario: Confirming
- **WHEN** the user confirms
- **THEN** the run is created with the chosen interval option, the dialog closes, and the feedback of
  "Feedback after generating, without navigation" follows

#### Scenario: Interval leaves no point
- **WHEN** the switch is on and the selected interval contains no point that passes the filter
- **THEN** confirming is unavailable and the dialog says no point qualifies, until the switch is turned
  off

#### Scenario: What is highlighted is what is used
- **WHEN** the user generates a run
- **THEN** the points used are exactly the ones the Dashboard, Gráficos and Dados tabs show as
  passing the applied filter, restricted to the time selection only when the switch is on

### Requirement: Time range is recorded per log
When the confirmation dialog's interval switch is on, the time selection, made on the timeline over
the concatenation of the active logs, SHALL be turned into one interval per log at generation time,
and the run SHALL record those per-log intervals (or "entire log" when the selection covers the whole
log). When the switch is off, or there is no selection, the run SHALL record every active log as used
in full. Reordering or deactivating logs afterwards SHALL NOT change what a recorded run says it used.

#### Scenario: Selection spanning two logs
- **WHEN** the selection covers the end of the first log and the beginning of the second
- **THEN** the run records an interval for each of the two logs and "not used" for any other log

#### Scenario: No selection
- **WHEN** no time selection exists
- **THEN** the run records that every active log was used in full

#### Scenario: Switch off with a selection present
- **WHEN** a selection exists but the user turned the dialog's interval switch off
- **THEN** the run records that every active log was used in full

### Requirement: Feedback after generating, without navigation
After a run is generated the app SHALL show a confirmation toast, always in the top-right corner of the
screen (below the TopBar) whatever the route, with a "Ver na VE" action, and SHALL mark the "Tuning"
item of the TopBar with an indicator until the user opens the VE tab. It SHALL NOT navigate on its own.

#### Scenario: Generating from the Gráficos tab
- **WHEN** the user generates a run while on the Gráficos tab
- **THEN** a toast confirms the run, the user stays on the Gráficos tab, and the TopBar's Tuning item
  shows the indicator

#### Scenario: Toast position
- **WHEN** any toast is shown, on any route
- **THEN** it appears in the top-right corner, below the TopBar, and never at the bottom

#### Scenario: Following the toast action
- **WHEN** the user activates "Ver na VE" in the toast
- **THEN** the app navigates to the VE tab with the new run selected

#### Scenario: Opening the VE tab clears the indicator
- **WHEN** the user opens the VE tab by any means
- **THEN** the TopBar indicator disappears

### Requirement: History of up to 10 runs
The app SHALL keep a history of at most 10 runs. Generating an 11th run SHALL discard the oldest one.
The user SHALL be able to delete any run, guarded by a confirmation.

#### Scenario: Reaching the limit
- **WHEN** 10 runs exist and the user generates another
- **THEN** the oldest run is removed, the new one is added and the history still holds 10

#### Scenario: Deleting a run
- **WHEN** the user deletes a run and confirms
- **THEN** it leaves the history and no other run changes

### Requirement: Run names
A new run SHALL be named by default with its creation date and time. The user SHALL be able to rename
any run; a name left empty SHALL revert to the default date-and-time name.

#### Scenario: Default name
- **WHEN** a run is generated
- **THEN** its name is its creation date and time

#### Scenario: Renaming
- **WHEN** the user renames a run to "Pós-troca de bico"
- **THEN** that name is shown in the run list and selector, and it persists

#### Scenario: Empty name
- **WHEN** the user clears a run's name and confirms
- **THEN** the run goes back to its default date-and-time name

### Requirement: Run selector in the VE correction section
The correction section of the VE tab SHALL show, below its title, a selector listing the history (name, creation time,
number of logs, and whether it is compatible with the loaded map) and show the selected run's recipe:
log filenames, time range per log, and the filter settings used, as chips. Below the selector and the
recipe chips the section SHALL show a "Valores" label and, under it, the Média / Mediana / Moda
switch, and beside it a "Cores" label with the Valor / Amostras switch defined by
`tuning-ve-correction`. The newest run SHALL be selected right after generation. After the selected
run is deleted, the most recent remaining compatible run SHALL be selected, or none. The selected run
SHALL persist across reloads.

#### Scenario: Newly generated run is selected
- **WHEN** a run is generated
- **THEN** it becomes the selected run

#### Scenario: Choosing an older run
- **WHEN** the user picks another run in the selector
- **THEN** the three correction tables show that run's data against the current map, and the recipe
  chips switch to that run's

#### Scenario: Deleting the selected run
- **WHEN** the selected run is deleted and other runs remain
- **THEN** the most recent remaining compatible run becomes the selected run

#### Scenario: Layout of the controls
- **WHEN** a run is displayed
- **THEN** from top to bottom the section shows its title, the run selector with rename and delete,
  the recipe chips, the "Valores" label with the Média / Mediana / Moda switch under it and, beside
  it, the "Cores" label with the Valor / Amostras switch under it, and then the correction tables

#### Scenario: Recipe chips
- **WHEN** a run is displayed
- **THEN** its filter settings appear as chips naming each enabled criterion and its limits, the
  filenames of the logs used and the time range used per log
