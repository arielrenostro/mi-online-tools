## Context

O router é criado uma única vez em `frontend/src/App.tsx` com `createBrowserRouter` (History API).
Navegação interna funciona, mas abrir `/datalog/charts` ou recarregar nela exige que o servidor
responda `index.html` para caminhos inexistentes. O `nginx.conf` (`try_files … /index.html`) faz
isso; o CloudFront com origem estática (S3) não, e devolve 403/404. Ver `proposal.md` — Why.

Todo o código de roteamento já passa pelo router (`Link`, `NavLink`, `useNavigate`, `useLocation`,
`useBlocker`, `<Navigate>`); nenhum lugar lê `window.location` para decidir rota (verificado por
grep em `frontend/src`). Os assets são emitidos pelo Vite com caminhos absolutos (`/assets/...`),
o que continua válido porque o documento sempre é servido da raiz.

## Goals / Non-Goals

**Goals:**
- Abrir/recarregar qualquer tela funcionar no CloudFront sem configuração no servidor.
- Zero mudança de comportamento dentro do app (rotas, guards, redirects, bloqueio de saída da aba
  Logs com filtros pendentes).

**Non-Goals:**
- Manter compatibilidade com URLs antigas sem `#` (caem na Home; app sem backend e sem links
  públicos conhecidos).
- Alterar a infraestrutura do CloudFront ou o `nginx.conf`.
- Servir o app de um subcaminho (`base` do Vite) — não solicitado.

## Decisions

**1. `createHashRouter` no lugar de `createBrowserRouter`.**
Troca de uma linha (import + chamada) em `App.tsx`; a mesma API de data router mantém `useBlocker`
(usado em `LogsTab`) e `RouterProvider`. URLs ficam `https://host/#/datalog/charts`. O servidor só
precisa servir `/`, o que o CloudFront já faz via Default Root Object (`index.html`).

*Alternativas consideradas:*
- **Páginas de erro do CloudFront (403/404 → `/index.html` com status 200).** Mantém URLs limpas e
  não mexe no código, mas é configuração de infraestrutura fora do repositório, fácil de se perder
  ao recriar a distribuição, e mascara 404 reais de assets (um JS ausente voltaria HTML). O usuário
  indicou preferir a abordagem de `#` (padrão conhecido do Angular). Pode ser adotada
  adicionalmente no futuro sem conflito.
- **CloudFront Function/Lambda@Edge reescrevendo URIs sem extensão para `/index.html`.** Mesma
  natureza de infraestrutura, mais peças para manter; descartada.

**2. Manter `nginx.conf` como está.**
O fallback `try_files` deixa de ser necessário, mas é inofensivo e continua útil para quem abrir
URLs antigas sem hash no ambiente Docker (caem na Home em vez de erro).

**3. Atualizar documentação junto (regra do projeto: código e specs andam juntos).**
Delta de `navigation-guards` (nova requirement de URLs por fragmento), linha "Roteamento" em
`specs/architecture/overview.md` e a seção "Routing" de `frontend/README.md`, que está
desatualizada (descreve `?tab=` e React Router v6; o app usa rotas aninhadas e v7).

## Risks / Trade-offs

- [URLs com `#` são menos "bonitas" e o fragmento não chega ao servidor/analytics] → Aceito; app
  interno de ferramentas, sem SEO ou métricas de rota.
- [Favoritos/links antigos sem `#` deixam de abrir a tela certa] → Caem na Home; sem backend e sem
  links publicados, impacto mínimo. Mencionar no resumo da mudança.
- [Algum código futuro usar `window.location.pathname`] → Já inexistente hoje; reforçar na nota do
  `frontend/CLAUDE.md`: ler rota sempre via `useLocation`.
- [Âncoras `href="#..."` na página conflitariam com o fragmento de rota] → Nenhum `href` no código
  atual (grep sem resultados); nada a fazer.
