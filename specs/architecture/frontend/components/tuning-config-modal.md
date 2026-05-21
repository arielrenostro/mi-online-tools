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

O modal mantém uma cópia local da config — **não** atualiza o store em tempo real (evita disparar o indicador "config alterada" e propagar valores inválidos antes de confirmar).

## JSON Schema estendido

O backend retorna JSON Schema padrão + propriedades `x-*` para a renderização.

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
  enum?: unknown[]               // string/number com enum → Select
  'x-unit'?: string              // unidade à direita do input. Ex: "ºC", "%", "kPa", "λ"
  'x-nullable-label'?: string    // label quando o campo nullable está null. Ex: "Desabilitado"
  'x-controls'?: string          // este campo (boolean) habilita/desabilita outro
}
```

Os grupos de `x-groups` definem as seções colapsáveis e a ordem dos campos. Fallback: todos os campos num único grupo "Configurações".

## Mapeamento tipo → componente (`fieldTypes.ts`)

`getFieldType(prop)` escolhe o componente shadcn/ui:

| `FieldComponentType` | Quando | Visual |
|----------------------|--------|--------|
| `nullable-number` | `type` é array (`["number","null"]`) | `<Switch>` habilita o `<Input>`; desligado mostra `x-nullable-label` |
| `switch` | `type: 'boolean'` | `<Switch>` + label/description |
| `select` | `number`/`integer`/`string` com `enum` | `<Select>` com options do `enum` |
| `number-input` | `number`/`integer` sem `enum` | `<Input type="number">` + badge de unidade + badge de range "[min – max]" |
| `text-input` | `string` sem `enum` | `<Input type="text">` |

`SchemaField` renderiza: label + description à esquerda, controle à direita; erro em vermelho abaixo. `NumberInput` confirma no `onBlur` se `!isNaN` e mantém o valor sincronizado quando o valor externo muda (ex.: "Restaurar padrões").

## Campos dependentes (`x-controls`)

Uma propriedade com `x-controls: "outro_campo"` torna o campo controlado renderizado **indentado** (`ml-8 pl-3 border-l`) logo abaixo do controlador, e desabilitado (`opacity-50`) quando o Switch controlador está `false`. O `CollapsibleGroup` pula os campos controlados ao iterar — eles são renderizados junto do controlador.

```
Aplicar regra RPM 400              [✓ Switch]
└── Desconto sobre 800 RPM         [4.5] %      ← habilitado / desabilitado conforme o Switch
```

## Hook `useSchemaForm`

Mantém o estado local do formulário a partir de `initialValues` (a `config` atual) e `defaultValues` (`engineInfo.defaultConfig`):

```typescript
interface UseSchemaFormReturn {
  formValues: Record<string, unknown>
  errors: Record<string, string>
  isDirty: boolean                          // algum campo difere de initialValues
  handleChange: (key, value) => void        // atualiza + valida o campo imediatamente
  handleReset: () => void                   // recarrega defaultValues, limpa erros
  validate: () => boolean                   // valida todos os campos; preenche errors
  getSubmitValue: () => Record<string, unknown>
}
```

**Regras de validação por campo** (`validateField`): campo nullable com valor `null` é válido; campos numéricos rejeitam não-números ("Valor inválido"), `integer` rejeita decimais ("Deve ser um número inteiro"), e valores fora de `minimum`/`maximum` geram "Mínimo: X unit" / "Máximo: X unit".

## Comportamento

```
Abrir         → useSchemaForm inicializa com a config do store
Editar        → estado local; store NÃO é tocado; onChange valida o campo, onBlur revalida
"Salvar"      → validate(): se há erros, não fecha e rola até o primeiro (scrollIntoView);
                senão onSave(getSubmitValue() as TuningConfig) → pai chama updateConfig() → onClose()
"Cancelar"/Esc → onClose() sem onSave; store mantém a config anterior
"Restaurar padrões" → recarrega engineInfo.defaultConfig no formulário local (NÃO salva);
                "Salvar" fica ativo se isDirty após o reset
```

Layout do `<Dialog>`: header (nome + descrição do engine) · `ScrollArea` com os `CollapsibleGroup` · footer com `[Restaurar padrões]` (esquerda) e `[Cancelar]` `[Salvar]` (direita; "Salvar" desabilitado se há erros).

## Integração com a aba VE

O cabeçalho da aba VE abre o modal passando a `config` e o `updateConfig` do `useTuningStore`, e o `engineInfo` obtido via `useEngineInfo(selectedEngineId)` (busca/cache de `GET /api/engines/{id}`).
