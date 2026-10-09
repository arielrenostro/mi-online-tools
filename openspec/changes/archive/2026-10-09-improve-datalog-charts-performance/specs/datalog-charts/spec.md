## ADDED Requirements

### Requirement: Panels stay responsive on large logs without losing resolution
Chart panels SHALL remain responsive when the active logs together contain tens of thousands of
points, across signal changes, zooming, panning, and returning to the Gráficos tab from another
Datalog tab or from another section (Mapa, Configurações, Home), without reducing the data resolution shown at the current zoom level (no aggregation
or downsampling that merges multiple raw points into one). The time axis SHALL keep spanning the
whole active log regardless of how much of it is currently drawn.

#### Scenario: Adding or removing a signal on a large log
- **WHEN** the user adds or removes a signal from a panel while the active logs total tens of
  thousands of points
- **THEN** the panel updates without freezing the UI, and every point within the panel's current
  zoom range renders individually

#### Scenario: Zooming or panning a large log
- **WHEN** the user zooms or pans within a chart panel on a large log
- **THEN** the redraw stays smooth and every point within the newly visible range is still
  rendered individually, at the same resolution as before the interaction

#### Scenario: Panning far from the original view
- **WHEN** the user pans or zooms to a stretch of the log far from the one that was drawn before
- **THEN** that stretch shows its points at full resolution once the interaction settles, and the
  shared selection holds the visible range

#### Scenario: Time axis spans the whole log
- **WHEN** a selection is active on a large log
- **THEN** the panels show the selected range zoomed in, and zooming out or clearing the selection
  shows the whole log on the same time axis

#### Scenario: Returning to the Gráficos tab
- **WHEN** the user switches from the Gráficos tab to another Datalog tab, or leaves Datalog for
  another section such as Mapa, and then comes back to it
- **THEN** the charts reappear without repeating the one-time cost of processing the entire active
  log set from scratch, and they reflect any filter, constants or selection change made meanwhile

#### Scenario: A hidden Gráficos tab does no work
- **WHEN** the user is on another Datalog tab or another section and changes the filter, the constants or the timeline
  selection
- **THEN** the charts are not redrawn while they are out of sight (no loading modal is shown for
  them), and the changes are applied once when the user returns to Gráficos

#### Scenario: Filtered-point dimming survives zooming
- **WHEN** a filter is applied (see `datalog-filter`) and the user zooms or pans a panel showing
  dimmed (filtered-out) stretches
- **THEN** every point keeps showing its own pass/fail state with no blending across a run
  boundary, at any zoom level

#### Scenario: The interface keeps responding while several panels redraw
- **WHEN** several panels redraw at once on a large log (for example after a filter is applied)
- **THEN** they redraw one after another, the interface handles the user's input and paints
  between them, and a click made meanwhile takes effect at once instead of being held until every
  panel has finished

#### Scenario: Input is blocked while a heavy redraw runs
- **WHEN** a heavy redraw (as above) is in progress on a large log
- **THEN** a modal "Carregando…" covers the whole screen with no way to dismiss it, mouse and
  keyboard input is blocked, and it disappears by itself when every redraw is finished, so nothing
  the user does meanwhile is queued and executed afterwards

#### Scenario: Small logs are not interrupted
- **WHEN** the active logs are small enough for the redraw to be instantaneous
- **THEN** no blocking modal is shown

#### Scenario: Heavy redraws show a loading indicator
- **WHEN** a change makes a panel redraw so much data that it takes noticeable time (a new
  selection, a signal or filter change, a layout change, or opening the Gráficos tab on a large log)
- **THEN** the panel shows a "Carregando…" indicator over its previous content (or empty, when it
  has none yet) before the redraw starts, and removes it when the redraw is done, instead of the
  screen freezing without feedback
