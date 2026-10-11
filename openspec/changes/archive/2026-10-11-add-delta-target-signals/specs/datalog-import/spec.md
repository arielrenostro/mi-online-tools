## ADDED Requirements

### Requirement: Boost target signal is named Boost Target
The signal that carries the target boost pressure SHALL be named "Boost Target" everywhere the app
names signals (Dashboard, Gráficos signal sidebar and picker, Dados columns and column menu, XY,
Configurações signal ranges). The datalog CSV column it is read from SHALL remain `Turbo Target`, with
the same conversion as before (integer, kPa); the name "Turbo Target" SHALL NOT be shown as a signal
name anywhere.

#### Scenario: Log with the Turbo Target column
- **WHEN** a log is imported whose CSV has a `Turbo Target` column with the raw value 150
- **THEN** the log has a "Boost Target" signal of 150 kPa and no signal named "Turbo Target"

#### Scenario: Signal lists
- **WHEN** the user opens the Dashboard, the Gráficos signal sidebar or the Dados column menu
- **THEN** the target boost pressure appears as "Boost Target"

### Requirement: Delta Lambda 1 Target signal
The app SHALL provide a derived "Delta Lambda 1 Target" signal, in λ, equal to Lambda 1 minus Lambda
Target for every row. A positive value means the measured mixture is leaner than the target and a
negative value that it is richer. It SHALL NOT depend on the constants of the Configurações screen,
and SHALL be shown with an explicit sign (for example `+0.012`).

#### Scenario: Lean of the target
- **WHEN** a row has Lambda 1 0.985 and Lambda Target 0.950
- **THEN** that row's Delta Lambda 1 Target is +0.035

#### Scenario: Rich of the target
- **WHEN** a row has Lambda 1 0.900 and Lambda Target 0.950
- **THEN** that row's Delta Lambda 1 Target is -0.050

#### Scenario: On target
- **WHEN** a row has Lambda 1 equal to Lambda Target
- **THEN** that row's Delta Lambda 1 Target is 0

### Requirement: Delta Boost Target signal
The app SHALL provide a derived "Delta Boost Target" signal, in kPa, equal to Boost minus Boost
Target for every row. A positive value means the measured boost is above the target and a negative
value that it is below. It SHALL NOT depend on the constants of the Configurações screen, and SHALL
be shown with an explicit sign (for example `+12 kPa`).

#### Scenario: Boost above the target
- **WHEN** a row has Boost 112 kPa and Boost Target 100 kPa
- **THEN** that row's Delta Boost Target is +12 kPa

#### Scenario: Boost below the target
- **WHEN** a row has Boost 80 kPa and Boost Target 100 kPa
- **THEN** that row's Delta Boost Target is -20 kPa

### Requirement: Target delta signals behave as regular signals
Delta Lambda 1 Target and Delta Boost Target SHALL be listed among every log's signals and be
selectable and displayed in Dashboard, Gráficos, Dados (including CSV export) and XY exactly like the
signals read from the CSV, and SHALL NOT show the "computed from the constants" hover. They SHALL NOT
be used by the applied filter nor by correction generation.

#### Scenario: Charting a delta
- **WHEN** the user adds Delta Lambda 1 Target to a chart panel
- **THEN** the series is drawn like any other signal, in λ, with a value axis that includes negative values

#### Scenario: Hovering a delta signal
- **WHEN** the user hovers Delta Boost Target in any signal list
- **THEN** no text about the constants in Configurações is shown

#### Scenario: Generating a correction run
- **WHEN** the user generates a correction run
- **THEN** the run is identical to the one generated before these signals existed

## MODIFIED Requirements

### Requirement: Related signals are listed together
Every place that lists the available signals — the Dashboard cards, the Gráficos signal sidebar and
signal picker, and the Dados columns and column menu — SHALL list them in one shared order in which
related signals are adjacent, regardless of the order in which the CSV columns appear or in which a
log was saved. The groups, in order, are:

1. RPM, MAP, Boost, Boost Target, Delta Boost Target
2. Pedal, dACC
3. Lambda 1, Lambda Target, Delta Lambda 1 Target, Lambda Corr, Lambda Loop
4. VE, VE Lambda, VE Lambda Corrigido
5. Inj. Pulse, Inj. DT, Inj. Efetivo, Inj. Utiliz.
6. Ign. Adv.
7. CLT, IAT
8. Batt Volt., ACP, Pressão Óleo
9. KM/H, Marcha
10. Potência, Torque

A signal that is not available (a log without its column, or a runtime signal without its inputs)
is simply absent from the list; the others keep their relative order. A signal not named above is
listed after all the named ones.

#### Scenario: VE signals are adjacent
- **WHEN** the user opens any signal list with VE, VE Lambda and VE Lambda Corrigido available
- **THEN** those three appear consecutively, in that order

#### Scenario: Target deltas sit beside what they compare
- **WHEN** the user opens any signal list of a log with all the signals
- **THEN** Delta Boost Target is listed right after Boost Target, and Delta Lambda 1 Target right after
  Lambda Target

#### Scenario: Runtime signals sit with their group
- **WHEN** the Constantes-derived signals are available
- **THEN** VE Lambda Corrigido is listed right after VE Lambda, and Potência and Torque are
  listed together after the other signals' groups, not mixed into them

#### Scenario: Log saved before the grouped order existed
- **WHEN** a log restored from a previous session had its signals stored in a different order
- **THEN** the lists still show the grouped order

#### Scenario: Missing signal does not break its group
- **WHEN** a log has no Inj. DT column
- **THEN** the injection group shows Inj. Pulse and Inj. Utiliz. adjacent, with no gap or placeholder
