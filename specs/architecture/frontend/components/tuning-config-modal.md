# Componente `TuningConfigModal`

Modal de configuração dos parâmetros do motor de tuning. Renderiza o formulário **dinamicamente** a partir do `config_schema` do backend — zero campos hardcoded. Validação em tempo real, campos dependentes, restauração de padrões.

**Localização:** `frontend/src/components/TuningConfigModal/` — `TuningConfigModal.tsx`, `SchemaForm.tsx`, `SchemaField.tsx`, `useSchemaForm.ts`, `fieldTypes.ts`

## Props

```typescript
export interface TuningConfigModalProps {
  open: boolean
  engineInfo: EngineInfo       // inclui o JSON Schema com extensões x-*
  config: TuningConfig         // config atual do useTuningStore; inicializa o formulário
  onSave: (config: TuningConfig) => void  // só ao confirmar; config já validada
  onClose: () => void          // ✕/Escape/clique fora; descarta edições locais
}
```

O modal mantém uma cópia local da config — não atualiza o store em tempo real.

## JSON Schema estendido

O backend retorna JSON Schema padrão + propriedades `x-*` para a renderização. O frontend itera sobre `x-groups` para as seções e usa o tipo de cada campo para escolher o componente.

```typescript
export interface JSONSchema {
  type: 'object'
  title?: string
  description?: string
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
  'x-groups'?: JSONSchemaGroup[]   // ordem e agrupamento dos campos
}

export interface JSONSchemaGroup {
  title: string
  fields: string[]               // chaves das propriedades, em ordem
  defaultCollapsed?: boolean     // padrão false
}

export interface JSONSchemaProperty {
  type: 'number' | 'integer' | 'boolean' | 'string' | ['number', 'null'] | ['integer', 'null']
  title?: string                 // label; usa a chave se ausente
  description?: string           // texto de ajuda
  default?: unknown              // usado por "Restaurar padrões"
  minimum?: number
  maximum?: number
  enum?: unknown[]               // string com enum → Select
  'x-unit'?: string              // unidade à direita do input. Ex: "ºC", "%", "kPa", "λ"
  'x-nullable-label'?: string    // label quando o campo nullable está null. Ex: "Desabilitado"
  'x-controls'?: string          // este campo (boolean) habilita/desabilita outro
}
```

### Exemplo de schema

```json
{
  "type": "object",
  "x-groups": [
    { "title": "Filtros de Dados", "fields": ["min_clt", "lambda_loop_closed_only",
      "skip_first_closed_loop", "skip_first_rpm_bucket", "skip_first_map_bucket",
      "max_delta_rpm", "max_delta_map", "max_delta_lambda_target", "max_lambda", "max_delta_pedal"] },
    { "title": "Qualidade por Célula", "fields": ["outlier_sigma", "cv_threshold"] },
    { "title": "Correção", "fields": ["weight_sample_base", "max_correction_pct"] },
    { "title": "Convergência", "fields": ["convergence_threshold"] },
    { "title": "Pós-processamento", "fields": ["rpm400_rule_enabled", "rpm400_discount",
      "low_map_rule_enabled", "low_map_threshold", "low_map_discount", "max_adjacent_gradient_pct"] }
  ],
  "properties": {
    "min_clt": { "type": "number", "title": "Temperatura mínima do motor (CLT)",
      "description": "Pontos com CLT abaixo deste valor são descartados",
      "x-unit": "ºC", "default": 80, "minimum": 0, "maximum": 120 },
    "lambda_loop_closed_only": { "type": "boolean", "title": "Apenas loop fechado",
      "description": "Descarta pontos em open loop (lambda_loop = 0)" },
    "max_delta_pedal": { "type": ["number", "null"], "title": "Máximo delta pedal entre amostras",
      "description": "Descarta pontos com variação de pedal acima deste valor. null = desabilitado",
      "x-unit": "%", "default": null, "x-nullable-label": "Desabilitado", "minimum": 0, "maximum": 100 },
    "rpm400_rule_enabled": { "type": "boolean", "title": "Aplicar regra RPM 400",
      "description": "Calcula coluna 400 RPM como 800 RPM menos o desconto abaixo",
      "x-controls": "rpm400_discount" },
    "rpm400_discount": { "type": "number", "title": "Desconto sobre 800 RPM",
      "x-unit": "%", "default": 4.5, "minimum": 0, "maximum": 20 }
  }
}
```

## Mapeamento tipo → componente (`fieldTypes.ts`)

```typescript
export type FieldComponentType =
  | 'number-input'    // <Input type="number"> + badge de unit
  | 'switch'          // <Switch>
  | 'nullable-number' // <Switch> enable/disable + <Input> condicional
  | 'select'          // <Select> com options do enum
  | 'text-input'      // <Input type="text">

export function getFieldType(prop: JSONSchemaProperty): FieldComponentType {
  if (Array.isArray(prop.type)) return 'nullable-number'   // ["number","null"]
  switch (prop.type) {
    case 'boolean': return 'switch'
    case 'number': case 'integer': return prop.enum ? 'select' : 'number-input'
    case 'string': return prop.enum ? 'select' : 'text-input'
    default: return 'number-input'
  }
}
```

| Tipo | Componente shadcn/ui | Visual |
|------|---------------------|--------|
| `number-input` | `<Input type="number">` | Badge de unidade à direita; badge de range "[min – max]" abaixo |
| `switch` | `<Switch>` | Switch à esquerda, label/description à direita |
| `nullable-number` | `<Switch>` + `<Input>` | Switch habilita o campo; desabilitado → exibe `x-nullable-label` |
| `select` | `<Select>` | Dropdown com options do `enum` |
| `text-input` | `<Input type="text">` | Input simples |

## `SchemaField`

Renderiza um campo: label + description à esquerda, controle à direita conforme `getFieldType(prop)`. Exibe erro de validação em vermelho abaixo e badge de range se `minimum` e `maximum` definidos. `disabled` (quando controlado por `x-controls`) aplica `opacity-50`.

**`NumberInput`** — mantém `localValue` (string) sincronizado via `useEffect` quando o valor externo muda (ex.: "Restaurar padrões"); confirma no `onBlur` se `!isNaN`. Badge de unidade à direita.

**`NullableNumberInput`** — `<Switch>` (`checked = value !== null`): ligar → `onChange(0)`; desligar → `onChange(null)`. Quando ligado mostra `NumberInput`; desligado mostra o `x-nullable-label`.

## Campos dependentes (`x-controls`)

Propriedade com `x-controls: "outro_campo"` → o campo controlado é renderizado **indentado** (`ml-8 pl-3 border-l`) e desabilitado quando o Switch controlador está `false`.

```tsx
// SchemaForm.tsx — renderiza o controlador + o dependente indentado
const controlledKey  = prop['x-controls']
const controlledProp = controlledKey ? schema.properties[controlledKey] : null
const isControllerOn = typeof formValues[fieldKey] === 'boolean' ? formValues[fieldKey] : true
// renderiza SchemaField(controlador) e, abaixo, SchemaField(controlado, disabled=!isControllerOn)
```

```
Aplicar regra RPM 400              [✓ Switch]
└── Desconto sobre 800 RPM         [4.5] %        ← habilitado
Aplicar regra RPM 400              [ ○ Switch]
└── Desconto sobre 800 RPM         [4.5] %        ← desabilitado (opacity-50)
```

## Seção colapsável (`CollapsibleGroup`)

Cada grupo de `x-groups` vira uma seção com header colapsável (`defaultCollapsed`). Ao renderizar os campos, pula os que são **controlados** por outro campo do mesmo grupo (`schema.properties[k]?.['x-controls'] === fieldKey`) — eles são renderizados junto com o controlador.

## Hook `useSchemaForm`

```typescript
interface UseSchemaFormReturn {
  formValues: Record<string, unknown>
  errors: Record<string, string>
  isDirty: boolean
  handleChange: (key: string, value: unknown) => void
  handleReset: () => void
  validate: () => boolean
  getSubmitValue: () => Record<string, unknown>
}

export function useSchemaForm({ schema, initialValues, defaultValues }: UseSchemaFormOptions) {
  const [formValues, setFormValues] = useState(() => ({ ...initialValues }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isDirty = useMemo(() =>
    Object.keys(formValues).some(key => formValues[key] !== initialValues[key]),
    [formValues, initialValues])

  function handleChange(key: string, value: unknown) {
    setFormValues(prev => ({ ...prev, [key]: value }))
    const fieldError = validateField(key, value, schema.properties[key])
    setErrors(prev => {
      if (fieldError) return { ...prev, [key]: fieldError }
      const { [key]: _, ...rest } = prev
      return rest
    })
  }

  function handleReset() { setFormValues({ ...defaultValues }); setErrors({}) }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    for (const [key, prop] of Object.entries(schema.properties)) {
      const error = validateField(key, formValues[key], prop)
      if (error) newErrors[key] = error
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  return { formValues, errors, isDirty, handleChange, handleReset, validate,
           getSubmitValue: () => ({ ...formValues }) }
}

/** Valida um campo conforme o schema. Retorna a mensagem de erro ou undefined. */
function validateField(key: string, value: unknown, prop: JSONSchemaProperty | undefined): string | undefined {
  if (!prop) return undefined
  if (Array.isArray(prop.type) && prop.type.includes('null') && value === null) return undefined  // nullable
  if (prop.type === 'number' || prop.type === 'integer' || Array.isArray(prop.type)) {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(num)) return 'Valor inválido'
    if (prop.type === 'integer' && !Number.isInteger(num)) return 'Deve ser um número inteiro'
    if (prop.minimum !== undefined && num < prop.minimum)
      return `Mínimo: ${prop.minimum}${prop['x-unit'] ? ` ${prop['x-unit']}` : ''}`
    if (prop.maximum !== undefined && num > prop.maximum)
      return `Máximo: ${prop.maximum}${prop['x-unit'] ? ` ${prop['x-unit']}` : ''}`
  }
  return undefined
}
```

## Componente principal

`TuningConfigModal` usa `<Dialog>` do shadcn/ui. `useSchemaForm` é inicializado com `config` (initialValues) e `engineInfo.defaultConfig` (defaultValues). Grupos: `schema['x-groups']` ou fallback (todos os campos num único grupo "Configurações").

```tsx
function handleSave() {
  if (!validate()) return  // rola até o primeiro erro
  onSave(getSubmitValue() as unknown as TuningConfig)
  onClose()
}
```

Layout: Header (nome + descrição do engine) · `ScrollArea` com os `CollapsibleGroup` · Footer com `[Restaurar padrões]` (à esquerda) e `[Cancelar]` `[Salvar]` (à direita; botão "Salvar"/"Fechar" conforme `isDirty`, desabilitado se há erros).

## Validação

- **Tempo real** — `onChange` valida o campo imediatamente; `onBlur` revalida
- **Ao salvar** — `validate()` percorre todos os campos; se há erros, o modal não fecha e rola até o primeiro:

```typescript
function scrollToFirstError(errors: Record<string, string>) {
  const firstErrorKey = Object.keys(errors)[0]
  if (firstErrorKey) document.getElementById(firstErrorKey)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
```

| Situação | Mensagem |
|----------|----------|
| Valor não numérico | "Valor inválido" |
| Integer com decimal | "Deve ser um número inteiro" |
| Abaixo do mínimo | "Mínimo: 0 ºC" |
| Acima do máximo | "Máximo: 120 ºC" |

## Estado local vs. store

O modal **não atualiza o `useTuningStore` em tempo real** — evita disparar o indicador "config alterada" antes de confirmar e propagar valores inválidos.

```
Abrir modal     → useSchemaForm inicializa com a config do store
Usuário edita   → estado local do formulário; store NÃO é tocado
"Salvar"        → validate() → onSave(newConfig) → pai chama updateConfig() → onClose()
"Cancelar"/Esc  → onClose() sem onSave; store mantém a config anterior
```

## Botão "Restaurar Padrões"

Recarrega `engineInfo.defaultConfig` no formulário local (**não salva**), limpa erros. "Salvar" fica ativo se `isDirty` após o reset (padrões podem diferir da config atual). O usuário ainda precisa clicar "Salvar" para persistir.

## Integração com a Aba VE

```tsx
function VETabHeader() {
  const [modalOpen, setModalOpen] = useState(false)
  const config       = useTuningStore(s => s.config)
  const updateConfig = useTuningStore(s => s.updateConfig)
  const engineInfo   = useEngineInfo(useTuningStore(s => s.selectedEngineId))  // busca/cache GET /api/engines/{id}

  if (!engineInfo) return null
  return (
    <>
      <button onClick={() => setModalOpen(true)}>⚙ Config</button>
      <TuningConfigModal
        open={modalOpen} engineInfo={engineInfo} config={config}
        onSave={newConfig => updateConfig(newConfig)}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
```
