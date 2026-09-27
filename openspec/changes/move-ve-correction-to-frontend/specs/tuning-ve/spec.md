## REMOVED Requirements

### Requirement: Auto-tuning availability depends on log data
**Reason**: Superseded by `tuning-ve-correction`'s own requirement for when "Gerar fator de
correção" is available and what point set it uses.
**Migration**: See `tuning-ve-correction`.

### Requirement: Running auto-tuning
**Reason**: The backend engine this delegated to is removed. Correction is now computed
client-side by an explicit "Gerar fator de correção" action with no backend round-trip, so there
is no confirmation-before-overwrite or backend-failure mode.
**Migration**: See `tuning-ve-correction`'s "Apply corrections to map" action.

### Requirement: Auto-tuning analysis heatmaps
**Reason**: These diagnostic views (confidence, CV, convergence, etc.) came from the removed
backend pipeline's internals (outlier rejection, anchored smoothing field, convergence tracking),
none of which the client-side algorithm performs.
**Migration**: See `tuning-ve-correction`'s heatmap, which shows sample count and correction value
(direct or weighted) instead.

### Requirement: Post-processing warnings panel
**Reason**: Monotonicity and gradient warnings were produced by the removed backend pipeline's
post-processing step, which the client-side algorithm does not perform.
**Migration**: None — no equivalent exists in the client-side design.

### Requirement: Filter-statistics panel
**Reason**: Superseded — the correction filters now apply live across the Dashboard, Charts, and
Data tabs (see `tuning-ve-correction`), so the user inspects the qualifying dataset directly in
those views instead of a dedicated discard-reason panel.
**Migration**: See `tuning-ve-correction` and the Dashboard/Charts/Data tab deltas.

### Requirement: Config access point
**Reason**: Opened the `tuning-config` modal, which is removed along with the backend engine
schema it rendered.
**Migration**: The client-side algorithm has one fixed constant (no config surface) and a filter
panel that lives inline on the Logs tab (see `tuning-ve-correction`), not a separate modal.

## MODIFIED Requirements

### Requirement: Three-section layout
The VE tab SHALL present a read-only original map, an editable map, and a correction section that
only appears once a correction snapshot has been generated (see `tuning-ve-correction`).

#### Scenario: Before running auto-tuning
- **WHEN** the user opens the VE tab and no correction snapshot has been generated in this session
- **THEN** only the original (collapsible, read-only) and editable map sections are shown

#### Scenario: After running auto-tuning
- **WHEN** a correction snapshot has been generated at least once (see `tuning-ve-correction`'s
  "Gerar fator de correção" action)
- **THEN** the correction section becomes visible below the editable map

#### Scenario: Original map collapse state persists
- **WHEN** the user collapses or expands the original map section
- **THEN** that collapsed/expanded state is remembered across the session (see
  `session-persistence`)

### Requirement: Log-point overlay on the editable map
When logs and a time selection define an analysis window, the editable map's chart SHALL overlay
the actual datalog points as a scatter, and cells the correction snapshot (see
`tuning-ve-correction`) flags as having no data SHALL be visually flagged as uncorrectable.

#### Scenario: Points plotted at their real coordinates
- **WHEN** logs and a time window are available
- **THEN** each datalog point is plotted at its real RPM/MAP position, with visual density
  indicating how many points fall near that position

#### Scenario: Cell with zero log points
- **WHEN** a cell has no datalog points in the current window
- **THEN** the editable map flags that cell as having no correction data available
