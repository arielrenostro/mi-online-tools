## MODIFIED Requirements

### Requirement: Switchable criteria combined with AND
The modal SHALL offer these criteria, each with its own enable switch, and a point SHALL pass the
filter if and only if it satisfies every enabled criterion (AND; disabled criteria are ignored even if
their fields hold values):

- a range with optional minimum and maximum, inclusive of both bounds, for each of MAP, RPM, Lambda 1,
  Lambda Corr, Pedal and CLT;
- the accepted Lambda Loop states (open, closed, closed with auto-correção);
- the maximum TPS delta and the maximum MAP delta (amplitudes defined by `mapa-ve-correction`);
- the maximum absolute difference between Lambda 1 and Lambda Target;
- skip the first N points after entering closed loop, skip the first N points after entering open
  loop, skip the N points before entering closed loop, and skip the N points before entering open
  loop (all four defined by `mapa-ve-correction`).

A point whose value for an enabled range's signal, or whose Lambda Loop value, is not a number SHALL
fail that criterion.

#### Scenario: Enabling a subset of criteria
- **WHEN** the user enables only the MAP and RPM ranges and disables everything else
- **THEN** a point passes only if both its MAP and its RPM are inside their ranges

#### Scenario: Open-ended range
- **WHEN** an enabled range has only a minimum, or only a maximum, filled in
- **THEN** it constrains only the filled side

#### Scenario: Enabled range with both bounds empty
- **WHEN** an enabled range has neither bound filled in
- **THEN** it constrains nothing

#### Scenario: Disabled criterion keeps its values
- **WHEN** a criterion is disabled while its fields still hold values
- **THEN** it is ignored by the filter and the values are kept for when it is enabled again

#### Scenario: Fields are locked while the criterion is off
- **WHEN** a criterion's enable switch is unchecked
- **THEN** every field of that criterion (bounds, limit, count or accepted Lambda Loop states) is
  disabled and cannot be edited, and typing is not possible until the switch is checked again

#### Scenario: Enabling unlocks the fields
- **WHEN** the user checks the criterion's enable switch
- **THEN** its fields become editable, holding the values they had

#### Scenario: Value is not a number
- **WHEN** a point has no numeric value for the signal of an enabled range
- **THEN** that point fails the filter

#### Scenario: "Before" and "after" skips combine
- **WHEN** both the "before entering closed loop" and the "after entering closed loop" skips are
  enabled
- **THEN** a point fails if it falls in either window, and the window around each transition is
  excluded on both sides

#### Scenario: Invalid skip count
- **WHEN** an enabled skip criterion (before or after) has a count that is not an integer greater
  than or equal to zero
- **THEN** that criterion is shown as invalid and "Aplicar" is unavailable

### Requirement: Default filter
The default filter SHALL have enabled: Lambda Loop with closed and closed-with-auto-correção
accepted, CLT with minimum 85, Lambda 1 with minimum 0.6 and maximum 1.1, maximum TPS delta 5,
maximum MAP delta 5, maximum |Lambda 1 − Lambda Target| 0.03, skip 5 points after entering closed
loop and skip 10 after entering open loop; and disabled: the MAP, RPM, Pedal and Lambda Corr ranges
and the skips of points before entering closed loop (count 5) and before entering open loop
(count 10).

#### Scenario: First use
- **WHEN** the app starts with no saved filter
- **THEN** the applied filter is the default above

#### Scenario: "Before" skips off by default
- **WHEN** the filter is the default
- **THEN** no point is excluded for preceding a Lambda Loop transition

## ADDED Requirements

### Requirement: Loop-transition skips laid out as Antes / Depois pairs
The "Transições de Lambda Loop" section of the modal SHALL have one row per kind of transition —
Closed Loop and Open Loop — and each row SHALL show the "Antes" skip and the "Depois" skip side by
side on the same line, each with its own enable switch and its own point count. "Antes" is the skip of
points before entering that state; "Depois" is the skip of points after entering it.

#### Scenario: Two rows, two fields each
- **WHEN** the user opens the filter modal
- **THEN** the section shows a Closed Loop row and an Open Loop row, and in each one the "Antes" and
  "Depois" controls appear next to each other on the same line

#### Scenario: Antes and Depois are independent
- **WHEN** the user enables "Antes" and disables "Depois" on the Closed Loop row
- **THEN** only the "Antes" count is editable and applied, and the "Depois" count stays locked while
  keeping its value

### Requirement: Filters saved before the "before" skips existed still load
A filter saved without the "before" skip criteria (an older session, or a correction run's recipe)
SHALL be read with those two criteria disabled and at their default counts, and every other saved
criterion SHALL keep its saved value.

#### Scenario: Reload with an old saved filter
- **WHEN** the app restores a saved filter that has no "before" skip fields
- **THEN** the applied filter equals the saved one with both "before" skips disabled, so the same
  points pass as before the upgrade

#### Scenario: Run recipe from an older run
- **WHEN** a correction run saved before this change is shown
- **THEN** its recipe chips list the criteria it did store and none for the "before" skips
