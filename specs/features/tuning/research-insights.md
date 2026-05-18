# Tuning Engine — Research Insights

Análise comparativa entre o algoritmo atual (derivado da planilha de referência do usuário) e as práticas da indústria de ECU tuning. O objetivo é identificar lacunas, confirmar decisões acertadas e propor melhorias fundamentadas.

**Fontes consultadas:** TunerStudio / MegaSquirt, Speeduino, Haltech, Link G4, MaxxECU, ECUMaster, HP Academy, RomRaider, fóruns especializados (msextra, vwvortex, romraider) e documentação técnica da EPA (40 CFR 1036.535).

---

## 1. Fórmula de correção — comparação

### Indústria (abordagem padrão)

A fórmula mais usada nos softwares profissionais (TunerStudio, Haltech, HP Tuners):

```
VE_corrigido = VE_atual × (Lambda_target / Lambda_medido)
```

Intuitiva, direta, mas tem um problema: **ignora a correção que a ECU já está aplicando** (fuel trim). Se o motor está em closed loop e o ECU já compensou +5%, o lambda medido pode estar perto do alvo mesmo com VE errado — a correção acima não identificaria o erro.

### Nossa abordagem (VE Lambda)

```
VE Lambda = (Lambda1_raw + LambdaCorrecao_raw - LambdaTarget_raw) × VEValue_raw / 1000
```

**Vantagem sobre a fórmula padrão:** incorpora simultaneamente o lambda medido, o fuel trim aplicado e o lambda alvo — resultando no VE que o mapa *deveria ter* naquele ponto, não apenas no fator de erro instantâneo do lambda. Isso é **superior** à abordagem da indústria para dados em closed loop.

**Equivalência:** quando não há fuel trim (`LambdaCorrecao_raw = 1000`) e em open loop, a fórmula reduz a:
```
VE Lambda ≈ (Lambda_raw - LambdaTarget_raw + 1000) × VE_raw / 1000
```
Que é essencialmente `VE × (1 + lambda_error)` — compatível com a fórmula padrão da indústria.

**Conclusão:** nossa fórmula está correta e é mais robusta. Manter.

---

## 2. Agregação por célula — comparação

### Indústria

- TunerStudio usa **weighted statistical averages** com remoção de outliers
- Registra hit count, média, variância e desvio padrão por célula
- Threshold mínimo comum: 10–50 amostras; EPA exige mínimo de 70 para testes de emissões
- Softwares de corrida usam mediana para robustez a outliers

### Nossa abordagem

- Usa **média simples** (AVERAGEIFS da planilha)
- Peso de correção via `n / (n + K)` com K=40

### Gap identificado: falta rastreamento de variância por célula

A indústria usa o desvio padrão como segundo critério de qualidade, além do hit count. Uma célula com 50 amostras mas alta dispersão (motor instável, sensor ruidoso) é menos confiável que 20 amostras consistentes.

**Melhoria proposta:**

```python
# Por célula, calcular além da média:
mean_ve_lambda = mean(ve_lambda_values)
std_ve_lambda  = std(ve_lambda_values)
cv             = std_ve_lambda / mean_ve_lambda  # coeficiente de variação

# Confiança combinada (count + estabilidade)
count_score    = n / (n + K)                     # peso atual
stability_score = max(0, 1 - cv / cv_threshold)  # 0 se cv > threshold

confidence = count_score * 0.7 + stability_score * 0.3
```

Parâmetro adicional: `cv_threshold` (padrão: 0.15 → 15% de variação relativa já indica célula instável).

### Gap identificado: rejeição de outliers intra-célula

A indústria rejeita amostras individuais mais de 2σ afastadas da média da célula antes de calcular a correção. Isso evita que um único transiente não filtrado distorça toda a célula.

**Melhoria proposta:**

```python
# Após coletar todos os valores da célula:
if len(values) >= 5:  # mínimo para ter significado estatístico
    mean, std = compute_stats(values)
    values = [v for v in values if abs(v - mean) <= 2 * std]
```

---

## 3. Filtragem de steady state — comparação

### Indústria

Softwares profissionais detectam regime estacionário por múltiplos critérios simultâneos:
- RPM variação < 2% por janela de tempo configurável
- Load (MAP/TPS) variação < 2% por janela
- Lambda estável (variância baixa) por pelo menos N amostras consecutivas
- TPS derivative: descarta pontos onde a posição do pedal está **mudando** (não só o valor absoluto)
- **Lambda delay table**: tabela de atraso configurável por RPM — o sinal do sensor O2 chega com latência que varia com temperatura, fluxo e comprimento do escapamento

### Nossa abordagem

Temos filtros por delta entre amostras consecutivas (`max_delta_rpm`, `max_delta_map`) e descarte dos primeiros N pontos por bucket. Faltam dois elementos críticos:

#### Gap 1: Lambda delay (latência do sensor O2)

O sensor wideband lê a mistura com atraso em relação à injeção. Em motores turbo com escapamento longo, esse atraso pode ser **200–800 ms**. Ignorar o lambda delay faz com que uma amostra de RPM/MAP X seja emparelhada com o lambda de um instante ligeiramente anterior — possivelmente de um RPM/MAP diferente.

**Melhoria proposta:** parâmetro `lambda_delay_ms` (padrão: 0, desabilitado). Quando ativo, o parser de datalog emparelha cada ponto de RPM/MAP com o lambda medido `lambda_delay_ms` milissegundos à frente no tempo.

```python
# Durante parsing do datalog (se lambda_delay_ms > 0):
for i, row in enumerate(rows):
    target_time = row.timestamp + config.lambda_delay_ms
    # busca a leitura de lambda mais próxima de target_time
    row.lambda_measured = find_lambda_at(rows, target_time)
```

#### Gap 2: Taxa de variação do pedal (TPS derivative)

Não basta o pedal estar em uma posição; ele precisa estar **parado** nessa posição. Um pedal variando suavemente a 10% ainda é transiente.

**Melhoria proposta:** filtro adicional `max_delta_pedal` (padrão: 5 % entre amostras consecutivas).

#### Lambda delay — não aplicável para a MasterInjection

Softwares de dyno tuning com hardware dedicado implementam compensação de lambda delay (latência do sensor O2 em relação à injeção). **Esse recurso não faz sentido no nosso contexto** por dois motivos:

1. **Timestamp não é hardware:** a MasterInjection não envia timestamp do próprio hardware. O campo `Timestamp` do log é calculado pelo software de dashboard com base no momento em que recebeu a trama via Bluetooth — o que inclui latência variável de transmissão. Compensar lambda delay em cima de um timestamp já impreciso seria somar ruído sobre ruído.

2. **Filtro já cobre o problema:** o `max_delta_lambda_target` descarta pontos onde o lambda está muito afastado do alvo, que é exatamente o sintoma de um delay não compensado (lambda ainda lendo o estado anterior). O problema é tratado pelo filtro de qualidade, não por deslocamento temporal.

**Conclusão: lambda delay não deve ser implementado para a MasterInjection.**

---

## 4. Zonas de tuning separadas — WOT vs. cruzeiro

### Indústria

A prática consolidada é tratar **WOT (wide open throttle)** e **cruzeiro/carga parcial** como sessões de tuning separadas. A razão: softwares como TunerStudio usam um lambda alvo **fixo e global** configurado pelo usuário. Ao misturar dados de WOT (lambda ≈ 0.85) com dados de cruzeiro (lambda ≈ 1.00) em um software com alvo fixo em 1.00, os pontos de WOT são interpretados como "mapa errado e rico" e o software tenta corrigi-los para stoich — o que é incorreto.

### Nossa abordagem — separação desnecessária

Nossa fórmula VE Lambda usa o `LambdaTarget_raw` **lido diretamente do log**, que reflete o alvo real que a ECU perseguia naquele instante (ex.: 0.85 em WOT, 1.00 em cruzeiro). A fórmula é matematicamente invariante ao valor do alvo:

```
Célula (3200 RPM, 100 kPa), VE correto = 600, mapa tem 600:

Cruzeiro → target=1000, lambda=1000, trim=1000 → VE Lambda = (1000+1000-1000)×600/1000 = 600 ✓
WOT      → target=850,  lambda=850,  trim=1000 → VE Lambda = (850+1000-850)×600/1000  = 600 ✓
```

Ambos convergem para o VE correto independentemente do alvo. Combinado com os filtros de `max_delta_lambda_target`, `max_delta_map` e `skip_first_closed_loop`, os transientes de WOT já são naturalmente excluídos antes de chegar à agregação.

**Conclusão: separação WOT/cruzeiro não se aplica ao nosso motor.** É uma limitação de softwares que usam alvo fixo, não um problema do nosso design.

---

## 5. Suavização — comparação

### Indústria

- TunerStudio: suavização por média de vizinhos, aplicada pelo usuário manualmente após auto-tune
- Alguns softwares implementam **Gaussian Adaptive Selective Outlier Rejecting Smoother** — suaviza sem destruir picos reais
- Interpolação bilinear entre células adjacentes é usada pela ECU em tempo real; por isso, células tunadas isoladamente ainda afetam os pontos de operação intermediários

### Nossa abordagem

Suavização gaussiana 3×3 apenas em células sem dados. Está correta, mas falta um passo:

**Melhoria proposta: verificação pós-tuning de monotonicidade e gradiente**

Após aplicar as correções, verificar automaticamente:
1. **Monotonicidade MAP:** para cada coluna RPM, VE[map_i] deve ser ≤ VE[map_i+1] (exceto abaixo de 40 kPa)
2. **Gradiente máximo entre vizinhos:** diferença entre células adjacentes não deve exceder X% (evita "spike" isolado)
3. Exibir violações como warnings na UI, sugerindo suavização local

---

## 6. Confiança e cobertura do mapa

### Indústria

- EPA recomenda mínimo 70 amostras por célula para dados de emissões
- TunerStudio exibe heatmap de hit count (cobertura) como ferramenta diagnóstica
- Prática comum: fazer pelo menos 3–5 ciclos de rodagem+tuning para convergência
- Critério de convergência: correção residual < ±5% em todas as células com dados

### Nossa abordagem

- `weight_sample_base K=40`: com 20 amostras o peso é 0.33 — bastante conservador para começar
- Não há critério explícito de convergência documentado

**Melhoria proposta: indicador de convergência por célula**

```python
# Após cada rodada de tuning:
residual_pct = abs(ve_lambda_avg - new_map_value) / new_map_value * 100
converged = residual_pct < config.convergence_threshold  # padrão: 5%
```

A UI pode exibir uma cor adicional no mapa: verde = célula convergida (< 5% de erro residual), amarelo = em progresso, cinza = sem dados.

---

## 7. Algoritmo PID vs. batch correction

### Indústria

Softwares como TunerStudio e Speeduino oferecem **PID closed-loop em tempo real**: enquanto o carro roda, o software ajusta a tabela de VE continuamente usando um controlador PID. Isso é poderoso para dialing rápido, mas requer laptoping e conexão ao carro.

### Nossa abordagem

**Batch correction offline**: o usuário importa o log depois da rodagem e calcula as correções. Esta é a abordagem correta para o cenário de uso (não há laptop conectado ao carro durante a rodagem).

**Conclusão:** nossa abordagem é adequada ao caso de uso. O PID é irrelevante aqui. Manter.

---

## 8. Resumo: melhorias priorizadas

| # | Melhoria | Impacto | Complexidade | Prioridade |
|---|----------|---------|--------------|------------|
| 1 | Rastreamento de variância (CV) por célula + confidence combinada | Alto | Baixa | ⭐⭐⭐ |
| 2 | Rejeição de outliers intra-célula (±2σ) | Alto | Baixa | ⭐⭐⭐ |
| 3 | Filtro de taxa de variação do pedal (`max_delta_pedal`) | Médio | Baixa | ⭐⭐ |
| 4 | ~~Lambda delay (`lambda_delay_ms`)~~ | Não aplicável — timestamp do log é calculado via Bluetooth, sem precisão temporal suficiente; `max_delta_lambda_target` já cobre o problema | — | ✅ N/A |
| 5 | Indicador de convergência por célula (residual < 5%) | Médio | Baixa | ⭐⭐ |
| 6 | Verificação pós-tuning de monotonicidade e gradiente | Médio | Média | ⭐⭐ |
| 7 | ~~Zonas de tuning separadas (WOT vs. cruzeiro)~~ | Não aplicável — fórmula VE Lambda já é invariante ao lambda target | — | ✅ N/A |

### Melhorias para v1 (baixa complexidade, alto impacto)

As melhorias 1, 2 e 5 podem ser implementadas no engine sem alterar a UI — apenas adicionam dados ao output que a UI já exibe (confiança, resumo de resultado).

### Melhorias para v1.1

As melhorias 3 e 4 adicionam parâmetros ao modal de config — simples de implementar no backend, requerem apenas novos campos na UI.

### Melhorias para v2

As melhorias 6 e 7 requerem lógica mais complexa e possivelmente novos elementos de UI (zonas coloridas no mapa, warnings de monotonicidade).

---

## 9. Parâmetros novos a adicionar ao TuningConfig

```python
# Qualidade de dados por célula
cv_threshold: float = 0.15          # coeficiente de variação máximo aceitável
outlier_sigma: float = 2.0          # rejeitar amostras > N desvios padrão da média da célula

# Filtragem de transiente
max_delta_pedal: float = 5.0        # % variação máxima do pedal entre amostras
lambda_delay_ms: int = 0            # latência do sensor O2 em ms (0 = desabilitado)

# Convergência
convergence_threshold: float = 5.0  # % de erro residual para considerar célula convergida
```

---

## 10. Referências

- [TunerStudio Auto-Tune Documentation](https://www.tunerstudio.com)
- [Speeduino Manual: AFR/O2 Closed Loop](https://wiki.speeduino.com/en/configuration/O2)
- [Haltech: Tuning with VE](https://www.haltech.com/news-events/tuning-with-ve-volumetric-efficiency/)
- [MaxxECU Auto-Tune from Logfile](https://www.maxxecu.com/webhelp/mtune-autotune_from_logfile.html)
- [HP Academy: Lambda Error Fuel Corrections](https://www.hpacademy.com)
- [RomRaider Forums: Map Interpolation](https://www.romraider.com/forum)
- [MegaSquirt / msextra Forums: Data Binning and Statistics](https://www.msextra.com/forums)
- [EPA 40 CFR 1036.535: Fuel Map Testing Requirements](https://www.ecfr.gov)
