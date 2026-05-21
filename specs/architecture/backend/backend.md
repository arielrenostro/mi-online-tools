# Arquitetura — Backend

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + NumPy + SciPy

## Princípios SOLID

| Princípio | Aplicação |
|-----------|-----------|
| **S** Single Responsibility | `parsers/` só parseia; `engines/` só executa tuning; `api/` só expõe HTTP |
| **O** Open/Closed | Novo motor = nova pasta em `engines/` + registro no `EngineRegistry`; nada existente é alterado |
| **L** Liskov | Todo `TuningEngine` concreto substitui a interface sem quebrar o caller |
| **I** Interface Segregation | `TuningEngine` define só o contrato mínimo; etapas extras ficam em protocolos internos do engine |
| **D** Dependency Inversion | As rotas dependem de `AbstractEngineRegistry`; injeção via FastAPI `Depends()` |

## Estrutura de pastas

```
backend/app/
├── main.py                 # FastAPI app, registro de routers, DI setup
├── api/                    # Camada HTTP — sem lógica de negócio
│   ├── engines.py          # GET /api/engines, GET /api/engines/{id}
│   ├── datalog.py          # POST /api/datalog/upload
│   └── tuning.py           # POST /api/tuning/run
├── core/                   # Domínio — zero dependência de framework
│   ├── interfaces/         # TuningEngine (ABC), AbstractEngineRegistry (ABC)
│   └── contracts/          # TuningInput/DatalogRow/TuningConfig, TuningOutput/FilterStats/...
├── models/                 # Pydantic models da API (DatalogModel, EngineInfo, TuningRunRequest)
├── engines/ve_lambda/      # VELambdaEngine: engine.py, config.py, schema.py,
│                           # pipeline/ (filter, snap, formula, aggregator, confidence,
│                           #            cf_calculator, interpolator, shape_propagation,
│                           #            applicator, postprocessor)
├── parsers/datalog_parser.py   # CSV datalog → DatalogModel + conversão raw→real
├── registry/default_registry.py
└── datalog/                # disk_store.py (cache por hash), cleanup.py (TTL)
```

`tests/` espelha a estrutura (`engines/ve_lambda/`, `parsers/`, `api/`).

## Interface `TuningEngine`

Contrato que todo motor deve implementar (`core/interfaces/tuning_engine.py`). Todas as propriedades são abstratas; `run` é uma **função pura** (sem side effects, I/O ou estado).

```python
class MapType(str, Enum):
    FUEL_VE = "fuel_ve"; IGNITION = "ignition"; LAMBDA = "lambda"; BOOST = "boost"

class TuningEngine(ABC):
    engine_id:       str        # identificador único e estável. Ex: "ve_lambda"
    name:            str        # nome legível
    description:     str        # o que o motor faz e como
    objective:       str        # o que o motor otimiza
    target_map_type: MapType    # tipo de mapa que o motor corrige

    def get_default_config(self) -> dict[str, Any]: ...
    def get_config_schema(self) -> dict[str, Any]: ...   # JSON Schema p/ o modal do frontend
    def run(self, input: TuningInput) -> TuningOutput: ...
```

## Interface `AbstractEngineRegistry`

`core/interfaces/engine_registry.py`. As rotas dependem apenas desta interface.

```python
class AbstractEngineRegistry(ABC):
    def register(self, engine: TuningEngine) -> None: ...  # ValueError se engine_id duplicado
    def get(self, engine_id: str) -> TuningEngine: ...     # KeyError se não encontrado
    def list_all(self) -> list[TuningEngine]: ...
```

`DefaultEngineRegistry` (`registry/default_registry.py`) implementa com um `dict[str, TuningEngine]`. Em `main.py`: instancia o registry, registra os engines (`registry.register(VELambdaEngine())`) e injeta via `app.dependency_overrides[AbstractEngineRegistry]`.

## Motor implementado: `VELambdaEngine`

Único motor da v1 (`engine_id = "ve_lambda"`, `target_map_type = FUEL_VE`). Implementa o pipeline de 12 etapas definido em [tuning-engine.md](../../features/tuning-engine.md). O `run()` encadeia as etapas, cada uma uma classe com responsabilidade única, testável isoladamente:

```
Filter → Snap → Formula → Aggregator → Confidence → CFCalculator
→ Interpolator → ShapePropagation → Applicator → Postprocessor → TuningOutput
```

## API REST

**Responsabilidade do backend:** armazenar datalogs temporariamente e executar o engine. O parsing e a exportação do CSV do mapa são exclusivos do frontend. Base URL: `/api`.

### `GET /api/engines` e `GET /api/engines/{engine_id}`

Listam / detalham os motores registrados. Cada item:

```json
{
  "engine_id": "ve_lambda", "name": "VE Lambda Tuning",
  "description": "...", "objective": "...", "target_map_type": "fuel_ve",
  "default_config": { "min_clt": 80, "outlier_sigma": 2.0, ... },
  "config_schema": { "$schema": "...", "properties": { ... } }
}
```

`404` (detalhe): `{ "detail": "Engine 've_lambda' não encontrado" }`.

### `POST /api/datalog/upload`

Upload e parsing de um CSV de datalog, com cache por hash.

- **Request:** `multipart/form-data` campo `file` (`.csv`) + header `X-Content-Hash: sha1:<hexdigest>` (SHA-1 calculado pelo frontend).
- **Comportamento:** extrai `<algoritmo>:<hexdigest>` do header; se `{CACHE_DIR}/{hexdigest}.json` existe → **cache hit** (toca o `mtime`, retorna o modelo salvo com `"cached": true`, sem re-parsing); senão → **cache miss** (parseia, salva, `"cached": false`). `CACHE_DIR` via env `MIOT_CACHE_DIR` (default `/tmp/miot_datalogs`).
- **Response `200`:** `{ hash, filename, duration_ms, signals[], cached, rows[] }`. Cada `row`: `timestamp_ms`, `rpm`, `map_kpa`, `lambda1`, `lambda_correcao`, `lambda_target`, `ve_value_raw`, `clt`, `lambda_loop` (0/1), `pedal` (ou `null`). O corpo é idêntico no cache hit.
- **`400`:** header `X-Content-Hash` ausente/malformado. **`422`:** CSV inválido ou não reconhecido.

### `POST /api/tuning/run`

Executa o motor de tuning. O mapa vai **inline** — o backend não armazena mapas entre chamadas.

**Comportamento:** para cada hash em `log_hashes`, carrega o `DatalogModel` do `DatalogDiskStore` e toca o `mtime` (reinicia o TTL); se algum hash não existir → `404` com `missing_hashes`. Monta o `TuningInput` (dados do mapa inline + datalogs), executa o engine e retorna o `TuningOutput`.

**Request body:**

```json
{
  "engine_id": "ve_lambda",
  "rpm_breakpoints": [400, 800, ..., 6800],
  "map_breakpoints": [20, 30, ..., 220],
  "cells": [[100, 120, ...], ...],
  "log_hashes": ["sha1:a3f2b1...", "sha1:c4d5e6..."],
  "time_range": { "start_ms": 252000, "end_ms": 1125000 },
  "config": { "min_clt": 80, "lambda_loop_closed_only": true, ... }
}
```

`time_range`: se `null`, usa todos os pontos dos logs. O `config` espelha o `TuningConfig` (ver [tuning-engine.md](../../features/tuning-engine.md)).

**Response `200`:** `TuningOutput` completo — `suggested_map`, `ve_lambda_map`, `sample_count_map`, `correction_pct_map`, `cf_map`, `confidence_map`, `cv_map`, `convergence_map`, `cells_no_data`, `cells_extrapolated`, `monotonicity_warnings`, `gradient_warnings`, `filter_stats`. Contrato detalhado em [tuning-engine.md](../../features/tuning-engine.md).

**`404`:** `{ "detail": "Logs não encontrados no disco", "missing_hashes": [...] }` — hashes inexistentes/expirados (TTL 1h); o frontend reenvia via `POST /api/datalog/upload` e repete. **`422`:** config inválida ou breakpoints/células inconsistentes.

## `DatalogDiskStore`

Os datalogs ficam em disco como JSON indexado pelo hexdigest do hash SHA-1 (`{CACHE_DIR}/{hexdigest}.json`). Permite: evitar re-parsing do mesmo arquivo (cache por hash) e adiar o envio do log até o tuning ser necessário.

Operações: `exists(hash)`, `get(hash)` (toca o `mtime` para reiniciar o TTL; `KeyError` se ausente), `save(hash, model)`, `touch(hash)`.

## Cleanup de datalogs (TTL = 1h)

Task assíncrona iniciada no `startup` do FastAPI. A cada **10 minutos**, remove os arquivos `*.json` do `CACHE_DIR` cujo `mtime` é anterior a `now − 3600s`. Erros de OS (race condition de remoção) são ignorados.

## Adicionar um novo motor

1. Criar `engines/<nome>/`.
2. Implementar `<Nome>Engine(TuningEngine)` com todas as propriedades e métodos do contrato.
3. Registrar em `main.py`: `registry.register(<Nome>Engine())`.

`GET /api/engines` já listará o novo motor e `POST /api/tuning/run` já o aceitará. Nenhum outro arquivo precisa mudar.
