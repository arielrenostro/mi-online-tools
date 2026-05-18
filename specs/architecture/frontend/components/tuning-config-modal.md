# Componente `TuningConfigModal`

Modal de configuração dos parâmetros do motor de tuning. Renderiza o formulário dinamicamente a partir do `config_schema` retornado pelo backend — zero campos hardcoded. Suporta validação em tempo real, campos dependentes e restauração de padrões.

**Localização:** `frontend/src/components/TuningConfigModal/`  
**Arquivos:** `TuningConfigModal.tsx`, `SchemaForm.tsx`, `SchemaField.tsx`, `useSchemaForm.ts`, `fieldTypes.ts`

---

## Props

```typescript
// src/components/TuningConfigModal/TuningConfigModal.tsx
import type { EngineInfo, JSONSchema, JSONSchemaProperty } from '@/types/engine'
import type { TuningConfig } from '@/types/tuning'

export interface TuningConfigModalProps {
  /** Controla visibilidade do modal. */
  open: boolean

  /**
   * Metadados do engine de tuning selecionado.
   * Inclui o JSON Schema completo com extensões `x-groups`, `x-unit`, `x-nullable-label`.
   */
  engineInfo: EngineInfo

  /**
   * Configuração atual persistida no useTuningStore.
   * Usada para inicializar o formulário ao abrir o modal.
   * O modal mantém uma cópia local — não atualiza o store em tempo real.
   */
  config: TuningConfig

  /**
   * Chamado apenas ao confirmar o "Salvar".
   * A config passada já foi validada — o pai pode persistir no store diretamente.
   */
  onSave: (config: TuningConfig) => void

  /** Chamado ao fechar (✕, Escape ou clique fora). Descarta edições locais. */
  onClose: () => void
}
```

---

## JSON Schema Estendido

O backend retorna um JSON Schema padrão estendido com propriedades `x-*` para controlar a renderização da UI. O frontend não assume estrutura fixa — itera sobre `x-groups` para determinar as seções e usa o tipo de cada campo para escolher o componente.

### Estrutura enviada pelo backend

```typescript
// src/types/engine.ts (campos relevantes)
export interface JSONSchema {
  type: 'object'
  title?: string
  description?: string
  properties: Record<string, JSONSchemaProperty>
  required?: string[]

  // Extensão: define a ordem e agrupamento dos campos no formulário
  'x-groups'?: JSONSchemaGroup[]
}

export interface JSONSchemaGroup {
  title: string
  /** Chaves das propriedades do schema que pertencem a este grupo, em ordem. */
  fields: string[]
  /** Se true, o grupo começa colapsado. Padrão: false. */
  defaultCollapsed?: boolean
}

export interface JSONSchemaProperty {
  /** Tipo do campo. Array indica nullable: ["number", "null"] = número opcional. */
  type: 'number' | 'integer' | 'boolean' | 'string' | ['number', 'null'] | ['integer', 'null']

  /** Label exibido no formulário. Se ausente, usa a chave da propriedade. */
  title?: string

  /** Texto de ajuda exibido abaixo do campo. */
  description?: string

  /** Valor padrão — usado pelo botão "Restaurar padrões". */
  default?: unknown

  /** Validação de range mínimo (para number/integer). */
  minimum?: number

  /** Validação de range máximo (para number/integer). */
  maximum?: number

  /** Valores permitidos (para string com enum → Select). */
  enum?: unknown[]

  // Extensões custom:

  /** Unidade exibida à direita do input. Ex.: "ºC", "%", "kPa", "λ". */
  'x-unit'?: string

  /**
   * Label exibido quando o campo nullable está no estado "desabilitado" (null).
   * Ex.: "Desabilitado" para max_delta_pedal quando null.
   */
  'x-nullable-label'?: string

  /**
   * Se fornecido, este campo controla o enable/disable de outro campo.
   * Ex.: "rpm400_rule_enabled" controla "rpm400_discount".
   * Quando o Switch está off, o campo dependente fica desabilitado e indentado.
   */
  'x-controls'?: string
}
```

### Exemplo completo de schema

```json
{
  "type": "object",
  "x-groups": [
    {
      "title": "Filtros de Dados",
      "fields": [
        "min_clt",
        "lambda_loop_closed_only",
        "skip_first_closed_loop",
        "skip_first_rpm_bucket",
        "skip_first_map_bucket",
        "max_delta_rpm",
        "max_delta_map",
        "max_delta_lambda_target",
        "max_lambda",
        "max_delta_pedal"
      ]
    },
    {
      "title": "Qualidade por Célula",
      "fields": ["outlier_sigma", "cv_threshold"]
    },
    {
      "title": "Correção",
      "fields": ["weight_sample_base", "max_correction_pct"]
    },
    {
      "title": "Convergência",
      "fields": ["convergence_threshold"]
    },
    {
      "title": "Pós-processamento",
      "fields": [
        "rpm400_rule_enabled",
        "rpm400_discount",
        "low_map_rule_enabled",
        "low_map_threshold",
        "low_map_discount",
        "max_adjacent_gradient_pct"
      ]
    }
  ],
  "properties": {
    "min_clt": {
      "type": "number",
      "title": "Temperatura mínima do motor (CLT)",
      "description": "Pontos com CLT abaixo deste valor são descartados",
      "x-unit": "ºC",
      "default": 80,
      "minimum": 0,
      "maximum": 120
    },
    "lambda_loop_closed_only": {
      "type": "boolean",
      "title": "Apenas loop fechado",
      "description": "Descarta pontos em open loop (lambda_loop = 0)"
    },
    "skip_first_closed_loop": {
      "type": "integer",
      "title": "Ignorar primeiros N pontos ao entrar em closed loop",
      "description": "A ECU demora alguns ciclos para estabilizar a correção",
      "x-unit": "amostras",
      "default": 10,
      "minimum": 0,
      "maximum": 100
    },
    "max_delta_pedal": {
      "type": ["number", "null"],
      "title": "Máximo delta pedal entre amostras",
      "description": "Descarta pontos com variação de pedal acima deste valor. null = desabilitado (coluna ausente no log)",
      "x-unit": "%",
      "default": null,
      "x-nullable-label": "Desabilitado",
      "minimum": 0,
      "maximum": 100
    },
    "rpm400_rule_enabled": {
      "type": "boolean",
      "title": "Aplicar regra RPM 400",
      "description": "Calcula coluna 400 RPM como 800 RPM menos o desconto abaixo",
      "x-controls": "rpm400_discount"
    },
    "rpm400_discount": {
      "type": "number",
      "title": "Desconto sobre 800 RPM",
      "x-unit": "%",
      "default": 4.5,
      "minimum": 0,
      "maximum": 20
    }
  }
}
```

---

## Mapeamento Tipo → Componente

```typescript
// fieldTypes.ts

/**
 * Determina qual componente renderizar para uma propriedade do schema.
 */
export function getFieldType(prop: JSONSchemaProperty): FieldComponentType {
  // Array de tipos → nullable number/integer
  if (Array.isArray(prop.type)) {
    return 'nullable-number'
  }

  switch (prop.type) {
    case 'boolean':
      return 'switch'

    case 'number':
    case 'integer':
      if (prop.enum) return 'select'
      return 'number-input'

    case 'string':
      if (prop.enum) return 'select'
      return 'text-input'

    default:
      return 'number-input'
  }
}

export type FieldComponentType =
  | 'number-input'    // <Input type="number"> com badge de unit
  | 'switch'          // <Switch> / <Checkbox>
  | 'nullable-number' // <Switch> enable/disable + <Input> condicional
  | 'select'          // <Select> com options do enum
  | 'text-input'      // <Input type="text">
```

### Detalhamento por tipo

| `FieldComponentType` | Componente shadcn/ui | Aspecto Visual |
|---------------------|---------------------|----------------|
| `number-input` | `<Input type="number">` | Input com badge de unidade à direita; badge de range "[min – max]" abaixo se ambos definidos |
| `switch` | `<Switch>` com label | Switch à esquerda, label e description à direita |
| `nullable-number` | `<Switch>` + `<Input>` | Switch "habilita/desabilita" o campo; quando desabilitado, Input fica oculto e aparece texto do `x-nullable-label` |
| `select` | `<Select>` | Dropdown com as opções do `enum` |
| `text-input` | `<Input type="text">` | Input simples |

---

## Componente `SchemaField`

```tsx
// SchemaField.tsx
import { Switch } from '@/components/ui/switch'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SchemaFieldProps {
  fieldKey: string
  prop: JSONSchemaProperty
  value: unknown
  disabled?: boolean          // quando controlado por outro campo (x-controls)
  error?: string
  onChange: (key: string, value: unknown) => void
}

export function SchemaField({ fieldKey, prop, value, disabled, error, onChange }: SchemaFieldProps) {
  const fieldType = getFieldType(prop)
  const label     = prop.title ?? fieldKey
  const unit      = prop['x-unit']
  const hasRange  = prop.minimum !== undefined && prop.maximum !== undefined

  return (
    <div className={cn('flex flex-col gap-1', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between gap-4 min-h-9">
        {/* Label + description */}
        <div className="flex-1">
          <Label
            htmlFor={fieldKey}
            className={cn('text-sm text-gray-200', disabled && 'cursor-not-allowed')}
          >
            {label}
          </Label>
          {prop.description && (
            <p className="text-xs text-gray-500 mt-0.5">{prop.description}</p>
          )}
        </div>

        {/* Controle à direita */}
        <div className="flex-none flex items-center gap-2">
          {fieldType === 'number-input' && (
            <NumberInput
              id={fieldKey}
              value={value as number}
              unit={unit}
              min={prop.minimum}
              max={prop.maximum}
              step={prop.type === 'integer' ? 1 : 0.001}
              disabled={disabled}
              error={error}
              onChange={v => onChange(fieldKey, v)}
            />
          )}

          {fieldType === 'switch' && (
            <Switch
              id={fieldKey}
              checked={value as boolean}
              disabled={disabled}
              onCheckedChange={v => onChange(fieldKey, v)}
            />
          )}

          {fieldType === 'nullable-number' && (
            <NullableNumberInput
              id={fieldKey}
              value={value as number | null}
              unit={unit}
              nullableLabel={prop['x-nullable-label'] ?? 'Desabilitado'}
              min={prop.minimum}
              max={prop.maximum}
              disabled={disabled}
              error={error}
              onChange={v => onChange(fieldKey, v)}
            />
          )}

          {fieldType === 'select' && (
            <Select
              value={String(value)}
              disabled={disabled}
              onValueChange={v => onChange(fieldKey, v)}
            >
              <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {prop.enum?.map(opt => (
                  <SelectItem key={String(opt)} value={String(opt)} className="text-gray-200">
                    {String(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Erro de validação */}
      {error && (
        <p className="text-xs text-red-400 text-right">{error}</p>
      )}

      {/* Badge de range */}
      {hasRange && fieldType === 'number-input' && !error && (
        <p className="text-xs text-gray-600 text-right">
          Faixa: {prop.minimum} – {prop.maximum}{unit ? ` ${unit}` : ''}
        </p>
      )}
    </div>
  )
}
```

---

## Subcomponentes de Campo

### `NumberInput`

```tsx
function NumberInput({ id, value, unit, min, max, step, disabled, error, onChange }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value))

  // Sincroniza quando o valor externo muda (ex.: "Restaurar padrões")
  useEffect(() => { setLocalValue(String(value)) }, [value])

  function handleBlur() {
    const num = parseFloat(localValue)
    if (!isNaN(num)) onChange(num)
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        type="number"
        value={localValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          'w-24 text-right bg-gray-800 border-gray-700 text-gray-200 text-sm',
          error && 'border-red-500 focus-visible:ring-red-500'
        )}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
      />
      {unit && (
        <span className="text-xs text-gray-500 w-8 shrink-0">{unit}</span>
      )}
    </div>
  )
}
```

### `NullableNumberInput`

Campo que combina um `<Switch>` (enable/disable) com um `<Input>` numérico condicional:

```tsx
function NullableNumberInput({
  id, value, unit, nullableLabel, min, max, disabled, error, onChange
}: NullableNumberInputProps) {
  const isEnabled = value !== null

  return (
    <div className="flex items-center gap-2">
      {/* Switch: habilita/desabilita o campo */}
      <Switch
        checked={isEnabled}
        disabled={disabled}
        onCheckedChange={checked => {
          if (checked) {
            // Ativa: restaura o default numérico (ou 0 se não houver)
            onChange(0)
          } else {
            // Desativa: define null
            onChange(null)
          }
        }}
      />

      {/* Input numérico (visível apenas quando habilitado) */}
      {isEnabled ? (
        <NumberInput
          id={id}
          value={value as number}
          unit={unit}
          min={min}
          max={max}
          step={0.1}
          disabled={disabled}
          error={error}
          onChange={onChange}
        />
      ) : (
        <span className="text-xs text-gray-500 italic w-28 text-right">
          {nullableLabel}
        </span>
      )}
    </div>
  )
}
```

---

## Campos Dependentes (`x-controls`)

Quando uma propriedade tem `x-controls: "outro_campo"`, o campo controlado é renderizado indentado e desabilitado quando o Switch está `false`:

```tsx
// SchemaForm.tsx — lógica de campos dependentes
function renderFieldWithDependents(
  fieldKey: string,
  prop: JSONSchemaProperty,
  formValues: Record<string, unknown>,
  onChange: (key: string, val: unknown) => void,
  errors: Record<string, string>,
) {
  const controlledKey  = prop['x-controls']
  const controlledProp = controlledKey ? schema.properties[controlledKey] : null
  const isControllerOn = typeof formValues[fieldKey] === 'boolean' ? formValues[fieldKey] as boolean : true

  return (
    <div key={fieldKey}>
      <SchemaField
        fieldKey={fieldKey}
        prop={prop}
        value={formValues[fieldKey]}
        error={errors[fieldKey]}
        onChange={onChange}
      />

      {/* Campo dependente — aparece indentado abaixo do switch */}
      {controlledKey && controlledProp && (
        <div className="ml-8 mt-1 pl-3 border-l border-gray-700">
          <SchemaField
            fieldKey={controlledKey}
            prop={controlledProp}
            value={formValues[controlledKey]}
            disabled={!isControllerOn}
            error={errors[controlledKey]}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
```

**Exemplo visual:**

```
  Aplicar regra RPM 400              [✓ Switch]
  └── Desconto sobre 800 RPM         [4.5] %        ← indentado, habilitado
  
  Aplicar regra RPM 400              [ ○ Switch]
  └── Desconto sobre 800 RPM         [4.5] %        ← indentado, desabilitado (opacity-50)
```

---

## Seção Colapsável

Cada grupo do `x-groups` é renderizado como uma seção com header colapsável:

```tsx
// SchemaForm.tsx
function CollapsibleGroup({
  group, schema, formValues, onChange, errors, defaultCollapsed,
}: CollapsibleGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false)

  return (
    <div className="border-b border-gray-800 last:border-b-0">
      {/* Header do grupo */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-3 text-left
                   hover:bg-gray-800/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          {group.title}
        </h3>
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200',
            collapsed && 'rotate-180'
          )}
        />
      </button>

      {/* Campos do grupo */}
      {!collapsed && (
        <div className="px-6 pb-4 flex flex-col gap-4">
          {group.fields.map(fieldKey => {
            const prop = schema.properties[fieldKey]
            if (!prop) return null

            // Se este campo é controlado por outro (x-controls aponta PARA ele),
            // pula — será renderizado junto com o controlador
            const isControlled = group.fields.some(k =>
              schema.properties[k]?.['x-controls'] === fieldKey
            )
            if (isControlled) return null

            return renderFieldWithDependents(fieldKey, prop, formValues, onChange, errors)
          })}
        </div>
      )}
    </div>
  )
}
```

---

## Hook `useSchemaForm`

```typescript
// useSchemaForm.ts
interface UseSchemaFormOptions {
  schema: JSONSchema
  initialValues: Record<string, unknown>
  defaultValues: Record<string, unknown>  // engineInfo.defaultConfig
}

interface UseSchemaFormReturn {
  formValues: Record<string, unknown>
  errors: Record<string, string>
  isDirty: boolean
  handleChange: (key: string, value: unknown) => void
  handleReset: () => void
  validate: () => boolean  // true se válido
  getSubmitValue: () => Record<string, unknown>
}

export function useSchemaForm({
  schema, initialValues, defaultValues
}: UseSchemaFormOptions): UseSchemaFormReturn {
  const [formValues, setFormValues] = useState<Record<string, unknown>>(
    () => ({ ...initialValues })
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isDirty = useMemo(() =>
    Object.keys(formValues).some(key => formValues[key] !== initialValues[key]),
    [formValues, initialValues]
  )

  function handleChange(key: string, value: unknown) {
    setFormValues(prev => ({ ...prev, [key]: value }))

    // Validação imediata ao mudar o campo
    const fieldError = validateField(key, value, schema.properties[key])
    setErrors(prev => {
      if (fieldError) return { ...prev, [key]: fieldError }
      const { [key]: _, ...rest } = prev
      return rest
    })
  }

  function handleReset() {
    setFormValues({ ...defaultValues })
    setErrors({})
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    for (const [key, prop] of Object.entries(schema.properties)) {
      const value = formValues[key]
      const error = validateField(key, value, prop)
      if (error) newErrors[key] = error
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function getSubmitValue(): Record<string, unknown> {
    return { ...formValues }
  }

  return { formValues, errors, isDirty, handleChange, handleReset, validate, getSubmitValue }
}

/**
 * Valida um campo individual conforme as restrições do schema.
 * Retorna a mensagem de erro ou undefined se válido.
 */
function validateField(
  key: string,
  value: unknown,
  prop: JSONSchemaProperty | undefined
): string | undefined {
  if (!prop) return undefined

  // Campo nullable — null é sempre válido
  if (Array.isArray(prop.type) && prop.type.includes('null') && value === null) return undefined

  if (prop.type === 'number' || prop.type === 'integer' || Array.isArray(prop.type)) {
    const num = typeof value === 'number' ? value : parseFloat(String(value))

    if (isNaN(num)) return 'Valor inválido'

    if (prop.type === 'integer' && !Number.isInteger(num)) return 'Deve ser um número inteiro'

    if (prop.minimum !== undefined && num < prop.minimum) {
      return `Mínimo: ${prop.minimum}${prop['x-unit'] ? ` ${prop['x-unit']}` : ''}`
    }

    if (prop.maximum !== undefined && num > prop.maximum) {
      return `Máximo: ${prop.maximum}${prop['x-unit'] ? ` ${prop['x-unit']}` : ''}`
    }
  }

  return undefined
}
```

---

## Componente Principal `TuningConfigModal`

```tsx
// TuningConfigModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function TuningConfigModal({ open, engineInfo, config, onSave, onClose }: TuningConfigModalProps) {
  const schema = engineInfo.configSchema as JSONSchema & { 'x-groups'?: JSONSchemaGroup[] }

  const { formValues, errors, isDirty, handleChange, handleReset, validate, getSubmitValue } =
    useSchemaForm({
      schema,
      initialValues: config as unknown as Record<string, unknown>,
      defaultValues: engineInfo.defaultConfig,
    })

  function handleSave() {
    if (!validate()) return  // foca no primeiro erro
    const newConfig = getSubmitValue() as unknown as TuningConfig
    onSave(newConfig)
    onClose()
  }

  // Grupos definidos no schema, ou fallback: todos os campos em um único grupo
  const groups: JSONSchemaGroup[] = schema['x-groups'] ?? [{
    title: 'Configurações',
    fields: Object.keys(schema.properties),
  }]

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent
        className="bg-gray-900 border-gray-700 text-gray-100 max-w-[600px] max-h-[85vh] flex flex-col p-0"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-800 shrink-0">
          <DialogTitle className="text-base font-semibold text-gray-100">
            Configurações — {engineInfo.name}
          </DialogTitle>
          {engineInfo.description && (
            <p className="text-sm text-gray-400 mt-1">{engineInfo.description}</p>
          )}
        </DialogHeader>

        {/* Corpo com scroll */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="py-2">
            {groups.map(group => (
              <CollapsibleGroup
                key={group.title}
                group={group}
                schema={schema}
                formValues={formValues}
                onChange={handleChange}
                errors={errors}
                defaultCollapsed={group.defaultCollapsed}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-gray-800 shrink-0 flex justify-between">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="text-gray-400 hover:text-gray-200"
          >
            Restaurar padrões
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={Object.keys(errors).length > 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isDirty ? 'Salvar alterações' : 'Fechar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Validação

### Em Tempo Real (onBlur + onChange)

- Ao **mudar** um campo (`onChange`): valida imediatamente e exibe erro abaixo do campo em vermelho
- Ao **sair** do campo (`onBlur`): revalida para capturar campos modificados externamente

### Ao Salvar

- `validate()` percorre todos os campos e exibe erros simultaneamente
- Se houver erros: o botão "Salvar" não fecha o modal, e os erros aparecem nos campos correspondentes
- O scroll do modal rola automaticamente até o primeiro campo com erro

```typescript
function scrollToFirstError(errors: Record<string, string>) {
  const firstErrorKey = Object.keys(errors)[0]
  if (!firstErrorKey) return
  document.getElementById(firstErrorKey)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}
```

### Erros Exibidos

| Situação | Mensagem |
|----------|---------|
| Valor não numérico | "Valor inválido" |
| Integer com decimal | "Deve ser um número inteiro" |
| Abaixo do mínimo | "Mínimo: 0 ºC" |
| Acima do máximo | "Máximo: 120 ºC" |

---

## Estado Local vs. Store

O modal **não atualiza o `useTuningStore` em tempo real** enquanto o usuário edita. Isso evita:
1. Disparar o indicador "configuração alterada" no botão de tuning antes de confirmar
2. Propagar valores inválidos (ainda sendo digitados) para outros componentes

O fluxo correto:

```
Abrir modal
    │ useSchemaForm inicializa com config atual do store
    │
Usuário edita campos
    │ Estado local do formulário (useSchemaForm)
    │ Store NÃO é atualizado
    │
Clicar "Salvar"
    │ validate() → true
    │ onSave(newConfig) → pai chama useTuningStore.updateConfig(newConfig)
    │ onClose()

Clicar "Cancelar" / Escape / Clique fora
    │ onClose() sem chamar onSave
    │ Store permanece com config anterior
```

---

## Integração com a Aba VE

```tsx
// features/tuning/ve/VETab.tsx
import { TuningConfigModal } from '@/components/TuningConfigModal'
import { useTuningStore }    from '@/store/tuningStore'
import { useEngineStore }    from '@/store/engineStore'  // ou fetch direto

function VETabHeader() {
  const [modalOpen, setModalOpen] = useState(false)

  const config         = useTuningStore(s => s.config)
  const updateConfig   = useTuningStore(s => s.updateConfig)
  const selectedEngine = useTuningStore(s => s.selectedEngineId)
  const engineInfo     = useEngineInfo(selectedEngine)  // hook que busca/cache GET /api/engines/{id}

  if (!engineInfo) return null

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300
                   hover:text-white border border-gray-700 rounded hover:bg-gray-800"
      >
        <span>⚙</span> Config
      </button>

      <TuningConfigModal
        open={modalOpen}
        engineInfo={engineInfo}
        config={config}
        onSave={newConfig => {
          updateConfig(newConfig)
          // O store persiste automaticamente via middleware
        }}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
```

---

## Comportamento do Botão "Restaurar Padrões"

- **Não salva** — apenas recarrega `engineInfo.defaultConfig` no formulário local
- Limpa todos os erros de validação (os valores padrão são sempre válidos)
- O botão "Salvar" fica ativo se `isDirty` for true após o reset (pode ser que os padrões difiram da config atual)
- Toast de confirmação: não é necessário — o usuário ainda precisa clicar "Salvar" para persistir

---

## Layout Visual (referência)

```
┌─ Configurações — VE Lambda Tuning ──────────────────────── [✕] ─┐
│  Corrige o mapa de VE a partir do feedback de lambda...          │
├──────────────────────────────────────────────────────────────────┤
│  FILTROS DE DADOS                                         [^]   │
│  ────────────────────────────────────────────────────────────   │
│  Temperatura mínima do motor (CLT)             [ 80 ] ºC        │
│    Pontos com CLT abaixo deste valor...                          │
│                                                                   │
│  Apenas loop fechado                                   [✓]      │
│    Descarta pontos em open loop...                               │
│                                                                   │
│  Ignorar primeiros N pontos...                  [ 10 ] amostras │
│                                                                   │
│  Máximo delta pedal entre amostras       [○]  Desabilitado      │
│    Descarta pontos com variação de pedal...                      │
├──────────────────────────────────────────────────────────────────┤
│  QUALIDADE POR CÉLULA                                     [^]   │
│  ────────────────────────────────────────────────────────────   │
│  Rejeição de outliers (sigma)               [2.0]               │
│  CV máximo aceito (cv_threshold)            [0.15]              │
├──────────────────────────────────────────────────────────────────┤
│  PÓS-PROCESSAMENTO                                        [v]   │  ← colapsado
├──────────────────────────────────────────────────────────────────┤
│  [ Restaurar padrões ]              [ Cancelar ]  [ Salvar ]    │
└──────────────────────────────────────────────────────────────────┘
```
