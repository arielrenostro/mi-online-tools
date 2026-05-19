import { NavLink } from 'react-router-dom'

interface Props {
  to: string
  label: string
  disabled?: boolean
}

export function TuningTabLink({ to, label, disabled = false }: Props) {
  if (disabled) {
    return (
      <span
        className="px-4 py-2 text-sm text-gray-600 cursor-not-allowed select-none"
        title="Disponível em breve"
        aria-disabled="true"
      >
        {label} 🔒
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'px-4 py-2 text-sm border-b-2 border-blue-500 text-blue-400 font-medium'
          : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-300'
      }
    >
      {label}
    </NavLink>
  )
}
