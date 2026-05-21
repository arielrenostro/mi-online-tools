# Componente `TuningTabLink`

Aba de navegação dentro de `TuningPage`. Wrapper sobre `<NavLink>` que adiciona suporte a estado bloqueado (abas não implementadas na v1).

**Arquivo:** `frontend/src/components/TuningTabLink.tsx`

## Props

```typescript
interface Props {
  to: string         // sub-rota relativa: "ve" | "ignition" | "lambda"
  label: string
  disabled?: boolean // padrão false
}
```

## Comportamento

- **Aba ativa (`disabled = false`)** — `<NavLink>` com callback de classe: rota ativa = borda inferior azul + texto azul; inativa = cinza com hover.
- **Aba bloqueada (`disabled = true`)** — `<span>` estático, não clicável, não altera a URL: `cursor-not-allowed`, texto cinza, tooltip nativo "Disponível em breve", `aria-disabled="true"`, label com sufixo `🔒`.

`to` é **relativo** — `TuningPage` está em `/tuning`, então `to="ve"` resolve para `/tuning/ve`; o `<NavLink>` gerencia o match via `isActive`.

> Não reutilizar fora de `TuningPage`. Para outras seções, criar um `TabLink` genérico análogo.
