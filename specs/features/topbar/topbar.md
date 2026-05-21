# TopBar

Barra superior global, sempre visível. Três seções além do logotipo/nome: **Mapa**, **Logs** e **Exportar**.

## Seção: Mapa

- **Sem mapa** — botão `+ Importar Mapa`; clique abre o seletor nativo de arquivo (`.csv`).
- **Com mapa** — exibe `📄 <nome>.csv`; clique abre o seletor para **substituir** o mapa. A substituição limpa o mapa editável e recarrega o original; os logs permanecem.

## Seção: Logs

- **Sem logs** — botão `+ Importar Log`; abre o seletor (`.csv`, múltipla seleção).
- **Com logs** — botão `📋 Logs (N)`; abre o **painel dropdown de logs**.

### Painel dropdown de logs

Lista cada log com:
- **Checkbox** — inclui/exclui o log da sessão ativa sem removê-lo da lista
- **≡ (handle)** — arraste para reordenar; a ordem define a concatenação temporal dos logs
- **✕** — remove o log permanentemente
- Nome e duração do arquivo

Rodapé: "Total selecionado: \<duração\>" e botão `+ Adicionar`. Alterar qualquer item atualiza automaticamente os componentes que consomem os dados (TimeRail, gráficos, análise).

## Seção: Exportar

Botão `⬇ Exportar` — desabilitado sem mapa. Com mapa, o clique faz **download imediato** (sem diálogo) do CSV no formato original da ECU, contendo o mapa **editável atual** (edições manuais + correções do auto-tuning). Nome sugerido: `<nome_original>_tuned.csv`.

## Comportamento de estado global

| Ação | Efeito |
|------|--------|
| Importar novo mapa | Substitui mapa original e editável; logs e seleção de tempo preservados |
| Remover/desmarcar log ativo | TimeRail e gráficos atualizam a duração total; a seleção é ajustada ou limpa se ficou fora do range |
| Reordenar logs | TimeRail reconstrói a linha do tempo com a nova ordem de concatenação |
