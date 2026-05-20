# Guards de Rota

Componentes que protegem rotas que exigem pré-requisitos (mapa carregado, logs ativos). Ao falhar a verificação, redirecionam para `/` sem exibir mensagem de erro — o usuário vê os cards desabilitados na `HomePage` com a explicação do que falta.

**Localização:** `frontend/src/components/guards/`

---

## `SessionRestoringSpinner`

Exibido pelos guards enquanto o `sessionRestorer` ainda não concluiu a restauração do IndexedDB.

```tsx
// components/guards/SessionRestoringSpinner.tsx
export function SessionRestoringSpinner() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm gap-2">
      <svg className="w-4 h-4 animate-spin" .../>
      Restaurando sessão…
    </div>
  )
}
```

**Quando é exibido:** enquanto `useSessionStore(s => s.isRestoring) === true`.

**Por que existe:** na inicialização, o app renderiza imediatamente (antes da restauração terminar). Sem o spinner, os guards veriam `originalMap === null` e redirecionariam para `/` — perdendo a sessão do usuário que estava em `/tuning`. O spinner pausa a decisão do guard até o IndexedDB ser lido.

---

## `RequireMap`

Protege todas as rotas `/tuning/*`. Exige que `originalMap !== null`.

```tsx
// components/guards/RequireMap.tsx
export function RequireMap({ children }: { children: React.ReactNode }) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const originalMap = useMapStore((s) => s.originalMap)

  if (isRestoring) return <SessionRestoringSpinner />
  if (originalMap === null) return <Navigate to="/" replace />
  return <>{children}</>
}
```

**Fluxo de decisão:**

```
isRestoring = true  →  <SessionRestoringSpinner />
isRestoring = false
  originalMap === null  →  <Navigate to="/" replace />
  originalMap !== null  →  renderiza children
```

---

## `RequireLog`

Protege individualmente as rotas `/datalog/dashboard`, `/datalog/charts` e `/datalog/data`. **Não** envolve `DatalogPage` — a aba Logs (`/datalog/logs`) é acessível sem logs e serve como ponto de entrada para adicioná-los.

Exige pelo menos 1 log ativo (`enabled === true`). Redireciona para `/datalog/logs` (não para `/`) quando a condição não é atendida, mantendo o usuário na seção Datalog.

```tsx
// components/guards/RequireLog.tsx
export function RequireLog({ children }: { children: React.ReactNode }) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const activeLogs  = useLogStore((s) => s.logs.filter((l) => l.enabled))

  if (isRestoring) return <SessionRestoringSpinner />
  if (activeLogs.length === 0) return <Navigate to="/datalog/logs" replace />
  return <>{children}</>
}
```

**Notas:**
- Logs carregados mas desabilitados (toggle off) contam como zero logs ativos — o guard redireciona.
- O redirect usa caminho absoluto `/datalog/logs` (não relativo) para evitar problemas com rotas aninhadas.

---

## Integração no router

```tsx
// App.tsx
{
  path: 'tuning',
  element: <RequireMap><TuningPage /></RequireMap>,  // guard no pai
  children: [ ... ],
},
{
  path: 'datalog',
  element: <DatalogPage />,                          // sem guard no pai
  children: [
    { index: true, element: <Navigate to="logs" replace /> },
    { path: 'logs',      element: <LogsTab /> },
    { path: 'dashboard', element: <RequireLog><DashboardTab /></RequireLog> },
    { path: 'charts',    element: <RequireLog><ChartsTab /></RequireLog> },
    { path: 'data',      element: <RequireLog><DataTab /></RequireLog> },
  ],
},
```

`RequireMap` envolve a **página inteira** de Tuning — todas as abas herdam a proteção.  
`RequireLog` é aplicado **individualmente** em cada aba filha de Datalog que precisa de logs — a aba Logs fica desprotegida e acessível sempre.

---

## `useSessionStore` — estado de restauração

```typescript
// store/sessionStore.ts
interface SessionState {
  isRestoring: boolean     // true até sessionRestorer.ts chamar setRestoringDone()
}
interface SessionActions {
  setRestoringDone(): void // chamado pelo sessionRestorer ao finalizar
}
```

O `isRestoring` começa como `true` (valor inicial do store). O `main.tsx` dispara `restoreSession()` em paralelo com o primeiro render — quando a Promise resolve, `setRestoringDone()` é chamado e `isRestoring` vira `false`, disparando re-render dos guards.

```tsx
// main.tsx
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
restoreSession()  // dispara em background — não bloqueia o render
```

```ts
// persistence/sessionRestorer.ts
export async function restoreSession(): Promise<void> {
  await Promise.allSettled([restoreMap(), restoreLogs(), restoreTuning()])
  const { useSessionStore } = await import('@/store/sessionStore')
  useSessionStore.getState().setRestoringDone()
}
```

---

## O que acontece no F5 (reload)

1. Stores Zustand voltam ao estado inicial: `originalMap = null`, `logs = []`, `isRestoring = true`
2. App renderiza — guards mostram `<SessionRestoringSpinner />`
3. `restoreSession()` lê o IndexedDB e popula os stores
4. `setRestoringDone()` → `isRestoring = false`
5. Guards re-renderizam com estado correto:
   - Dados encontrados → deixam passar, usuário vê a tela onde estava
   - IndexedDB vazio → redirecionam para `/`
