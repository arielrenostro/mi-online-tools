## Why

Cada sinal tem hoje uma faixa fixa (`min`/`max` em `SIGNAL_DEFS`/`RUNTIME_SIGNAL_DEFS`) que define o
eixo Y nos gráficos, e o usuário não consegue mudá-la. Quando um sinal sai da faixa (ex.: MAP de uma
moto turbo acima de 250 kPa, Potência acima de 300 cv, ou um log que só vive entre 0,9 e 1,1 de
Lambda e fica achatado num eixo 0,7–1,3) a curva é cortada ou fica ilegível. A tela Configurações já
é o lugar das constantes que o usuário ajusta; a faixa dos sinais deve morar lá também.

## What Changes

- Nova seção **"Faixa dos sinais"** na tela Configurações, com um campo **mínimo** e um **máximo**
  para **todos** os sinais exibíveis (os lidos do CSV, os derivados do parse e os de runtime:
  VE Lambda Corrigido, Potência, Torque), na ordem de exibição agrupada, com a unidade de cada um.
- Os valores iniciais são as faixas padrão atuais; o usuário pode sobrescrever cada sinal e há um
  controle para restaurar a faixa de um sinal e outro para restaurar todas.
- A faixa configurada passa a ser o eixo desse sinal nos gráficos que hoje usam a faixa fixa:
  **Gráficos** (eixo Y de cada série) e **XY** (eixo X e eixos Y). Edição vale imediatamente, sem
  botão de aplicar, e sobrevive a reload.
- Validação: mínimo e máximo devem ser números finitos com mínimo < máximo; valor inválido é
  sinalizado e a última faixa válida continua em uso (mesmo padrão dos campos de Constantes).
- A faixa **não** altera os dados, o filtro, os runs de correção nem os valores exibidos nos cartões
  e na tabela — só o enquadramento dos eixos.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `app-settings`: nova seção "Faixa dos sinais" na tela Configurações (campos, restaurar, validação).
- `datalog-charts`: o eixo Y de cada série passa a usar a faixa configurada do sinal.
- `datalog-xy`: eixos X e Y passam a usar a faixa configurada do sinal.
- `session-persistence`: a faixa dos sinais sobrevive a reload (ausente/inválida cai no padrão).

## Impact

- Código (frontend, só cliente): novo `store/signalRangesStore.ts` (somente sobrescritas, persistido em
  `localStorage` como `miot:signal-ranges`); novo `features/settings/SignalRangesPanel.tsx` em
  `pages/SettingsPage.tsx`; `components/SyncedChart.tsx` (`buildOption`), `components/XYChart.tsx`
  (`buildXYOption`/`xRange`) e `persistence/sessionRestorer.ts` (hidratação).
- Sem mudança em parsers, dados persistidos, runs de correção ou dependências.
- Sobreposição de arquivos com a change em andamento `improve-datalog-charts-performance`
  (`SyncedChart.tsx`/`datalog-charts`): os deltas aqui são requisitos novos, sem alterar os dela;
  ao implementar, aplicar sobre o código já resultante dessa change.
- Fora de escopo: eixos do Dinamômetro (potência/torque próprios), sparkline da TimeRail (escala
  pelos dados do trecho) e o destaque de valor fora da faixa no Dashboard.
