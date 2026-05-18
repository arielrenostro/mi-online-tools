# Datalog › Aba Dados

**Status:** ✅ v1  
**Impacto do TimeRail:** cursor destaca e rola para a linha correspondente; seleção de intervalo filtra as linhas exibidas

---

## Objetivo

Exibição tabular dos dados brutos pós-conversão. Permite inspecionar cada amostra individualmente, navegar pelo log e correlacionar valores com os gráficos.

---

## Layout

```
┌─ Dados ─────────────────────────────────── [ Colunas ▼ ]  [ Exportar CSV ] ─┐
│  Exibindo 8.730 linhas (seleção: 04:12 – 18:45)                              │
│                                                                                │
│ ┌──────────────┬──────┬─────┬──────────┬────────────────┬────────────┬─────┐ │
│ │  Tempo       │  RPM │ MAP │ Lambda 1 │ Lambda Target  │ Lambda Corr│ CLT │ │
│ ├──────────────┼──────┼─────┼──────────┼────────────────┼────────────┼─────┤ │
│ │  04:12.100   │ 2341 │  87 │  0.998   │  1.000         │  +0.2%     │  84 │ │
│ │▶ 04:23.512   │ 3241 │  98 │  0.994   │  1.000         │  -0.6%     │  85 │ │  ← cursor
│ │  04:23.612   │ 3256 │  99 │  0.997   │  1.000         │  -0.3%     │  85 │ │
│ │  ...         │      │     │          │                │            │     │ │
│ └──────────────┴──────┴─────┴──────────┴────────────────┴────────────┴─────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Colunas

### Colunas padrão (exibidas por padrão)

| Coluna | Fonte | Formato |
|--------|-------|---------|
| Tempo | `Timestamp` (relativo ao início) | `MM:SS.mmm` |
| RPM | `RPM` | inteiro |
| MAP | `MAP` | `{v} kPa` |
| Lambda 1 | `Lambda 1` | `{v:.3f}` |
| Lambda Target | `Lambda Target` | `{v:.3f}` |
| Lambda Corr | `Lambda Corr` | `{v:+.1f}%` |
| CLT | `CLT` | `{v} ºC` |

### Colunas opcionais (ocultas por padrão)

Todos os demais sinais disponíveis no log podem ser adicionados via `[ Colunas ▼ ]`:
Boost, VE, Ign. Adv., IAT, KM/H, Lambda Loop, Inj. Utiliz., Turbo Target, ACC %, etc.

---

## Comportamentos

### Filtragem por seleção do TimeRail

- Quando há seleção de intervalo no TimeRail: exibe apenas as linhas dentro do intervalo
- Quando não há seleção: exibe todas as linhas de todos os logs ativos concatenados
- O contador no topo informa: `Exibindo N linhas (seleção: HH:MM – HH:MM)` ou `Exibindo N linhas (todos os logs)`

### Linha do cursor

- A linha correspondente ao instante do cursor pontual do TimeRail fica **destacada** (fundo diferente) e é rolada automaticamente para o centro da viewport ao mover o cursor
- O ícone `▶` na primeira coluna marca a linha do cursor

### Navegação bidirecional

- **Clicar em qualquer linha** move o cursor pontual do TimeRail para o instante daquela amostra
- Isso sincroniza o Dashboard e os Gráficos com aquele instante

### Performance

- A tabela é **virtualizada**: renderiza apenas as linhas visíveis na viewport
- Suporta logs com dezenas de milhares de linhas sem degradação de performance

### Configuração de colunas

- Botão `[ Colunas ▼ ]` abre dropdown com checkboxes para cada sinal disponível
- Configuração persiste em `localStorage`
- A ordem das colunas pode ser reordenada via drag-and-drop no header
- Botão switch entre `Bruto` e `Tratado`, para alternar entre o dado bruto e já parseado.

### Exportar CSV

- Botão `[ Exportar CSV ]` faz download das linhas atualmente exibidas (respeitando filtro de seleção e colunas visíveis)
- Formato: CSV com separador `;`, valores já convertidos (não brutos), encoding UTF-8
