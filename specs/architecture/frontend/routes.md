# Rotas — Frontend (React Router v6)

Este documento especifica a estrutura completa de rotas da aplicação, incluindo guards, navegação programática, comportamento no reload (F5) e as regras para rotas bloqueadas na v1.

---

## Estrutura do router

O router é definido em `App.tsx` usando `createBrowserRouter` do React Router v6. O layout raiz (com a `TopBar`) é implementado como um route pai com `<Outlet>`, garantindo que a barra superior esteja sempre visível em todas as rotas.

```tsx
// App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

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
          { path: 'ignition',  element: <IgnitionTab /> },   // visível, bloqueada na UI
          { path: 'lambda',    element: <LambdaTab /> },     // visível, bloqueada na UI
        ],
      },

      {
        path: 'datalog',
        element: <RequireLog><DatalogPage /></RequireLog>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardTab /> },
          { path: 'charts',    element: <ChartsTab /> },
          { path: 'data',      element: <DataTab /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
```

---

## Layout raiz — `RootLayout`

```tsx
// pages/RootLayout.tsx
import { Outlet } from 'react-router-dom'
import { TopBar } from '@/components/TopBar'

export function RootLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

A `TopBar` é renderizada **sempre**, independentemente de qual rota está ativa. Ela exibe os controles de importação de mapa e logs, e o botão de exportação.

---

## Tabela de rotas

| Path | Componente | Guard | Redirect | Abas filhas |
|------|-----------|-------|----------|-------------|
| `/` | `HomePage` | — | — | — |
| `/tuning` | `TuningPage` (via `RequireMap`) | mapa carregado | `/` se sem mapa | redireciona para `/tuning/ve` |
| `/tuning/ve` | `VETab` dentro de `TuningPage` | herdado | — | — |
| `/tuning/ignition` | `IgnitionTab` dentro de `TuningPage` | herdado | — | bloqueada na UI |
| `/tuning/lambda` | `LambdaTab` dentro de `TuningPage` | herdado | — | bloqueada na UI |
| `/datalog` | `DatalogPage` (via `RequireLog`) | 1+ logs ativos | `/` se sem logs | redireciona para `/datalog/dashboard` |
| `/datalog/dashboard` | `DashboardTab` dentro de `DatalogPage` | herdado | — | — |
| `/datalog/charts` | `ChartsTab` dentro de `DatalogPage` | herdado | — | — |
| `/datalog/data` | `DataTab` dentro de `DatalogPage` | herdado | — | — |

---

## Guards

Os guards são componentes React simples que verificam o estado dos stores Zustand e redirecionam se o pré-requisito não for atendido. Eles **não exibem uma tela de erro** — apenas redirecionam para `/`, onde o usuário verá os cards desabilitados com a explicação do que falta.

### `RequireMap`

Protege todas as rotas `/tuning/*`. Redireciona para `/` se `originalMap === null`.

```tsx
// components/guards/RequireMap.tsx
import { Navigate } from 'react-router-dom'
import { useMapStore } from '@/store/mapStore'

interface Props {
  children: React.ReactNode
}

export function RequireMap({ children }: Props) {
  const originalMap = useMapStore((s) => s.originalMap)

  // Se o sessionRestorer ainda está rodando (isRestoring=true), exibir loading
  // Para evitar redirect prematuro antes da restauração terminar
  const isRestoring = useSessionStore((s) => s.isRestoring)
  if (isRestoring) {
    return <SessionRestoringSpinner />
  }

  if (originalMap === null) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
```

### `RequireLog`

Protege todas as rotas `/datalog/*`. Redireciona para `/` se não houver nenhum log ativo (`activeLogs.length === 0`).

```tsx
// components/guards/RequireLog.tsx
import { Navigate } from 'react-router-dom'
import { useLogStore } from '@/store/logStore'
import { useSessionStore } from '@/store/sessionStore'

interface Props {
  children: React.ReactNode
}

export function RequireLog({ children }: Props) {
  const activeLogs = useLogStore((s) => s.logs.filter((l) => l.enabled))
  const isRestoring = useSessionStore((s) => s.isRestoring)

  if (isRestoring) {
    return <SessionRestoringSpinner />
  }

  if (activeLogs.length === 0) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
```

### Comportamento durante o `sessionRestorer`

Na inicialização da aplicação, o `sessionRestorer.ts` restaura o estado do IndexedDB/localStorage de forma assíncrona. Durante esse período, os guards não podem tomar decisões corretas — o `originalMap` pode estar `null` simplesmente porque a restauração ainda não terminou.

Para evitar redirecionamentos prematuros:

1. Um `useSessionStore` com estado `isRestoring: boolean` é definido separadamente.
2. `isRestoring` começa como `true` (antes mesmo do primeiro render) e muda para `false` após o `sessionRestorer` concluir.
3. Os guards verificam `isRestoring` **antes** de checar o estado de mapa/log.
4. Enquanto `isRestoring === true`, exibem um spinner centralizado leve (não a tela completa — apenas o `<main>` com um spinner).

```tsx
// components/guards/SessionRestoringSpinner.tsx
export function SessionRestoringSpinner() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Spinner className="mr-2 h-4 w-4 animate-spin" />
      Restaurando sessão...
    </div>
  )
}
```

### O que acontece ao dar F5

1. O estado em memória é perdido (stores Zustand voltam ao estado inicial com `originalMap = null`).
2. O `sessionRestorer` executa **antes do primeiro render** (chamado em `main.tsx` com `await sessionRestorer.restore()`).
3. Se havia dados salvos no IndexedDB, o estado é restaurado: `originalMap` é populado, logs são carregados.
4. Apenas **após** a restauração (`isRestoring = false`), os guards avaliam o estado.
5. Se a restauração foi bem-sucedida, o guard deixa passar e o usuário vê a tela onde estava.
6. Se o IndexedDB estava vazio (primeira visita ou usuário limpou os dados), o guard redireciona para `/`.

Não há tentativa de manter o estado na URL — o estado reside nos stores, que são restaurados pelo `sessionRestorer`.

---

## Abas das páginas — `NavLink` para subrotas

As abas dentro de `TuningPage` e `DatalogPage` são implementadas com `<NavLink>` do React Router, que automaticamente aplica a classe `active` à aba correspondente à rota atual. Isso garante que o botão "voltar" do navegador funcione corretamente entre abas.

### Abas do `TuningPage`

```tsx
// pages/TuningPage.tsx
import { NavLink, Outlet } from 'react-router-dom'

export function TuningPage() {
  return (
    <div className="flex flex-col h-full">
      <nav className="flex gap-1 border-b px-4 pt-2">
        <TuningTabLink to="ve" label="VE" />
        <TuningTabLink to="ignition" label="Ignition" disabled />
        <TuningTabLink to="lambda" label="Lambda" disabled />
      </nav>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
```

### Abas do `DatalogPage`

```tsx
// pages/DatalogPage.tsx
import { NavLink, Outlet } from 'react-router-dom'

export function DatalogPage() {
  return (
    <div className="flex flex-col h-full">
      {/* TimeRail sempre visível dentro de DatalogPage */}
      <TimeRailContainer />
      <nav className="flex gap-1 border-b px-4 pt-2">
        <NavLink to="dashboard">Dashboard</NavLink>
        <NavLink to="charts">Gráficos</NavLink>
        <NavLink to="data">Dados</NavLink>
      </nav>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
```

O `TimeRailContainer` é um wrapper que lê os stores e passa as props para o componente `TimeRail`. Ele fica acima das abas e **não é desmontado** ao trocar de aba — o TimeRail mantém seu estado continuamente.

---

## Navegação programática

A navegação é **sempre explícita pelo usuário** — não existe redirecionamento automático para uma aba específica ao carregar um mapa ou ao rodar o auto-tuning.

Fluxo correto:
1. Usuário importa mapa via TopBar → store é atualizado, não há redirect.
2. Usuário clica no card "Tuning" na HomePage → `useNavigate()('/tuning')` → redireciona para `/tuning/ve` (por causa do `<Navigate to="ve" replace />` no índice).
3. Usuário importa log via TopBar → store é atualizado, não há redirect.
4. Usuário clica no card "Datalog" → navega para `/datalog/dashboard`.

A única exceção são os redirects de índice (`<Navigate to="ve" replace />`), que garantem que `/tuning` e `/datalog` sempre resolvam para uma subrota específica — mas isso acontece por demanda do router, não por lógica de negócio.

```tsx
// Exemplo de navegação programática a partir dos cards da HomePage
import { useNavigate } from 'react-router-dom'

function HomeCard({ to, disabled }: { to: string; disabled: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      disabled={disabled}
      onClick={() => navigate(to)}
    >
      Abrir →
    </button>
  )
}
```

---

## Rotas bloqueadas na v1

As rotas `/tuning/ignition` e `/tuning/lambda` existem no router e são acessíveis via URL, mas os componentes `IgnitionTab` e `LambdaTab` exibem um estado bloqueado, não conteúdo funcional.

### Comportamento das abas bloqueadas

- A aba é **visível** na barra de navegação do `TuningPage`
- A aba **não é clicável** — `pointer-events: none` ou `disabled` no elemento
- Um `Tooltip` com o texto "Disponível em breve" é exibido ao passar o mouse
- A URL não muda ao tentar clicar
- Se alguém acessar a URL diretamente (ex.: digitar `/tuning/ignition` no browser), o componente exibe um estado vazio com a mesma mensagem "Disponível em breve"

```tsx
// components/TuningTabLink.tsx
import { NavLink } from 'react-router-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  to: string
  label: string
  disabled?: boolean
}

export function TuningTabLink({ to, label, disabled = false }: Props) {
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="px-4 py-2 text-sm text-muted-foreground cursor-not-allowed select-none"
            aria-disabled="true"
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>Disponível em breve</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'px-4 py-2 text-sm border-b-2 border-primary font-medium'
          : 'px-4 py-2 text-sm text-muted-foreground hover:text-foreground'
      }
    >
      {label}
    </NavLink>
  )
}
```

```tsx
// features/tuning/ignition/IgnitionTab.tsx
export function IgnitionTab() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p>Tuning de ignição — Disponível em breve</p>
    </div>
  )
}
```

---

## Diagrama de fluxo de navegação

```
Abrir app
    │
    ▼
sessionRestorer.restore()   ← aguarda IndexedDB
    │
    ├── dados encontrados → popula stores
    └── sem dados → stores iniciais
    │
    ▼
isRestoring = false
    │
    ▼
Router renderiza /
    │
    ├── Guards avaliam estado dos stores
    │   ├── RequireMap: originalMap !== null? → deixa passar
    │   └── RequireLog: activeLogs.length > 0? → deixa passar
    │
    └── Usuário interage
        ├── Clica "Tuning" → navigate('/tuning') → redirect para /tuning/ve
        └── Clica "Datalog" → navigate('/datalog') → redirect para /datalog/dashboard
```

---

## Localização dos arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/App.tsx` | Definição do router, `RouterProvider` |
| `src/pages/RootLayout.tsx` | Layout raiz com TopBar e Outlet |
| `src/pages/HomePage.tsx` | Tela inicial com cards |
| `src/pages/TuningPage.tsx` | Layout da seção Tuning com abas |
| `src/pages/DatalogPage.tsx` | Layout da seção Datalog com TimeRail e abas |
| `src/components/guards/RequireMap.tsx` | Guard que exige mapa carregado |
| `src/components/guards/RequireLog.tsx` | Guard que exige ao menos 1 log ativo |
| `src/components/guards/SessionRestoringSpinner.tsx` | Spinner exibido durante restauração |
| `src/components/TuningTabLink.tsx` | Aba de navegação com suporte a estado bloqueado |
| `src/features/tuning/ignition/IgnitionTab.tsx` | Placeholder da aba Ignition (bloqueada) |
| `src/features/tuning/lambda/LambdaTab.tsx` | Placeholder da aba Lambda (bloqueada) |
