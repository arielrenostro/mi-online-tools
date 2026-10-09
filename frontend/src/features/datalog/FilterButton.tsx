import { useState } from 'react'
import FilterModal from './FilterModal'
import { useFilterStore } from '@/store/filterStore'
import { countEnabled, isDefaultFilter } from '@/types/filter'

/**
 * Botão "Filtro" do cabeçalho do Datalog: mostra quantos critérios estão ligados e fica destacado
 * enquanto o filtro aplicado difere do padrão (aviso de que algo foi mexido).
 */
export function FilterButton() {
  const [open, setOpen] = useState(false)
  const filter     = useFilterStore(s => s.filter)
  const count      = countEnabled(filter)
  const customized = !isDefaultFilter(filter)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={customized ? 'Filtro alterado em relação ao padrão' : 'Filtro (padrão)'}
        className={
          customized
            ? 'px-2.5 h-6 flex items-center rounded-full border border-yellow-500 bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 text-xs font-medium transition-colors'
            : 'px-2.5 h-6 flex items-center rounded-full border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs font-medium transition-colors'
        }
      >
        Filtro ({count}){customized ? ' •' : ''}
      </button>
      <FilterModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
