# MasterInjection — Mapa (CSV)

Especificação do formato do arquivo de mapa da ECU MasterInjection e das regras de parsing e exportação.

---

## Formato do arquivo

Arquivo de texto plano com campos separados por `;`. Cada linha começa com um código de instrução no formato `#Xnn`, onde `X` identifica o tipo e `nn` o índice da linha/tabela.

### Instruções gerais

- Não deve ser utilizado valor decimal, sempre inteiro
- Mapas de ignição, combustível, lambda e correções não aceitam valores negativos

### Instruções dos três mapas MAP×RPM

Todos os três mapas compartilham os mesmos breakpoints (`#I20` e `#I21`).

| Instrução | Conteúdo | Valores no arquivo de referência |
|-----------|----------|----------------------------------|
| `#I20` | Breakpoints de RPM — eixo X, 16 valores | `400;800;1200;1600;2000;2400;2800;3200;3600;4000;4400;4800;5200;5600;6200;6800` |
| `#I21` | Breakpoints de MAP em kPa — eixo Y, 16 valores | `10;20;30;40;50;60;70;80;90;100;110;120;140;160;180;200` |
| `#F01`–`#F16` | Linhas da tabela de VE (combustível), uma por nível de MAP | `#F01;486;502;563;592;608;625;617;632;...` |
| `#I01`–`#I16` | Linhas da tabela de avanço de ignição, uma por nível de MAP | `#I01;10;12;14;16;18;20;22;24;...` |
| `#A01`–`#A16` | Linhas da tabela de alvo de lambda, uma por nível de MAP | `#A01;1000;1000;980;960;950;940;...` |

### Layout das tabelas de MAP x RPM

Exemplo usando a de combustível (VE, `#F01`). O mesmo layout se aplica a ignição (`#I01`) e lambda alvo (`#A01`).

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

## Representação dos valores por tabela

| Tabela | Instrução | Unidade no CSV | Faixa válida | Representação na UI |
|--------|-----------|---------------|-------------|---------------------|
| VE (combustível) | `#F01`–`#F16` | Inteiro (pulso interno) | 100–9999 | Valor direto |
| Ignição | `#I01`–`#I16` | Inteiro (graus × fator interno) | 0–100 | Valor direto |
| Lambda alvo | `#A01`–`#A16` | Inteiro (lambda × 1000) | 0–2000 | Dividido por 1000 (ex: `1000` → `1.00`) |

O lambda alvo é armazenado no CSV como inteiro (ex.: `1000` = lambda 1.000, `850` = lambda 0.850). A interface exibe o valor dividido por 1000 com duas casas decimais. Na exportação, o valor é multiplicado por 1000 e arredondado.

---

## Regras de parsing

1. Ler o arquivo linha a linha
2. Ignorar linhas em branco
3. Identificar instrução pelo prefixo (tudo antes do primeiro `;`)
4. Os valores vêm após o prefixo, separados por `;`
5. Para `#I20` e `#I21`: converter cada valor para `int` → listas de breakpoints
6. Para `#F01`–`#F16`: o sufixo numérico (`01`–`16`) indica o índice da linha MAP (1-based); converter cada valor para `int`
7. Para `#I01`–`#I16`: mesmo esquema de `#F`, produz `ignitionCells[map_idx][rpm_idx]`
8. Para `#A01`–`#A16`: mesmo esquema, produz `lambdaCells[map_idx][rpm_idx]` com valores inteiros 0–2000
9. Todas as demais linhas: armazenar como string literal para reutilização na exportação

```typescript
// Estrutura resultante (MapModel)
{
  name:            "mapa.csv",
  rpmBreakpoints:  [400, 800, 1200, ..., 6800],   // #I20
  mapBreakpoints:  [10, 20, 30, ..., 200],         // #I21
  cells: [                                          // VE — [map_idx][rpm_idx]
    [486, 502, 563, ..., 634],   // #F01 → MAP 10 kPa
    ...
    [762, 791, 884, ..., 995],   // #F16 → MAP 200 kPa
  ],
  ignitionCells: [                                  // Ignição — mesma grade
    [10, 12, 14, ..., 24],       // #I01 → MAP 10 kPa
    ...
  ],
  lambdaCells: [                                    // Lambda alvo — inteiros 0–2000
    [1000, 1000, 980, ..., 950], // #A01 → MAP 10 kPa
    ...
  ],
  rawLines: [...]  // todas as linhas originais, em ordem
}
```

---

## Regras de exportação

1. Iterar sobre `rawLines` na ordem original
2. Ao encontrar uma linha `#Fnn` (01–16): substituir pelos valores editados de VE da linha correspondente
3. Ao encontrar uma linha `#Inn` (01–16): substituir pelos valores editados de ignição da linha correspondente
4. Ao encontrar uma linha `#Ann` (01–16): substituir pelos valores de lambda alvo, multiplicando cada valor por 1000 e arredondando antes de escrever no CSV
5. Todas as demais linhas: escrever exatamente como estavam em `rawLines`
6. Separador de saída: `;` (igual ao original)
7. Encoding: UTF-8

O resultado é um CSV idêntico ao original, exceto pelas linhas dos três mapas (`#F01`–`#F16`, `#I01`–`#I16`, `#A01`–`#A16`) que foram editadas.

---

## Notas e limitações conhecidas

- O número de breakpoints pode variar (mapas com dimensão diferente de 16×16 existem em versões futuras da ECU); o parser deve ler o tamanho dinamicamente a partir do número de valores em `#I20` e `#I21`
- Valores na tabela de combustível são sempre inteiros positivos; nunca negativos
- Faixa válida observada: 100–9999 (usar como hard limit na exportação)
