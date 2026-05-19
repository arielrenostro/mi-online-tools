# Home

**Rota:** `/`  
**Pré-requisito:** nenhum

Tela inicial da aplicação. Ponto de entrada após o carregamento. Apresenta as funcionalidades disponíveis como cards e orienta o usuário sobre o que importar para começar.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [TopBar]                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   Master Injection Online Tools                                              │
│   Importe um mapa e/ou logs para começar.                                    │
│                                                                               │
│   ┌────────────────────────────┐   ┌────────────────────────────┐           │
│   │  🗺  Tuning                 │   │  📊  Datalog                │           │
│   │                            │   │                            │           │
│   │  Edite e afine os mapas    │   │  Visualize e analise os    │           │
│   │  da ECU com base nos       │   │  dados capturados pelo     │           │
│   │  dados dos logs.           │   │  veículo em tempo real.    │           │
│   │                            │   │                            │           │
│   │  ⚠ Requer: mapa importado  │   │  ⚠ Requer: 1+ logs         │           │
│   │                            │   │                            │           │
│   │  [ Abrir → ]               │   │  [ Abrir → ]               │           │
│   └────────────────────────────┘   └────────────────────────────┘           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cards

### Card Tuning

| Estado | Pré-requisito atendido? | Comportamento |
|--------|------------------------|---------------|
| Desabilitado | Não (sem mapa) | Botão cinza, não clicável; exibe `⚠ Requer: mapa importado` |
| Habilitado | Sim | Botão ativo; exibe `✓ Mapa: 4bar - 1.csv`; clique navega para `/tuning` |

### Card Datalog

| Estado | Pré-requisito atendido? | Comportamento |
|--------|------------------------|---------------|
| Desabilitado | Não (sem logs) | Botão cinza, não clicável; exibe `⚠ Requer: 1+ logs importados` |
| Habilitado | Sim | Botão ativo; exibe `✓ 2 logs carregados (20 min 36 s)`; clique navega para `/datalog` |

---

## Estados da tela

### Nada carregado

Ambos os cards desabilitados. A TopBar exibe os botões de importação com destaque visual para orientar o próximo passo.

### Apenas mapa carregado

Card Tuning habilitado, card Datalog desabilitado.

### Apenas logs carregados

Card Tuning desabilitado, card Datalog habilitado.

### Mapa e logs carregados

Ambos os cards habilitados. A tela está pronta para o fluxo completo de tuning.

---

## Navegação

- Não possui navbar lateral — a navegação entre funcionalidades ocorre pelos cards e pelo botão `← Home` presente nas telas filhas
- Recarregar a página retorna para Home (sem persistência de sessão entre recarregamentos na v1)
