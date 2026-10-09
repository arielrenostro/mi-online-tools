## Context

Hoje o mapa é gerenciado em três lugares: o nome aparece como label na `TopBar`; importar/exportar
vivem num menu "Ações" (três pontinhos) em `TuningPage`; e o `RequireMap` envolve todo o `/tuning`,
mostrando uma tela de upload no lugar das abas quando não há mapa (a spec fala em "redirecionar para
Home", mas o código nunca fez isso). Não existe "remover mapa", embora `mapStore.clear()` (zera o
estado e apaga a entrada `current` do IndexedDB) já exista. O handler de Ctrl+Z/Y em `TuningPage`
decide a tabela pela rota (`/ignition`, `/lambda`, senão VE). Motivação em `proposal.md`; requisitos
em `specs/`.

Restrições: app 100% client-side; `loadMap` já mantém o mapa anterior quando o parse falha (só
preenche `lastError`); runs de correção sobrevivem a troca/remoção do mapa (`correction-runs`);
`ConfirmDialog` (`variant="danger"`) é o padrão de confirmação (VE Reset, RunSelector).

## Goals / Non-Goals

**Goals:**
- Um lugar único (aba Arquivo) para subir, substituir, exportar, remover e inspecionar o mapa.
- A aba Arquivo funciona sem mapa, sem estado "intermediário" de navegação.
- Renomear Tuning → Mapa de forma consistente em texto, rotas, código e specs.
- Reaproveitar o que existe (`loadMap`, `clear`, `exportMapCsv`/`downloadCsv`, `ConfirmDialog`).

**Non-Goals:**
- Mudar formato de persistência, parser ou exportador.
- Mostrar informações que o modelo não tem (tamanho em bytes, data de importação, firmware).
- Remover mapa pela Home ou por atalho; mexer na lógica dos cards da Home além do rótulo/rota.
- Tornar a remoção desfazível.
- Renomear "auto-tuning" (nome do produto) ou os nomes legados de stores do IndexedDB.

## Decisions

**1. Nome da aba nova: "Arquivo" (`/mapa/arquivo`, spec `mapa-arquivo`).** A seção passa a se chamar
"Mapa"; uma aba "Mapa" dentro de "Mapa" seria ambígua. Alternativa: manter "Mapa" — descartada pelo
mesmo motivo; é uma premissa registrada no proposal e barata de trocar.

**2. Rename em duas camadas, um commit/ordem lógica.** (a) *Mecânico, sem mudança de comportamento:*
`git mv` de pastas/arquivos (`features/tuning` → `features/mapa`, `TuningPage` → `MapaPage`,
`TuningTabLink` → `MapaTabLink`) e dos diretórios de spec (`tuning-*` → `mapa-*`), com troca dos
imports/textos; fica verificável só por `build` + `test` + `grep`. (b) *Funcional:* aba Arquivo,
guard, TopBar, atalhos. Fazer (a) primeiro isola o ruído do diff. Alternativa: renomear só o texto
visível — descartada pelo pedido de renomear tudo.

**3. Rotas `/mapa/*` com redirect legado.** `App.tsx` ganha uma rota `tuning/*` que navega para
`/mapa` (que já redireciona para `ve`), para favoritos e PWA em cache. Perde-se o sub-caminho
(`#/tuning/lambda` cai em `#/mapa/ve`) — suficiente para um app de uso pessoal e evita um mapa de
redirecionamento por aba.

**4. Persistência: sem migração de dados, exceto um campo.** Nomes `tuning-output`/`tuning-history`
(stores órfãs do IndexedDB) ficam — renomear exigiria bump de versão do banco sem ganho. Em
`miot:ui`, o campo `tuningAnalysisMode` passa a `mapaAnalysisMode`; `hydrate` aceita o nome antigo
como fallback para não perder a preferência salva (e o persist grava só o novo).

**5. Guard por aba, não no pai.** `RequireMap` sai do elemento da seção em `App.tsx` e passa a
envolver `ve`, `ignition` e `lambda`; `MapaPage` (barra de abas) renderiza sempre. Alternativa:
manter o guard no pai com exceção por rota — descartada por acoplar o guard a um caminho e esconder
a barra justamente quando o usuário precisa dela. O guard mostra um aviso "Nenhum mapa carregado" +
link para `/mapa/arquivo` (o upload agora mora lá — evita duas telas de upload); `isRestoring`
continua mostrando o spinner.

**6. Remover mapa = `mapStore.clear()`, sem navegar.** O usuário já está na aba Arquivo (estado
vazio). Nenhum redirect automático. `clear()` não mexe em logs, constantes, filtros nem runs, o que
bate com a spec. Alternativa: apagar runs também — descartada, contradiz `correction-runs`.

**7. Confirmações via `ConfirmDialog`.** Remover sempre confirma (texto cita edições perdidas se
`isDirty || isDirtyIgnition || isDirtyLambda`, e sugere exportar antes). Importar com um mapa já
carregado (mesmo botão "Importar mapa" do estado vazio) só confirma se houver edições. O `File` escolhido fica em estado local até confirmar/cancelar.

**8. Informações derivadas, sem novo estado.** Função pura `countEditedCells(editable, original)` em
`utils/mapInfo.ts` (com teste) compara célula a célula; faixas de RPM/MAP via min/max (o modelo
guarda RPM crescente e MAP decrescente — não depender da ordem). Alternativa: reutilizar `isDirty*`
— descartada, é booleano e a spec pede contagem.

**9. Atalhos de undo/redo por aba.** O handler continua deduzindo a tabela pela rota, agora com
mapeamento explícito `ve → ve`, `ignition → ignição`, `lambda → lambda` e *nenhuma ação* para
qualquer outra rota (inclui `/arquivo`), em vez do `else` que cai na VE. Cada tabela já tem seu
próprio histórico no `mapStore`; nada muda lá. O handler já ignora foco em INPUT/TEXTAREA.

**10. Dropzone na própria aba.** Mesmo comportamento do card da Home (primeiro `.csv` vence,
não-CSV ignorado); a área serve ao estado vazio e à importação com mapa já carregado. Input `accept=".csv"` com valor
limpo após cada escolha.

**11. Exportar/Remover só com mapa.** Sem mapa, os botões "Exportar mapa" e "Remover mapa" não são renderizados (em vez de ficarem desabilitados); o único botão do estado vazio é "Importar mapa", que também é o rótulo usado com mapa carregado.

**12. Aba "Eficiência Volumétrica".** Só o rótulo (`MapaPage`, aviso da `TopBar`, toast "Ver em Eficiência Volumétrica →", textos de ajuda/Configurações) e o texto das specs; rota, componentes e ids mantêm `ve`.

**13. `TopBar` deixa de ler `mapStore`.** Some o `<span>` do nome e o seletor `originalMap?.name`;
o item vira "Mapa" (link para `/mapa`) e mantém o indicador de run novo (`hasUnseenRun`).

## Risks / Trade-offs

- [Diff grande do rename mistura-se com o working tree já modificado e sem commit] → fazer o rename
  (grupo 1) primeiro e rodar `build` + `test` antes de seguir; commitar o estado anterior antes, se
  o usuário quiser um diff limpo.
- [Rename de pasta de spec esquece referências cruzadas (`tuning-ve-correction` citado em outras
  specs/CLAUDE.md)] → `grep -rn "tuning" openspec/specs CLAUDE.md frontend/CLAUDE.md` deve ficar
  sem ocorrências relevantes (exceto "auto-tuning").
- [Quem tinha `#/tuning/lambda` salvo cai em `#/mapa/ve`] → aceito (decisão 3).
- [Usuário cai em `/mapa/ve` sem mapa e vê um aviso em vez da tela de upload de antes] → o aviso traz
  o link direto para a aba Arquivo.
- [Estado de seleção compartilhado da VE/gráficos pode referenciar células do mapa removido] →
  verificar na implementação se a seleção é zerada ao limpar/trocar o mapa; se não for, zerá-la.
- [Remoção é irreversível] → confirmação sempre; a mensagem lembra de exportar antes.
- [Sem o menu de três pontinhos, quem se acostumou perde o atalho] → trade-off aceito.
- [Os nomes dos 3 cenários renomeados em `home`/`navigation-guards` ainda dizem "Tuning" nos deltas,
  porque o validador exige reaproveitar os títulos antigos] → renomeá-los nas specs principais
  depois do archive (tarefa 7.4).
