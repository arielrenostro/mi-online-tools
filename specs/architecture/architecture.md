# Arquitetura do Projeto

## Stack tecnológico

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | React 18 + TypeScript + Vite | Ecosistema maduro, tipagem forte, build rápido |
| Estilo | Tailwind CSS + shadcn/ui | Produtividade alta, componentes acessíveis |
| Gráficos | ECharts (via echarts-for-react) | Suporta zoom, seleção de intervalo, heatmap nativo |
| Tabela/Mapa | Componente custom | Heatmap RPM×MAP com células editáveis |
| Backend | Python 3.12 + FastAPI | Processamento de dados, numpy/pandas, fácil de estender |
| Dados | Em memória (sessão) | Sem banco; arquivos são carregados por sessão |
| Comunicação | REST JSON | Simples, sem necessidade de WebSocket na v1 |

## Estrutura de pastas

```
mi-fuel-tuner/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app + rotas
│   │   ├── models/
│   │   │   ├── map.py               # Pydantic models do mapa
│   │   │   └── datalog.py           # Pydantic models do datalog
│   │   ├── parsers/
│   │   │   ├── map_parser.py        # Parsing do CSV da MasterInjection
│   │   │   └── datalog_parser.py    # Parsing do CSV de datalog
│   │   ├── engine/
│   │   │   ├── tuning_engine.py     # Motor de auto-tuning
│   │   │   └── cell_aggregator.py  # Agrupamento de dados por célula
│   │   └── exporters/
│   │       └── map_exporter.py      # Exportação do CSV atualizado
│   ├── tests/
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── MapTable/             # Tabela heatmap editável do mapa
    │   │   ├── DatalogChart/         # Gráficos de sinais do datalog
    │   │   ├── TuningOverlay/        # Overlay de correções sugeridas
    │   │   └── UploadZone/           # Dropzone para arquivos
    │   ├── pages/
    │   │   ├── MapPage.tsx
    │   │   ├── DatalogPage.tsx
    │   │   └── TuningPage.tsx
    │   ├── hooks/
    │   │   ├── useMap.ts
    │   │   └── useDatalog.ts
    │   ├── store/
    │   │   └── session.ts            # Estado global da sessão (Zustand)
    │   ├── api/
    │   │   └── client.ts             # Chamadas REST ao backend
    │   └── types/
    │       ├── map.ts
    │       └── datalog.ts
    └── vite.config.ts
```

## Fluxo de dados principal

```
[Upload CSV mapa]
      │
      ▼
backend: map_parser → MapModel (I20, I21, F01–F16, demais instruções preservadas)
      │
      ▼
frontend: MapTable (heatmap interativo)

[Upload CSV datalog]
      │
      ▼
backend: datalog_parser → DatalogModel (rows com sinais convertidos)
      │
      ▼
frontend: DatalogChart (gráficos com seleção de intervalo)

[Rodar auto-tuning]
      │
      ▼
backend: cell_aggregator (agrupa pontos selecionados por célula RPM×MAP)
      │
      ▼
backend: tuning_engine (calcula correções por célula)
      │
      ▼
frontend: TuningOverlay (mapa original + delta de correção + mapa sugerido)

[Aplicar + Exportar]
      │
      ▼
backend: map_exporter (gera CSV com F01–F16 atualizados, demais linhas intactas)
      │
      ▼
[Download do arquivo]
```

## API REST (backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/map/upload` | Upload e parsing do CSV do mapa; retorna MapModel |
| `GET` | `/api/map/{id}` | Retorna mapa parseado |
| `POST` | `/api/datalog/upload` | Upload e parsing de um datalog; retorna DatalogModel |
| `GET` | `/api/datalog/{id}/signals` | Lista de sinais disponíveis |
| `POST` | `/api/tuning/analyze` | Roda análise: recebe map_id, datalog_ids, config, intervalo; retorna CorrectionMap |
| `POST` | `/api/tuning/apply` | Aplica correções ao mapa; retorna novo MapModel |
| `GET` | `/api/map/{id}/export` | Download do CSV atualizado |

## Modelos de dados (Pydantic)

### MapModel
```python
class FuelMap(BaseModel):
    rpm_breakpoints: list[int]          # 16 valores de #I20
    map_breakpoints: list[int]          # 16 valores de #I21 (kPa)
    cells: list[list[int]]              # [map_idx][rpm_idx] = valor
    raw_lines: list[str]                # todas as linhas originais preservadas

class MapModel(BaseModel):
    id: str
    name: str
    fuel_map: FuelMap
```

### DatalogModel
```python
class DatalogRow(BaseModel):
    timestamp: int
    rpm: int
    map_kpa: int
    lambda_measured: float
    lambda_target: float
    lambda_corr_pct: float              # fuel trim em %
    lambda_loop_closed: bool
    clt: int
    iat: int
    pedal_pct: float
    inj_duty: int

class DatalogModel(BaseModel):
    id: str
    filename: str
    rows: list[DatalogRow]
    duration_ms: int
```

### CorrectionMap
```python
class CellCorrection(BaseModel):
    map_idx: int
    rpm_idx: int
    current_value: int
    suggested_value: int
    correction_pct: float               # delta em % (ex: +5.2, -3.1)
    data_points: int                    # nº de amostras que embasaram essa célula
    confidence: float                   # 0–1 baseado em nº de pontos e estabilidade

class CorrectionMap(BaseModel):
    cells: list[CellCorrection]
    untouched_cells: list[tuple[int,int]]  # células sem dados suficientes
```
