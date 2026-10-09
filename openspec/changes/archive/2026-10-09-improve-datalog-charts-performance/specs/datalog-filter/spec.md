## ADDED Requirements

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
