# API Client — Frontend

Camada de comunicação com o backend FastAPI. Só HTTP, serialização e tratamento de erros — sem lógica de negócio.

```
src/api/
├── client.ts    # fetch base, erros, tipos de erro
├── datalog.ts   # uploadDatalog
├── engines.ts   # listEngines, getEngine
└── tuning.ts    # runTuning
```

> Não existe `api/map.ts`. Parsing do mapa fica em `parsers/mapParser.ts`, exportação em `utils/mapExporter.ts`.

## `client.ts`

### Base URL e timeouts

- `BASE_URL` = `import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`
- Timeout padrão: **30s**; uploads: **120s** (CSVs grandes)

### Tipos de erro

Três classes distintas, tratáveis separadamente pelos callers:

| Classe | Significado | Campos |
|--------|-------------|--------|
| `ApiError` | Backend respondeu com status 4xx | `status`, `detail` (mensagem do FastAPI/Pydantic), `raw` |
| `NetworkError` | Servidor não respondeu (`fetch` lançou `TypeError`: CORS, servidor down) | `cause` |
| `TimeoutError` | Requisição excedeu o timeout (`AbortController`) | `timeoutMs` |

### `apiFetch<T>(path, options)`

`fetch` com `AbortController` para o timeout. Em erro de rede → `NetworkError`; `AbortError` → `TimeoutError`. Resposta `!ok` → lê o corpo JSON e monta `ApiError`: o `detail` do FastAPI pode ser uma string ou um array de erros de validação Pydantic (`{ msg }[]`, juntados por `; `). Status `204` retorna `undefined`.

### Uploads e hash

- **`apiUpload<T>(path, file, fieldName, extraHeaders)`** — envia `multipart/form-data`; usa o timeout de 120s. Não define `Content-Type` (o browser gera o boundary).
- **`computeHash(file)`** — SHA-1 do arquivo via `crypto.subtle.digest`; retorna `"sha1:<hexdigest>"`. Usado para o cache server-side de datalogs.

## `api/datalog.ts` — `uploadDatalog(file, hash)`

Faz upload do CSV; o backend parseia, converte raw→real e retorna o modelo. O `hash` vai no header `X-Content-Hash` para o cache server-side — hash já conhecido → resposta `cached: true` sem re-parsing.

A resposta crua vem em snake_case; a função converte os `rows` para `DatalogRow` (camelCase) e monta o `DatalogModel`. Retorna `{ hash, model, cached }`.

`@throws` `ApiError 422` (CSV não é datalog MasterInjection) · `NetworkError` · `TimeoutError`.

## `api/engines.ts`

- **`listEngines()`** — `GET /api/engines`; lista todos os engines registrados (popula o seletor do `TuningConfigModal`).
- **`getEngine(id)`** — `GET /api/engines/{id}`; detalhes de um engine, incluindo `config_schema`. `@throws ApiError 404` se o `engineId` não existe.

Ambas convertem o `EngineInfoRaw` (snake_case) para `EngineInfo` (camelCase).

## `api/tuning.ts` — `runTuning(req)`

`POST /api/tuning/run` — operação mais pesada do app; resposta **síncrona** (sem polling), timeout 120s. Converte `TuningRunRequest` camelCase→snake_case no envio e `TuningOutput` snake_case→camelCase na resposta (todas as matrizes, `cells_no_data`, `cells_extrapolated[].{row_i,col_j,rule}`, `gradient_warnings[].*`, `filter_stats.*`).

`@throws` `ApiError 404` (algum hash de log não está no disco do backend — re-enviar via `uploadDatalog` e repetir) · `ApiError 422` (config inválida) · `NetworkError` · `TimeoutError`.

## Convenções

- **Loading state não é do `api/`** — é dos stores/hooks (`isLoading`, `isRunning`). O `api/` apenas lança erros tipados; o store os converte em `lastError`.
- **snake_case ↔ camelCase** — o backend usa snake_case nos JSONs; o frontend usa camelCase. Cada módulo `api/` converte na entrada e na saída. snake_case nunca vaza do `api/`.
- **Re-export de tipos** — módulos `api/` não definem tipos públicos (só os `*Raw` internos). Os tipos públicos vêm de `@/types/` — única fonte de verdade.
