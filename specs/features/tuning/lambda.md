# Tuning › Aba Lambda

**Pré-requisito:** mapa carregado 
**Mapa da ECU:** Alvo de lambda — instruções `#A01`–`#A16`  
**Eixos:** linhas = MAP (kPa), colunas = RPM

---

## Layout

```
┌─ [Mapa Original ] ───────────────────────────────┐
│  (heatmap somente leitura)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

```


## Planejamento (futuro)

Permite editar o mapa de alvo de lambda da ECU (valores que a própria ECU usa como referência para o controle em loop fechado).

Diferente do tuning de VE (que corrige quanto combustível é injetado), o tuning de lambda alvo define *qual* mistura a ECU deve buscar em cada ponto de operação — por exemplo, mistura mais rica em alta carga para proteção do motor, mais pobre em cruzeiro para economia.

Spec detalhada a ser criada quando a aba for implementada.
