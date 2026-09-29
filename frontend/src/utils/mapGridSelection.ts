// A mousedown inside any of these keeps the shared VE-grid selection alive: the tables and their
// charts/toolbars (`data-map-grid-item`) and modal dialogs opened from them.
const KEEP_SELECTION_SELECTOR = '[data-map-grid-item], [role="dialog"]'

export function isInsideMapGrid(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(KEEP_SELECTION_SELECTOR) !== null
}
