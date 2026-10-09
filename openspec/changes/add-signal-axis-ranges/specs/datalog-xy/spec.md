## MODIFIED Requirements

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
