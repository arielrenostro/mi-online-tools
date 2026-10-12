## Context

Hoje `computeCorrectionCells` acumula, por célula, o VE Lambda absoluto de cada ponto (peso
bilinear) e `correctionDisplay` divide a estatística pelo valor do centro da célula no mapa editável.
Os pontos que tocam uma célula vêm de toda a vizinhança (até ±1 breakpoint em cada eixo), então a média
carrega a inclinação do mapa — ver `proposal.md`. Um run guarda só `{n, mean, median, mode}` por célula
mais breakpoints e receita, e por isso é "independente dos logs"; o fator é derivado na leitura contra
o mapa editável, o que dá a atualização ao vivo ao editar o mapa.

Fatos que moldam a solução:

- O VE interpolado no ponto usa **os mesmos 4 pesos bilineares** da atribuição do ponto às células
  (`bilinearWeights`): `M_ponto = Σ peso_c × valorDoMapa_c`. Uma única passagem de pesos por amostra
  serve para atribuir e para interpolar.
- A razão `VE Lambda ÷ M_ponto` é não linear no mapa, então não se decompõe em estatísticas por
  célula guardáveis: para a atualização ao vivo o run precisa das amostras, não de agregados.
- `n` (soma dos pesos por célula) não depende do mapa, só dos breakpoints e das amostras.

## Goals / Non-Goals

**Goals:**
- Fator por célula isento da inclinação do mapa, calculado sempre contra o mapa editável carregado.
- Manter a atualização ao vivo, Média/Mediana/Moda, k, cores por amostra, aplicação no mapa e o
  histórico de 10 runs como são.
- Runs antigos continuam no histórico, sem serem apagados ou reinterpretados.

**Non-Goals:**
- Não muda a fórmula do VE Lambda (`veLambdaFormula.ts`), o filtro, a atribuição bilinear nem as
  constantes da tela Configurações.
- Não reconstrói o mapa que gravou o log nem avisa sobre divergência de mapa: a razão é relativa ao
  mapa carregado por construção, então a divergência deixa de afetar o resultado.
- Não faz ajuste de mínimos quadrados da superfície (descartado abaixo).

## Decisions

**1. Razão por ponto contra o mapa interpolado no ponto.**
`ratio = VE Lambda ÷ Σ(w_c × mapa_c)`. Alternativas descartadas:
- *Quociente de somas contra o VE logado* (`ΣwVEλ ÷ ΣwVE`): remove o viés, mas é relativo ao mapa que
  gravou o log, que o usuário não quer como dependência.
- *Mínimos quadrados da superfície necessária*: desfaria também a suavização da vizinhança, porém
  perde mediana/moda, precisa de regularização nas células sem dados e é grande para o ganho.
- *Distribuir a diferença da média absoluta entre as células*: a diferença já está contaminada; não
  remove o viés.

**2. O run guarda amostras, não estatísticas.**
`CorrectionRun.samples` é um `Float64Array` intercalado `[MAP, RPM, VE Lambda, …]` com os pontos
qualificados que caem dentro da faixa do mapa; `cells` deixa de existir nos runs novos. Guardar
`Float64` (24 B/ponto) evita qualquer questão de igualdade com breakpoints; `Float32` (12 B/ponto) fica
como otimização se o histórico pesar. O IndexedDB clona arrays tipados por estrutura, sem mudar
`DB_VERSION` (mesmo `keyPath`).

**3. Derivação na leitura em duas etapas.**
(a) *Plano* por run, calculado uma vez e guardado em `WeakMap<run, plano>`: para cada amostra, as
células afetadas e seus pesos; e o `n` por célula. (b) *Estatísticas* a cada mudança de mapa: razão por amostra, depois média ponderada, mediana e moda por célula. O componente
da seção de correção chama isso num `useMemo` sobre `(run, editableMap)`. Em 14 mil amostras isso é
~56 mil multiplicações; a ordenação por célula para mediana/moda é o custo dominante.

**4. `CorrectionCell` passa a significar fator.** `mean/median/mode` são razões (1,02 = +2%), `n`
continua a contagem efetiva. `computeDirectFactor` devolve a estatística escolhida (sem dividir pelo
mapa); `computeWeightedFactor` mantém `1 + (direto − 1) × n/(n+k)`. `MODE_TOLERANCE` vai de 0,5 (ponto
de VE) para 0,005 (ponto percentual de fator). `rawVeToReal` e `snapshotHasMode` saem. A tooltip mostra
média/mediana/moda como percentual com sinal.

**5. Run sem amostras = utilizável: não.**
Distingue-se por `samples == null`. Esses runs (anteriores e o migrado do snapshot único) seguem no
histórico, com receita, renomeáveis e apagáveis, mas a seção mostra "gerado com método anterior —
gere novamente", sem fatores e sem aplicar. Alternativa descartada: continuar exibindo-os pela fórmula
antiga — mostraria exatamente o número errado que esta change corrige.
`selectSelectedRun`/"próximo run após apagar" passam a exigir compatível **e** com amostras.

**6. Geração.** `generateCorrectionRun` percorre os pontos qualificados como hoje, descarta os fora da
faixa do mapa e grava as amostras; a condição de "run vazio" no store passa a ser "nenhuma amostra".
A atribuição, o filtro, o intervalo de tempo e a receita não mudam.

## Risks / Trade-offs

- **Runs antigos ficam inutilizáveis** → continuam visíveis com a receita; o usuário regenera a partir
  dos logs. Custo único, aviso explícito na UI.
- **Tamanho no IndexedDB** (24 B/ponto; 200 mil pontos × 10 runs ≈ 48 MB) → o filtro costuma deixar
  ~10–60% dos pontos; se pesar, `Float32` (metade) ou limitar o histórico por tamanho.
- **Recalcular a cada edição do mapa** → pesos em cache por run; só a razão e as estatísticas são
  refeitas. Se mediana/moda pesarem, calculá-las só para a estatística selecionada e sob demanda para a
  tooltip.
- **Rollback** → um build antigo lendo um run novo não encontra `cells`. O app é um PWA com atualização
  automática e sem backend; aceito, sem migração de volta.
- **Suavização residual** → o fator de uma célula ainda é a média de uma região (bilinear). Só um ajuste
  de superfície a desfaria; fora de escopo.
- **Lambda Corr e sinal** → a razão herda a convenção de `VE Lambda`; se essa fórmula estiver errada,
  continua errada aqui. Fora de escopo.

## Migration Plan

1. Sem alteração de `DB_VERSION` nem do `keyPath` do store `correction-runs`.
2. Runs persistidos sem `samples` carregam normalmente e são tratados como "sem amostras".
3. O snapshot único migrado continua gerando um run sem amostras.
4. Após implementar, ajustar o *Purpose* de `correction-runs` (hoje diz "map-independent") no spec
   principal, já que a mudança de Purpose não passa por delta.

## Open Questions

Nenhuma. A medição prevista (4.5) resolveu a dúvida de desempenho: com um `sort` numérico de
`Float64Array` por célula, compartilhado entre mediana e moda, a derivação leva ~4 ms com 14 mil
amostras (os 5 logs de 10/10) e ~64 ms com 200 mil amostras espalhadas pelas 256 células (pior caso,
plano em cache). Mediana e moda ficam calculadas sempre, sem "sob demanda".
