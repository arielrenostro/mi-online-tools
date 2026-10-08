## Why

Publicado no CloudFront (origem estática, sem regra de fallback), abrir diretamente uma URL de tela
— por exemplo `/datalog/charts` — ou recarregar a página estando nela devolve erro (403/404 do
S3/CloudFront), porque o caminho não existe como arquivo. Hoje o app usa `createBrowserRouter`
(History API), que depende do servidor responder `index.html` para qualquer caminho; o `nginx.conf`
local faz isso, mas o CloudFront não. Como o app é 100% estático e sem backend, a navegação não
deveria depender de configuração do servidor.

## What Changes

- Trocar `createBrowserRouter` por `createHashRouter` em `frontend/src/App.tsx`: as rotas passam a
  viver depois do `#` (ex.: `https://host/#/datalog/charts`). O servidor só precisa servir `/` →
  `index.html`, então abrir a URL e recarregar funcionam em qualquer host estático.
- A árvore de rotas, os guards (`RequireMap`/`RequireLog`), os redirecionamentos de índice e todo o
  uso de `Link`/`NavLink`/`useNavigate`/`useLocation`/`useBlocker` permanecem iguais — o
  `pathname` visto pelo React Router continua sendo `/datalog/charts` etc.
- Documentar a decisão (URLs com `#`) nas specs e na documentação de arquitetura/roteamento.
- Sem **BREAKING** de comportamento dentro do app. Efeito colateral aceito: links/favoritos antigos
  no formato `/datalog/charts` (sem `#`) deixam de apontar para a tela e caem na Home.

Fora de escopo: configurar páginas de erro personalizadas no CloudFront (alternativa de
infraestrutura descrita no design) e mudanças no `nginx.conf`.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `navigation-guards`: passa a exigir que as rotas sejam endereçáveis por hash (`/#/...`), de modo
  que abrir uma URL de tela diretamente ou recarregá-la funcione em hospedagem estática sem
  fallback para `index.html`.

## Impact

- Código: `frontend/src/App.tsx` (único ponto de criação do router). Nenhum componente usa
  `window.location` para roteamento — `TuningPage`, `DatalogPage` e `LogsTab` já leem a rota via
  `useLocation`/`useBlocker`, que funcionam igual com hash router.
- Specs/docs: `openspec/specs/navigation-guards/spec.md` (delta), `specs/architecture/overview.md`
  (linha de roteamento), `frontend/CLAUDE.md` se citar o tipo de router.
- Deploy: nenhuma alteração de infraestrutura necessária; `frontend/nginx.conf` (fallback) torna-se
  desnecessário mas inofensivo e é mantido.
- Dependências: nenhuma nova (`react-router-dom` já expõe `createHashRouter`).
