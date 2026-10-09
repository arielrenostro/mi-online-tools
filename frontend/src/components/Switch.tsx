interface Props {
  checked:   boolean
  onChange:  (checked: boolean) => void
  disabled?: boolean
  label:     string
}

/** Interruptor liga/desliga (role="switch"); `label` é o nome acessível. */
export function Switch({ checked, onChange, disabled = false, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-blue-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
