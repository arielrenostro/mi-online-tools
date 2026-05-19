# Componente `TuningTabLink`

Aba de navegação usada dentro de `TuningPage`. Wrapper sobre `<NavLink>` do React Router que adiciona suporte a estado bloqueado (tabs não implementadas na v1) com estilo visual consistente.

**Localização:** `frontend/src/components/TuningTabLink.tsx`

---

## Props

```typescript
interface Props {
  to: string        // sub-rota relativa: "ve" | "ignition" | "lambda"
  label: string     // texto da aba
  disabled?: boolean // padrão: false
}
```

---

## Comportamento

### Aba ativa (`disabled = false`)

Usa `<NavLink>` com callback de classe para aplicar estilo ativo:

| Estado | Estilo |
|--------|--------|
| Rota ativa | `border-b-2 border-blue-500 text-blue-400 font-medium` |
| Inativa | `text-gray-500 hover:text-gray-300` |

### Aba bloqueada (`disabled = true`)

Renderiza um `<span>` estático (não é clicável, não altera a URL):

- `cursor-not-allowed`, `text-gray-600`, `select-none`
- Atributo `title="Disponível em breve"` exibe tooltip nativo do browser
- `aria-disabled="true"` para acessibilidade
- Label exibe sufixo `🔒`

---

## Exemplo de uso

```tsx
// pages/TuningPage.tsx
<nav className="flex items-center gap-1 px-4 pt-2 border-b border-gray-800">
  <TuningTabLink to="ve"        label="VE" />
  <TuningTabLink to="ignition"  label="Ignition" disabled />
  <TuningTabLink to="lambda"    label="Lambda"   disabled />
</nav>
```

---

## Contexto de roteamento

Os `to` são **relativos** — `TuningPage` é renderizado dentro de uma rota `/tuning`, portanto `to="ve"` resolve para `/tuning/ve`. O React Router `<NavLink>` gerencia a correspondência com a rota atual automaticamente via `isActive`.

---

## Extensão para outras seções

Se futuras seções (Datalog, etc.) precisarem do mesmo padrão, criar um componente genérico `TabLink` ou um `DatalogTabLink` análogo — não reutilizar `TuningTabLink` fora de `TuningPage`.
