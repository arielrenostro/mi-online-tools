import { useToastStore } from '@/store/toastStore'

/** Pilha de toasts sempre no canto superior direito (abaixo da TopBar); a ação opcional só roda no clique do usuário. */
export function ToastHost() {
  const toasts  = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 items-end" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 bg-gray-800 border border-gray-600 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-100">
          <span>{t.message}</span>
          {t.actionLabel && t.onAction && (
            <button
              onClick={() => { t.onAction?.(); dismiss(t.id) }}
              className="text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
            >
              {t.actionLabel}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} aria-label="Fechar" className="text-gray-500 hover:text-gray-300 leading-none text-lg">×</button>
        </div>
      ))}
    </div>
  )
}
