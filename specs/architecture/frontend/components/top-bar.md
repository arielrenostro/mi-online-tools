# Componente `TopBar`

Barra de navegação global em todas as rotas. Logotipo/link para home, badge do mapa carregado, controles de importação de mapa e abertura do `LogsPanel`. Gerencia internamente o estado de abertura do `LogsPanel`.

**Arquivo:** `frontend/src/components/TopBar.tsx`

## Props

Nenhuma. Auto-suficiente — lê os stores diretamente e gerencia o `LogsPanel` via estado local.

## Comportamento

| Elemento | Descrição |
|----------|-----------|
| Logotipo "Master Injection Online Tools" | `<Link to="/">` — navega para a home |
| Badge do mapa | `originalMap.name` truncado (máx 240px); oculto sem mapa |
| Botão "Importar Mapa" | `<input type="file" accept=".csv">` oculto → `useMapStore.loadMap(file)`. Limpa o valor do input após cada seleção (permite reimportar o mesmo arquivo) |
| Botão "Datalogs" | Define `logsOpen = true`, abrindo o `LogsPanel` |
| `LogsPanel` | Renderizado inline, controlado por estado local `logsOpen` |

```typescript
const loadMap = useMapStore((s) => s.loadMap)
const mapName = useMapStore((s) => s.originalMap?.name ?? null)
```

O `TopBar` não subscreve estado reativo do `useLogStore` — o `LogsPanel` faz isso internamente.

## Invariantes

- Usado **exclusivamente** em `RootLayout`. Não instanciar em outras páginas.
- Não recebe `onLogsClick`/`onSettingsClick` por prop — estado do `LogsPanel` é local.
- Botão de config de tuning (gear) **não** está no TopBar — fica em `TuningPage`.
- Botão de exportação de mapa **não** está no TopBar — fica em `EditableMapSection`.
