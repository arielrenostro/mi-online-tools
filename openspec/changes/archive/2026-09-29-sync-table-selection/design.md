## Context

Ver `proposal.md` (Why). Hoje cada `HeatmapTable` guarda `anchor`/`selEnd` em `useState`;
`MapWithChart` espelha isso num `Set<string>` para o gráfico e usa `externalSelection` para o caminho
inverso. Nas tabelas `readOnly`, `handleContainerKey` sai antes do F2, e o `onBlur` do wrapper limpa
a seleção quando o foco sai do container. Todas as tabelas da aba VE usam a mesma grade. Ctrl+Z/Y
já é tratado globalmente em `TuningPage`, então não faz parte da delegação de teclas.

## Goals / Non-Goals

**Goals:**
- Um único estado de seleção para original, editável, Direta, Ponderado, Amostras e os gráficos.
- Atalhos do mapa editável funcionando com o foco em qualquer tabela, sem mudar seu comportamento.

**Non-Goals:**
- Aplicar fator de correção por atalho ou por seleção.
- Layout sticky / lado a lado das tabelas.
- Persistir a seleção.

## Decisions

**1. Seleção elevada ao `VETab` (estado local, não store).**
`VETab` guarda `{ anchor, selEnd }` e passa `selection` + `onSelectionChange` para todas as
seções. É estado de sessão, exclusivo desta aba e não precisa sobreviver à navegação, então não
justifica um store Zustand nem persistência.
*Alternativa:* store global — rejeitada, aumentaria o acoplamento e a superfície de invalidação
sem benefício.

**2. `HeatmapTable` passa a aceitar seleção controlada (opcional).**
Novas props `selection` e `onSelectionChange`; sem elas, mantém o estado interno atual (uso
isolado continua funcionando). Substitui `externalSelection`, que deixa de ser necessária: uma
seleção vinda de fora é só uma mudança da prop. O `useEffect` que emite `onSelectionChange` é
removido; a tabela chama o callback diretamente ao alterar a seleção.

**3. Delegação de teclas (opção A).**
Tabelas `readOnly` recebem `onKeyDelegate(e)`. Elas tratam sozinhas apenas a navegação/seleção
(setas, Shift+setas, Tab, Home/End/PageUp/PageDown, Escape); toda outra tecla é repassada ao handler
do mapa editável. Para isso, a lógica de `handleContainerKey` que age sobre valores (F2, H, V,
Ctrl+I/U, Delete, Ctrl+C/V, Enter, dígito) é extraída para um hook (`useMapEditKeys`) usado pela
tabela editável e exposto via ref/callback ao `VETab`. O foco permanece na tabela clicada.
*Alternativa B (mover o foco para a editável):* rejeitada — o teclado "trocaria de tabela" sem
aviso e o `focus()` arrisca rolar a página para longe da tabela de correção.

**4. Regras de blur/limpeza.**
O `onBlur` deixa de limpar a seleção. Limpam: Escape (fora de edição) e `mousedown` fora de
qualquer tabela da grade. Um listener de `mousedown` no `VETab` verifica se o alvo está dentro de um
elemento `[data-map-grid-item]` (tabela/gráfico/toolbar) ou `[role="dialog"]` (BulkEditModal e
ConfirmDialog ganharam `role="dialog"`); caso contrário
limpa. Diálogos (BulkEditModal, ConfirmDialog) ficam dentro do container marcado ou são ignorados
pela checagem, para o clique neles não limpar a seleção.

**5. Gráficos consomem a seleção compartilhada.**
`MapWithChart` deixa de ter `selectedCells`/`externalSelection` próprios: deriva o `Set` do
`selection` recebido e reporta cliques/box-select do gráfico via `onSelectionChange`. Vale para o
gráfico do original e do editável.

**6. Tabelas readOnly nunca editam.**
`startEdit` continua protegido por `readOnly`. A delegação só cobre atalhos que agem sobre valores
sem abrir input (F2, H, V, Ctrl+I/U, Delete em intervalo, Ctrl+C/V). Enter, dígito e Delete em uma
única célula NÃO são delegados: abririam edição inline na tabela editável e puxariam o foco (e a
rolagem) para longe da tabela de correção. Enter/Tab continuam sendo navegação local.
As funções puras desses atalhos ficam em `utils/mapEditOps.ts` (testadas); o `HeatmapTable` expõe o
handler da tabela editável via `keyHandlerRef`, e o F2 delegado devolve o foco à tabela de origem ao
fechar o diálogo.

**7. Escape.** A spec já dizia que Escape limpa a seleção, mas o código só a limpava via blur; agora
Escape (fora de edição) limpa a seleção compartilhada explicitamente.

## Risks / Trade-offs

- [Extrair a lógica de teclas de um componente de 684 linhas pode quebrar atalhos] → cobrir com
  testes das funções puras extraídas (interpolação já tem; adicionar F2/pct/Delete) e verificação
  manual de cada atalho a partir de cada tabela.
- [Clique fora limpando a seleção ao clicar em toolbar/diálogo] → marcadores
  `data-map-grid-item` / `role="dialog"` e teste manual de cada controle.
- [Seleção elevada re-renderiza todas as tabelas a cada arrasto] → grade 16×16; se necessário,
  `React.memo` nas linhas. Sem otimização antecipada.
- [Estado de edição inline vs. seleção compartilhada] → durante edição inline, mudança externa de
  seleção confirma a edição (mesmo comportamento de clicar em outra célula hoje).
