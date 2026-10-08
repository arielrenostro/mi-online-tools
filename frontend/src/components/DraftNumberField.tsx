import { useEffect, useState } from 'react'

/** `''` → `null` (vazio); texto não numérico → `undefined` (inválido). Aceita vírgula decimal. */
function parseText(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isNaN(n) ? undefined : n
}

function fmt(value: number | null): string {
  return value === null ? '' : String(value)
}

interface Props {
  label:     string
  value:     number | null
  /** Chamado só com valores válidos; `null` apenas quando `allowEmpty`. */
  onCommit:  (value: number | null) => void
  /** Vazio é válido e significa `null` (ex.: "sem limite"). */
  allowEmpty?: boolean
  /** Validação do número digitado (padrão: qualquer número finito). */
  isValid?:  (n: number) => boolean
  /** Mensagem exibida quando o texto é inválido. */
  invalidMessage?: string
  unit?:     string
  disabled?: boolean
  labelWidth?: string
  title?:    string
  /** Marca o campo como inválido por uma regra entre campos (ex.: mínimo > máximo). */
  forceInvalid?: boolean
  /** Classe de fundo do input (padrão `bg-gray-900`; use `bg-gray-950` sobre painéis gray-900). */
  inputBg?: string
}

/**
 * Campo numérico com texto local: o store só recebe valores válidos (o último válido continua valendo
 * enquanto o texto está inválido) e o campo é marcado em vermelho. Para forçar a ressincronização
 * com o store após um reset, remonte o campo com outra `key`.
 */
export function DraftNumberField({
  label, value, onCommit, allowEmpty = false, isValid = Number.isFinite,
  invalidMessage = 'Valor inválido', unit, disabled, labelWidth = 'w-40', title, forceInvalid = false, inputBg = 'bg-gray-900',
}: Props) {
  const [text, setText] = useState(fmt(value))

  const check = (t: string): boolean => {
    const p = parseText(t)
    if (p === undefined) return false
    if (p === null) return allowEmpty
    return isValid(p)
  }
  const valid = check(text) && !forceInvalid

  // Mudança externa (restore, reset): só sobrescreve o texto se ele já não representar o valor.
  useEffect(() => {
    const p = parseText(text)
    if (check(text) && p === value) return
    setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(t: string) {
    setText(t)
    if (check(t)) onCommit(parseText(t) as number | null)
  }

  return (
    <label className="flex items-center gap-2 text-xs text-gray-400" title={title}>
      <span className={`${labelWidth} flex-shrink-0`}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={e => handleChange(e.target.value)}
        className={`w-24 ${inputBg} border rounded px-2 py-1 text-gray-200 disabled:opacity-40 ${
          valid ? 'border-gray-700' : 'border-red-500'
        }`}
      />
      {unit && <span className="text-gray-500">{unit}</span>}
      {!check(text) && <span className="text-red-400">{invalidMessage}</span>}
    </label>
  )
}
