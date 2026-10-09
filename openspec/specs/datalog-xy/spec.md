# datalog-xy Specification

## Purpose
Mostra a relação entre sinais do datalog em uma nuvem de pontos XY (um sinal no eixo X, um ou mais no
eixo Y), usando o filtro único do Datalog e o intervalo da TimeRail, para o usuário ver como um sensor
responde a outro sem comparar dois gráficos de tempo.

## Requirements

### Requirement: XY tab
The Datalog screen SHALL provide an "XY" tab, after "Gráficos" and before "Dinamômetro" (see
`navigation-guards` for the order of all tabs), showing one scatter chart of points (no connecting
lines between the points themselves) built from the rows of the active logs. Each point SHALL have, as its X value,
the row's value of the chosen X signal and, as its Y value, the row's value of one chosen Y signal.
The tab SHALL list as choices every signal available in all active logs, including the signals
computed from the constants (VE Lambda Corrigido, Potência, Torque).

#### Scenario: Opening the tab with active logs
- **WHEN** the user opens the XY tab with at least one active log and no saved choice
- **THEN** the chart shows RPM on the X axis and MAP as the single Y series, one point per row that
  has a numeric value for both

#### Scenario: Hovering a point
- **WHEN** the user hovers a point of the chart
- **THEN** a tooltip shows the X signal's name and value and the Y signal's name and value at that
  point, each with its unit

#### Scenario: Hovering a point that fails the filter
- **WHEN** the user hovers a dimmed point (one that fails the applied filter and is shown)
- **THEN** the tooltip says the point is outside the filter, besides the values above

#### Scenario: Signals computed from constants
- **WHEN** the user picks Potência as a Y signal
- **THEN** its points are computed with the current constants from Configurações, and editing them
  there updates the chart on return

### Requirement: Choosing the X signal
The tab SHALL provide a selector for the X axis signal, holding exactly one signal at all times. The
X axis SHALL be labeled with the signal's name and unit (the unit is omitted when it only repeats the
name, as for RPM) and SHALL span that signal's configured range (see `app-settings`; its default
range when the user has not changed it), as the Y axes do.

#### Scenario: Changing the X signal
- **WHEN** the user picks another signal in the X selector
- **THEN** every series is redrawn against the new X signal

#### Scenario: X signal also in Y
- **WHEN** the user picks as X a signal that is also one of the Y series
- **THEN** both choices are kept and that series is drawn as the diagonal of the chart, without error

#### Scenario: X range edited in Configurações
- **WHEN** the user sets the range of RPM to 800–6000 on the Configurações screen and RPM is the X
  signal
- **THEN** the X axis spans 800 to 6000 and the mean, maximum and minimum curves are computed over
  that same span

### Requirement: Several Y signals, each with its own axis
The tab SHALL let the user add any number of signals to the Y axis and remove them individually. Each
Y signal SHALL be a separate series with its own color, shown as a removable chip in that color, and
SHALL have its own value axis, labeled with the signal's name and unit and drawn in the series color.
Axes SHALL alternate between the sides of the chart — the first on the left, the second on the right,
the third on the left beside the first, and so on — so that they never overlap, and the chart's margins
SHALL grow with the number of axes on each side. Each axis SHALL span the
signal's configured range (see `app-settings`) — by default the same one the Gráficos tab uses for
that signal (for example 0.7 to 1.3 for Lambda 1) — regardless of the data shown. A signal already in
the Y list SHALL NOT be offered again. Any Y signal SHALL be removable, including the only one: the Y
list MAY be empty.

#### Scenario: Adding a Y signal
- **WHEN** the user adds a signal to the Y list
- **THEN** a new series appears in its own color, with its own labeled axis, alongside the existing
  ones

#### Scenario: Removing a Y signal
- **WHEN** the user removes a Y signal's chip
- **THEN** that series and its axis disappear and the other series keep their colors

#### Scenario: Removing the only Y signal
- **WHEN** the Y list has one signal and the user removes its chip
- **THEN** the Y list becomes empty, the chart is replaced by a message asking to add a signal to the Y
  axis, and the X selector and the control to add a Y signal remain available

#### Scenario: Adding a Y signal to an empty list
- **WHEN** the Y list is empty and the user adds a signal
- **THEN** the chart is drawn again with that signal as its only series

#### Scenario: Standard range per signal
- **WHEN** a Lambda signal is a Y series
- **THEN** its axis spans the range configured for that signal (by default the standard one the
  Gráficos tab uses), not the range of the data currently drawn

#### Scenario: Range edited in Configurações
- **WHEN** the user changes the range of a Y signal on the Configurações screen and returns to the XY
  tab
- **THEN** that signal's axis spans the new range, and the X selection, Y list, filter and time
  selection are unchanged

#### Scenario: Axes on both sides
- **WHEN** the Y list holds four signals
- **THEN** the first and third axes are on the left, side by side, and the second and fourth on the
  right, side by side, each in its series color and none covering another

#### Scenario: Signals with different scales
- **WHEN** the Y list holds signals of very different magnitudes, such as MAP and Lambda 1
- **THEN** each is readable on its own axis, not flattened by a shared scale

### Requirement: Rows without a value are skipped per series
For each Y series, a row SHALL contribute a point only when both the X signal and that Y signal have
numeric values in that row. A row missing the value of one Y signal SHALL NOT remove its points from the
other Y series, and a signal that does not exist in some active log SHALL only leave those logs' rows
out of its own series.

#### Scenario: Signal absent from one log
- **WHEN** one of two active logs has no Marcha column and Marcha is a Y series
- **THEN** the Marcha series has points only from the other log, and the other series keep points from
  both logs

### Requirement: Applied filter and the visibility toggle
Every series SHALL reflect the applied Datalog filter (see `datalog-filter`) using the same pass/fail
state as the Dashboard, Gráficos and Dados tabs. Points that fail it SHALL follow "Mostrar pontos
filtrados": drawn dimmed, in a muted version of the series color, when it is set to visible, and
omitted when it is set to hidden. Dimmed points SHALL be drawn beneath the points that pass, so a
passing point is never covered by a dimmed one. The "Filtro" and "Gerar Correção" buttons of the Datalog
header SHALL be available on this tab, and applying a different filter SHALL redraw the chart right
away.

#### Scenario: Visibility toggle set to "visible"
- **WHEN** "Mostrar pontos filtrados" keeps excluded points visible
- **THEN** points failing the applied filter are drawn dimmed and points passing it in the full series
  color, in the same chart

#### Scenario: Visibility toggle set to "hidden"
- **WHEN** "Mostrar pontos filtrados" hides excluded points
- **THEN** points failing the applied filter are not drawn at all

#### Scenario: Passing points over dimmed ones
- **WHEN** dimmed and passing points overlap in the same place
- **THEN** the passing point is the one visible

#### Scenario: Header buttons on the XY tab
- **WHEN** the user is on the XY tab
- **THEN** the "Filtro" and "Gerar Correção" buttons are shown in the header, and use the same applied
  filter and time selection as on the other tabs

#### Scenario: Applying a filter while on the tab
- **WHEN** the user applies a different filter in the modal opened from this tab
- **THEN** the chart redraws with the new pass/fail state without leaving the tab

### Requirement: Timeline selection scopes the chart
When a time interval is selected on the timeline, the chart SHALL contain only the points whose row
lies inside that interval, and with no selection it SHALL contain the points of every active log.
Changing or clearing the selection SHALL update the chart immediately.

#### Scenario: Interval selected
- **WHEN** the user selects an interval on the timeline while on the XY tab
- **THEN** only points from rows inside the interval remain, filtered by the applied filter as usual

#### Scenario: Selection cleared
- **WHEN** the selection is cleared
- **THEN** the points of every active log are shown again

### Requirement: Cursor highlight
When the timeline has a cursor, each Y series SHALL highlight the point of the row at the cursor
instant — the last row at or before it — in a visible marker (larger than the points, in the series
color with a white border, drawn above everything else), as long as that row has numeric values
for the X signal and that series' Y signal. With no cursor, or without such a row, no marker SHALL be
shown. Moving the cursor SHALL update the markers without redrawing the point cloud.

#### Scenario: Cursor over a row with values
- **WHEN** the cursor sits at an instant whose row has numeric X and Y values
- **THEN** each Y series shows a marker at that row's X and Y values

#### Scenario: No cursor
- **WHEN** the timeline has no cursor
- **THEN** no cursor marker is drawn

#### Scenario: Cursor row filtered out
- **WHEN** the cursor row fails the applied filter and filtered points are hidden
- **THEN** the marker is still shown for that row, so the user can see where the cursor sits

### Requirement: Mean curve of the Y signals along X
The tab SHALL provide a "Linha média" checkbox, unchecked by default. While it is checked, each Y
series SHALL show a dashed red line that follows the mean of the series' Y values along the X axis. The
X axis is divided into bands of equal width, 70 bands over the X signal's standard chart range (for
RPM, 100 rpm each), and each band holding at least 3 points contributes one point to the line, at the
mean X and the mean Y of the points in the band. The line SHALL then be extended horizontally, at the
level of its first and of its last point, to the lowest and to the highest X among the points that
enter, so that it spans every horizontal position that has points, including the sparse edges where no
band reaches 3 points. Only points that pass the applied filter inside the timeline selection SHALL
enter the means and set the extent of the line; points that fail the filter, drawn dimmed or not, SHALL
NOT.

The line SHALL be drawn on the series' own axis, above the cloud of points and with a dark halo, so that
it stays legible over a cloud of any color (it SHALL be a darker red when the series' own color is
itself red). Each of its points SHALL be marked in the color of its series so that the curves of
different series can be told apart, and hovering one of them SHALL show the mean Y value with its unit
and the X value of the point. A series with no band of at least 3 points SHALL show no line. The line
SHALL follow the filter, the selection, the X signal and the Y list as they change, and the checkbox
state SHALL persist across reloads.

#### Scenario: Turning the mean curve on
- **WHEN** the user checks "Linha média" with X = RPM and Y = Pressão Óleo
- **THEN** a line appears over the cloud showing the mean oil pressure of each RPM band, rising and
  falling with the cloud, and unchecking removes it

#### Scenario: One curve per Y signal
- **WHEN** the mean curve is on with MAP and Lambda 1 as Y signals
- **THEN** each has its own dashed red curve, read on its own axis, with its points marked in the color
  of its series

#### Scenario: The line spans the whole horizontal extent of the points
- **WHEN** the points that pass the filter run from MAP 22 to MAP 175, with at least 3 points in the
  bands from 30 to 165 and fewer in the bands at both ends
- **THEN** the line starts at MAP 22 and ends at MAP 175, flat at the level of the nearest mean at each
  end, instead of stopping at the first and last band with enough points

#### Scenario: Edge band with enough points
- **WHEN** the first band holds at least 3 points whose lowest X is smaller than their mean X
- **THEN** the line still starts at that lowest X, at the mean Y of the band

#### Scenario: Value of a point of the curve
- **WHEN** the user hovers a point of the mean curve
- **THEN** a tooltip shows the signal name, its mean value with unit and the X of the point

#### Scenario: Filter changes the curve
- **WHEN** the mean curve is on and the user applies a filter that excludes part of the points
- **THEN** the curve and its extent are recomputed from the points that pass the new filter

#### Scenario: Filtered points are not averaged
- **WHEN** the mean curve is on and "Mostrar pontos filtrados" shows the failing points dimmed
- **THEN** the dimmed points are drawn but do not count toward any mean, and the line does not reach
  the X of a point that fails the filter

#### Scenario: Timeline selection
- **WHEN** the mean curve is on and the user selects an interval on the timeline
- **THEN** the curve is computed, and extended, only from the points inside the interval

#### Scenario: Sparse bands in the middle
- **WHEN** an X band between two valid bands holds fewer than 3 passing points
- **THEN** that band adds no point of its own and the line joins the neighboring bands

#### Scenario: Series without enough points
- **WHEN** a Y series has no X band with at least 3 passing points
- **THEN** no curve is shown for it, and the other series keep theirs

#### Scenario: Reload
- **WHEN** the user leaves "Linha média" checked and reloads the page
- **THEN** it is still checked and the curves are drawn

### Requirement: Maximum and minimum curves of the Y signals along X
The tab SHALL provide two more checkboxes, "Linha máxima" and "Linha mínima", both unchecked by default
and independent of each other and of "Linha média". While "Linha máxima" is checked, each Y series SHALL
show a dotted light-gray line through the highest Y value of each X band; while "Linha mínima" is
checked, likewise through the lowest.

The bands, the minimum of 3 points per band, the horizontal extension to the lowest and highest X of
the points that enter, the points that enter (only those that pass the applied filter inside the
timeline selection), the axis of the line, its point at the mean X of the band, the hover tooltip
(naming the maximum or minimum of the signal, with its unit, and the X of the point) and the behavior
on changes of the filter, the selection, the X signal and the Y list SHALL be those of the mean curve.
The two lines SHALL be drawn beneath the mean curve and above the cloud, told apart from the mean curve
and from the cloud by color and dash style, and from each other by their position (the maximum above the
minimum). The state of both checkboxes SHALL persist across reloads.

#### Scenario: Envelope around the mean
- **WHEN** the user checks "Linha média", "Linha máxima" and "Linha mínima" with X = RPM and Y = Pressão
  Óleo
- **THEN** in each RPM band the maximum line lies at or above the mean line and the minimum line at or
  below it, wrapping the cloud of points that pass the filter

#### Scenario: Same horizontal extent as the mean
- **WHEN** the three lines are on
- **THEN** all three start at the lowest X and end at the highest X of the points that pass the filter

#### Scenario: Each checkbox on its own
- **WHEN** the user checks only "Linha máxima"
- **THEN** only the maximum line is drawn, and unchecking it removes it without touching the other
  curves

#### Scenario: Value of a point of the line
- **WHEN** the user hovers a point of the maximum line
- **THEN** a tooltip shows the signal name, its maximum value with unit in that band and the X of the
  point

#### Scenario: Filtered points do not set the extremes
- **WHEN** a point that fails the applied filter has the highest Y of its band
- **THEN** it is drawn dimmed but the maximum line ignores it

#### Scenario: Sparse bands are skipped
- **WHEN** an X band holds fewer than 3 passing points
- **THEN** the maximum and minimum lines add no point of their own for that band

#### Scenario: Reload
- **WHEN** the user leaves "Linha máxima" and "Linha mínima" checked and reloads the page
- **THEN** both are still checked and their lines are drawn

### Requirement: Point count summary
The tab's toolbar SHALL show how many points are drawn in full color (those that pass the applied
filter, summed over the Y series) and, when filtered points are shown and there are any, how many are
drawn dimmed, and SHALL say so when the count is restricted to the timeline selection.

#### Scenario: Counts with dimmed points shown
- **WHEN** "Mostrar pontos filtrados" keeps excluded points visible and some points fail the filter
- **THEN** the toolbar shows the number of passing points and the number of points outside the filter

#### Scenario: Filtered points hidden
- **WHEN** "Mostrar pontos filtrados" hides excluded points
- **THEN** the toolbar shows only the number of passing points

#### Scenario: Count within a selection
- **WHEN** an interval is selected on the timeline
- **THEN** the counts cover only that interval and the toolbar says they are within the time selection

### Requirement: The XY tab is described in the Datalog help
The Datalog help dialog SHALL have a section describing the XY tab: choosing X and the Y signals, the
shared filter and "Mostrar pontos filtrados", the timeline selection and cursor, the mean, maximum and
minimum lines, and removing Y signals.

#### Scenario: Reading the help
- **WHEN** the user opens the help dialog from the Datalog header
- **THEN** a section about the XY tab is present, covering the points above

### Requirement: Large logs stay responsive
The chart SHALL remain usable with logs of tens of thousands of rows, drawing every qualifying point
without sampling or dropping any.

#### Scenario: Two-hour log
- **WHEN** the active logs total about 72 thousand rows and the user changes the X signal or adds a Y
  signal
- **THEN** the chart updates without freezing the interface and no qualifying point is omitted from
  the series

### Requirement: Empty states
When the Y list is empty, the chart area SHALL show a message asking the user to add a signal to the Y
axis instead of a chart. When no row has numeric values for the X signal and any Y signal under the
current filter and selection, the chart area SHALL show a message that there is no data for the current
filters instead of an empty chart.

#### Scenario: Empty Y list
- **WHEN** the Y list is empty
- **THEN** the tab shows the message asking to add a Y signal, not the no-data message

#### Scenario: Filter excludes everything
- **WHEN** the applied filter and filtered points hidden leave no point to draw
- **THEN** the tab shows the no-data message

### Requirement: Signal choice persists
The chosen X signal, the list of Y signals (in order) and the "Linha média", "Linha máxima" and "Linha
mínima" checkboxes SHALL persist across reloads. A saved choice that is missing or unreadable SHALL
fall back to X = RPM, Y = MAP and all three lines off, without an error; a saved Y list that is
empty is a valid choice and SHALL be restored as empty. A saved signal that is not available in the
current active logs SHALL be left out of the chart without being deleted from the saved choice, and
SHALL reappear when the signal is available again; when none of the saved Y signals is available, the
Y list shown is empty. A saved X signal that is not available
SHALL likewise be replaced on screen by RPM without being deleted from the saved choice.

#### Scenario: Reload
- **WHEN** the user chooses X = MAP and Y = Lambda 1 and Inj. Pulse, and reloads the page
- **THEN** the XY tab shows the same X and the same Y series in the same order

#### Scenario: Empty Y list persisted
- **WHEN** the user removes every Y signal and reloads the page
- **THEN** the Y list is still empty and the tab shows the message asking to add a Y signal, not the
  default MAP

#### Scenario: Saved choice unreadable
- **WHEN** the stored XY choice cannot be read
- **THEN** the tab uses RPM on X and MAP on Y and shows no error

#### Scenario: Saved signal not in the active logs
- **WHEN** the saved Y list holds Marcha and the active logs have no Marcha column
- **THEN** the Marcha series is not drawn, the other saved series are, and Marcha returns when a log
  with that signal is active again

#### Scenario: Saved X signal not in the active logs
- **WHEN** the saved X signal is Marcha and the active logs have no Marcha column
- **THEN** the chart uses RPM on the X axis, and Marcha is X again when a log with that signal is
  active
