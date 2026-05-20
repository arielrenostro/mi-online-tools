# Datalog › Aba Gráficos

**Status:** ✅ v1  
**Impacto do TimeRail:** cursor projeta linha vertical em todos os painéis; seleção de intervalo define o zoom inicial

---

## Objetivo

Área de visualização livre dividida em painéis. O usuário configura quantos gráficos quer ver, como estão dispostos e quais sinais cada um exibe.

---

## Layout inicial (sem painéis criados)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   Nenhum gráfico adicionado.                                                 │
│                                                                               │
│   [ + Adicionar gráfico ]                                                    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout com painéis

```
┌──────────────────────────────────── [ + Dividir ↔ ] [ + Dividir ↕ ] ──────┐
│                                     │                                         │
│  Painel A                [✕]       │  Painel B                    [✕]      │
│  [ RPM ×] [ MAP ×] [ + Sinal ]     │  [ Lambda 1 ×] [ λ Target ×] [+ Sinal]│
│                                     │                                         │
│  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿     │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      │
│  ─────────────────────────────      │  ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿    │
│                                     │                                         │
├─────────────────────────────────────┴─────────────────────────────────────── │
│                                                                               │
│  Painel C                                                        [✕]        │
│  [ Inj. Utiliz. ×] [ + Sinal ]                                              │
│  ░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░                              │
│                                                                               │
└────────────────────────────────────────────────────────────────────────────-─┘
```

---

## Divisão de painéis

- **`+ Dividir ↔ (horizontal)`**: divide o painel focado em dois, lado a lado
- **`+ Dividir ↕ (vertical)`**: divide o painel focado em dois, empilhados
- A divisão é **recursiva**: qualquer painel pode ser dividido novamente
- **`✕`** em cada painel: remove o painel; o espaço é absorvido pelo painel irmão
- O último painel não pode ser removido (botão `✕` desaparece quando restar apenas um)

---

## Configuração de sinais por painel

Cada painel possui uma barra de chips de sinais no topo:

```
[ RPM × ]  [ MAP × ]  [ + Sinal ▼ ]
```

- **`[ + Sinal ▼ ]`**: abre dropdown com todos os sinais disponíveis do datalog; clique adiciona ao painel
- **`[ Sinal × ]`**: clique no `×` remove o sinal daquele painel
- Múltiplos sinais no mesmo painel compartilham o **eixo X (tempo)**
- Cada sinal tem seu próprio **eixo Y** com escala independente, exibido na lateral do gráfico
- A cor de cada sinal segue a definição em [master/datalog.md](../../master/datalog.md)

---

## Sincronização entre painéis

### Eixo X (tempo)

O eixo X é **sempre sincronizado** entre todos os painéis:
- Zoom via scroll em qualquer painel aplica o mesmo zoom em todos
- Pan (arrastar) em qualquer painel arrasta todos simultaneamente
- O range inicial do eixo X corresponde à seleção do TimeRail (se houver), ou ao intervalo completo dos logs
- **Quando o usuário faz zoom, o TimeRail exibe um viewport band** — overlay escuro nas regiões fora do zoom — indicando visualmente qual trecho da timeline está visível

### Cursor do TimeRail

O cursor pontual do TimeRail projeta uma **linha vertical** em todos os painéis ao mesmo tempo. A linha se move ao arrastar o cursor no rail.

### Tooltip sincronizado

Ao mover o mouse sobre **qualquer painel**, todos os painéis exibem simultaneamente um tooltip com o valor de cada sinal no instante correspondente ao eixo X do mouse:

```
┌─────────────────────┐
│  t = 04:23          │
│  RPM:    3.241      │
│  MAP:    98 kPa     │
└─────────────────────┘
```

```
┌─────────────────────┐
│  t = 04:23          │
│  Lambda 1:   0.998  │
│  λ Target:   1.000  │
└─────────────────────┘
```

O tooltip de cada painel exibe apenas os sinais daquele painel. O tempo (`t`) é sempre o mesmo em todos.

A sincronização usa um handler `onPointerMove` no container pai de todos os painéis — isso garante que o tooltip persista mesmo ao mover o mouse rapidamente pelo gap entre painéis.

### Formato do eixo X

Os labels do eixo X seguem o formato `MM:SS` (ex: `04:23`) ou `HH:MM:SS` para logs com mais de 1 hora. Zero-padded, sem decimais.

---

## Altura dos gráficos

A área de gráficos tem uma **alça de redimensionamento** no rodapé. O usuário pode arrastar verticalmente para aumentar ou diminuir a altura total da área de gráficos.

- Altura mínima: 200px
- Altura máxima: 1200px
- Valor padrão: 400px
- A altura é persistida em `localStorage` via `uiStore.chartsHeight`

---

## Persistência do layout

- O layout de painéis (divisões e sinais configurados) é salvo em `localStorage`
- A altura da área de gráficos é salva em `localStorage`
- Ambos são restaurados ao retornar à aba Gráficos
