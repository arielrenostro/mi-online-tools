# Frontend — Master Injection Online Tools

App React de UI para auto-tuning de mapas de ECU — importa mapa, datalogs, executa tuning, visualiza diagnósticos, edita células, exporta resultado.

## Stack

- **React 18** · TypeScript · Vite
- **Tailwind CSS** — styling
- **Zustand** — gerenciamento de estado (4 stores)
- **IndexedDB + localStorage** — persistência de sessão
- **ECharts** — gráficos (linhas, heatmap, scatter)
- **idb** — wrapper IndexedDB
- **pytest + Vitest** — testes

## Rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173` e aponta para backend em `http://localhost:8000` (padrão).

Mudar URL do backend:

```bash
VITE_API_URL=https://api.exemplo.com npm run dev
```

Build:

```bash
npm run build      # dist/
npm run preview    # servir dist/ localmente
```

## Estrutura

```
frontend/
├── src/
│   ├── main.tsx                Entrypoint React
│   ├── App.tsx
│   ├── types/
│   │   ├── map.ts             MapModel, MapType
│   │   ├── datalog.ts         DatalogRow, DatalogModel, TimeSelection
│   │   ├── tuning.ts          TuningConfig, TuningRunRequest, TuningOutput
│   │   ├── engine.ts          EngineInfo, JSONSchema
│   │   └── ui.ts              UIState, ChartLayout, ColorScale
│   ├── store/
│   │   ├── mapStore.ts        useMapStore (mapa, undo, edição)
│   │   ├── logStore.ts        useLogStore (datalogs, upload)
│   │   ├── tuningStore.ts     useTuningStore (config, engine, output)
│   │   ├── timeStore.ts       useTimeStore (cursor, seleção, zoom)
│   │   └── uiStore.ts         useUIStore (layout, colunas, aba ativa)
│   ├── api/
│   │   ├── client.ts          HTTP fetch wrapper
│   │   └── endpoints.ts       GET /engines, POST /tuning/run, etc.
│   ├── hooks/
│   │   ├── useSessionRestorer.ts    Hydrata stores de IndexedDB na startup
│   │   └── useAutoSave.ts           Persiste mudanças em IndexedDB
│   ├── features/
│   │   ├── home/              Tela Home (/)
│   │   ├── datalog/           Tela Datalog (/datalog)
│   │   │   ├── components/
│   │   │   ├── TimeRail.tsx
│   │   │   ├── SyncedChart.tsx
│   │   │   └── tabs/          Logs, Dashboard, Gráficos, Dados
│   │   └── tuning/            Tela Tuning (/tuning)
│   │       ├── components/
│   │       ├── HeatmapTable.tsx
│   │       ├── MapChart.tsx
│   │       └── tabs/          VE, Config, Análise
│   ├── components/
│   │   ├── TopBar.tsx         Navegação global
│   │   ├── Modal.tsx
│   │   └── ...outros
│   ├── parsers/
│   │   ├── mapParser.ts       CSV → MapModel
│   │   └── datalogParser.ts   CSV → DatalogModel
│   ├── utils/
│   │   ├── persistence.ts     IndexedDB + localStorage wrappers
│   │   ├── routes.ts          Tab routing dentro de tela
│   │   └── ...outros
│   └── styles/
│       └── globals.css        Tailwind
├── public/
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Telas

### Home (`/`)

- Cards de entrada — Mapa, Datalogs, Auto-tuning
- Ícones + descrições

### Datalog (`/datalog`)

- **TimeRail** — barra temporal com cursor/seleção, sparkline
- **Abas:**
  - **Logs** — upload, lista, ativação
  - **Dashboard** — cards de sinais no cursor
  - **Gráficos** — painéis configuráveis de `SyncedChart`
  - **Dados** — tabela de linhas do datalog

### Tuning (`/tuning`)

- **HeatmapTable** — grid editável N_MAP × N_RPM
- **Abas:**
  - **VE** — heatmap VE Lambda + edição manual
  - **Config** — modal dinâmico de parâmetros
  - **Análise** — heatmaps de amostras/confiança/CV/correção/convergência
  - **MapChart** — gráfico 2D ou 3D do mapa

## Gerenciamento de estado (Zustand)

4 stores principais:

| Store | Responsável por |
|-------|-----------------|
| `useMapStore` | Mapa original + editável, undo/redo, import/export |
| `useLogStore` | Datalogs (upload, remoção, reordenação, ativação) |
| `useTuningStore` | Config do engine, execução, output, status |
| `useTimeStore` | Cursor temporal, seleção/zoom, sparkline |
| `useUIStore` | Layout de gráficos, colunas visíveis, aba ativa |

Cada store:
- Persiste automaticamente em IndexedDB (`miot:*`)
- Restaura na startup via `useSessionRestorer`
- Sincroniza entre abas/componentes

## Persistência

**IndexedDB (`miot:` stores):**
- `miot:map` — MapModel original
- `miot:editable-map` — mapa editável
- `miot:logs` — array de LogEntry
- `miot:time` — cursor, seleção, sparkline
- `miot:ui` — UIState (layout, colunas, aba ativa)
- `miot:tuning` — TuningConfig, output

**localStorage:**
- `miot:sessionVersion` — versão de schema
- Exports/settings globais

## Hooks customizados

- `useSessionRestorer` — hydrata stores de IndexedDB na startup
- `useAutoSave` — persiste mutações em IndexedDB (debounce 1s)
- `useModalStack` — fila de modais com backdrop
- `useShortcut` — atalhos globais (Ctrl+Z/Y, Ctrl+C/V, etc.)

## Componentes principais

| Componente | Localização | Função |
|-----------|----------|--------|
| `TopBar` | `src/components/TopBar.tsx` | Barra global (Mapa, Logs, Exportar) |
| `TimeRail` | `src/features/datalog/TimeRail.tsx` | Timeline com cursor/seleção |
| `SyncedChart` | `src/features/datalog/SyncedChart.tsx` | Gráficos de linha sincronizados (ECharts) |
| `HeatmapTable` | `src/features/tuning/HeatmapTable.tsx` | Grid editável N×M (teclado + mouse) |
| `MapChart` | `src/features/tuning/MapChart.tsx` | Visualização 2D/3D do mapa (ECharts) |
| `TuningConfigModal` | `src/features/tuning/TuningConfigModal.tsx` | Formulário dinâmico de TuningConfig |
| `HeatmapLegend` | `src/components/HeatmapLegend.tsx` | Escalas de cor (warm, diverging, confidence) |

## Parsing

**Client-side (browser):**
- `mapParser.ts` — CSV MasterInjection → MapModel (extrai #I20/#I21/#Fnn)
- `datalogParser.ts` — CSV datalog → DatalogModel (coluna-por-coluna, conversão raw→real)

Ambos rodam antes de enviar ao backend. Backend reparseia o datalog ao receber upload para validação.

## Atalhos de teclado

**HeatmapTable (VE, Ignition, Lambda):**
- `F2` — edição em massa
- `Ctrl+Z/Y` — undo/redo
- `Ctrl+C/V` — copiar/colar
- `Arrow keys` — navegação
- `Escape` — cancelar edição
- `Enter` — confirmar

**TimeRail:**
- `Click + drag` — seleciona intervalo (200ms debounce)
- `Shift+click` — estende seleção

Ver [`specs/features/tuning/ve.md`](../specs/features/tuning/ve.md) para lista completa.

## Routing

React Router v6:

```
/              → Home
/datalog       → Tela Datalog (default: aba Logs)
  ?tab=logs
  ?tab=dashboard
  ?tab=charts
  ?tab=data
/tuning        → Tela Tuning (default: aba VE)
  ?tab=ve
  ?tab=config
  ?tab=analysis
  ?tab=map
```

**Guards:**
- `/datalog` requer mapa carregado
- `/tuning` requer mapa carregado + logs ativos
- `/tuning/...?tab=analysis` requer output de tuning válido

Ver [`specs/architecture/frontend/routes.md`](../specs/architecture/frontend/routes.md).

## Testes

```bash
npm run test           # watch mode
npm run test:coverage  # cobertura
```

Vitest + React Testing Library.

## Convenções

- **CamelCase** em TypeScript/React (ex: `rpmBreakpoints`, `useMapStore`)
- **Conversão snake_case ↔ camelCase** na camada API (`src/api/`)
- **Componentes** — export nomeado, Props interface, memo() se pesado
- **Hooks** — hooks customizados em `src/hooks/`, não espalhar lógica em componentes
- **Stores Zustand** — immutable state, ações explícitas, sem side effects fora de actions

## Invariantes

- Mapa sempre N_MAP × N_RPM; `cells[i][j]` ∈ [100, 9999]
- Seleção temporal válida: `start < end` e ambos ∈ [0, totalDuration]
- EditableMap e MapModel sincronizados (MapModel é imutável)
- Logs ativos — não podem deletar último log ativo, deve haver pelo menos um

Ver [`frontend/CLAUDE.md`](CLAUDE.md) para convenções, arquitetura de stores, persistência.

Ver [`specs/architecture/frontend/`](../specs/architecture/frontend/) para specs detalhadas de cada camada.
