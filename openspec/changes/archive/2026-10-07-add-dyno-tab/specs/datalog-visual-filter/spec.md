## MODIFIED Requirements

### Requirement: Visual filter button next to the help button
The Datalog screen SHALL show a "Filtro visual" button in the top-right of the tab bar, immediately
beside the "?" help button, that opens the visual filter modal, on every Datalog tab except
Dinamômetro, where it SHALL be hidden because the visual filter has no effect there.

#### Scenario: Opening the modal
- **WHEN** the user activates the "Filtro visual" button
- **THEN** a modal opens listing the available ranges, and it can be dismissed with Escape or by
  closing it without applying

#### Scenario: Button reflects an active filter
- **WHEN** a visual filter is active
- **THEN** the button is visibly highlighted (distinct from its idle style), on every Datalog tab
  where it is shown

#### Scenario: Button idle
- **WHEN** no visual filter is active
- **THEN** the button renders in its idle style

#### Scenario: Dinamômetro tab
- **WHEN** the user opens the Dinamômetro tab
- **THEN** the "Filtro visual" button is not shown while the "?" help button remains

#### Scenario: Leaving the Dinamômetro tab
- **WHEN** a visual filter was active before the user visited the Dinamômetro tab and the user goes
  back to another Datalog tab
- **THEN** the button is shown again, still highlighted, and the filter is still applied
