## MODIFIED Requirements

### Requirement: Sparkline previews a chosen signal
The timeline SHALL render, behind the rail, a preview chart of one signal across the whole active
timeline, selectable by the user and defaulting to RPM. The preview SHALL be clearly visible, SHALL
keep short peaks and dips visible regardless of log length, SHALL leave a gap where the signal has
no value (instead of drawing zero), and SHALL show the signal's value at the cursor and the minimum
and maximum of its scale.

#### Scenario: Preview is shown
- **WHEN** at least one log is active
- **THEN** the rail shows the preview chart of the selected signal from the first render, aligned
  with the timeline's time axis

#### Scenario: Changing the sparkline signal
- **WHEN** the user picks a different signal from the sparkline selector
- **THEN** the rail's preview redraws using that signal's values across the timeline, with the new
  signal's minimum and maximum

#### Scenario: Short transients on long logs
- **WHEN** the active logs contain far more points than the preview can draw and the signal has a
  short spike or dip
- **THEN** the spike or dip is still visible in the preview

#### Scenario: Missing values
- **WHEN** the selected signal has no value over some stretch of the timeline
- **THEN** the preview shows a gap there instead of a line at zero

#### Scenario: Value at the cursor
- **WHEN** the cursor is on the timeline
- **THEN** the preview marks the selected signal's value at that instant and shows it formatted as
  in the rest of the app, following the cursor as it moves
