# MasterInjection — Datalog (CSV)

Formato do arquivo de datalog gerado pelo software da ECU e regras de parsing.

## Formato do arquivo

CSV separado por `;`. Gerado em tempo real; quando o software reinicia (sem encerrar a sessão de log), reescreve o cabeçalho no meio do arquivo.

```
Timestamp;Event;Mess 1;RPM;MAP;Boost;Load %;Idle;Lambda 1;Inj. Pulse;...
1778957562179;;#D01;839;37;100;20;20;1018;146;...
1778957562298;;#D01;846;37;100;20;20;1021;146;...
```

## Colunas relevantes para tuning

Colunas identificadas sempre pelo **nome** (header), nunca por índice.

| Coluna | Sinal | Unidade | Conversão raw→real |
|--------|-------|---------|--------------------|
| `Timestamp` | Timestamp Unix | ms | `int` |
| `RPM` | Rotações | RPM | `int(raw)` |
| `MAP` | Pressão coletor admissão | kPa | `int(raw)` |
| `Boost` | Pressão de boost (ref. atmosférica) | kPa | `int(raw)` |
| `Lambda 1` | Lambda medido pela sonda | λ | `float(raw)/1000` |
| `Inj. Utiliz.` | Duty cycle do injetor | % | `int(raw)` |
| `VE Value` | VE calculada pela ECU | % | `float(raw)/10` |
| `Ign. Adv.` | Avanço de ignição | º | `int(raw)` |
| `Batt Volt.` | Tensão da bateria | V | — (reservado) |
| `CLT` | Temp. líquido arrefecimento | ºC | `int(raw)-273` |
| `IAT` | Temp. ar admitido | ºC | `int(raw)-273` |
| `KM/H` | Velocidade | km/h | `int(raw)` |
| `Lambda Loop` | Modo de controle de lambda | — | `int(raw)` → `0`=open, `1`=closed |
| `Lambda Target` | Lambda alvo da ECU | λ | `float(raw)/1000` |
| `Lambda Corr` | Correção de combustível (fuel trim) | % | `(float(raw)-1000)/10` |
| `Turbo Target` | Pressão de boost alvo | kPa | `int(raw)` |
| `ACC %` | Posição do acelerador (pedal) | % | `min(100.0, float(raw)/990.0*100.0)` |

### Notas sobre conversores

- **CLT/IAT**: raw em Kelvin; subtrair 273
- **Lambda 1 / Lambda Target**: raw = lambda × 1000; dividir por 1000
- **Lambda Corr**: offset 1000, escala ×10; `(raw-1000)/10`. raw=1020 → +2.0%; raw=980 → -2.0%
- **ACC %**: raw 0–990; normalizar para 0–100%, clampar em 100%
- **Lambda Loop**: `0`=open loop (ECU não corrige), `1`=closed loop (ECU corrige)

### Colunas presentes mas não usadas na v1

`Event`, `Mess 1`, `Mess 2`, `Idle`, `Inj. Pulse`, `Knock`, `A/C Input`, `Start Input`, `Outputs 1`, `Outputs 2`, `Lambda 2`, `Inj. DT`, `Ign. Dwell`, `Strobo Angle`, `ACP %`, `dACC %`, e as duas colunas sem nome (`0;0` final).

## Regras de parsing

### 1. Identificação do header

Linha é **header** quando o primeiro campo não é numérico e contém `Timestamp`. O parser deve achar o header **em qualquer linha** (não só a primeira); ao reencontrá-lo, continua lendo com o novo mapeamento de colunas.

```python
def is_header(line: str) -> bool:
    return line.split(';')[0].strip() == 'Timestamp'
```

### 2. Leitura dos dados

```python
for line in file:
    if is_header(line):
        column_map = build_column_map(line)  # nome → índice
        continue
    if not column_map:
        continue  # aguardando o primeiro header
    row = parse_row(line, column_map)
    if row:
        rows.append(row)
```

### 3. Coluna Timestamp

Se presente no header, usar como timestamp absoluto (ms Unix). Se **ausente**, gerar dinamicamente: primeira linha = `0`, cada linha seguinte += `100` (ms).

### 4. Validação de linhas

Descartar se: nº de campos ≠ esperado pelo header atual; `Timestamp` (quando presente) não numérico; `RPM` ou `MAP` não inteiros válidos.

Linhas com `Event` preenchido (alarmes) podem virar metadados, mas não entram na análise.

### 4. Estrutura resultante por linha

Cada linha vira um `DatalogRow` (campos em [architecture/frontend/types.md](../architecture/frontend/types.md)): `timestamp_ms`, `rpm`, `mapKpa`, `lambda1`, `lambdaCorrecao`, `lambdaTarget`, `veValueRaw`, `clt`, `lambdaLoop` (0/1), `pedal`. As colunas não usadas na v1 são descartadas no parsing.

## Performance

- Datalogs podem ter dezenas de milhares de linhas (~30 min @ 10 Hz ≈ 18.000)
- Parsing em streaming (linha a linha), sem carregar o arquivo inteiro em memória
- Múltiplos datalogs: cada um parseado independentemente e concatenado na sessão
