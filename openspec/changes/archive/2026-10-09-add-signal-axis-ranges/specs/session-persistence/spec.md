## ADDED Requirements

### Requirement: Signal ranges persist across reloads
The ranges the user edited in the Faixa dos sinais section of the Configurações screen (see
`app-settings`) SHALL be restored after a reload, before any chart that uses them is drawn. Only
ranges that differ from the default need to be kept; a signal with no saved range, or whose saved
range is unreadable or invalid (not finite numbers, or minimum not below maximum), SHALL use its
default range, signal by signal and without showing an error. Restoring signal ranges SHALL NOT
invalidate or alter any correction run.

#### Scenario: Restoring edited ranges
- **WHEN** the user reloads after changing the range of MAP and Lambda 1 on the Configurações screen
- **THEN** the Configurações screen shows the same ranges and the Gráficos and XY charts use them

#### Scenario: Saved range invalid or missing
- **WHEN** the stored ranges are absent, unreadable, or hold an invalid range for one signal
- **THEN** that signal (or all, if nothing is readable) uses its default range, the other valid saved
  ranges are kept, and no error is shown

#### Scenario: Unknown signal in the stored ranges
- **WHEN** the stored ranges mention a signal that does not exist in the app
- **THEN** that entry is ignored
