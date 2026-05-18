# MasterInjection — Datalog (CSV)

Especificação do formato do arquivo de datalog gerado pelo software de dashboard da ECU MasterInjection e das regras de parsing.

---

## Formato do arquivo

CSV com separador `;`. O arquivo é gerado em tempo real pelo software de coleta; quando o software reinicia (sem encerrar a sessão de log), ele escreve o cabeçalho novamente no meio do arquivo.

### Exemplo das primeiras linhas

```
Timestamp;Event;Mess 1;RPM;MAP;Boost;Load %;Idle;Lambda 1;Inj. Pulse;Inj. Utiliz.;VE Value;Ign. Adv.;Knock;A/C Input;Start Input;Outputs 1;Outputs 2;Lambda 2;Mess 2;Batt Volt.;CLT;IAT;Inj. DT;Ign. Dwell;KM/H;Lambda Loop;Lambda Target;Lambda Corr;Strobo Angle;Turbo Target;ACC %;ACP %;dACC %;0;0
1778957562179;;#D01;839;37;100;20;20;1018;146;2;580;10;0;0000;1000;1101;00;0;#D02;143;357;331;542;341;0;1;1000;1020;1170;150;0;594;5000;0;0
1778957562298;;#D01;846;37;100;20;20;1021;146;2;581;10;0;0000;1000;1101;00;0;#D02;142;357;331;548;344;0;1;1000;1021;1170;150;0;594;5000;0;0
```

---

## Colunas relevantes para tuning

Colunas são sempre identificadas pelo **nome** (header), nunca por posição de índice.

| Nome da coluna | Sinal | Unidade | Conversão do valor bruto |
|----------------|-------|---------|--------------------------|
| `Timestamp` | Timestamp Unix | ms | nenhuma (`int`) |
| `RPM` | Rotações por minuto | RPM | `int(raw)` |
| `MAP` | Pressão no coletor de admissão | kPa | `int(raw)` |
| `Boost` | Pressão de boost (referência atmosférica) | kPa | `int(raw)` |
| `Lambda 1` | Lambda medido pela sonda | λ | `float(raw) / 1000` |
| `Inj. Utiliz.` | Duty cycle do injetor | % | `int(raw)` |
| `VE Value` | Eficiência volumétrica calculada pela ECU | % | `float(raw) / 10` |
| `Ign. Adv.` | Avanço de ignição | º | `int(raw)` |
| `Batt Volt.` | Tensão da bateria | V | — (reservado) |
| `CLT` | Temperatura do líquido de arrefecimento | ºC | `int(raw) - 273` |
| `IAT` | Temperatura do ar admitido | ºC | `int(raw) - 273` |
| `KM/H` | Velocidade do veículo | km/h | `int(raw)` |
| `Lambda Loop` | Modo de controle de lambda | — | `int(raw)` → `0`=open loop, `1`=closed loop |
| `Lambda Target` | Lambda alvo configurado na ECU | λ | `float(raw) / 1000` |
| `Lambda Corr` | Correção de combustível aplicada pela ECU (fuel trim) | % | `(float(raw) - 1000) / 10` |
| `Turbo Target` | Pressão de boost alvo | kPa | `int(raw)` |
| `ACC %` | Posição do acelerador (pedal) | % | `min(100.0, float(raw) / 990.0 * 100.0)` |

### Notas sobre conversores

- **CLT / IAT**: valor bruto em Kelvin; subtrair 273 para obter Celsius
- **Lambda 1 / Lambda Target**: valor bruto é lambda × 1000 (inteiro); dividir por 1000
- **Lambda Corr**: valor bruto com offset 1000, escala ×10; fórmula: `(raw - 1000) / 10`. Ex.: raw=1020 → +2.0%; raw=980 → -2.0%
- **ACC %**: range bruto 0–990; normalizar para 0–100%, clampar em 100%
- **Lambda Loop**: `0` = open loop (ECU não corrige), `1` = closed loop (ECU corrige ativamente)

### Colunas presentes mas não usadas na v1

`Event`, `Mess 1`, `Mess 2`, `Idle`, `Inj. Pulse`, `Knock`, `A/C Input`, `Start Input`, `Outputs 1`, `Outputs 2`, `Lambda 2`, `Inj. DT`, `Ign. Dwell`, `Strobo Angle`, `ACP %`, `dACC %`, e as duas colunas sem nome (`0;0` no final).

---

## Regras de parsing

### 1. Identificação do header

Uma linha é considerada **header** quando:
- O primeiro campo não é numérico (não pode ser convertido para `int` ou `float`)
- Contém a string `Timestamp` no primeiro campo

O parser deve estar preparado para encontrar o header **em qualquer linha do arquivo**, não apenas na primeira. Ao encontrar um header repetido, continuar lendo os dados que se seguem usando o novo mapeamento de colunas (que deve ser idêntico, mas o parser não deve assumir isso).

```python
def is_header(line: str) -> bool:
    first_field = line.split(';')[0]
    return first_field.strip() == 'Timestamp'
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

### 3. Validação de linhas

Descartar linha se:
- Número de campos for diferente do esperado pelo header atual
- `Timestamp` não for numérico
- `RPM` ou `MAP` não forem inteiros válidos

Linhas com coluna `Event` preenchida (alarmes, eventos) podem ser preservadas como metadados mas não entram na análise de tuning.

### 4. Estrutura resultante por linha (após conversão)

```python
@dataclass
class DatalogRow:
    timestamp: int          # ms
    rpm: int                # RPM
    map_kpa: int            # kPa
    lambda_measured: float  # λ (já convertido)
    lambda_target: float    # λ (já convertido)
    lambda_corr_pct: float  # % (já convertido, ex: +2.0, -1.5)
    lambda_loop_closed: bool
    clt: int                # ºC
    iat: int                # ºC
    pedal_pct: float        # %
    inj_duty: int           # %
    ve: float               # %
    speed_kmh: int          # km/h
```

---

## Considerações de performance

- Datalogs podem ter dezenas de milhares de linhas (log de ~30 min a ~10 Hz ≈ 18.000 linhas)
- O parsing deve ser feito em streaming (linha a linha), sem carregar o arquivo inteiro em memória antes de processar
- Ao fazer upload de múltiplos datalogs, cada um é parseado independentemente e concatenado na sessão
