## REMOVED Requirements

### Requirement: Three-section layout
**Reason**: The correction section is no longer hidden until a snapshot exists; it is always present
and the layout is described by a renamed requirement.
**Migration**: See "Correction section is always present" below.

## ADDED Requirements

### Requirement: Correction section is always present
The VE tab SHALL present a read-only original map, an editable map, and a correction section, in that
order. The correction section SHALL always be present; before any correction run exists it SHALL show
an explanatory message instead of the correction tables (see `correction-runs`).

#### Scenario: No correction run yet
- **WHEN** the user opens the VE tab and no correction run exists
- **THEN** the correction section is shown below the editable map with a text explaining that the
  correction is generated from the datalogs, using the "Gerar Correção" button on the Datalog
  screen, and offering a link to the Datalog screen that navigates only when activated

#### Scenario: After generating a run
- **WHEN** at least one correction run exists
- **THEN** the correction section shows the run selector and the three correction tables below the
  editable map, as defined by `correction-runs` and `tuning-ve-correction`

#### Scenario: Original map collapse state persists
- **WHEN** the user collapses or expands the original map section
- **THEN** that collapsed/expanded state is remembered across the session (see
  `session-persistence`)
