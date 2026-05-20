# Componente `TuningTabLink`

Aba de navegação dentro de `TuningPage`. Wrapper sobre `<NavLink>` que adiciona suporte a estado bloqueado (tabs não implementadas na v1).

**Arquivo:** `frontend/src/components/TuningTabLink.tsx`

## Props

```typescript
interface Props {
  to: string        // sub-rota relativa: "ve" | "ignition" | "lambda"
  label: string
  disabled?: boolean // padrão false
}
```

## Comportamento

### Aba ativa (`disabled = false`)

`<NavLink>` com callback de classe:

| Estado | Estilo |
|--------|--------|
| Rota ativa | `border-b-2 border-blue-500 text-blue-400 font-medium` |
| Inativa | `text-gray-500 hover:text-gray-300` |

### Aba bloqueada (`disabled = true`)

`<span>` estático (não clicável, não altera a URL): `cursor-not-allowed`, `text-gray-600`, `select-none`, `title="Disponível em breve"` (tooltip nativo), `aria-disabled="true"`, label com sufixo `🔒`.

## Contexto de roteamento

`to` é **relativo** — `TuningPage` está em `/tuning`, então `to="ve"` resolve para `/tuning/ve`. O `<NavLink>` gerencia o match com a rota atual via `isActive`.

## Extensão

Para outras seções (Datalog, etc.) que precisem do mesmo padrão, criar um `TabLink` genérico ou `DatalogTabLink` análogo — não reutilizar `TuningTabLink` fora de `TuningPage`.
