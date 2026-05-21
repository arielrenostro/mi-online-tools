# Home

**Rota:** `/` · **Pré-requisito:** nenhum

Tela inicial e ponto de entrada. Apresenta as funcionalidades como cards e orienta o usuário sobre o que importar para começar.

## Layout

Título do app + subtítulo orientativo, e dois cards lado a lado:

- **Card Tuning** — "Edite e afine os mapas da ECU com base nos dados dos logs."
- **Card Datalog** — "Visualize e analise os dados capturados pelo veículo."

## Estados dos cards

| Card | Pré-requisito | Habilitado | Desabilitado |
|------|---------------|------------|--------------|
| Tuning | mapa importado | Botão ativo; exibe `✓ Mapa: <nome>.csv`; clique → `/tuning` | Botão cinza não clicável; `⚠ Requer: mapa importado` |
| Datalog | 1+ logs importados | Botão ativo; exibe `✓ N logs carregados (<duração>)`; clique → `/datalog` | Botão cinza não clicável; `⚠ Requer: 1+ logs importados` |

Combinações: nada carregado (ambos desabilitados, TopBar destaca os botões de importação) · só mapa (Tuning ativo) · só logs (Datalog ativo) · ambos (fluxo completo pronto).

## Navegação

Sem navbar lateral — a navegação ocorre pelos cards e pelo logotipo/`← Home` das telas filhas. O estado da sessão é restaurado ao recarregar (ver [architecture/frontend/persistence.md](../../architecture/frontend/persistence.md)), mas a rota não é persistida: o reload sempre cai na Home.
