export type UndoTarget = 've' | 'ignition' | 'lambda'

/**
 * Tabela que os atalhos de undo/redo afetam na rota atual: a tabela editável da aba em exibição.
 * Abas sem tabela editável (Arquivo) retornam null — os atalhos não fazem nada.
 */
export function undoTargetForPath(pathname: string): UndoTarget | null {
  const segment = pathname.replace(/\/+$/, '').split('/').pop()
  if (segment === 've' || segment === 'ignition' || segment === 'lambda') return segment
  return null
}
