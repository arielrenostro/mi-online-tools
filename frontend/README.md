# Frontend — Master Injection Online Tools

App React de UI para auto-tuning de mapas de ECU — importa mapa, datalogs, executa tuning, visualiza diagnósticos, edita células, exporta resultado.

## Stack

- **React 18** · TypeScript · Vite
- **Tailwind CSS** — styling
- **Zustand** — gerenciamento de estado (4 stores)
- **IndexedDB + localStorage** — persistência de sessão
- **ECharts** — gráficos (linhas, heatmap, scatter)
- **idb** — wrapper IndexedDB
- **Vitest** — testes

App 100% client-side — sem backend, sem servidor pra apontar.

## Rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

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
│   │   ├── correction.ts      CorrectionFilterConfig, CorrectionSnapshot
│   │   └── ui.ts              UIState, ChartLayout, ColorScale
│   ├── store/
│   │   ├── mapStore.ts        useMapStore (mapa, undo, edição)
│   │   ├── logStore.ts        useLogStore (datalogs)
│   │   ├── correctionStore.ts useCorrectionStore (filtros, snapshot gerado)
│   │   ├── timeStore.ts       useTimeStore (cursor, seleção, zoom)
│   │   └── uiStore.ts         useUIStore (layout, colunas, aba ativa)
│   ├── api/
│   │   └── client.ts          computeHash (dedupe de logs por SHA-1)
│   ├── persistence/
│   │   ├── sessionRestorer.ts       Hidrata stores de IndexedDB/localStorage na startup
│   │   └── *Persistence.ts          Um módulo por domínio (map, log, correction)
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
- **Abas:** VE (mapa original + editável + seção de correção), Ignition, Lambda (ambas bloqueadas na v1)

## Gerenciamento de estado (Zustand)

5 stores principais:

| Store | Responsável por |
|-------|-----------------|
| `useMapStore` | Mapa original + editável, undo/redo, import/export |
| `useLogStore` | Datalogs (import, remoção, reordenação, ativação) |
| `useCorrectionStore` | Filtros de correção VE, toggle de visibilidade, snapshot gerado |
| `useTimeStore` | Cursor temporal, seleção/zoom, sparkline |
| `useUIStore` | Layout de gráficos, colunas visíveis, aba ativa |

Cada store:
- Persiste automaticamente em IndexedDB/localStorage (`miot:*`)
- Restaura na startup via `sessionRestorer`
- Sincroniza entre abas/componentes

## Persistência

**IndexedDB (`miot:` stores):**
- `miot:map` — MapModel original
- `miot:editable-map` — mapa editável
- `miot:logs` — array de LogEntry
- `miot:time` — cursor, seleção, sparkline
- `miot:ui` — UIState (layout, colunas, aba ativa)
- `miot:correction` — último snapshot de correção VE gerado

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
| `HeatmapTable` | `src/components/HeatmapTable.tsx` | Grid N×M (teclado + mouse); editável (VE) ou somente leitura (correção) |
| `CorrectionSection` | `src/features/tuning/CorrectionSection.tsx` | Heatmap de correção, toggles, proveniência, aplicar |
| `CorrectionFilterPanel` | `src/features/datalog/CorrectionFilterPanel.tsx` | Filtros de correção + "Gerar fator de correção" (aba Logs) |

## Parsing

**Client-side (browser), único lugar onde os CSVs são lidos:**
- `mapParser.ts` — CSV MasterInjection → MapModel (extrai #I20/#I21/#Fnn)
- `datalogParser.ts` — CSV datalog → DatalogModel (coluna-por-coluna, conversão raw→real, depois sinais derivados)

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

Ver [`openspec/specs/heatmap-editing/spec.md`](../openspec/specs/heatmap-editing/spec.md) para o
contrato completo de edição/atalhos, e [`openspec/specs/tuning-ve/spec.md`](../openspec/specs/tuning-ve/spec.md)
para o restante da aba VE.

## Routing

React Router v7 com **hash router**: as rotas ficam depois do `#` (ex.: `https://host/#/datalog/charts`),
para que o app funcione em hospedagem estática (CloudFront/S3) sem fallback para `index.html`.

```
/#/                    → Home
/#/tuning              → redireciona para /#/tuning/ve
  /#/tuning/ve | ignition | lambda
/#/datalog             → redireciona para /#/datalog/logs
  /#/datalog/logs | dashboard | charts | data | dyno
```

**Guards:**
- `/tuning/*` requer mapa carregado (`RequireMap`)
- `/datalog/dashboard|charts|data|dyno` requerem ao menos um log ativo (`RequireLog`)

Ver [`openspec/specs/navigation-guards/spec.md`](../openspec/specs/navigation-guards/spec.md).

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

Ver [`openspec/specs/`](../openspec/specs/) (rode `openspec list --specs`) para as capabilities
detalhadas de cada área do frontend.
