# MasterInjection — Mapa (CSV)

Formato do arquivo de mapa da ECU e regras de parsing/exportação.

## Formato do arquivo

Texto plano, campos separados por `;`. Cada linha começa com um código `#Xnn` (`X` = tipo, `nn` = índice 1-based).

### Regras gerais

- Valores sempre inteiros, nunca decimais
- Mapas de ignição, combustível, lambda e correções nunca aceitam negativos

### Instruções dos três mapas MAP×RPM

Todos compartilham os mesmos breakpoints (`#I20` e `#I21`).

| Instrução | Conteúdo | Exemplo de referência |
|-----------|----------|-----------------------|
| `#I20` | Breakpoints RPM (eixo X, 16 valores) | `400;800;1200;...;6800` |
| `#I21` | Breakpoints MAP em kPa (eixo Y, 16 valores) | `10;20;30;...;200` |
| `#F01`–`#F16` | Linhas da tabela VE (combustível), uma por nível de MAP | `#F01;486;502;563;...` |
| `#I01`–`#I16` | Linhas da tabela de avanço de ignição | `#I01;10;12;14;...` |
| `#A01`–`#A16` | Linhas da tabela de alvo de lambda | `#A01;1000;1000;980;...` |

### Layout das tabelas MAP×RPM

Mesmo layout para VE (`#Fnn`), ignição (`#Inn`) e lambda (`#Ann`):

- **Linhas** → MAP: `#F01` = primeiro breakpoint (`#I21[0]`=10 kPa), `#F16` = último (`#I21[15]`=200 kPa)
- **Colunas** → RPM: cada valor segue a ordem de `#I20`
- Dimensão padrão: 16×16. Valores em unidade interna da ECU (inteiros)

```
         RPM→  400   800  1200  1600  ...  6800
MAP(kPa)↓
10  (#F01)      486   502   563   592  ...   634
20  (#F02)      488   506   567   596  ...   637
...
200 (#F16)      762   791   884   929  ...   995
```

## Representação por tabela

| Tabela | Instrução | Unidade no CSV | Faixa válida | UI |
|--------|-----------|----------------|--------------|----|
| VE | `#F01`–`#F16` | Inteiro (pulso interno) | 100–9999 | Valor direto |
| Ignição | `#I01`–`#I16` | Inteiro (graus × fator) | 0–100 | Valor direto |
| Lambda alvo | `#A01`–`#A16` | Inteiro (lambda × 1000) | 0–2000 | Dividido por 1000 (`1000`→`1.00`) |

Lambda alvo: CSV armazena como inteiro (`1000`=λ1.000). UI exibe ÷1000 com 2 casas decimais. Exportação multiplica por 1000 e arredonda.

## Regras de parsing

1. Ler linha a linha; ignorar linhas em branco
2. Identificar instrução pelo prefixo (até o primeiro `;`); valores vêm após, separados por `;`
3. `#I20`/`#I21`: converter cada valor para `int` → listas de breakpoints
4. `#F01`–`#F16`: sufixo 01–16 = índice da linha MAP (1-based); valores `int` → `cells[map_idx][rpm_idx]`
5. `#I01`–`#I16`: mesmo esquema → `ignitionCells[map_idx][rpm_idx]`
6. `#A01`–`#A16`: mesmo esquema → `lambdaCells[map_idx][rpm_idx]` (inteiros 0–2000)
7. Demais linhas: armazenar como string literal para reuso na exportação

```typescript
// MapModel
{
  name:            "mapa.csv",
  rpmBreakpoints:  [400, 800, ..., 6800],   // #I20
  mapBreakpoints:  [10, 20, ..., 200],       // #I21
  cells:           [[...], ...],             // VE — [map_idx][rpm_idx]
  ignitionCells:   [[...], ...],             // Ignição — mesma grade
  lambdaCells:     [[...], ...],             // Lambda alvo — inteiros 0–2000
  rawLines:        [...]                      // todas as linhas originais, em ordem
}
```

## Regras de exportação

1. Iterar `rawLines` na ordem original
2. Linha `#Fnn` (01–16): substituir pelos valores editados de VE
3. Linha `#Inn` (01–16): substituir pelos valores editados de ignição
4. Linha `#Ann` (01–16): substituir pelos valores de lambda × 1000, arredondados
5. Demais linhas: escrever exatamente como em `rawLines`
6. Separador `;`, encoding UTF-8

Resultado: CSV idêntico ao original, exceto as linhas dos três mapas editados.

## Notas e limitações

- Número de breakpoints pode variar (futuras versões da ECU); parser lê o tamanho dinamicamente do número de valores em `#I20`/`#I21`
- Valores de VE sempre inteiros positivos; hard limit 100–9999 na exportação
