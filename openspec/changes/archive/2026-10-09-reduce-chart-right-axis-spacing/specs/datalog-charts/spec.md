## ADDED Requirements

### Requirement: Right-side Y axes are compactly spaced
When a panel shows more than two signals, the Y axes stacked on the right side of the plot SHALL sit
close to one another, separated by no more than what their tick labels need to stay legible, and
the plot area SHALL use the width this frees. Tick labels of adjacent axes SHALL NOT overlap each
other or the plotted series. The spacing SHALL NOT depend on the signals' ranges, the zoom, the
time selection or the filter.

#### Scenario: Panel with three or more signals
- **WHEN** a panel shows three or more signals, so that two or more Y axes are on the right
- **THEN** the right-side axes are placed next to each other with only a small gap between one
  axis's labels and the next axis's line, and every tick label is fully readable

#### Scenario: Panel with two signals
- **WHEN** a panel shows two signals
- **THEN** the second signal's axis sits on the right edge of the plot with no extra space reserved
  for further axes

#### Scenario: Wide tick labels
- **WHEN** a right-side axis has long tick labels (for example a range up to 10000)
- **THEN** its labels do not overlap the neighbouring axis's labels or line

#### Scenario: Spacing follows the label width
- **WHEN** a panel's right-side axes have short labels (for example `1.3` or `30`)
- **THEN** each axis takes only about the width of its own labels, so axes with shorter labels sit
  closer together than axes with longer ones, and the space between the last axis's labels and the
  chart's right edge is just a small gap

#### Scenario: Adding or removing signals
- **WHEN** the user adds or removes a signal in a panel
- **THEN** the right margin of the plot grows or shrinks by the width of the added or removed
  axis, and the remaining axes keep the same compact spacing

### Requirement: Plot areas line up across panels
The left and right margins of every chart panel's plot area SHALL be the same in all panels: the
largest margin any panel needs on each side, so that a panel with a single signal leaves the same
space on its right as the panel with the most right-side axes. The left margin SHALL fit the labels
of the first signal's axis with no extra fixed padding. Plot areas of panels in the same column
SHALL therefore start and end at the same horizontal positions, keeping the time axis and the cursor
aligned from one panel to the next.

#### Scenario: Panels with different numbers of signals
- **WHEN** one panel shows three signals (two right-side axes) and another shows one
- **THEN** both plot areas span the same horizontal range, and the single-signal panel keeps empty
  space on its right equal to the other panel's axes

#### Scenario: Left margin fits the labels
- **WHEN** a panel's first signal has short labels (for example `100`)
- **THEN** the space to the left of the plot is just what those labels and the axis need, with no
  extra fixed margin

#### Scenario: A panel's signals change the common margin
- **WHEN** the user adds a signal that makes some panel need a wider margin than any other, or
  removes the one that did
- **THEN** every panel's plot area adopts the new common margin, and with it the time selection,
  cursor and each panel's signals are unchanged

#### Scenario: Signal range edited
- **WHEN** the user edits a signal's range in Configurações so that its labels become wider or narrower
- **THEN** the common margins are recomputed from the new ranges when the charts are redrawn
