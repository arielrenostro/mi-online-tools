import type { TuningOutput } from '@/types/tuning'

// A representação interna do frontend para o mapa (breakpoints/cells) é
// descendente por MAP (índice 0 = maior kPa, batendo com a exibição da tabela —
// ver `mapParser.ts`). O backend e o formato de arquivo CSV exigem ascendente
// (índice 0 = menor kPa). Esses helpers convertem nos dois pontos de fronteira
// onde o frontend fala com o backend (`tuningStore.ts`): a requisição de
// `/api/tuning/run` (descendente → ascendente) e a resposta (ascendente →
// descendente).

/** Inverte a ordem de um array simples (ex.: `mapBreakpoints`). Não muta o array recebido. */
export function reverseArray<T>(arr: T[]): T[] {
  return [...arr].reverse()
}

/** Inverte a ordem das linhas de uma grade `[row][col]`. Não muta o array recebido. */
export function reverseRows<T>(grid: T[][]): T[][] {
  return [...grid].reverse()
}

/** Espelha um índice de linha para a convenção oposta (ascendente ⇄ descendente). */
export function flipRowIndex(rowI: number, nRows: number): number {
  return nRows - 1 - rowI
}

/**
 * Converte um `TuningOutput` recebido do backend (linhas ascendentes, mesma
 * ordem do `mapBreakpoints` enviado na request) para a convenção interna
 * descendente do frontend. Cobre as 8 grades `[row][col]` e as 4 listas que
 * carregam coordenadas de linha (`cellsNoData`, `cellsExtrapolated`,
 * `monotonicityWarnings`, `gradientWarnings` — incluindo `neighborI`).
 */
export function toDescendingOutput(output: TuningOutput): TuningOutput {
  const nRows = output.suggestedMap.length
  const flip  = (rowI: number) => flipRowIndex(rowI, nRows)

  return {
    suggestedMap:      reverseRows(output.suggestedMap),
    veLambdaMap:       reverseRows(output.veLambdaMap),
    sampleCountMap:    reverseRows(output.sampleCountMap),
    correctionPctMap:  reverseRows(output.correctionPctMap),
    cfMap:             reverseRows(output.cfMap),
    confidenceMap:     reverseRows(output.confidenceMap),
    cvMap:             reverseRows(output.cvMap),
    convergenceMap:    reverseRows(output.convergenceMap),

    cellsNoData:          output.cellsNoData.map(([r, c]) => [flip(r), c]),
    cellsExtrapolated:    output.cellsExtrapolated.map(ce => ({ ...ce, rowI: flip(ce.rowI) })),
    monotonicityWarnings: output.monotonicityWarnings.map(([r, c]) => [flip(r), c]),
    gradientWarnings:     output.gradientWarnings.map(gw => ({
      ...gw,
      rowI:       flip(gw.rowI),
      neighborI:  flip(gw.neighborI),
    })),

    filterStats: output.filterStats,
  }
}
