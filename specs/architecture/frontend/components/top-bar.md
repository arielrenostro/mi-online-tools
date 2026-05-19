# Componente `TopBar`

Barra de navegação global exibida em todas as rotas da aplicação. Contém o logotipo/link para home, o badge do mapa carregado, os controles de importação de mapa e abertura do painel de datalogs. Gerencia internamente o estado de abertura do `LogsPanel`.

**Localização:** `frontend/src/components/TopBar.tsx`

---

## Props

Nenhuma. O componente é auto-suficiente — lê os stores diretamente e gerencia o estado do `LogsPanel` internamente.

---

## Comportamento

| Elemento | Descrição |
|----------|-----------|
| **Logotipo "Master Injection Online Tools"** | `<Link to="/">` — navega para a home ao clicar |
| **Badge do mapa** | Exibe `originalMap.name` truncado (max 240 px). Oculto quando nenhum mapa está carregado |
| **Botão "Importar Mapa"** | Abre um `<input type="file" accept=".csv">` oculto. Ao selecionar, chama `useMapStore.loadMap(file)`. O valor do input é limpo após cada seleção para permitir reimportar o mesmo arquivo |
| **Botão "Datalogs"** | Define `logsOpen = true`, abrindo o `LogsPanel` |
| **`LogsPanel`** | Renderizado inline no `TopBar`, controlado por estado local `logsOpen` |

### Leitura dos stores

```typescript
const loadMap = useMapStore((s) => s.loadMap)
const mapName = useMapStore((s) => s.originalMap?.name ?? null)
```

O `TopBar` não subscreve nenhum estado reativo do `useLogStore` diretamente — o `LogsPanel` faz isso internamente.

---

## Exemplo de uso

```tsx
// pages/RootLayout.tsx
import { TopBar } from '@/components/TopBar'

export function RootLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

`TopBar` é usado **exclusivamente** em `RootLayout`. Não deve ser instanciado em outras páginas ou features.

---

## Invariantes

- Não recebe `onLogsClick` nem `onSettingsClick` por prop — o estado de abertura do `LogsPanel` é local.
- O botão de configurações de tuning (gear icon) **não** está no `TopBar` — fica em `TuningPage`, pois é específico da seção de tuning.
- O botão de exportação de mapa **não** está no `TopBar` — fica em `EditableMapSection`, junto ao contexto onde faz sentido.
