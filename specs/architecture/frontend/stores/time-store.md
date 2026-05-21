# Store: `useTimeStore`

Gerencia a navegação temporal: cursor pontual, seleção de intervalo e sinal da sparkline.

**Arquivo:** `src/store/timeStore.ts`

## Estado

```typescript
interface TimeState {
  cursor_ms:       number | null      // instante atual (ms rel. ao início do 1º log ativo); null=sem cursor
  selection:       TimeSelection | null  // zoom dos gráficos + intervalo de análise; null = visão completa
  sparklineSensor: string             // sinal da sparkline; deve existir nos logs ativos. Default "RPM"
}

interface TimeActions {
  setCursor(ms: number | null): void
  setSelection(start: number, end: number): void
  clearSelection(): void
  setSparklineSensor(signal: string): void
  /** Chamado pelo logStore quando a duração total muda; ajusta cursor/selection ao novo range. */
  onTotalDurationChanged(newTotal_ms: number): void
  hydrate(data: { cursor_ms; selection; sparklineSensor }): void  // sessionRestorer
}
```

Valores iniciais: `cursor_ms: null`, `selection: null`, `sparklineSensor: 'RPM'`.

## Regras das actions

- **`setCursor`** — clampa `ms` a `[0, totalDuration]`; `null` limpa o cursor. Persiste.
- **`setSelection`** — clampa `start`/`end` a `[0, totalDuration]`; rejeita (warning, no-op) se `start >= end` após o clamp. Persiste.
- **`clearSelection`** — `selection = null`. Persiste.
- **`setSparklineSensor`** — rejeita (warning, no-op) se o sinal não está em `selectAllSignals`. Persiste.
- **`hydrate`** — aplica os valores **sem validar** contra o range (o range pode não estar disponível no restore; o ajuste vem depois via `onTotalDurationChanged`).

Toda action de mutação persiste em `miot:time`.

## `onTotalDurationChanged(newTotal_ms)`

Reconciliação do estado quando a duração total muda (toggle/remoção de log):

```
cursor_ms !== null:
  newTotal === 0          → cursor_ms = null
  cursor_ms > newTotal    → cursor_ms = newTotal (clampa)
selection !== null:
  newTotal === 0 ou start >= newTotal  → selection = null (inteiramente fora)
  end > newTotal                       → end = newTotal (parcialmente fora)
    se após o ajuste start >= end      → selection = null
sparklineSensor não está mais disponível → volta ao primeiro sinal disponível (ou 'RPM')
```

Caso prático: 3 logs (30 min), seleção [10min, 25min]; remove o 2º log → novo total 20 min → seleção vira [10min, 20min].

## Persistência (`miot:time`)

`cursor_ms` e `selection` persistem porque fazem parte do fluxo iterativo de tuning (o usuário identifica um trecho, fecha o browser e retoma com a mesma seleção). `sparklineSensor` é uma preferência de visualização.

```json
{ "cursor_ms": 253512, "selection": { "start_ms": 145000, "end_ms": 872000 }, "sparklineSensor": "RPM" }
```

## Consumo

`TimeRailContainer` lê os stores, monta os props do `TimeRail` (mapeando `activeLogs`, `totalDuration`, `availableSensors` do `useLogStore`) e liga as actions. `onSelectionChange(sel)` → `setSelection` ou `clearSelection` conforme `sel` seja objeto ou `null`.

## Sincronização com outros componentes

- **`SyncedChart`** — bidirecional via `selection` (zoom dos gráficos = intervalo de análise): `datazoom` do ECharts → `setSelection`/`clearSelection`; CTRL+drag → `setSelection`; mudança de `selection` → `dispatchAction({ type: 'dataZoom' })`. Ver [components/synced-chart.md](../components/synced-chart.md).
- **`HeatmapTable` (aba Dados)** — destaca a linha mais próxima de `cursor_ms` e filtra por `selection`.
- **`runTuning`** — usa `selection` como `timeRange` do `TuningRunRequest` (`null` = todos os pontos).
