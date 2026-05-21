# Guards de Rota

Componentes que protegem rotas com pré-requisitos (mapa carregado, logs ativos). Ao falhar, redirecionam sem exibir erro — o usuário vê cards desabilitados na origem.

**Localização:** `frontend/src/components/guards/`

## `SessionRestoringSpinner`

Spinner centralizado ("Restaurando sessão…") exibido pelos guards enquanto `useSessionStore(s => s.isRestoring) === true`.

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

Protege `/datalog/dashboard|charts|data` individualmente. **Não** envolve `DatalogPage` — a aba Logs (`/datalog/logs`) é acessível sem logs e serve de ponto de entrada. Exige ≥1 log ativo (`enabled === true`); logs desabilitados contam como zero. Redireciona para `/datalog/logs` (caminho absoluto), mantendo o usuário na seção Datalog.

```tsx
export function RequireLog({ children }: { children: React.ReactNode }) {
  const isRestoring = useSessionStore((s) => s.isRestoring)
  const activeLogs  = useLogStore((s) => s.logs.filter((l) => l.enabled))
  if (isRestoring) return <SessionRestoringSpinner />
  if (activeLogs.length === 0) return <Navigate to="/datalog/logs" replace />
  return <>{children}</>
}
```

Ambos checam `isRestoring` **antes** do estado de mapa/log.

## `useSessionStore`

```typescript
interface SessionState   { isRestoring: boolean }   // começa true
interface SessionActions { setRestoringDone(): void }
```

`main.tsx` renderiza o app e dispara `restoreSession()` **em paralelo** (não bloqueia o render). O `sessionRestorer` lê o IndexedDB, popula os stores e ao final chama `setRestoringDone()` → `isRestoring = false`, disparando o re-render dos guards.
