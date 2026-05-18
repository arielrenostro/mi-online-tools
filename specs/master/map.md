# MasterInjection — Mapa (CSV)

Especificação do formato do arquivo de mapa da ECU MasterInjection e das regras de parsing e exportação.

---

## Formato do arquivo

Arquivo de texto plano com campos separados por `;`. Cada linha começa com um código de instrução no formato `#Xnn`, onde `X` identifica o tipo e `nn` o índice da linha/tabela.

### Instruções gerais

- Não deve ser utilizado valor decimal, sempre inteiro
- Mapas de ignição, combustível, lambda e correções não aceitam valores negativos

### Instruções da tabela de combustível

| Instrução | Conteúdo | Valores no arquivo de referência |
|-----------|----------|----------------------------------|
| `#I20` | Breakpoints de RPM — eixo X, 16 valores | `400;800;1200;1600;2000;2400;2800;3200;3600;4000;4400;4800;5200;5600;6200;6800` |
| `#I21` | Breakpoints de MAP em kPa — eixo Y, 16 valores | `10;20;30;40;50;60;70;80;90;100;110;120;140;160;180;200` |
| `#F01`–`#F16` | Linhas da tabela de combustível, uma por nível de MAP | `#F01;486;502;563;592;608;625;617;632;...` |

### Layout das tabelas de MAP x RPM

Exemplo usando a de combustível (VE, #F01).

- **Linhas** → MAP: `#F01` corresponde ao primeiro breakpoint de MAP (`#I21[0]` = 10 kPa), `#F16` ao último (`#I21[15]` = 200 kPa)
- **Colunas** → RPM: cada valor na linha segue a ordem de `#I20`
- Dimensão padrão: **16 linhas × 16 colunas**
- Unidade dos valores: inteiros em unidade interna da ECU (pulso de injeção)

```
         RPM→  400   800  1200  1600  2000  2400  ...  6800
MAP(kPa)↓
10  (#F01)      486   502   563   592   608   625  ...   634
20  (#F02)      488   506   567   596   611   629  ...   637
30  (#F03)      503   522   584   613   630   648  ...   657
...
200 (#F16)      762   791   884   929   955   982  ...   995
```

---

## Outras instruções presentes no arquivo

Estas instruções existem no CSV mas **não são editadas na v1**. Devem ser preservadas intactas na exportação.

| Prefixo | Descrição |
|---------|-----------|
| `#I01`–`#I16` | Tabela de avanço de ignição (MAP × RPM) |
| `#A01`–`#A16` | Tabela de alvo de lambda (MAP × RPM) |
| `#F01`-`#F16` | Tabela de VE (MAP x RPM) |
| `#I20` | Breakpoints de RPM — eixo X, 16 valores |
| `#I21` | Breakpoints de MAP — eixo Y, 16 valores |

---

## Regras de parsing

1. Ler o arquivo linha a linha
2. Ignorar linhas em branco
3. Identificar instrução pelo prefixo (tudo antes do primeiro `;`)
4. Os valores vêm após o prefixo, separados por `;`
5. Para `#I20` e `#I21`: converter cada valor para `int` → listas de breakpoints
6. Para `#F01`–`#F16`: o sufixo numérico (`01`–`16`) indica o índice da linha MAP (1-based); converter cada valor para `int`
7. Todas as demais linhas: armazenar como string literal para reutilização na exportação

```python
# Exemplo de estrutura resultante
{
  "rpm_breakpoints": [400, 800, 1200, ..., 6800],   # #I20
  "map_breakpoints": [10, 20, 30, ..., 200],          # #I21
  "cells": [                                           # [map_idx][rpm_idx]
    [486, 502, 563, ..., 634],   # #F01 → MAP 10 kPa
    [488, 506, 567, ..., 637],   # #F02 → MAP 20 kPa
    ...
    [762, 791, 884, ..., 995],   # #F16 → MAP 200 kPa
  ],
  "raw_lines": [...]  # todas as linhas originais, em ordem
}
```

---

## Regras de exportação

1. Iterar sobre `raw_lines` na ordem original
2. Ao encontrar uma linha `#Fnn` (01–16): substituir pelo novo valor da célula correspondente
3. Todas as demais linhas: escrever exatamente como estavam em `raw_lines`
4. Separador de saída: `;` (igual ao original)
5. Encoding: UTF-8

O resultado deve ser um CSV bit-a-bit idêntico ao original, exceto pelas linhas `#F01`–`#F16` que foram alteradas.

---

## Notas e limitações conhecidas

- O número de breakpoints pode variar (mapas com dimensão diferente de 16×16 existem em versões futuras da ECU); o parser deve ler o tamanho dinamicamente a partir do número de valores em `#I20` e `#I21`
- Valores na tabela de combustível são sempre inteiros positivos; nunca negativos
- Faixa válida observada: 100–9999 (usar como hard limit na exportação)
