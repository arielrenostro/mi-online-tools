# Rotas — Frontend (React Router v6)

Estrutura de rotas, guards, navegação programática, comportamento no F5 e rotas bloqueadas na v1.

## Estrutura do router

`App.tsx` usa `createBrowserRouter`. O layout raiz (`RootLayout` com `TopBar`) é um route pai com `<Outlet>`, garantindo a barra superior em todas as rotas.

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,      // TopBar + <Outlet />
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'tuning',
        element: <RequireMap><TuningPage /></RequireMap>,
        children: [
          { index: true, element: <Navigate to="ve" replace /> },
          { path: 've',        element: <VETab /> },
          { path: 'ignition',  element: <IgnitionTab /> },   // bloqueada na UI
          { path: 'lambda',    element: <LambdaTab /> },     // bloqueada na UI
        ],
      },
      {
        path: 'datalog',
        element: <DatalogPage />,          // sem guard no pai — LogsTab acessível sem logs
        children: [
          { index: true, element: <Navigate to="logs" replace /> },
          { path: 'logs',      element: <LogsTab /> },
          { path: 'dashboard', element: <RequireLog><DashboardTab /></RequireLog> },
          { path: 'charts',    element: <RequireLog><ChartsTab /></RequireLog> },
          { path: 'data',      element: <RequireLog><DataTab /></RequireLog> },
        ],
      },
    ],
  },
])
```

## `RootLayout`

```tsx
export function RootLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  )
}
```

`TopBar` é renderizada sempre. Exibe controles de importação de mapa/logs e exportação.

## Tabela de rotas

| Path | Componente | Guard | Redirect |
|------|-----------|-------|----------|
| `/` | `HomePage` | — | — |
| `/tuning` | `TuningPage` (via `RequireMap`) | mapa carregado | `/` se sem mapa; `/tuning` → `/tuning/ve` |
| `/tuning/ve` | `VETab` | herdado | — |
| `/tuning/ignition` | `IgnitionTab` | herdado | bloqueada na UI |
| `/tuning/lambda` | `LambdaTab` | herdado | bloqueada na UI |
| `/datalog` | `DatalogPage` | — | `/datalog` → `/datalog/logs` |
| `/datalog/logs` | `LogsTab` | — | — |
| `/datalog/dashboard` | `DashboardTab` | `RequireLog` → `/datalog/logs` | — |
| `/datalog/charts` | `ChartsTab` | `RequireLog` → `/datalog/logs` | — |
| `/datalog/data` | `DataTab` | `RequireLog` → `/datalog/logs` | — |

## Guards

Componentes React que verificam os stores Zustand e redirecionam se o pré-requisito falha. Não exibem tela de erro — redirecionam (o usuário vê cards desabilitados na origem).

### `RequireMap`

Protege `/tuning/*`. Redireciona para `/` se `originalMap === null`.

```tsx
export function RequireMap({ children }: { children: React.ReactNode }) {
  const originalMap = useMapStore((s) => s.originalMap)
  const isRestoring = useSessionStore((s) => s.isRestoring)
  if (isRestoring) return <SessionRestoringSpinner />
  if (originalMap === null) return <Navigate to="/" replace />
  return <>{children}</>
}
```

### `RequireLog`

Protege `/datalog/dashboard|charts|data` individualmente. **Não** envolve `DatalogPage` — a aba Logs é acessível sem logs. Redireciona para `/datalog/logs` (não `/`) quando não há logs ativos.

```tsx
export function RequireLog({ children }: { children: React.ReactNode }) {
  const activeLogs = useLogStore((s) => s.logs.filter((l) => l.enabled))
  const isRestoring = useSessionStore((s) => s.isRestoring)
  if (isRestoring) return <SessionRestoringSpinner />
  if (activeLogs.length === 0) return <Navigate to="/datalog/logs" replace />
  return <>{children}</>
}
```

### Comportamento durante o `sessionRestorer`

Na inicialização, o restorer popula os stores de forma assíncrona. Durante esse período, `originalMap` pode estar `null` só porque a restauração não terminou. Para evitar redirects prematuros:

1. `useSessionStore` tem `isRestoring: boolean`, começa `true` (antes do primeiro render), vira `false` após o restorer concluir.
2. Os guards checam `isRestoring` **antes** do estado de mapa/log.
3. Enquanto `isRestoring`, exibem `SessionRestoringSpinner` (spinner centralizado leve).

### F5 (reload)

1. Stores Zustand voltam ao inicial (`originalMap = null`).
2. `sessionRestorer` executa antes do primeiro render (`await` em `main.tsx`).
3. Se havia dados no IndexedDB, o estado é restaurado.
4. Só após o restore (`isRestoring = false`), os guards avaliam.
5. Restauração bem-sucedida → o guard passa; IndexedDB vazio → redireciona para `/`.

O estado não é mantido na URL — reside nos stores, restaurados pelo `sessionRestorer`.

## Abas das páginas — `NavLink`

As abas de `TuningPage` e `DatalogPage` usam `<NavLink>`, que aplica classe `active` à rota atual e faz o botão "voltar" funcionar entre abas.

```tsx
// TuningPage.tsx
<nav className="flex gap-1 border-b px-4 pt-2">
  <TuningTabLink to="ve" label="VE" />
  <TuningTabLink to="ignition" label="Ignition" disabled />
  <TuningTabLink to="lambda" label="Lambda" disabled />
</nav>
<div className="flex-1 overflow-auto"><Outlet /></div>
```

```tsx
// DatalogPage.tsx — TimeRailContainer sempre visível, não desmontado ao trocar de aba
<TimeRailContainer />
<nav className="flex gap-1 border-b px-4 pt-2">
  <NavLink to="logs">Logs</NavLink>
  <NavLink to="dashboard">Dashboard</NavLink>
  <NavLink to="charts">Gráficos</NavLink>
  <NavLink to="data">Dados</NavLink>
</nav>
<div className="flex-1 overflow-auto"><Outlet /></div>
```

## Navegação programática

Navegação é **sempre explícita pelo usuário** — sem redirect automático ao carregar mapa ou rodar tuning. A única exceção são os redirects de índice (`<Navigate to="ve" replace />`), por demanda do router.

```tsx
function HomeCard({ to, disabled }: { to: string; disabled: boolean }) {
  const navigate = useNavigate()
  return <button disabled={disabled} onClick={() => navigate(to)}>Abrir →</button>
}
```

## Rotas bloqueadas na v1

`/tuning/ignition` e `/tuning/lambda` existem no router mas `IgnitionTab`/`LambdaTab` exibem estado bloqueado.

- A aba é **visível** na barra de navegação mas **não clicável** (`pointer-events: none`)
- `Tooltip` "Disponível em breve" ao hover; a URL não muda ao tentar clicar
- Acesso direto via URL → componente exibe estado vazio com a mesma mensagem

```tsx
// TuningTabLink.tsx
export function TuningTabLink({ to, label, disabled = false }: Props) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="px-4 py-2 text-sm text-muted-foreground cursor-not-allowed select-none"
                aria-disabled="true">{label}</span>
        </TooltipTrigger>
        <TooltipContent>Disponível em breve</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <NavLink to={to} className={({ isActive }) =>
      isActive ? 'px-4 py-2 text-sm border-b-2 border-primary font-medium'
               : 'px-4 py-2 text-sm text-muted-foreground hover:text-foreground'}>
      {label}
    </NavLink>
  )
}
```

## Localização dos arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/App.tsx` | Router, `RouterProvider` |
| `pages/RootLayout.tsx` | Layout raiz (TopBar + Outlet) |
| `pages/HomePage.tsx` | Tela inicial com cards |
| `pages/TuningPage.tsx` | Layout da seção Tuning com abas |
| `pages/DatalogPage.tsx` | Layout do Datalog com TimeRail e abas |
| `features/datalog/LogsTab.tsx` | Gerenciamento de logs |
| `components/guards/RequireMap.tsx` | Guard: exige mapa |
| `components/guards/RequireLog.tsx` | Guard: exige ≥1 log ativo; redireciona para `/datalog/logs` |
| `components/guards/SessionRestoringSpinner.tsx` | Spinner durante restauração |
| `components/TuningTabLink.tsx` | Aba com estado bloqueado |
| `features/tuning/ignition/IgnitionTab.tsx` | Placeholder (bloqueada) |
| `features/tuning/lambda/LambdaTab.tsx` | Placeholder (bloqueada) |
