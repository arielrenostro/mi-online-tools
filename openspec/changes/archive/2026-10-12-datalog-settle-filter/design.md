## Context

O filtro único (`FilterConfig`, avaliado por `evaluateFilterForLog`) é a máscara de destaque e de
geração de run. Hoje ele só vê um transitório *enquanto ele acontece*: `computeDeltaAmplitude` mede a
amplitude de Pedal/MAP numa janela de 200 ms, e as transições de Lambda Loop contam *pontos*
(`computeLoopTransitionSkipMask`). Nada descarta pontos durante o tempo de assentamento, e a Marcha
(sinal opcional, `signalRegistry`) não entra no filtro. Ver `proposal.md` para a motivação.

Fatos que moldam a solução:

- `computeDeltaAmplitude(rows, signal, windowMs)` é uma janela deslizante O(n) (deques de máx/mín) em
  *tempo*, e devolve `null` onde não há janela completa — a regra de "histórico insuficiente" que
  queremos manter. A janela de estabilidade agora é em *pontos*, então precisa de uma variante por
  contagem do mesmo mecanismo.
- As linhas de um log chegam ordenadas; o avaliador já trata cada log separadamente, então nada
  atravessa logs. Os skips de Lambda Loop já contam em pontos.
- `filtersEqual` compara por `JSON.stringify` do filtro clonado: a ordem das chaves em `cloneFilter`
  importa e precisa incluir os campos novos.
- O filtro salvo (localStorage) e a receita de cada run (`RunRecipe.filter`) guardam o `FilterConfig`
  cru; a receita é lida sem passar por `sanitizeFilter`, então o código de exibição (`filterChips`)
  tem de tolerar campos ausentes (como já faz para os "antes").

## Goals / Non-Goals

**Goals:**
- Descartar, por tempo e não por quantidade de pontos, o trecho que segue um degrau de Pedal, um degrau
  de MAP ou uma troca de marcha, sem cortar rampas lentas.
- Oferecer a janela de estabilidade como critério à parte, para regime estacionário e deriva lenta.
- Zero mudança de comportamento para filtros já salvos (os critérios novos são lidos desligados quando
  ausentes, mesmo com o padrão novo ligando alguns), e padrão novo só para quem ainda não tem filtro.

**Non-Goals:**
- Não altera o delta de 200 ms nem os skips de Lambda Loop (que seguem em pontos).
- Não usa Lambda Corr, RPM ou auto-detecção como critério (ver proposta).
- Não cria janela *antes* do evento para Pedal/MAP/Marcha.
- Não normaliza taxa de amostragem: N é em pontos do log, então N = 25 vale 2,5 s só a 10 Hz.

## Decisions

**1. Cinco critérios novos e independentes, com limite próprio.**
`holdPedal` e `holdMap` (`{enabled, value, n}` — `value` é o limite do degrau, `n` os pontos descartados após o degrau),
`holdGear` (`{enabled, n}`), `stablePedal` e `stableMap` (`{enabled, value, n}` — `value` é a amplitude
máxima, `n` o tamanho da janela em pontos). Alternativa descartada: pendurar "descartar por (s)" nos critérios `maxDeltaTps` /
`maxDeltaMap` existentes. Reaproveitar o limite seria menos campos, mas acopla o evento a um critério
que o usuário pode desligar (qual limite vale então?) e o impede de usar um limite de degrau diferente
do delta de exclusão. Critérios próprios mantêm a regra "cada linha do modal liga/desliga sozinha".
No padrão: `holdPedal`/`holdMap` ligados (degrau 5, n = 15), `holdGear` ligado (n = 15), `stablePedal` ligado
(amplitude 5, n = 10) e `stableMap` desligado (5, n = 10 guardados). O padrão também muda Lambda 1 (0,70–1,09),
CLT (87), |Δλ×alvo| (0,05) e desliga `maxDeltaTps`/`maxDeltaMap` (5 guardados) e o pulo após open loop (`skipOpen`,
n = 10 guardado).

**2. Hold-off: evento por linha + "último evento" varrendo o log.**
Evento de Pedal/MAP: `computeDeltaAmplitude(rows, sinal, 200)` (a constante `DELTA_WINDOW_MS`) com
amplitude `> value` (a detecção do degrau segue em 200 ms; só a contagem do hold é em pontos); linhas sem
janela completa não são evento. Evento de marcha: `Marcha[i]` e a
última `Marcha` numérica anterior são ambas números e diferem (uma linha sem número não é evento nem
zera a referência). Uma única varredura mantém `lastEventIdx`; a linha `i` é excluída quando
`lastEventIdx != null` e `i − lastEventIdx ≤ n` (a própria linha de evento entra, pois `lastEventIdx` é
atualizado antes do teste). Isso dá "N pontos depois do último ponto do degrau" e a extensão por eventos
seguidos sem contador extra. Alternativa descartada: contar N a partir do primeiro ponto do evento — um
degrau de 6 linhas gastaria 6 dos N pontos do assentamento.

**3. Janela de estabilidade: amplitude em janela de N pontos.**
O ponto `i` olha as linhas `i − n + 1 … i`; é excluído quando a amplitude é `> value`, e quando
`i < n − 1` (menos de N pontos de histórico) nunca exclui — mesma regra do delta de 200 ms. A
implementação extrai de `computeDeltaAmplitude` o núcleo de deques de máx/mín e o reaproveita com uma
janela por contagem (sem duplicar o algoritmo; o delta de 200 ms continua por tempo). Custo: uma
passagem O(n) por critério ligado. Linhas sem número no sinal são ignoradas na amplitude, como no delta
de 200 ms.

**4. Contagem em pontos do log, como os skips de Lambda Loop.**
Os critérios novos usam `n` inteiro (pontos), a mesma unidade dos skips de Loop, e não timestamps: o
modal fica uniforme, não depende de timestamps regulares e não precisa tratar buracos no arquivo.
A 10 Hz, N = 25 ≈ 2,5 s. Alternativa descartada: segundos (versão anterior desta change) — mais
intuitivo, mas o usuário prefere a unidade dos skips existentes; o custo é o valor depender da taxa de
amostragem do log.

**5. Persistência e exibição tolerantes.**
`sanitizeFilter` lê cada chave nova se existir e for válida (`value ≥ 0` finito, `n` inteiro: ≥ 0 nos
hold-offs e ≥ 2 nas janelas de estabilidade); do contrário (ausente ou ilegível) o critério fica **desligado**, com os limites padrão: o padrão novo
liga alguns, mas um filtro salvo antes deles tem de deixar passar os mesmos pontos. Um objeto sem nenhuma
chave de filtro é tratado como ilegível e vira o padrão inteiro. `migrateLegacyCorrectionFilters` também
desliga os cinco. `cloneFilter`, `filtersEqual` (ordem das chaves),
`countEnabled`, `filterError` e `isDefaultFilter` passam a cobrir os campos. `filterChips` usa
encadeamento opcional (`filter.holdPedal?.enabled`), pois a receita não é sanitizada.

**6. Modal: seção "Estabilização" e rascunho em texto.**
`FilterDraft` ganha `DraftWindow` (`{enabled, valueText, nText}`) e `DraftCount`
(`{enabled, nText}`), com chaves de erro novas em `DraftErrorKey`. A seção vem depois de
"Transições de Lambda Loop" e antes de "Exibição". Cada linha: switch + rótulo + campo(s) + unidade,
travados quando desligados, como as demais.

## Risks / Trade-offs

- **[Janela longa descarta muito em condução com carga variável]** → o padrão liga os de Pedal/MAP e marcha (15 pontos) e a estabilidade do Pedal (10), e o
  modal mostra a prévia de pontos que passam antes de "Aplicar".
- **[N em pontos depende da taxa de amostragem do log]** → o modal mostra a unidade "pontos" e a spec
  diz que 25 pontos ≈ 2,5 s a 10 Hz; logs com outra taxa pedem outro N.
- **[Buraco de timestamps (software da ECU reiniciou no meio do arquivo)]** → a janela e o hold contam
  linhas, então pontos de um lado e do outro do buraco são tratados como vizinhos; é o mesmo
  comportamento dos skips de Lambda Loop hoje e não é tratado aqui.
- **[Limite do degrau (5) igual ao do delta de exclusão pode confundir]** → o modal explica que a
  detecção de degrau (200 ms) é independente do Máx Delta TPS/MAP.
- **[Marcha ausente em logs antigos]** → o critério não exclui nada nesses logs (não gera evento) em
  vez de reprovar tudo, ao contrário das faixas; isso está na spec para não surpreender.
- **[`filtersEqual` por JSON.stringify]** → o teste de igualdade/clonagem cobre a ordem das chaves
  novas, para o botão "Aplicar" e o destaque do botão "Filtro" não ficarem errados.

## Migration Plan

Sem migração de banco: o filtro e as receitas ganham campos opcionais lidos com padrão. Reverter =
remover os campos; filtros salvos com eles voltariam a ser lidos sem eles, sem erro.
