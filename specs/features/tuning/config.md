# Tuning › Configurações (modal)

Acessível via ícone `⚙` na TopBar ou pelo botão `⚙ Config` dentro de uma aba de tuning. Exibido como modal — não é rota separada. As configurações são **globais** e se aplicam a todas as abas de tuning.

O formulário é renderizado dinamicamente a partir do JSON Schema do engine (ver [architecture/frontend/components/tuning-config-modal.md](../../architecture/frontend/components/tuning-config-modal.md)). Os campos são agrupados em seções colapsáveis.

## Campos

### Filtros de dados

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `min_clt` | inteiro (ºC) | 80 | Descarta pontos com temperatura do motor abaixo do valor — motor frio tem enriquecimento de partida que distorce o VE Lambda |
| `lambda_loop_closed_only` | boolean | true | Descarta open loop — o método VE Lambda depende do feedback de closed loop |
| `skip_first_closed_loop` | inteiro | 10 | Descarta os primeiros N pontos após entrar em closed loop — a correção demora a estabilizar |
| `skip_first_rpm_bucket` | inteiro | 0 | Descarta os primeiros N pontos após mudar de bucket de RPM (transiente) |
| `skip_first_map_bucket` | inteiro | 0 | Descarta os primeiros N pontos após mudar de bucket de MAP (transiente) |
| `max_delta_rpm` | inteiro (RPM) | 99999 | Descarta pontos com variação de RPM entre amostras acima do valor |
| `max_delta_map` | inteiro (kPa) | 99999 | Descarta pontos com variação de MAP entre amostras acima do valor |
| `max_delta_lambda_target` | float (λ) | 0.200 | Descarta se `abs(lambda_medido − lambda_target) > valor` — leitura fora do alvo |
| `max_lambda` | float (λ) | 1.090 | Descarta pontos com lambda medido acima do valor — leituras muito pobres são inválidas |
| `max_delta_pedal` | float (%) \| null | null | Descarta pontos com variação de pedal acima do valor; `null` = desabilitado. Requer a coluna de pedal no log |

### Qualidade por célula

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `outlier_sigma` | float | 2.0 | Rejeita amostras a mais de N desvios padrão da média da célula (só quando a célula tem ≥5 amostras) |
| `cv_threshold` | float | 0.15 | CV (`std/média`) a partir do qual o `stability_score` cai a 0 — 15% de variação já indica célula instável |

### Correção

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `weight_sample_base` (K) | inteiro | 40 | Parâmetro K de `count_score = n/(n+K)`. Controla a inércia da correção: K alto → mais amostras para peso alto. Com K=40: 40 amostras = peso 0.5, 200 amostras = peso 0.83 |
| `max_correction_pct` | inteiro (%) | 15 | Correção máxima por célula em uma única rodada; células que precisariam de mais são clampeadas |

### Convergência

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `convergence_threshold` | float (%) | 5.0 | Erro residual abaixo do qual a célula é considerada convergida |

### Pós-processamento (extrapolação)

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `rpm400_rule_enabled` | boolean | true | Aplica a regra de RPM 400: usa a coluna 800 RPM descontada de `rpm400_discount` |
| `rpm400_discount` | float | 0.045 | Desconto sobre a coluna 800 RPM. `val_400 = val_800 × (1 − 0.045)` |
| `low_map_rule_enabled` | boolean | true | Extrapola linhas de MAP baixo sem dados a partir da linha superior |
| `low_map_threshold` | inteiro (kPa) | 20 | Linhas de MAP até este valor sem dados usam a linha imediatamente superior como base |
| `low_map_discount` | float | 0.025 | Desconto sobre a linha de MAP superior. `val_20kpa = val_30kpa × (1 − 0.025)` |
| `max_adjacent_gradient_pct` | float (%) | 20.0 | Diferença máxima entre células vizinhas antes de emitir um warning de gradiente |

### Campo de correção

Etapa 7 do pipeline (ver [tuning-engine.md](../tuning-engine.md)).

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `smoothing_strength` | float | 0.5 | Suavização do campo de correção (`μ`). ↑ = campo mais liso e uniforme, células de confiança média cedem mais aos vizinhos; ↓ = campo gruda mais nos dados medidos. Células de alta confiança permanecem ~verdade em qualquer valor razoável |

## Comportamento

- **Salvar** — persiste em `localStorage` (`miot:config`); o botão "Rodar Auto-tuning" usa os novos valores na próxima execução.
- **Restaurar padrões** — reverte os campos para os valores padrão; não salva automaticamente.
- As configurações **não retroagem** sobre um auto-tuning já executado — é necessário rodar novamente.
- Alterar qualquer campo marca o último resultado como desatualizado (indicação visual no botão "Rodar Auto-tuning").
