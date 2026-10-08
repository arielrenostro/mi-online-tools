## 1. Router

- [x] 1.1 Em `frontend/src/App.tsx`, trocar `createBrowserRouter` por `createHashRouter` (import e chamada), mantendo a árvore de rotas intacta; verificar com `cd frontend && npx tsc --noEmit`
- [x] 1.2 Verificar por grep que nenhum código em `frontend/src` (fora de testes) decide rota via `window.location`/`location.pathname` global, só via `useLocation`/`useBlocker` — `grep -rnE "window\.location|document\.location" frontend/src` sem resultados relevantes

## 2. Specs e documentação

- [x] 2.1 Atualizar a linha "Roteamento" de `specs/architecture/overview.md` para mencionar rotas por fragmento (`#/...`) e verificar que o texto bate com o delta de `navigation-guards`
- [x] 2.2 Corrigir a seção "Routing" de `frontend/README.md` para o formato real (`/#/tuning/ve`, `/#/datalog/logs|dashboard|charts|data|dyno`, React Router v7, guards `RequireMap`/`RequireLog`), conferindo contra as rotas de `App.tsx`
- [x] 2.3 Em `frontend/CLAUDE.md`, adicionar nota curta: roteamento por hash; ler a rota sempre via `useLocation`, nunca `window.location`; conferir que o índice de specs continua correto

## 3. Verificação

- [x] 3.1 Rodar `cd frontend && npm test && npm run build` e confirmar que passam
- [x] 3.2 Manual (`npm run dev` ou `npm run preview`): abrir `http://localhost:<porta>/#/datalog/charts` em aba nova e recarregar (F5) em `#/tuning/ve` — a tela correta carrega; `/#/tuning` e `/#/datalog` redirecionam para `ve`/`logs`; sem mapa, `#/tuning/ve` volta à Home; navegar pela TopBar atualiza o fragmento
- [x] 3.3 Manual: na aba Logs com filtros pendentes (draft), trocar de aba/rota ainda mostra a confirmação de saída; Ctrl+Z na aba Ignition/Lambda continua agindo na tabela correta
- [x] 3.4 Rodar `openspec validate use-hash-router --strict` e confirmar que passa
