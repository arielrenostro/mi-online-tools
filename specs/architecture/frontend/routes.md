# Rotas — Frontend (React Router v6)

Estrutura de rotas, guards, navegação programática e comportamento no F5.

## Estrutura do router

`App.tsx` usa `createBrowserRouter`. O layout raiz (`RootLayout` = `TopBar` + `<Outlet>`) é um route pai, garantindo a barra superior em todas as rotas.

```tsx
const router = createBrowserRouter([{
  path: '/', element: <RootLayout />, children: [
    { index: true, element: <HomePage /> },
    { path: 'tuning', element: <RequireMap><TuningPage /></RequireMap>, children: [
        { index: true, element: <Navigate to="ve" replace /> },
        { path: 've',       element: <VETab /> },
        { path: 'ignition', element: <IgnitionTab /> },   // bloqueada na UI
        { path: 'lambda',   element: <LambdaTab /> },     // bloqueada na UI
    ]},
    { path: 'datalog', element: <DatalogPage />, children: [   // sem guard no pai
        { index: true, element: <Navigate to="logs" replace /> },
        { path: 'logs',      element: <LogsTab /> },
        { path: 'dashboard', element: <RequireLog><DashboardTab /></RequireLog> },
        { path: 'charts',    element: <RequireLog><ChartsTab /></RequireLog> },
        { path: 'data',      element: <RequireLog><DataTab /></RequireLog> },
    ]},
  ],
}])
```

## Tabela de rotas

| Path | Componente | Guard | Redirect |
|------|-----------|-------|----------|
| `/` | `HomePage` | — | — |
| `/tuning` | `TuningPage` | `RequireMap` | `/` se sem mapa; `/tuning` → `/tuning/ve` |
| `/tuning/ve` | `VETab` | herdado | — |
| `/tuning/ignition` | `IgnitionTab` | herdado | bloqueada na UI |
| `/tuning/lambda` | `LambdaTab` | herdado | bloqueada na UI |
| `/datalog` | `DatalogPage` | — | `/datalog` → `/datalog/logs` |
| `/datalog/logs` | `LogsTab` | — | — |
| `/datalog/dashboard` | `DashboardTab` | `RequireLog` → `/datalog/logs` | — |
| `/datalog/charts` | `ChartsTab` | `RequireLog` → `/datalog/logs` | — |
| `/datalog/data` | `DataTab` | `RequireLog` → `/datalog/logs` | — |

## Guards

Componentes React que verificam os stores e redirecionam se o pré-requisito falha (não exibem tela de erro). Detalhes e implementação em [components/guards.md](components/guards.md).

- **`RequireMap`** — protege `/tuning/*` (envolve `TuningPage`, abas herdam). Redireciona para `/` se `originalMap === null`.
- **`RequireLog`** — protege `/datalog/dashboard|charts|data` individualmente. **Não** envolve `DatalogPage` — a aba Logs é acessível sem logs. Redireciona para `/datalog/logs` quando não há logs ativos.

Ambos checam `useSessionStore.isRestoring` **antes** do estado de mapa/log: enquanto a restauração não termina, exibem `SessionRestoringSpinner` em vez de redirecionar prematuramente.

### F5 (reload)

1. Stores Zustand voltam ao inicial (`originalMap = null`, `logs = []`); `isRestoring = true`.
2. App renderiza — guards mostram o spinner.
3. `sessionRestorer` lê o IndexedDB e popula os stores; ao concluir, `isRestoring = false`.
4. Guards re-avaliam: dados restaurados → passam; IndexedDB vazio → redirecionam para `/`.

O estado não fica na URL — reside nos stores, restaurados pelo `sessionRestorer`.

## Abas das páginas — `NavLink`

As abas de `TuningPage` e `DatalogPage` usam `<NavLink>` (classe `active` na rota atual; botão "voltar" funciona entre abas). Em `DatalogPage`, o `TimeRailContainer` fica sempre visível acima das abas, não desmontado ao trocar de aba.

## Navegação programática

Navegação é **sempre explícita pelo usuário** — sem redirect automático ao carregar mapa ou rodar tuning. A única exceção são os redirects de índice (`<Navigate to="ve" replace />` etc.).

## Rotas bloqueadas na v1

`/tuning/ignition` e `/tuning/lambda` existem no router mas estão bloqueadas na UI:
- A aba é **visível** na navegação mas **não clicável** (`<span>` estático, não `<NavLink>`); a URL não muda ao tentar clicar
- Tooltip "Disponível em breve" ao hover
- Acesso direto via URL → o componente exibe estado vazio com a mesma mensagem

Implementação da aba bloqueada: ver [components/tuning-tab-link.md](components/tuning-tab-link.md).
