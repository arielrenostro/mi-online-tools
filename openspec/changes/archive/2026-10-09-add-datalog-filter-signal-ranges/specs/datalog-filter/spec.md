## MODIFIED Requirements

### Requirement: Switchable criteria combined with AND
The modal SHALL offer these criteria, each with its own enable switch, and a point SHALL pass the
filter if and only if it satisfies every enabled criterion (AND; disabled criteria are ignored even if
their fields hold values):

- a range with optional minimum and maximum, inclusive of both bounds, for each of MAP, RPM, Lambda 1,
  Lambda Corr, Pedal, CLT, IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost;
- the accepted Lambda Loop states (open, closed, closed with auto-correção);
- the maximum TPS delta and the maximum MAP delta (amplitudes defined by `mapa-ve-correction`);
- the maximum absolute difference between Lambda 1 and Lambda Target;
- skip the first N points after entering closed loop, skip the first N points after entering open
  loop, skip the N points before entering closed loop, and skip the N points before entering open
  loop (all four defined by `mapa-ve-correction`).

A point whose value for an enabled range's signal, or whose Lambda Loop value, is not a number SHALL
fail that criterion. This includes the optional signals (Batt Volt., Inj. DT, Inj. Pulse) when a log
has no such column.

#### Scenario: Ranges follow the Gráficos signal order
- **WHEN** the user opens the filter modal
- **THEN** the "Faixas" section lists the ranges in the same order as the signals in the Gráficos
  sidebar: RPM, MAP, Boost, Pedal, Lambda 1, Lambda Target, Lambda Corr, Inj. Pulse, Inj. DT,
  Inj. Utiliz., CLT, IAT, Batt Volt.

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

#### Scenario: Range on an injector or electrical signal
- **WHEN** the user enables the Batt Volt. range with minimum 12 and maximum 15
- **THEN** a point passes that criterion only if its battery voltage, in volts, is between 12 and 15
  inclusive

#### Scenario: Range on a signal the log does not have
- **WHEN** the Inj. DT range is enabled and a log has no Inj. DT column
- **THEN** every point of that log fails the filter

#### Scenario: Boost and Lambda Target ranges
- **WHEN** the user enables a Boost maximum of 150 and a Lambda Target minimum of 0.8
- **THEN** a point passes only if its boost is at most 150 kPa and its Lambda Target is at least 0.8 λ

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
loop and skip 10 after entering open loop; and disabled: the MAP, RPM, Pedal and Lambda Corr ranges,
the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges, and the skips of
points before entering closed loop (count 5) and before entering open loop (count 10). The MAP, RPM,
Pedal, Lambda Corr, IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges
SHALL have empty minimum and maximum (no default value).

#### Scenario: First use
- **WHEN** the app starts with no saved filter
- **THEN** the applied filter is the default above

#### Scenario: "Before" skips off by default
- **WHEN** the filter is the default
- **THEN** no point is excluded for preceding a Lambda Loop transition

#### Scenario: New ranges are off and empty by default
- **WHEN** the filter is the default and the user opens the modal
- **THEN** the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost ranges are each
  unchecked, with empty "mín" and "máx" fields, and the "Filtro" button count is unchanged by them

## ADDED Requirements

### Requirement: Filters saved before the new ranges existed still load
A filter saved without the IAT, Batt Volt., Inj. DT, Inj. Utiliz., Inj. Pulse, Lambda Target and Boost
ranges (an older session, or a correction run's recipe) SHALL be read with those ranges disabled and
empty, and every other saved criterion SHALL keep its saved value. A saved filter that includes them
SHALL restore their enable state and bounds.

#### Scenario: Reload with an old saved filter
- **WHEN** the app restores a saved filter that has none of the seven new ranges
- **THEN** the applied filter equals the saved one with the seven ranges disabled and empty, so the same
  points pass as before the upgrade

#### Scenario: Reload with new ranges applied
- **WHEN** the user applies an enabled Boost range with a minimum and reloads the page
- **THEN** the Boost range is restored enabled with the same minimum

#### Scenario: Run recipe from an older run
- **WHEN** a correction run saved before this change is shown
- **THEN** its recipe chips list the criteria it did store, none for the new ranges, and nothing fails to render

#### Scenario: Run recipe lists an enabled new range
- **WHEN** a run is generated with the Inj. Utiliz. range enabled with a maximum of 85
- **THEN** its recipe shows a chip for that range with the limit
