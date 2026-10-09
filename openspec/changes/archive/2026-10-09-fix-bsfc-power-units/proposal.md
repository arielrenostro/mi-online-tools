## Why

A Potência é calculada como `combustível [lb/h] ÷ BSFC`, então sai na unidade do denominador do BSFC. O
campo está rotulado `lb/cv·h`, mas os valores de BSFC de referência (incluindo o padrão 0,8) usam a
convenção `lb/hp·h`. Nesse caso o resultado é em hp (745,7 W) exibido como cv (735,5 W) e o torque usa a
constante do cv (716,2): potência e torque saem ~1,4% abaixo do real.

## What Changes

- O BSFC passa a ser declarado em **lb/hp·h** (rótulo na tela e na spec); o padrão continua 0,8.
- A potência calculada em hp é convertida para cv (× 745,7 ÷ 735,5) antes de ser exposta; o torque
  continua `Potência [cv] × 716,2 ÷ RPM`.
- Para o mesmo BSFC, Potência e Torque sobem ~1,39%. O cenário de referência da spec muda de
  9,98 cv / 2,78 kgf·m para ~10,11 cv / ~2,82 kgf·m.
- O valor de BSFC já salvo em `miot:constants` não é migrado: o número é o mesmo, só muda a unidade em
  que é lido (**BREAKING** para quem calibrou o BSFC como lb/cv·h: deve multiplicar o valor por 1,0139 para manter os mesmos resultados).

## Capabilities

### New Capabilities

### Modified Capabilities
- `datalog-constants`: o rótulo/unidade do BSFC e a fórmula de Potência e Torque (conversão hp→cv); o
  cenário de referência da planilha ganha os novos valores.

## Impact

- `frontend/src/signals/enginePower.ts` (+ `enginePower.test.ts`): conversão hp→cv e comentário da unidade.
- `frontend/src/features/settings/ConstantsPanel.tsx`: rótulo `lb/hp·h`.
- Outros testes que fixam valores de Potência/Torque (`signalRegistry`, `displayRows`, `runtimeSignals`),
  se existirem.
- `openspec/specs/datalog-constants/spec.md` (via delta); `frontend/CLAUDE.md` se citar a unidade.
- Sem mudança na correção do mapa VE, em runs, no parser ou na persistência.
