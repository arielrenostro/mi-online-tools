# Tuning › Configurações (modal)

Acessível via ícone `⚙` na TopBar ou pelo botão `⚙ Config` dentro de qualquer aba de tuning. Exibido como modal ou drawer lateral — não é rota separada.

As configurações são globais e se aplicam a todas as abas de tuning.

---

## Layout

```
┌─ Configurações de Tuning ──────────────────────────────────────────────────┐
│                                                                              │
│  FILTROS DE DADOS                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Temperatura mínima do motor (CLT)              [  80 ] ºC                 │
│  Apenas loop fechado                            [✓]                        │
│  Ignorar primeiros N pontos ao entrar em        [  10 ] amostras           │
│    closed loop                                                               │
│  Ignorar primeiros N pontos ao mudar bucket     [   0 ] amostras           │
│    de RPM                                                                    │
│  Ignorar primeiros N pontos ao mudar bucket     [   0 ] amostras           │
│    de MAP                                                                    │
│  Máximo delta RPM entre amostras                [99999] RPM                │
│  Máximo delta MAP entre amostras                [99999] kPa                │
│  Máximo desvio lambda vs. target                [ 0.20] λ                  │
│  Lambda máximo aceito                           [ 1.09] λ                  │
│                                                                              │
│  CORREÇÃO                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Base de amostras para peso (K)                 [  40 ]                    │
│    weight = n / (n + K)  →  K=40: 40 amostras = peso 0.5                  │
│  Correção máxima por iteração                   [  15 ] %                  │
│  Suavização em células sem dados                [✓]   raio: [ 1 ]         │
│                                                                              │
│  EXTRAPOLAÇÃO                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Aplicar regra RPM 400 (col. 800 menos X%)      [✓]   desconto: [ 4.5] %  │
│  Aplicar regra MAP baixo sem dados (≤ X kPa)   [✓]   limite: [  20] kPa  │
│    desconto sobre linha superior:               [ 2.5] %                   │
│                                                                              │
│                               [ Restaurar padrões ]       [ Salvar ]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Campos

### Filtros de dados

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `min_clt` | inteiro (ºC) | 80 | Descarta pontos com temperatura do motor abaixo desse valor — motor frio tem enriquecimento de partida ativo que distorce o VE Lambda |
| `lambda_loop_closed_only` | boolean | true | Descarta pontos em open loop — o método VE Lambda depende do feedback de lambda em closed loop |
| `skip_first_closed_loop` | inteiro (amostras) | 10 | Descarta os primeiros N pontos após a ECU entrar em closed loop — a correção demora alguns ciclos para estabilizar |
| `skip_first_rpm_bucket` | inteiro (amostras) | 0 | Descarta os primeiros N pontos após mudar de bucket de RPM — elimina transientes de entrada na célula |
| `skip_first_map_bucket` | inteiro (amostras) | 0 | Descarta os primeiros N pontos após mudar de bucket de MAP — elimina transientes de carga |
| `max_delta_rpm` | inteiro (RPM) | 99999 | Descarta pontos onde a variação de RPM entre amostras excede esse valor |
| `max_delta_map` | inteiro (kPa) | 99999 | Descarta pontos onde a variação de MAP entre amostras excede esse valor |
| `max_delta_lambda_target` | float (λ) | 0.200 | Descarta pontos onde `abs(lambda_medido - lambda_target) > valor` — leitura muito fora do alvo indica sinal ruidoso ou transiente não detectado |
| `max_lambda` | float (λ) | 1.090 | Descarta pontos com lambda medido acima desse valor — leituras excessivamente pobres são provavelmente inválidas |

### Correção

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `weight_sample_base` (K) | inteiro | 40 | Parâmetro K da fórmula `weight = n / (n + K)`. Controla a "inércia" da correção: K alto → mais amostras necessárias para atingir peso alto; K baixo → poucas amostras já dominam. Com K=40: 40 amostras = peso 0.5, 200 amostras = peso 0.83 |
| `max_correction_pct` | inteiro (%) | 15 | Limite máximo de correção por célula em uma única rodada. Células que precisariam de mais são clampeadas nesse valor |
| `smoothing_enabled` | boolean | true | Aplica suavização gaussiana 3×3 em células sem dados usando vizinhos com dados como âncoras |
| `smoothing_radius` | inteiro | 1 | Raio do kernel de suavização (1 = vizinhos imediatos, 2 = dois saltos, etc.) |

### Propagação estrutural

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `shape_propagation_enabled` | boolean | true | Ativa as etapas 8+9 do pipeline: extração de tendências estruturais (RPM, MAP, gradiente) e composição do `cf_final` com pesos normalizados. Se desativado, o mapa usa apenas a interpolação 2D local (etapa 7) |
| `shape_rpm_weight` | float | 0.50 | Peso α da tendência por RPM no fator estrutural: `cf_structural = rpm_cf^α × map_cf^β × gradient_cf^(1−α−β)` |
| `shape_map_weight` | float | 0.30 | Peso β da tendência por MAP no fator estrutural |
| `shape_gradient_weight` | float | 0.20 | Peso `(1−α−β)` do gradiente local no fator estrutural. Deve satisfazer `shape_rpm_weight + shape_map_weight + shape_gradient_weight = 1.0` |
| `global_shape_weight` | float | 0.10 | Peso do fator global (`cf_global`) no `cf_final`. Desconta proporcionalmente os componentes local e estrutural: `w = 1 − global_shape_weight`, garantindo que a soma dos pesos seja 1.0 |
| `gradient_min_samples` | inteiro | 2 | Número mínimo de pontos observados para computar gradiente em uma linha ou coluna. Abaixo desse valor usa o valor constante observado (1 ponto) ou 1.0 (nenhum ponto) |

### Extrapolação

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `rpm400_rule_enabled` | boolean | true | Aplica a regra de extrapolação da coluna RPM 400: usa o valor da coluna 800 RPM descontado de `rpm400_discount` |
| `rpm400_discount` | float (%) | 4.5 | Percentual de desconto aplicado sobre a coluna 800 RPM para calcular o valor de 400 RPM. Ex.: `val_400 = val_800 × (1 - 0.045)` |
| `low_map_rule_enabled` | boolean | true | Aplica a regra de extrapolação para linhas de MAP muito baixo sem dados suficientes |
| `low_map_threshold` | inteiro (kPa) | 20 | Linhas de MAP até este valor (inclusive) sem dados usam a linha imediatamente superior como base |
| `low_map_discount` | float (%) | 2.5 | Percentual de desconto aplicado sobre a linha de MAP superior. Ex.: `val_20kpa = val_30kpa × (1 - 0.025)` |

---

## Comportamento

- **Salvar**: persiste as configurações em `localStorage`; o botão "Rodar Auto-tuning" usa os novos valores na próxima execução
- **Restaurar padrões**: reverte todos os campos para os valores padrão listados acima; não salva automaticamente
- As configurações **não retroagem** sobre um auto-tuning já executado — é necessário rodar novamente
- Alterar qualquer filtro invalida o resultado do último auto-tuning exibido (indicação visual no botão "Rodar Auto-tuning")
