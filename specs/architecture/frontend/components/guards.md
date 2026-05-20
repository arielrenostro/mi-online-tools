# Guards de Rota

Componentes que protegem rotas com pré-requisitos (mapa carregado, logs ativos). Ao falhar, redirecionam sem exibir erro — o usuário vê cards desabilitados na origem.

**Localização:** `frontend/src/components/guards/`

## `SessionRestoringSpinner`

Exibido pelos guards enquanto `useSessionStore(s => s.isRestoring) === true`.

```tsx
export function SessionRestoringSpinner() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm gap-2">
      <svg className="w-4 h-4 animate-spin" .../>
      Restaurando sessão…
    </div>
  )
}
```

**Por que existe:** o app renderiza imediatamente, antes da restauração do IndexedDB terminar. Sem o spinner, os guards veriam `originalMap === null` e redirecionariam para `/`, perdendo a sessão. O spinner pausa a decisão do guard até o IndexedDB ser lido.

## `RequireMap`

Protege `/tuning/*`. Exige `originalMap !== null`.

```tsx
export function RequireMap({ children }: { children: React.ReactNode }) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const originalMap = useMapStore((s) => s.originalMap)
  if (isRestoring) return <SessionRestoringSpinner />
  if (originalMap === null) return <Navigate to="/" replace />
  return <>{children}</>
}
```

## `RequireLog`

Protege `/datalog/dashboard|charts|data` individualmente. **Não** envolve `DatalogPage` — a aba Logs (`/datalog/logs`) é acessível sem logs e serve de ponto de entrada. Exige ≥1 log ativo (`enabled === true`); redireciona para `/datalog/logs` (caminho absoluto), mantendo o usuário na seção Datalog.

```tsx
export function RequireLog({ children }: { children: React.ReactNode }) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const activeLogs  = useLogStore((s) => s.logs.filter((l) => l.enabled))
  if (isRestoring) return <SessionRestoringSpinner />
  if (activeLogs.length === 0) return <Navigate to="/datalog/logs" replace />
  return <>{children}</>
}
```

Logs carregados mas desabilitados contam como zero logs ativos.

## Integração no router

```tsx
{ path: 'tuning', element: <RequireMap><TuningPage /></RequireMap>, children: [...] }  // guard no pai
{ path: 'datalog', element: <DatalogPage />, children: [                              // sem guard no pai
    { index: true, element: <Navigate to="logs" replace /> },
    { path: 'logs',      element: <LogsTab /> },
    { path: 'dashboard', element: <RequireLog><DashboardTab /></RequireLog> },
    { path: 'charts',    element: <RequireLog><ChartsTab /></RequireLog> },
    { path: 'data',      element: <RequireLog><DataTab /></RequireLog> },
] }
```

`RequireMap` envolve a página inteira (abas herdam). `RequireLog` é aplicado individualmente nas abas que precisam de logs.

## `useSessionStore`

```typescript
// store/sessionStore.ts
interface SessionState { isRestoring: boolean }   // true até setRestoringDone()
interface SessionActions { setRestoringDone(): void }
```

`isRestoring` começa `true`. `main.tsx` dispara `restoreSession()` em paralelo com o primeiro render; ao resolver, `setRestoringDone()` torna `isRestoring = false`, disparando re-render dos guards.

```tsx
// main.tsx
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
restoreSession()  // background — não bloqueia o render
```

```ts
// sessionRestorer.ts
export async function restoreSession(): Promise<void> {
  await Promise.allSettled([restoreMap(), restoreLogs(), restoreTuning()])
  const { useSessionStore } = await import('@/store/sessionStore')
  useSessionStore.getState().setRestoringDone()
}
```

## F5 (reload)

1. Stores voltam ao inicial: `originalMap = null`, `logs = []`, `isRestoring = true`
2. App renderiza — guards mostram `<SessionRestoringSpinner />`
3. `restoreSession()` lê o IndexedDB e popula os stores
4. `setRestoringDone()` → `isRestoring = false`
5. Guards re-renderizam: dados encontrados → passam; IndexedDB vazio → redirecionam para `/`
