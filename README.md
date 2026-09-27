# Master Injection Online Tools

> Ferramenta web de auto-tuning para mapas de combustível da ECU **MasterInjection**.  
> Importa mapa + datalogs → analisa desvios de lambda → sugere correções precisas no mapa VE.

## O que faz

- **Importação client-side** — lê CSV MasterInjection (`#I20`/`#I21`/`#F01`–`#F16`) e datalogs direto no browser, sem upload a nenhum servidor
- **Correção de VE guiada por datalog** — filtros configuráveis (aba Logs) recortam os pontos válidos ao vivo; "Gerar fator de correção" roda a atribuição bilinear (4 células, como a própria ECU lê a tabela) + agregação por célula inteiramente no navegador
- **Edição manual** — tabela interativa com atalhos Excel (range, F2 inline, Ctrl+C/V/Z/Y)
- **Heatmap de correção** — fator direto/ponderado, cor por amostras ou por valor, proveniência (quais logs/filtros geraram o resultado), aviso de desatualizado
- **Multi-log** — carregamento e combinação de vários datalogs com toggle individual
- **Exportação** — download do mapa corrigido em CSV original da ECU
- **Persistência** — mapa, logs, filtros e último snapshot de correção restaurados automaticamente, sem servidor

## Stack

```
Frontend  → React 18 · TypeScript · Vite · Tailwind · Zustand · IndexedDB
Deploy    → Docker (nginx servindo o build estático) — opcional, é só um SPA
```

Sem backend — o app roda inteiramente no navegador.

## Início rápido

### Com Docker

```bash
docker compose up --build
```

- Frontend: http://localhost

### Localmente

```bash
cd frontend && npm install && npm run dev
```

- Frontend: http://localhost:5173

## Usar

1. **Importar mapa** → selecione CSV da MasterInjection
2. **Datalogs** → arraste ou selecione CSVs de log
3. **Filtros** (aba Logs) → ajuste CLT/Lambda/Loop/delta TPS conforme necessário; Dashboard/Gráficos/Dados já refletem o recorte ao vivo
4. **Gerar fator de correção** → roda a atribuição bilinear + agregação e mostra o heatmap na aba VE
5. **Ajustar** → edite células manualmente se necessário
6. **Aplicar correções** → multiplica o mapa editável pelos fatores gerados
7. **Exportar** → baixe CSV pronto para a ECU

## Documentação

| Tipo | Localização |
|------|-----------|
| **Frontend** | [`frontend/README.md`](frontend/README.md) · [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |
| **Specs** | [`specs/`](specs/) · [`openspec/specs/`](openspec/specs/) · [`CLAUDE.md`](CLAUDE.md) |

## Estrutura

```
├── frontend/         App React — mapa, datalogs, correção, UI (tudo client-side)
├── specs/            Specs de formato/arquitetura fora do OpenSpec
├── openspec/         Specs de comportamento do frontend (capabilities)
├── docker-compose.yml
└── README.md
```
