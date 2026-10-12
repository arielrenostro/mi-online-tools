## Why

A correção de VE compara, por célula, a média do VE Lambda **absoluto** dos pontos que a tocam com o
valor do **centro** da célula. Como a atribuição bilinear faz uma célula receber pontos de toda a
vizinhança, e o VE do mapa varia rápido nessa vizinhança, a média absoluta carrega a inclinação do
mapa e não só o erro de lambda. Com os 5 logs de 10/10 e os filtros do usuário, a célula MAP 40 / RPM
800 aparece com **+5,4%** quando o erro real de lambda é **−1,1%** (contra o mapa carregado); células
de VE inclinado (30/2000, 40/1200, 40/2400) erram na mesma ordem, com sinal trocado. O fator mostrado
e aplicado ao mapa está, portanto, errado onde o mapa é mais inclinado.

## What Changes

- A estatística acumulada por célula deixa de ser o VE Lambda absoluto e passa a ser a **razão por
  ponto**: `VE Lambda ÷ VE do mapa carregado interpolado no MAP/RPM do ponto`. Cada ponto é comparado
  ao mapa **na sua própria posição**, não no centro da célula. A atribuição bilinear (pesos, `n`)
  não muda.
- Média (ponderada), mediana e moda passam a ser estatísticas dessa razão. O fator Direto é a própria
  estatística (já é um fator); o Ponderado continua `1 + (direto − 1) × n/(n+k)`. A tolerância da
  moda passa de ±0,5 ponto de VE para ±0,5 ponto percentual de fator.
- O mapa usado como referência é sempre o **mapa editável carregado agora**; nenhum cálculo depende
  do mapa que gravou o log.
- Como a razão depende do mapa, que muda depois de gerado o run, o **run passa a guardar as amostras**
  (MAP, RPM, VE Lambda dos pontos qualificados e dentro da faixa do mapa) em vez de estatísticas por
  célula. As estatísticas por célula passam a ser derivadas na leitura, a partir das amostras e do
  mapa atual — a atualização ao vivo ao editar o mapa continua existindo.
- A atribuição, a seleção Média/Mediana/Moda, o k, as cores, a aplicação no mapa e o histórico de 10
  runs permanecem.
- **BREAKING**: runs já persistidos (e o migrado do snapshot único) só têm estatísticas do VE Lambda
  absoluto e não podem ser convertidos. Continuam no histórico, nomeados e com a receita visível, mas
  ficam **inutilizáveis** (sem fatores, sem aplicar) com a indicação de que foram gerados antes do
  método atual e precisam ser gerados de novo. A opção Moda deixa de ter caso "indisponível".

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `mapa-ve-correction`: a estatística por célula (sample count e valores centrais), o cálculo dos
  fatores Direto/Ponderado, a atualização ao vivo, o tooltip e a aplicação das correções passam a
  usar a razão por ponto contra o mapa carregado.
- `correction-runs`: o conteúdo de um run (amostras em vez de estatísticas por célula), a derivação
  das células na leitura, a utilizabilidade de runs sem amostras e o diálogo de geração.
- `session-persistence`: o que persiste de um run (amostras), a migração do snapshot único e a
  substituição do requisito "Restored run without a mode" por "Restored run without samples".

## Impact

- Código: `frontend/src/utils/correctionGeneration.ts` (geração de amostras; novo cálculo das células
  a partir de amostras + mapa), `frontend/src/utils/correctionDisplay.ts` (fatores a partir da razão),
  `frontend/src/types/correction.ts` (`CorrectionRun`, `MODE_TOLERANCE`), `frontend/src/store/correctionStore.ts`
  (condição de "run vazio", utilizabilidade), `frontend/src/persistence/legacyMigration.ts` e
  `sessionRestorer.ts` (runs sem amostras), `frontend/src/features/mapa/CorrectionSection.tsx` e
  `RunSelector.tsx` (células derivadas, estado "sem amostras", tooltip em percentual).
- Dados: o store `correction-runs` do IndexedDB passa a guardar um array tipado por run (~24 bytes por
  ponto qualificado; ~340 KB em 14 mil pontos, ~3,4 MB no histórico cheio). Sem mudança de versão do
  banco (mesmo `keyPath`).
- Desempenho: editar o mapa recalcula a razão de todas as amostras do run selecionado (O(pontos));
  os pesos bilineares por amostra são calculados uma vez por run.
- Sem backend, sem novas dependências.
