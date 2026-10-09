## REMOVED Requirements

### Requirement: Visual filter button next to the help button
**Reason**: The visual filter and the VE correction filters are unified into a single filter.
**Migration**: See `datalog-filter` ("Filter button in the Datalog header").

### Requirement: Selectable optional ranges
**Reason**: Absorbed by the unified filter, whose criteria include the same MAP, RPM, Lambda 1,
Lambda Corr and Pedal ranges (plus CLT).
**Migration**: See `datalog-filter` ("Switchable criteria combined with AND").

### Requirement: Lambda Loop state selection
**Reason**: Absorbed by the unified filter.
**Migration**: See `datalog-filter` ("Switchable criteria combined with AND").

### Requirement: Applied visual filter replaces the highlight mask
**Reason**: There is no longer a separate highlight-only mask; one filter drives both the highlight
and the correction run.
**Migration**: See `datalog-filter` ("One mask for highlighting and for correction runs").

### Requirement: Existing visibility toggle applies to the visual filter
**Reason**: The visibility toggle now belongs to the single filter.
**Migration**: See `datalog-filter` ('"Mostrar pontos filtrados" in the filter modal').

### Requirement: Clearing restores the correction filters
**Reason**: There is no second filter to fall back to.
**Migration**: See `datalog-filter` ("Restore the default filter").

### Requirement: Visual filter never affects the correction factor
**Reason**: Intentionally reversed: the filter that highlights points is the one that selects the
points of a correction run, so that what is highlighted is what is used.
**Migration**: See `datalog-filter` ("One mask for highlighting and for correction runs") and
`correction-runs`.

### Requirement: Visual filter is session-only
**Reason**: The unified filter is an input of correction runs and persists across reloads.
**Migration**: See `datalog-filter` ("The applied filter and the toggle persist").
