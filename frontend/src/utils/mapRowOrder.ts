// A representação interna do frontend para o mapa (breakpoints/cells) é
// descendente por MAP (índice 0 = maior kPa, batendo com a exibição da tabela —
// ver `mapParser.ts`). O formato de arquivo CSV exige ascendente (índice 0 =
// menor kPa). Esses helpers convertem nessa única fronteira, em
// `mapParser.ts`/`mapExporter.ts`.

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
