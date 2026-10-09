## Why

O gerenciamento do mapa está espalhado: o nome do mapa fica como um "label" no topo de toda a
aplicação (ocupando espaço sem ser acionável), importar/exportar fica num menu de três pontinhos
escondido na barra de abas, e não existe como remover o mapa nem ver o que foi carregado. Uma aba
dedicada concentra tudo num lugar óbvio e deixa o topo limpo. Junto, a seção "Tuning" passa a se
chamar "Mapa", em tudo (texto, rotas, pastas, specs).

## What Changes

- **Remover o label do mapa da `TopBar`** (o nome do arquivo ao lado de "Master Injection Online
  Tools"). O nome passa a aparecer na nova aba e nos cards da Home (já exibem).
- **Renomear "Tuning" → "Mapa" em tudo:**
  - texto visível (item da `TopBar`, card da Home, avisos, mensagens, ajuda);
  - rotas: `/tuning/*` → `/mapa/*` (`/mapa`, `/mapa/ve`, `/mapa/ignition`, `/mapa/lambda`);
    URLs antigas `#/tuning...` redirecionam para `#/mapa`;
  - código: `features/tuning/` → `features/mapa/`, `TuningPage` → `MapaPage`, `TuningTabLink` →
    `MapaTabLink`, `TuningAnalysisMode` → `MapaAnalysisMode`;
  - specs: `tuning-ve`, `tuning-ve-correction`, `tuning-ignition`, `tuning-lambda` →
    `mapa-ve`, `mapa-ve-correction`, `mapa-ignition`, `mapa-lambda`; textos de todas as specs e dos
    `CLAUDE.md` que citam Tuning passam a dizer Mapa.
  - **Não renomeia:** "auto-tuning" como nome do produto (descrição do app, `index.html`, manifest,
    `CLAUDE.md`), pois não é a seção; e os nomes legados `tuning-output`/`tuning-history` das stores
    órfãs do IndexedDB, que são formato de dados persistidos.
- **Nova aba "Arquivo" na seção Mapa** (`/mapa/arquivo`), primeira da barra de abas (antes de VE,
  Ignition, Lambda), com:
  - **Subir mapa** — escolher um `.csv` (ou arrastar) quando não há mapa; **Importar mapa**
    (o mesmo botão) quando já há um (pede confirmação se o mapa atual tiver edições, pois elas são descartadas);
  - **Exportar mapa** — baixa o CSV `_tuned` com as edições atuais; só aparece com mapa carregado;
  - **Remover mapa** — descarta o mapa, as edições e a cópia persistida, com confirmação;
    só aparece com mapa carregado;
  - **Informações do mapa** — nome do arquivo, tamanho da grade (colunas RPM × linhas MAP), faixa
    de RPM, faixa de MAP e, por tabela (VE, Ignição, Lambda alvo), quantas células foram editadas
    em relação ao original.
- **A aba Arquivo é acessível sem mapa carregado**: o guard `RequireMap` deixa de envolver toda a
  seção e passa a proteger só VE, Ignition e Lambda, que sem mapa mostram um aviso apontando para a
  aba Arquivo. Depois de remover o mapa o usuário continua na aba Arquivo, pronto para subir outro.
- **Aba "VE" renomeada para "Eficiência Volumétrica"** (só o rótulo: barra de abas, avisos, links e textos que citam a aba; rota `/mapa/ve`, ids de spec, código e nomes de sinais/tabela "VE" ficam).
- **Remover o menu "Ações" (três pontinhos)** da barra de abas — Importar/Exportar migram para a
  aba Arquivo.
- **Ctrl+Z / Ctrl+Y por aba/tabela:** os atalhos agem só na tabela editável da aba em exibição
  (VE → VE, Ignition → ignição, Lambda → lambda); na aba Arquivo, que não tem tabela editável, não
  fazem nada (hoje, fora de Ignition/Lambda, caem no undo da VE).
- Specs desatualizadas em relação ao código são corrigidas junto: o requisito "TopBar map control"
  descreve um controle de importar/substituir que já não existe na `TopBar`, e o guard descrito como
  "redireciona para Home" na prática mostra uma tela de upload no lugar.

> **Premissa:** o nome da aba nova é "Arquivo" (e não "Mapa") porque a seção inteira agora se
> chama "Mapa" e `Mapa > Mapa` seria ambíguo. Trocar o nome é só texto/rota/id de spec.

## Capabilities

### New Capabilities
- `mapa-arquivo`: a aba Arquivo da seção Mapa — importar/substituir, exportar, remover e
  informações do mapa; comportamento sem mapa carregado.

### Modified Capabilities
- `map-import-export`: sai o requisito "TopBar map control" (import/replace/nome do mapa na
  `TopBar`); import e export passam a ser acionados pela aba Arquivo, e o controle de export não
  aparece sem mapa.
- `navigation-guards`: rotas `/tuning` → `/mapa` (com redirect das antigas); o guard de mapa passa
  a cobrir só VE/Ignition/Lambda e mostra um aviso apontando para a aba Arquivo em vez de
  redirecionar para Home; "Global navigation affordances" deixa de exigir o badge do mapa na
  `TopBar`.
- `home`: o card "Tuning" vira "Mapa" e navega para `/mapa`.
- `heatmap-editing`: undo/redo por aba/tabela; aba Arquivo não tem tabela editável.
- `mapa-ve`: a aba é rotulada "Eficiência Volumétrica".

(Os renomes de id das specs `tuning-*` → `mapa-*` e a troca de "Tuning" por "Mapa" no texto das demais
specs não mudam requisitos; são feitos diretamente nas specs principais na implementação — ver
`tasks.md` grupo 7.)

## Impact

- **Código (frontend):** `components/TopBar.tsx`, `pages/TuningPage.tsx` → `pages/MapaPage.tsx`
  (sem menu de ações; aba Arquivo; atalhos por aba), `App.tsx` (rotas `mapa/*`, redirect de
  `tuning/*`, `RequireMap` por aba), `components/guards/RequireMap.tsx` (aviso), `HomePage.tsx`,
  `TuningTabLink.tsx` → `MapaTabLink.tsx`, `features/tuning/**` → `features/mapa/**` (todos os
  imports `@/features/tuning/...`), `types/ui.ts` e `store/uiStore.ts` (rename do tipo/campo, lendo o
  campo antigo salvo), `DatalogHelpModal.tsx` e comentários que citam Tuning; nova pasta
  `features/mapa/arquivo/` com `ArquivoTab`.
- **Stores/persistência:** sem mudança de formato. `mapStore.clear()` já existe e já limpa o
  IndexedDB. O campo `tuningAnalysisMode` salvo em `miot:ui` continua sendo lido (migração no
  `hydrate`). Runs de correção **não** são apagados ao remover o mapa (regra já em `correction-runs`).
- **URLs:** rotas mudam de `#/tuning/...` para `#/mapa/...`; favoritos antigos são redirecionados.
- **Specs:** nova `openspec/specs/mapa-arquivo`; deltas em `map-import-export`, `navigation-guards`,
  `home`, `heatmap-editing`; renome de quatro capabilities e reescrita de texto nas demais.
  `CLAUDE.md` da raiz e `frontend/CLAUDE.md` atualizados.
- **Sem dependências novas.** A change em andamento anterior (`correction-runs-and-unified-filter`)
  já foi arquivada; não há conflito de change aberta, mas o working tree tem alterações não
  commitadas nos mesmos arquivos — aplicar sobre elas.
