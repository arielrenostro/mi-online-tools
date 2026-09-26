# navigation-guards Specification

## Purpose
Defines the app's route structure, the prerequisite guards that protect routes needing a map or
active logs, and the locked-tab pattern used for features not yet available in v1.

## Requirements

### Requirement: Route structure and index redirects
The Tuning and Datalog sections SHALL each redirect their index route to a default sub-route, and
the global TopBar SHALL remain visible across every route.

#### Scenario: Visiting the Tuning index
- **WHEN** the user navigates to `/tuning`
- **THEN** the app redirects to `/tuning/ve`

#### Scenario: Visiting the Datalog index
- **WHEN** the user navigates to `/datalog`
- **THEN** the app redirects to `/datalog/logs`

### Requirement: Map prerequisite guard
Every route under Tuning SHALL require a map to have been imported, redirecting to Home otherwise.

#### Scenario: Accessing Tuning without a map
- **WHEN** the user navigates to any `/tuning/*` route without a map imported
- **THEN** the app redirects to the Home screen

### Requirement: Active-log prerequisite guard
The Dashboard, Gráficos, and Dados routes SHALL each individually require at least one active log,
redirecting to the Logs tab otherwise; the Logs tab itself has no such requirement.

#### Scenario: Accessing Dashboard/Charts/Data with no active logs
- **WHEN** the user navigates to `/datalog/dashboard`, `/datalog/charts`, or `/datalog/data` with
  zero active logs
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Logs tab has no prerequisite
- **WHEN** the user navigates to `/datalog/logs` with no logs imported
- **THEN** the tab renders normally, acting as the entry point for importing logs

### Requirement: Guards wait for session restore before redirecting
A guard SHALL show a restoring indicator instead of evaluating its prerequisite while the session
is still being restored, to avoid redirecting away from data that is about to be restored.

#### Scenario: Reloading a guarded route
- **WHEN** the user reloads the browser on a guarded route while session restore is still in
  progress
- **THEN** the guard shows a restoring indicator instead of redirecting, then evaluates its
  prerequisite once restore completes

### Requirement: Locked-tab pattern
A tab representing a feature not available in the current version SHALL remain visible in
navigation, be non-interactive, and communicate that it is not yet available.

#### Scenario: Hovering a locked tab
- **WHEN** the user hovers a locked tab
- **THEN** a tooltip explains the feature is not yet available

#### Scenario: Clicking a locked tab
- **WHEN** the user clicks a locked tab
- **THEN** the URL does not change and no navigation occurs

#### Scenario: Direct URL access to a locked route
- **WHEN** the user navigates directly to a locked route's URL
- **THEN** the same locked/unavailable state is rendered as if reached through the tab

### Requirement: No automatic navigation
The app SHALL never change the current route on its own, except for the index redirects defined
above.

#### Scenario: Importing a map does not navigate
- **WHEN** the user imports a map while on the Home screen
- **THEN** the app stays on the Home screen; navigating to Tuning requires an explicit action

### Requirement: Global navigation affordances
The TopBar SHALL provide a way back to Home from any screen, and SHALL indicate the currently
imported map when one exists.

#### Scenario: Returning to Home
- **WHEN** the user activates the TopBar logo/name from any screen
- **THEN** the app navigates to the Home screen

#### Scenario: Map badge
- **WHEN** a map is currently imported
- **THEN** the TopBar shows its filename; when no map is imported, no badge is shown
