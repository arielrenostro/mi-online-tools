/** Camada "Carregando…" sobre uma área (o pai precisa ser `relative`) enquanto ela redesenha muitos dados. */
export function LoadingOverlay() {
  return (
    <div
      role="status"
      className="absolute inset-0 z-30 flex items-center justify-center gap-2 bg-gray-950/60 text-xs text-gray-300"
    >
      <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-500 border-t-blue-400 animate-spin" />
      Carregando…
    </div>
  )
}
