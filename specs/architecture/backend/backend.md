# Arquitetura — Backend

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + NumPy + SciPy

---

## Princípios SOLID aplicados

| Princípio | Aplicação concreta |
|-----------|-------------------|
| **S** Single Responsibility | `parsers/` só parseia; `engines/` só executa tuning; `api/` só expõe HTTP |
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
│   │   ├── datalog_model.py             # DatalogModel
│   │   └── engine_model.py              # EngineInfo, TuningRunRequest (inclui dados do mapa inline)
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
│   │   └── datalog_parser.py            # parse CSV datalog → DatalogModel + conversão raw→real
│   │
│   ├── registry/
│   │   └── default_registry.py          # DefaultEngineRegistry — registra todos os engines
│   │
│   └── datalog/
│       ├── disk_store.py                # DatalogDiskStore: lê/escreve JSON por hash no disco
│       └── cleanup.py                   # task de limpeza: remove arquivos com mtime < now−3600s
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
│   │   └── test_datalog_parser.py
│   └── api/
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

**Responsabilidade do backend:** armazenar datalogs temporariamente e executar o tuner engine. O parsing e exportação do CSV do mapa são responsabilidade exclusiva do frontend.

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

### Datalog

#### `POST /api/datalog/upload`

Upload e parsing de um CSV de datalog. Suporta cache por hash para evitar re-parsing de arquivos já conhecidos.

**Request:**
- `multipart/form-data` — campo `file` (`.csv`)
- Header `X-Content-Hash: sha1:<hexdigest>` — digest SHA-1 do conteúdo do arquivo, calculado pelo frontend antes do upload

**Comportamento:**
1. Lê o header `X-Content-Hash`; extrai `<algorithm>:<hexdigest>` (ex.: `sha1:a3f2b1c4...`)
2. Verifica se `{CACHE_DIR}/{hexdigest}.json` existe no disco
   - **Cache hit:** toca o `mtime` do arquivo (atualiza para agora) e retorna o modelo salvo com `"cached": true` — sem re-parsing do CSV
   - **Cache miss:** parseia o CSV, salva o modelo como `{CACHE_DIR}/{hexdigest}.json` e retorna com `"cached": false`
3. O `CACHE_DIR` é configurável via variável de ambiente `MFT_CACHE_DIR` (default: `/tmp/mft_datalogs`)

**Response `200`:**
```json
{
  "hash": "sha1:a3f2b1c4...",
  "filename": "log_stream_20260516_155239.csv",
  "duration_ms": 754320,
  "signals": ["RPM", "MAP", "Lambda 1", "Lambda Target", "CLT", "Pedal", ...],
  "cached": false,
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

`"cached": true` indica que o arquivo foi reconhecido pelo hash e o parsing foi ignorado. O corpo da resposta é idêntico ao caso normal.

**Response `400`:** Header `X-Content-Hash` ausente ou malformado.  
**Response `422`:** CSV inválido ou estrutura de datalog não reconhecida.

---

### Tuning

#### `POST /api/tuning/run`

Executa o motor de tuning selecionado.

**Comportamento:**
1. Para cada hash em `log_hashes`: carrega o `DatalogModel` do `DatalogDiskStore` e toca o `mtime` do arquivo (reinicia o TTL)
2. Se qualquer hash não existir no disco → responde 404 com `missing_hashes`
3. Monta o `TuningInput` com os dados do mapa recebidos inline (`rpm_breakpoints`, `map_breakpoints`, `cells`) e os datalogs carregados
4. Executa o engine selecionado
5. Retorna o `TuningOutput` completo

O mapa é enviado pelo frontend a cada requisição — o backend não armazena mapas entre chamadas.

**Request body:**
```json
{
  "engine_id": "ve_lambda",
  "rpm_breakpoints": [400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6200, 6800],
  "map_breakpoints": [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200, 220],
  "cells": [[100, 120, ...], ...],
  "log_hashes": ["sha1:a3f2b1...", "sha1:c4d5e6..."],
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

**Response `404`:** `{ "detail": "Logs não encontrados no disco", "missing_hashes": ["sha1:a3f2...", ...] }` — um ou mais log hashes não existem ou expiraram (TTL 1h). O frontend deve re-enviar os logs faltantes via `POST /api/datalog/upload` e repetir o tuning.  
**Response `422`:** config inválida ou breakpoints/células inconsistentes.

---

## DatalogDiskStore

O backend não armazena mapas. Os dados do mapa (`rpm_breakpoints`, `map_breakpoints`, `cells`) são enviados pelo frontend em cada requisição de tuning.

Os datalogs são armazenados em disco como JSON indexado pelo hash SHA-1 do arquivo CSV original. Isso permite:
- Evitar re-parsing quando o mesmo arquivo é enviado novamente (cache por hash)
- O frontend envia o log apenas quando o tuning é necessário — não no carregamento inicial

```python
# datalog/disk_store.py
import json
import os
from pathlib import Path

CACHE_DIR = Path(os.environ.get("MFT_CACHE_DIR", "/tmp/mft_datalogs"))

class DatalogDiskStore:

    def __init__(self):
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _path(self, hash: str) -> Path:
        # hash = "sha1:a3f2..." — usar apenas a parte hex como nome de arquivo
        hex_part = hash.split(":", 1)[-1]
        return CACHE_DIR / f"{hex_part}.json"

    def exists(self, hash: str) -> bool:
        return self._path(hash).exists()

    def get(self, hash: str) -> DatalogModel:
        path = self._path(hash)
        if not path.exists():
            raise KeyError(hash)
        path.touch()   # atualiza mtime para reiniciar o TTL
        return DatalogModel(**json.loads(path.read_text(encoding="utf-8")))

    def save(self, hash: str, model: DatalogModel) -> None:
        self._path(hash).write_text(model.model_dump_json(), encoding="utf-8")
        # mtime = now (automático na escrita)

    def touch(self, hash: str) -> None:
        path = self._path(hash)
        if path.exists():
            path.touch()
```

---

## Cleanup de Datalogs (TTL = 1h)

Task assíncrona iniciada no `startup` do FastAPI. Executa a cada 10 minutos e remove arquivos cujo `mtime` é anterior a `now − 3600s`.

```python
# datalog/cleanup.py
import asyncio
import time
from datalog.disk_store import CACHE_DIR

TTL_SECONDS      = 3600   # 1 hora
INTERVAL_SECONDS = 600    # verificar a cada 10 minutos

async def cleanup_loop() -> None:
    while True:
        await asyncio.sleep(INTERVAL_SECONDS)
        now = time.time()
        for f in CACHE_DIR.glob("*.json"):
            try:
                if f.stat().st_mtime < now - TTL_SECONDS:
                    f.unlink(missing_ok=True)
            except OSError:
                pass  # arquivo já removido por race condition
```

Registro em `main.py`:

```python
@app.on_event("startup")
async def start_cleanup():
    asyncio.create_task(cleanup_loop())
```

---

## Adicionar um novo motor (guia rápido)

1. Criar pasta `engines/<nome>/`
2. Implementar `<Nome>Engine(TuningEngine)` com `engine_id`, `name`, `description`, `objective`, `target_map_type`, `get_default_config()`, `get_config_schema()` e `run()`
3. Registrar em `main.py`: `registry.register(<Nome>Engine())`
4. Pronto — o endpoint `GET /api/engines` já listará o novo motor, e `POST /api/tuning/run` já o aceitará pelo `engine_id`

Nenhum outro arquivo precisa ser alterado.
