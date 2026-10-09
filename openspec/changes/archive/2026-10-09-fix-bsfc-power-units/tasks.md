## 1. Cálculo

- [x] 1.1 Em `enginePower.ts`, converter a potência de hp para cv (× 745,7 ÷ 735,5) antes do torque, atualizar os comentários/interface (`bsfc` em lb/hp·h) e verificar com `enginePower.test.ts` atualizado: referência da planilha em ~10,11 cv / ~2,82 kgf·m, e que o torque continua `Potência × 716,2 ÷ RPM`
- [x] 1.2 Verificar que nenhum outro teste fixa valores de Potência/Torque (`npm run test` na pasta `frontend`) e ajustar os que fixarem

## 2. Interface e documentação

- [x] 2.1 Trocar o rótulo do BSFC em `ConstantsPanel.tsx` para `lb/hp·h` e verificar com `grep` que não resta `lb/cv·h` em `frontend/src` nem em `frontend/CLAUDE.md`
- [x] 2.2 Atualizar `frontend/CLAUDE.md` se citar a unidade/fórmula do BSFC e verificar que `openspec validate fix-bsfc-power-units` passa
