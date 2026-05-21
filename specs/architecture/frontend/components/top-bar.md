# Componente `TopBar`

Barra de navegação global em todas as rotas. Logotipo/link para home, badge do mapa carregado, controle de importação de mapa e abertura do `LogsPanel`.

**Arquivo:** `frontend/src/components/TopBar.tsx`

## Props

Nenhuma. Auto-suficiente — lê os stores diretamente e gerencia o `LogsPanel` via estado local (`logsOpen`).

## Comportamento

| Elemento | Descrição |
|----------|-----------|
| Logotipo "Master Injection Online Tools" | `<Link to="/">` — navega para a home |
| Badge do mapa | `originalMap.name` truncado (máx 240px); oculto sem mapa |
| Botão "Importar Mapa" | `<input type="file" accept=".csv">` oculto → `useMapStore.loadMap(file)`. Limpa o valor do input após cada seleção (permite reimportar o mesmo arquivo) |
| Botão "Datalogs" | Abre o `LogsPanel` (renderizado inline, controlado por `logsOpen`) |

## Invariantes

- Usado **exclusivamente** em `RootLayout`. Não instanciar em outras páginas.
- O botão de config de tuning (gear) fica em `TuningPage`, **não** no TopBar.
- O botão de exportação de mapa fica em `EditableMapSection`, **não** no TopBar.
- O `TopBar` não subscreve estado reativo do `useLogStore` — o `LogsPanel` faz isso internamente.
