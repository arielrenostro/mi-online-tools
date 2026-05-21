# Componente `TimeRail`

Barra de tempo fixa no topo da tela Datalog. Exibe os logs como segmentos concatenados, cursor pontual, seleção de intervalo e uma sparkline do sinal escolhido. Totalmente controlado — estado no `useTimeStore`.

**Arquivo:** `frontend/src/components/TimeRail.tsx`

## Props

```typescript
/** Versão reduzida de LogEntry — só metadados para renderizar o rail. */
export interface LogSegment {
  hash: string
  filename: string
  startOffset_ms: number   // deslocamento na timeline concatenada
  duration_ms: number
  enabled: boolean         // false = fundo listrado, não usado no tuning
}

export interface TimeRailProps {
  /** Segmentos em ordem de concatenação. O pai calcula startOffset acumulando duration_ms. */
  segments: LogSegment[]
  totalDuration_ms: number
  cursor_ms: number | null
  selection: { start_ms: number; end_ms: number } | null
  sparklineSensor: string
  sparklineData: [number, number][]  // [timestamp_ms, value] ordenado; gerado pelo pai
  availableSensors: string[]          // interseção de sinais dos logs ativos
  onCursorChange: (ms: number) => void
  onSelectionChange: (sel: { start_ms: number; end_ms: number } | null) => void  // null = limpar
  onSparklineSensorChange: (sensor: string) => void
}
```

## Layout visual

`[Select sinal ▼]` + rail (~48px) com, em camadas (z-index do fundo ao topo): sparkline SVG translúcida → ViewportBand → overlay de segmentos desabilitados → faixa de seleção azul → separadores verticais pontilhados entre logs → cursor (linha vermelha + triângulo `▼`). Abaixo, status bar com cursor, seleção e `[Limpar]`.

## Cursor pontual

Triângulo `▼` vermelho + linha vertical + tempo formatado (`MM:SS.mmm`). Interação:
- Clique no rail (fora de handle de seleção e fora da faixa de seleção) move o cursor
- Drag no cursor o segue (hit area ~12px)
- Constrangido a `[0, totalDuration_ms]`

## Seleção de intervalo

Drag em área livre: `mousedown` inicia, `mousemove` mostra a faixa em tempo real, `mouseup` confirma. Drag direita→esquerda normaliza (`start = min`, `end = max`). Threshold mínimo de ~200ms de drag para criar seleção — abaixo disso, o clique apenas move o cursor.

Regras: clique dentro da faixa (sem drag) não faz nada; clique fora move o cursor; drag fora cria nova seleção (substitui a anterior); drag de um handle ajusta só aquele limite (mínimo de 200ms entre as bordas).

## Viewport band e SelectionBand

`selection` é o conceito unificado de zoom dos gráficos e intervalo de análise. Quando `selection` está setada, o rail desenha:
- **ViewportBand** — escurece as regiões **fora** do intervalo (`bg-gray-950/65`) com borda lateral azul
- **SelectionBand** — faixa azul translúcida sobre o intervalo, com handles esquerdo/direito (`cursor-ew-resize`) para ajustar as bordas

## Separadores e segmentos desabilitados

- **LogSeparator** — linha vertical pontilhada entre logs; tooltip com o nome do próximo arquivo no hover
- **Segmento desabilitado** — overlay listrado diagonal cinza sobre o trecho do log inativo

## Sparkline

SVG puro (sem lib de charting), decorativo — sem eixos/grid/labels. Normaliza os valores ao espaço do SVG e renderiza um `<polygon>` preenchido + `<polyline>` de contorno (azul translúcido). Não renderiza se `data.length < 2`.

## Suporte a teclado

Rail focável (`tabIndex={0}`):

| Tecla | Ação |
|-------|------|
| `←` / `→` | Move o cursor 100ms |
| `Shift+←` / `Shift+→` | Move o cursor 1000ms |
| `Escape` | Limpa a seleção |

Cursor sempre constrangido a `[0, totalDuration_ms]`.

## Integração com `useTimeStore`

Controlado via `TimeRailContainer` (ver `stores/time-store.md`). O container monta `segments` (acumulando `startOffset`), decima o sinal selecionado para a `sparklineData`, e liga `onSelectionChange`/`onCursorChange` às actions do store. O `TimeRail` fica fixo no topo de `DatalogPage`, sobre o `<Outlet>` das abas (que rola independentemente).
