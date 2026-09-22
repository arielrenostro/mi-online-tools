# Backend — Master Injection Online Tools

**Stack:** Python 3.12 · FastAPI 0.115 · Pydantic v2 · NumPy 2.1 · SciPy 1.14

## Specs do backend

Veja o índice completo de specs no `CLAUDE.md` da raiz. As mais relevantes para esta área:

| Spec | Cobre |
|------|-------|
| `../specs/architecture/backend/backend.md` | SOLID, engines plugáveis, API REST, session store |
| `../specs/features/tuning-engine.md` | Pipeline de 12 etapas do motor VE Lambda |
| `../specs/features/tuning/research-insights.md` | Análise comparativa do algoritmo vs. indústria |
| `../specs/master/datalog.md` | Formato CSV do datalog, colunas, conversões raw→real |
| `../specs/master/map.md` | Formato do mapa (cells inline em `TuningRunRequest`) |
| `../specs/architecture/overview.md` | Stack, fluxo de dados, fronteiras de responsabilidade |

**IMPORTANT — specs e código andam juntos:** sempre que alterar o código, atualize na mesma mudança a(s) spec(s) correspondente(s) em `specs/`. Specs e código DEVEM permanecer sincronizados.

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
│       └── pipeline/              # 8 etapas, cada uma em seu módulo
│           ├── filter.py          # Etapa 1: filtragem de pontos
│           ├── snap.py            # Etapa 2: snap para breakpoints
│           ├── formula.py         # Etapa 3: cálculo ve_lambda por ponto
│           ├── aggregator.py      # Etapa 4: agregação + rejeição de outliers ±σ
│           ├── confidence.py      # Etapa 5: count_score, CV, confidence
│           ├── cf_calculator.py   # Etapa 6: fator de correção por célula (âncoras)
│           ├── field_solver.py    # Etapa 7: campo de correção suave ancorado
│           ├── applicator.py      # Etapas 8+9: aplicação + limites absolutos
│           └── postprocessor.py   # Etapa 10: RPM400, MAP baixo, gradiente
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

### Campo de correção (etapa 7)
`FieldSolver` resolve o sistema linear `(diag(W) + μ·L)·cf = W·cf_sparse` (L = Laplaciano da grade). Células com dados são âncoras de peso `W = amostras_efetivas / 120` (limitado a 100); o termo `μ` (`smoothing_strength`) suaviza. Não usa `scipy.griddata` nem coordenadas físicas — a suavidade é célula-a-célula na grade.

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
