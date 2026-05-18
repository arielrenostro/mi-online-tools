# Arquitetura — Backend

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + NumPy + SciPy

---

## Princípios SOLID aplicados

| Princípio | Aplicação concreta |
|-----------|-------------------|
| **S** Single Responsibility | `parsers/` só parseia; `engines/` só executa tuning; `api/` só expõe HTTP; `exporters/` só gera arquivo |
| **O** Open/Closed | Novo motor (ignição, boost…) = nova pasta em `engines/` + registro no `EngineRegistry`. Nenhuma linha existente é alterada |
| **L** Liskov | Todo `TuningEngine` concreto pode substituir a interface abstraia sem quebrar o caller |
| **I** Interface Segregation | `TuningEngine` define apenas o contrato mínimo. Engines que precisam de etapas extras criam seus próprios protocolos internos |
| **D** Dependency Inversion | As rotas da API dependem de `AbstractEngineRegistry`, não de `DefaultEngineRegistry`. A injeção é feita via FastAPI `Depends()` |

---

## Estrutura de pastas

```
backend/
├── app/
│   ├── main.py                          # FastAPI app, registro de routers, DI setup
│   │
│   ├── api/                             # Camada HTTP — sem lógica de negócio
│   │   ├── engines.py                   # GET /api/engines, GET /api/engines/{id}
│   │   ├── map.py                       # POST /api/map/upload, GET /api/map/{id}/export
│   │   ├── datalog.py                   # POST /api/datalog/upload
│   │   └── tuning.py                    # POST /api/tuning/run
│   │
│   ├── core/                            # Domínio — zero dependência de framework
│   │   ├── interfaces/
│   │   │   ├── tuning_engine.py         # TuningEngine (ABC)
│   │   │   └── engine_registry.py       # AbstractEngineRegistry (ABC)
│   │   └── contracts/
│   │       ├── tuning_input.py          # TuningInput, DatalogRow, TuningConfig
│   │       └── tuning_output.py         # TuningOutput, FilterStats, CellExtrapolation, etc.
│   │
│   ├── models/                          # Pydantic models (request/response da API)
│   │   ├── map_model.py                 # MapModel, FuelMap
│   │   ├── datalog_model.py             # DatalogModel
│   │   └── engine_model.py              # EngineInfo, TuningRunRequest
│   │
│   ├── engines/                         # Implementações concretas dos motores
│   │   └── ve_lambda/
│   │       ├── __init__.py
│   │       ├── engine.py                # VELambdaEngine(TuningEngine) — orquestra o pipeline
│   │       ├── config.py                # VELambdaTuningConfig (Pydantic)
│   │       ├── pipeline/
│   │       │   ├── filter.py            # Etapa 1: filtragem de pontos
│   │       │   ├── snap.py              # Etapa 2: snap para breakpoints
│   │       │   ├── formula.py           # Etapa 3: fórmula VE Lambda
│   │       │   ├── aggregator.py        # Etapa 4: agregação + rejeição de outliers
│   │       │   ├── confidence.py        # Etapa 5: count_score, CV, confidence
│   │       │   ├── cf_calculator.py     # Etapa 6: fator de correção ponderado
│   │       │   ├── interpolator.py      # Etapa 7: interpolação 2D (scipy.griddata)
│   │       │   ├── applicator.py        # Etapas 8+9: aplicação + limites absolutos
│   │       │   └── postprocessor.py     # Etapa 10: RPM400, MAP baixo, monotonicidade, gradiente
│   │       └── schema.py                # JSON Schema da config (para o endpoint de engines)
│   │
│   ├── parsers/
│   │   ├── map_parser.py                # parse CSV MasterInjection → MapModel
│   │   └── datalog_parser.py            # parse CSV datalog → DatalogModel + conversão raw→real
│   │
│   ├── exporters/
│   │   └── map_exporter.py              # gera CSV com #F01–#F16 atualizados, demais intactos
│   │
│   ├── registry/
│   │   └── default_registry.py          # DefaultEngineRegistry — registra todos os engines
│   │
│   └── session/
│       └── store.py                     # in-memory store (MapStore, DatalogStore) com UUIDs
│
├── tests/
│   ├── engines/ve_lambda/
│   │   ├── test_filter.py
│   │   ├── test_snap.py
│   │   ├── test_formula.py
│   │   ├── test_aggregator.py
│   │   ├── test_confidence.py
│   │   ├── test_interpolator.py
│   │   └── test_postprocessor.py
│   ├── parsers/
│   │   ├── test_map_parser.py
│   │   └── test_datalog_parser.py
│   └── api/
│       ├── test_map_api.py
│       └── test_tuning_api.py
│
└── requirements.txt
```

---

## Interface `TuningEngine`

Contrato que todo motor deve implementar. Definido em `core/interfaces/tuning_engine.py`.

```python
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any

class MapType(str, Enum):
    FUEL_VE   = "fuel_ve"    # eficiência volumétrica
    IGNITION  = "ignition"   # avanço de ignição
    LAMBDA    = "lambda"     # alvo de lambda
    BOOST     = "boost"      # controle de boost

class TuningEngine(ABC):

    @property
    @abstractmethod
    def engine_id(self) -> str:
        """Identificador único e estável. Ex.: 've_lambda'"""

    @property
    @abstractmethod
    def name(self) -> str:
        """Nome legível. Ex.: 'VE Lambda Tuning'"""

    @property
    @abstractmethod
    def description(self) -> str:
        """Explicação do que o motor faz e como funciona."""

    @property
    @abstractmethod
    def objective(self) -> str:
        """O que o motor tenta otimizar. Ex.: 'Corrigir o mapa de VE para que
        o lambda medido convirja para o lambda alvo em todos os pontos de operação.'"""

    @property
    @abstractmethod
    def target_map_type(self) -> MapType:
        """O tipo de mapa que este motor corrige."""

    @abstractmethod
    def get_default_config(self) -> dict[str, Any]:
        """Retorna a configuração padrão como dict serializável."""

    @abstractmethod
    def get_config_schema(self) -> dict[str, Any]:
        """Retorna o JSON Schema da configuração (usado para renderizar o modal no frontend)."""

    @abstractmethod
    def run(self, input: "TuningInput") -> "TuningOutput":
        """
        Executa o pipeline completo de tuning.
        Função pura — sem side effects, sem I/O, sem estado.
        """
```

---

## Interface `AbstractEngineRegistry`

Definida em `core/interfaces/engine_registry.py`. As rotas da API dependem apenas desta interface.

```python
from abc import ABC, abstractmethod
from app.core.interfaces.tuning_engine import TuningEngine

class AbstractEngineRegistry(ABC):

    @abstractmethod
    def register(self, engine: TuningEngine) -> None:
        """Registra um motor. Lança ValueError se engine_id já existir."""

    @abstractmethod
    def get(self, engine_id: str) -> TuningEngine:
        """Retorna o motor pelo ID. Lança KeyError se não encontrado."""

    @abstractmethod
    def list_all(self) -> list[TuningEngine]:
        """Retorna todos os motores registrados."""
```

### Implementação `DefaultEngineRegistry`

```python
# registry/default_registry.py
class DefaultEngineRegistry(AbstractEngineRegistry):
    def __init__(self):
        self._engines: dict[str, TuningEngine] = {}

    def register(self, engine: TuningEngine) -> None:
        if engine.engine_id in self._engines:
            raise ValueError(f"Engine '{engine.engine_id}' já registrado")
        self._engines[engine.engine_id] = engine

    def get(self, engine_id: str) -> TuningEngine:
        if engine_id not in self._engines:
            raise KeyError(f"Engine '{engine_id}' não encontrado")
        return self._engines[engine_id]

    def list_all(self) -> list[TuningEngine]:
        return list(self._engines.values())
```

### Registro em `main.py`

```python
# main.py
registry = DefaultEngineRegistry()
registry.register(VELambdaEngine())
# registry.register(IgnitionEngine())  ← adicionar aqui quando implementado

app = FastAPI()
app.dependency_overrides[AbstractEngineRegistry] = lambda: registry
```

---

## Motor implementado: `VELambdaEngine`

O único motor da v1. Implementa o pipeline de 10 etapas definido em [tuning-engine.md](../../features/tuning-engine.md).

```python
# engines/ve_lambda/engine.py
class VELambdaEngine(TuningEngine):
    engine_id       = "ve_lambda"
    name            = "VE Lambda Tuning"
    target_map_type = MapType.FUEL_VE

    description = (
        "Motor de auto-tuning de eficiência volumétrica baseado na fórmula "
        "VE Lambda = (λ_medido + trim - λ_alvo) × VE_atual / 1000. "
        "Processa datalogs em closed loop, agrega amostras por célula, "
        "e interpola fatores de correção em 2D para preservar a topologia do mapa."
    )

    objective = (
        "Corrigir o mapa de VE para que o lambda medido convirja para o lambda "
        "alvo em todos os pontos de operação cobertos pelo log, sem introduzir "
        "spikes ou descontinuidades nas regiões sem dados."
    )

    def run(self, input: TuningInput) -> TuningOutput:
        rows    = Filter(input.config).apply(input.datalog_rows)
        snapped = Snap(input.rpm_breakpoints, input.map_breakpoints).apply(rows)
        with_ve = Formula().apply(snapped)
        agg     = Aggregator(input.config).aggregate(with_ve)
        conf    = Confidence(input.config).compute(agg)
        cf      = CFCalculator(input.config).compute(conf, input.current_map)
        cf_full = Interpolator(input.map_breakpoints, input.rpm_breakpoints).interpolate(cf)
        applied = Applicator(input.config).apply(cf_full, input.current_map, agg)
        result  = Postprocessor(input.config, input.map_breakpoints, input.rpm_breakpoints).run(applied)
        return result
```

Cada etapa do pipeline é uma classe com responsabilidade única, testável isoladamente.

---

## API REST

Base URL: `/api`

### Engines

#### `GET /api/engines`

Lista todos os motores registrados.

**Response `200`:**
```json
[
  {
    "engine_id": "ve_lambda",
    "name": "VE Lambda Tuning",
    "description": "...",
    "objective": "...",
    "target_map_type": "fuel_ve",
    "default_config": { "min_clt": 80, "outlier_sigma": 2.0, ... },
    "config_schema": { "$schema": "...", "properties": { ... } }
  }
]
```

#### `GET /api/engines/{engine_id}`

Retorna detalhes de um motor específico. Mesmo formato acima, objeto único.

**Response `404`:** `{ "detail": "Engine 've_lambda' não encontrado" }`

---

### Mapa

#### `POST /api/map/upload`

Upload e parsing do CSV do mapa da MasterInjection.

**Request:** `multipart/form-data` — campo `file` (`.csv`)

**Response `200`:**
```json
{
  "map_id": "uuid-...",
  "name": "4bar - 1.csv",
  "rpm_breakpoints": [400, 800, 1200, ...],
  "map_breakpoints": [20, 30, 40, ...],
  "cells": [[100, 120, ...], ...]
}
```

**Response `422`:** CSV inválido ou estrutura de mapa não reconhecida.

#### `GET /api/map/{map_id}/export`

Gera e retorna o CSV atualizado com os valores do mapa editável.

**Query params:** `cells` — JSON do mapa editável (`number[][]` serializado)

**Response `200`:** `Content-Type: text/csv` + `Content-Disposition: attachment; filename="<nome>_tuned.csv"`

**Comportamento:** linhas `#F01`–`#F16` são substituídas com os valores de `cells`; todas as demais linhas do CSV original são preservadas bit-a-bit.

---

### Datalog

#### `POST /api/datalog/upload`

Upload e parsing de um CSV de datalog.

**Request:** `multipart/form-data` — campo `file` (`.csv`)

**Response `200`:**
```json
{
  "log_id": "uuid-...",
  "filename": "log_stream_20260516_155239.csv",
  "duration_ms": 754320,
  "signals": ["RPM", "MAP", "Lambda 1", "Lambda Target", "CLT", "Pedal", ...],
  "rows": [
    {
      "timestamp_ms": 0,
      "rpm": 2341.0,
      "map_kpa": 87.0,
      "lambda1": 0.998,
      "lambda_correcao": 1.002,
      "lambda_target": 1.000,
      "ve_value_raw": 592,
      "clt": 84.0,
      "lambda_loop": 1,
      "pedal": 32.5
    },
    ...
  ]
}
```

**Nota:** `rows` pode ser omitido da resposta inicial para economizar banda (apenas metadados + `signals`). O frontend já recebe o modelo completo apenas se necessário — na v1, o parsing acontece server-side e o modelo completo é retornado.

---

### Tuning

#### `POST /api/tuning/run`

Executa o motor de tuning selecionado.

**Request body:**
```json
{
  "engine_id": "ve_lambda",
  "map_id": "uuid-...",
  "log_ids": ["uuid-...", "uuid-..."],
  "time_range": { "start_ms": 252000, "end_ms": 1125000 },
  "config": {
    "min_clt": 80,
    "lambda_loop_closed_only": true,
    "skip_first_closed_loop": 10,
    "outlier_sigma": 2.0,
    "cv_threshold": 0.15,
    "weight_sample_base": 40,
    "max_correction_pct": 15.0,
    "convergence_threshold": 5.0,
    "rpm400_rule_enabled": true,
    "rpm400_discount": 0.045,
    "low_map_rule_enabled": true,
    "low_map_threshold": 20,
    "low_map_discount": 0.025,
    "max_adjacent_gradient_pct": 20.0,
    "max_delta_pedal": null
  }
}
```

`time_range`: se `null`, usa todos os pontos dos logs.

**Response `200`:** `TuningOutput` completo (ver contrato em [tuning-engine.md](../../features/tuning-engine.md)):

```json
{
  "suggested_map": [[...], ...],
  "ve_lambda_map": [[...], ...],
  "sample_count_map": [[...], ...],
  "correction_pct_map": [[...], ...],
  "cf_map": [[...], ...],
  "confidence_map": [[...], ...],
  "cv_map": [[...], ...],
  "convergence_map": [[...], ...],
  "cells_no_data": [[2, 14], ...],
  "cells_extrapolated": [{ "row_i": 0, "col_j": 3, "rule": "low_map" }, ...],
  "monotonicity_warnings": [[5, 3], ...],
  "gradient_warnings": [{ "row_i": 7, "col_j": 9, "neighbor_i": 7, "neighbor_j": 8, "gradient_pct": 24.3 }, ...],
  "filter_stats": {
    "total_rows": 12430,
    "passed": 8741,
    "discarded_clt": 1203,
    "discarded_open_loop": 892,
    "discarded_skip_cl": 412,
    "discarded_skip_rpm_bkt": 0,
    "discarded_skip_map_bkt": 0,
    "discarded_delta_rpm": 78,
    "discarded_delta_map": 103,
    "discarded_delta_lambda": 891,
    "discarded_max_lambda": 48,
    "discarded_delta_pedal": 110,
    "discarded_out_of_range": 83,
    "discarded_outlier": 141
  }
}
```

**Response `404`:** map_id ou log_id não encontrado no session store.  
**Response `422`:** config inválida para o engine selecionado.

---

## Session Store

O `SessionStore` mantém os dados uploadados em memória durante a vida do processo. Implementação simples com dicts em memória:

```python
# session/store.py
from uuid import uuid4

class SessionStore:
    def __init__(self):
        self._maps:     dict[str, MapModel]     = {}
        self._datalogs: dict[str, DatalogModel] = {}

    def save_map(self, model: MapModel) -> str:
        id = str(uuid4())
        self._maps[id] = model
        return id

    def get_map(self, id: str) -> MapModel:
        if id not in self._maps:
            raise KeyError(id)
        return self._maps[id]

    def save_datalog(self, model: DatalogModel) -> str:
        id = str(uuid4())
        self._datalogs[id] = model
        return id

    def get_datalog(self, id: str) -> DatalogModel:
        if id not in self._datalogs:
            raise KeyError(id)
        return self._datalogs[id]
```

Uma única instância compartilhada é injetada via `Depends()` em todas as rotas. Sem locking explícito na v1 (FastAPI com uvicorn single-worker).

---

## Adicionar um novo motor (guia rápido)

1. Criar pasta `engines/<nome>/`
2. Implementar `<Nome>Engine(TuningEngine)` com `engine_id`, `name`, `description`, `objective`, `target_map_type`, `get_default_config()`, `get_config_schema()` e `run()`
3. Registrar em `main.py`: `registry.register(<Nome>Engine())`
4. Pronto — o endpoint `GET /api/engines` já listará o novo motor, e `POST /api/tuning/run` já o aceitará pelo `engine_id`

Nenhum outro arquivo precisa ser alterado.
