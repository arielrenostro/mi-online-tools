# Tuning › Aba Ignition

**Pré-requisito:** mapa carregado 
**Mapa da ECU:** Avanço de ignição — instruções `#I01`–`#I16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM

---

## Layout

```
┌─ [Mapa Original ] ───────────────────────────────┐
│  (heatmap somente leitura)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Gráficos ─────────────────────────────────────────────────────────────────┐
│  [MAP × RPM]                    [RPM × MAP]                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Planejamento (futuro)

Funcionalidade análoga à aba VE, mas operando sobre o mapa de avanço de ignição.

O motor de tuning para ignição requer lógica distinta da de combustível:
- A referência não é lambda, mas sim knock e torque estimado
- Correções devem ser conservadoras (nunca aumentar avanço automaticamente sem dados de knock)
- Requer sinal de knock do datalog

Spec detalhada a ser criada quando a aba for implementada.
