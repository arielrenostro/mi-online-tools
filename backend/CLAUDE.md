# Backend — Master Injection Online Tools

**Stack:** Python 3.12 · FastAPI 0.115 · Pydantic v2 · NumPy 2.1 · SciPy 1.14

Spec de referência: `../specs/architecture/backend/backend.md`  
Pipeline do tuning engine: `../specs/features/tuning-engine.md`

## Rodar

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
# Docker
docker build -t miot-backend .
docker run -p 8000:8000 -e MIOT_CACHE_DIR=/tmp/miot_datalogs miot-backend
```

## Testar

```bash
pytest tests/ -v
```

Os testes ficam em `tests/`. Estrutura espelha `app/`:
- `tests/engines/ve_lambda/` — testes unitários de cada etapa do pipeline
- `tests/parsers/` — testes do parser de datalog
- `tests/api/` — testes de integração dos endpoints

## Estrutura

```
app/
├── main.py                        # FastAPI app, CORS, DI, startup cleanup
├── api/                           # Camada HTTP — sem lógica de negócio
│   ├── engines.py                 # GET /api/engines, GET /api/engines/{id}
│   ├── datalog.py                 # POST /api/datalog/upload
│   └── tuning.py                  # POST /api/tuning/run
├── core/                          # Domínio puro — sem dependência de framework
│   ├── interfaces/
│   │   ├── tuning_engine.py       # TuningEngine (ABC)
│   │   └── engine_registry.py     # AbstractEngineRegistry (ABC)
│   └── contracts/
│       ├── tuning_input.py        # TuningInput, DatalogRow, TuningConfig
│       └── tuning_output.py       # TuningOutput, FilterStats, warnings
├── engines/
│   └── ve_lambda/                 # Único motor implementado
│       ├── engine.py              # VELambdaEngine — orquestra o pipeline
│       ├── config.py              # default_config(), config_from_dict()
│       ├── schema.py              # JSON Schema para o modal do frontend
│       └── pipeline/              # 10 etapas, cada uma em seu módulo
│           ├── filter.py          # Etapa 1: filtragem de pontos
│           ├── snap.py            # Etapa 2: snap para breakpoints
│           ├── formula.py         # Etapa 3: cálculo ve_lambda por ponto
│           ├── aggregator.py      # Etapa 4: agregação + rejeição de outliers ±σ
│           ├── confidence.py      # Etapa 5: count_score, CV, confidence
│           ├── cf_calculator.py   # Etapa 6: fator de correção ponderado
│           ├── interpolator.py      # Etapa 7: interpolação 2D scipy.griddata
│           ├── shape_propagation.py # Etapas 8+9: tendências estruturais + composição cf_final
│           ├── applicator.py        # Etapas 10+11: aplicação + limites absolutos
│           └── postprocessor.py     # Etapa 12: RPM400, MAP baixo, gradiente
├── models/                        # Pydantic request/response da API
├── parsers/
│   └── datalog_parser.py          # Parseia CSV MasterInjection → DatalogModel
├── datalog/
│   ├── disk_store.py              # DatalogDiskStore: cache JSON por hash SHA-1
│   └── cleanup.py                 # Task assíncrona: remove arquivos com mtime < now-1h
└── registry/
    └── default_registry.py        # DefaultEngineRegistry (dict-based)
```

## Endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/engines` | Lista motores registrados |
| `GET` | `/api/engines/{id}` | Detalhes de um motor |
| `POST` | `/api/datalog/upload` | Upload + parsing de CSV de datalog |
| `POST` | `/api/tuning/run` | Executa o tuning engine |
| `GET` | `/health` | Health check |

## Convenções

### Pydantic v2
Usar `model_validate_json` / `model_dump_json`. Não usar `parse_raw`, `dict()` ou `from_orm`.

### Fórmula VE Lambda
```
ve_lambda = (lambda1 + lambda_correcao - lambda_target) × ve_value_raw
```
- `lambda_correcao` é um **multiplicador** (1.000 = sem trim; raw/1000). **Não** é um delta.
- `ve_value_raw` é o valor bruto da ECU (VE% × 10). Células do mapa são inteiros 100–9999.

### Conversões raw → real no parser de datalog
| Campo | Conversão |
|-------|-----------|
| `lambda1`, `lambda_target`, `lambda_correcao` | `raw / 1000` |
| `clt` | `raw - 273` (Kelvin → Celsius) |
| `pedal` | `min(100, raw / 990 * 100)` |

### Interpolação 2D
`scipy.griddata(method='linear', fill_value=1.0)` com coordenadas físicas (kPa, RPM) — **não** índices de array. Essencial para respeitar o espaçamento não uniforme dos breakpoints.

### Orientação das células
`cells[0]` = linha com o **menor MAP** (ex.: 20 kPa). `cells[-1]` = maior MAP. O frontend inverte a exibição (maior MAP no topo da tabela).

### Cache de datalog
- Hash no header `X-Content-Hash: sha1:<hex>`
- Arquivo em `{MIOT_CACHE_DIR}/{hex}.json`
- TTL 1h via `mtime`; cleanup a cada 10min
- Cache hit → `touch()` + retorna modelo salvo, sem re-parsing

### Resposta 404 de tuning
```json
{ "detail": "Logs não encontrados no disco", "missing_hashes": ["sha1:..."] }
```
O frontend deve re-enviar os logs via upload e repetir o tuning.

## Adicionar um novo motor

1. Criar `engines/<nome>/engine.py` implementando `TuningEngine` (ABC em `core/interfaces/tuning_engine.py`)
2. Implementar: `engine_id`, `name`, `description`, `objective`, `target_map_type`, `get_default_config()`, `get_config_schema()`, `run()`
3. Registrar em `main.py`: `_registry.register(<Nome>Engine())`

Nenhum outro arquivo existente precisa ser alterado.

## Invariantes — não violar

- **`TuningEngine.run()` é função pura**: sem I/O, sem estado global, sem side effects. Chamadas repetidas com o mesmo input devem produzir o mesmo output.
- **O backend nunca lê ou escreve o CSV do mapa**. O mapa chega inline em `TuningRunRequest.cells`.
- **Dependency Inversion**: as rotas dependem de `AbstractEngineRegistry` via `Depends()`. Nunca importar `DefaultEngineRegistry` ou `VELambdaEngine` diretamente nas rotas.
