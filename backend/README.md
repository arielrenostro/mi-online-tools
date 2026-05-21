# Backend — Master Injection Online Tools

API REST FastAPI que executa o pipeline de auto-tuning VE Lambda.

## Stack

- **Python 3.12** · FastAPI · Uvicorn
- **NumPy · SciPy** — processamento numérico
- **Pydantic v2** — validação de schema
- **pytest · coverage** — testes
- **Docker** — deploy isolado

## Rodar

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

Swagger: `http://localhost:8000/docs`

## Estrutura

```
backend/
├── app/
│   ├── main.py                 Entrypoint FastAPI
│   ├── routers/
│   │   ├── engines.py          Listagem e info de engines
│   │   └── tuning.py           POST /api/tuning/run
│   ├── models/                 Pydantic schemas (request/response)
│   ├── core/
│   │   ├── cache.py            TTL cache de datalogs (SHA-1)
│   │   └── parsers.py          Parsing CSV (map/datalog)
│   └── engines/
│       └── ve_lambda/
│           ├── engine.py       Pipeline 12 etapas
│           ├── config.py       TuningConfig dataclass
│           └── filters.py      Lógica de filtro por célula
├── requirements.txt
├── CLAUDE.md
└── README.md
```

## API

### `GET /api/engines`

Lista engines de tuning.

```json
[
  {
    "engineId": "ve_lambda",
    "name": "VE Lambda",
    "description": "...",
    "targetMapType": "fuel_ve",
    "defaultConfig": { ... },
    "configSchema": { ... }
  }
]
```

### `POST /api/tuning/run`

Executa auto-tuning.

**Request:**
```json
{
  "engineId": "ve_lambda",
  "rpmBreakpoints": [500, 1000, 2000, ...],
  "mapBreakpoints": [20, 40, 60, ...],
  "cells": [[100, 120, ...], ...],
  "logHashes": ["sha1:abc...", ...],
  "timeRange": null,
  "config": { "min_clt": 80, ... }
}
```

**Response:**
```json
{
  "suggestedMap": [[110, 125, ...], ...],
  "veLambdaMap": [[102.5, null, ...], ...],
  "sampleCountMap": [[15, 0, ...], ...],
  "confidence": [[0.87, null, ...], ...],
  "convergenceMap": [[true, null, ...], ...],
  "cellsNoData": [[2, 3], ...],
  "monotonicityWarnings": [[1, 4], ...],
  "filterStats": { "totalRows": 5000, "passed": 4200, ... }
}
```

Datalogs são recuperados do cache por hash SHA-1 (1h TTL).

## Pipeline de tuning (etapas 1–12)

1. **Parse datalog** — CSV → `DatalogRow[]` com conversões raw→real
2. **Filtro global** — CLT, lambda_loop, delta_rpm, delta_map, delta_lambda, outliers (±2σ)
3. **Snap a breakpoints** — mapeia cada ponto ao grid RPM×MAP
4. **Agregação por célula** — méd VE Lambda, contagem, CV
5. **Rejeição de outliers** — intra-célula; mantém CV ≤ threshold
6. **Confiança** — `count_score × 0.7 + stability × 0.3`
7. **Fator de correção** — baseado em desvio medido vs. alvo
8. **Clamp e rules** — `rpm400_rule`, `low_map_rule`, max_adjacent_gradient
9. **Propagação estrutural** — tendências por RPM/MAP/gradiente
10. **Interpolação 2D** — células sem dados
11. **Convergência** — marca residual < threshold
12. **Export** — suggestedMap + diagnósticos

## Configuração (TuningConfig)

44 parâmetros editáveis no `POST /api/tuning/run`:

- **Filtros** — `min_clt`, `lambda_loop_closed_only`, `skip_first_*`, `max_delta_*`, `max_lambda`, `max_delta_pedal`
- **Qualidade** — `outlier_sigma`, `cv_threshold`
- **Correção** — `weight_sample_base`, `max_correction_pct`
- **Convergência** — `convergence_threshold`
- **Pós-proc** — `rpm400_rule_enabled`, `low_map_rule_enabled`, `max_adjacent_gradient_pct`
- **Propagação** — `shape_propagation_enabled`, `shape_rpm_weight`, `shape_map_weight`, `shape_gradient_weight`, `global_shape_weight`, `gradient_min_samples`

Ver `specs/features/tuning/config.md` para defaults e significado de cada campo.

## Cache de datalogs

Datalogs são parseados no backend ao receberem upload via `POST /api/datalog/upload` (frontend) e cacheados em disco por SHA-1 (TTL 1h, variável `MIOT_CACHE_DIR`).

No `POST /api/tuning/run`, o frontend passa `logHashes` — backend recupera do cache sem reparsear.

## Testes

```bash
pytest tests/
pytest --cov=app tests/  # cobertura
```

## Convenções

- **Camel-case em JSON** (`rpmBreakpoints`), snake_case em Python (`rpm_breakpoints`)
- **Resposta de erro** — status 400/422 + `{"detail": "..."}`
- **Validação** — Pydantic + validadores customizados
- **Invariantes** — mapa sempre n_map × n_rpm; cells[i][j] ∈ [100, 9999]

## Decisões arquiteturais

- **Backend não armazena mapa** — frontend é dono; enviado inline em cada `POST /api/tuning/run`
- **Parsing client-side + server-side** — frontend parseia para UI; backend reparseia para garantir integridade
- **Engines plugáveis** — novo engine = nova pasta em `engines/`, com interface `AbstractEngineRegistry`
- **Sem persistência de sessão** — frontend gerencia; backend stateless

Ver [`backend/CLAUDE.md`](CLAUDE.md) para rotas, testes, adicionar novo engine.

Ver [`specs/architecture/backend/backend.md`](../specs/architecture/backend/backend.md) para design detalhado.
