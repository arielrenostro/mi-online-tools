## ADDED Requirements

### Requirement: Generating a run does not freeze the dialog
Generating a run walks every qualifying point, which takes noticeable time on a large log. The
generation dialog SHALL close immediately when the user confirms, and a visible "working" indicator
SHALL be shown until the run is generated (and its confirmation toast appears).

#### Scenario: Confirming generation on a large log
- **WHEN** the user confirms "Gerar Correção" on a large log
- **THEN** the dialog closes right away, an indicator such as "Gerando correção…" is shown, and the
  usual "Run … gerado" toast appears when the run is ready
