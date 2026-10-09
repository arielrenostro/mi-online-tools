## MODIFIED Requirements

### Requirement: Entry cards reflect prerequisite state
The Home screen SHALL present a Mapa card and a Datalog card, each enabled only when its
prerequisite data has been imported.

#### Scenario: No map and no logs imported
- **WHEN** the user opens the Home screen with no map imported and no logs active
- **THEN** both the Mapa and Datalog cards are shown disabled, each displaying its unmet
  requirement ("map imported" / "1+ logs imported")

#### Scenario: Map imported, no logs
- **WHEN** a map has been imported and no logs are active
- **THEN** the Mapa card is enabled and displays a checkmark with the map's filename; the
  Datalog card remains disabled

#### Scenario: Logs imported, no map
- **WHEN** one or more logs are active and no map has been imported
- **THEN** the Datalog card is enabled and displays a checkmark with the log count and total
  duration; the Mapa card remains disabled

#### Scenario: Both imported
- **WHEN** a map has been imported and one or more logs are active
- **THEN** both cards are enabled

### Requirement: Card navigation is gated
Each entry card SHALL navigate to its screen only when it is enabled.

#### Scenario: Clicking an enabled card
- **WHEN** the user clicks an enabled Mapa or Datalog card
- **THEN** the app navigates to `/mapa` or `/datalog` respectively

#### Scenario: Clicking a disabled card
- **WHEN** the user clicks a disabled card
- **THEN** the app does not navigate, and the unmet requirement remains visible

### Requirement: Reload always returns to Home
Reloading the browser SHALL always render the Home screen, regardless of which screen was active
before the reload, while the underlying session state (imported map/logs) is restored
independently.

#### Scenario: Reload while on Mapa or Datalog
- **WHEN** the user reloads the browser while on `/mapa` or `/datalog`
- **THEN** the app renders the Home screen, and the entry cards reflect the restored map/logs
  once session restore completes
