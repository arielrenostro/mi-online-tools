## MODIFIED Requirements

### Requirement: Route structure and index redirects
The Mapa and Datalog sections SHALL each redirect their index route to the tab the user was last on
in that section (or to a default sub-route when there is none), and the global TopBar SHALL remain
visible across every route.

#### Scenario: Visiting the Mapa index
- **WHEN** the user navigates to `/mapa` and has not opened any Mapa tab before
- **THEN** the app redirects to `/mapa/ve`

#### Scenario: Visiting the Datalog index
- **WHEN** the user navigates to `/datalog` and has not opened any Datalog tab before
- **THEN** the app redirects to `/datalog/logs`

#### Scenario: Returning to a section reopens the tab last used there
- **WHEN** the user was on a Datalog tab (for example XY), moved to Mapa or Home, and activates the
  TopBar's Datalog entry
- **THEN** the app opens `/datalog/xy`, and likewise the TopBar's Mapa entry reopens the Mapa tab
  last used

#### Scenario: Legacy Tuning URLs
- **WHEN** the user opens a route under the former `#/tuning` prefix (for example `#/tuning/ve`)
- **THEN** the app redirects to `#/mapa`, which in turn redirects to the Mapa tab last used (by
  default `#/mapa/ve`)
