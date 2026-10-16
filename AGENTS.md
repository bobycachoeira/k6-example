# AGENTS.md — guia para agentes de IA

Este repositório é um projeto de exemplo de testes de carga com **k6**. Este é o ponto de entrada
para agentes de IA (opencode, Claude Code, Cursor, Copilot, etc.) que forem trabalhar aqui.
Leia antes de alterar qualquer coisa.

## Mapa rápido

| Caminho | Papel |
|---|---|
| `config/options.js` | Perfis (smoke/load/stress/spike), thresholds e `buildOptions(profile)` |
| `config/dynamic.js` | Perfil `dynamic`: jornadas como cenários independentes, taxa por RPS via env |
| `config/env.js` | `BASE_URL`, `RESULTS_DIR`, tags |
| `lib/journey.js` | Jornadas (fluxos de negócio): `getJourney`, `createJourney`, `fullJourney` |
| `lib/metrics/` | Métricas customizadas: `common.js` + uma por jornada (com recorders) |
| `lib/http-client.js` | Wrapper HTTP com tags e métricas customizadas |
| `lib/report.js` | `handleSummary` → `summary.json` + `summary.html` |
| `scenarios/*.js` | Um arquivo por perfil; declara o próprio perfil: `buildOptions('load')` |
| `scripts/run.sh` | Orquestra execução e guarda artefatos em `results/<data>-<perfil>/` |
| `scripts/check.sh` | Validações sem carga (k6 inspect + contratos + casos de erro) |
| `tests/contracts.js` | Contratos dos módulos — 1 iteração, sem carga |
| `grafana/` | Datasource + dashboard provisionados |
| `agents/` | Playbooks por tarefa (ver seção Playbooks) |

## Invariantes (nunca quebre)

1. `./scripts/check.sh` deve terminar com `0 falha(s)` — rode após qualquer mudança.
2. Cada perfil mantém os thresholds obrigatórios: `checks`, `http_req_failed`,
   `http_req_duration` e `api_latency` (definidos em `config/options.js`).
3. Arquivos em `scenarios/` declaram o próprio perfil explicitamente
   (`buildOptions('smoke')`); nunca dependa de variável de ambiente para escolher o perfil.
4. Novos fluxos de negócio nascem em `lib/journey.js`; cenários apenas orquestram a execução.
5. Sem dependências npm — apenas k6 + bash (python3 só no `check.sh`, para ler JSON).
6. Nada de referências a empresas, APIs internas ou código proprietário: o projeto é genérico
   e 100% original.
7. Rode `./scripts/run.sh smoke` ao final de mudanças de código para validar contra o alvo real.

## Comandos

```bash
./scripts/check.sh                                 # validações sem carga (rápido — sempre rode)
./scripts/run.sh smoke                             # execução real curta contra o alvo
GET_RPS=20 CREATE_RPS=5 ./scripts/run.sh dynamic   # perfil por RPS
SCENARIOS=get,create ./scripts/run.sh dynamic      # seleção explícita de jornadas
./scripts/run.sh load --influx                     # métricas em tempo real no Grafana local
k6 run tests/contracts.js                          # contratos isolados
docker compose up -d influxdb grafana              # observabilidade (localhost:3000)
```

## Playbooks

- `agents/criar-cenario.md` — adicionar um novo perfil de execução
- `agents/criar-jornada.md` — adicionar um novo fluxo de negócio
- `agents/avaliar-resultados.md` — ler e interpretar artefatos de uma execução
- `agents/evolucao.md` — checklist para evoluir o projeto com segurança

## Fluxo recomendado para qualquer tarefa

1. Leia o playbook correspondente em `agents/`.
2. Implemente nos pontos listados no playbook.
3. Rode `./scripts/check.sh` (obrigatório) e `./scripts/run.sh smoke`.
4. Atualize README/AGENTS.md se o comportamento público mudou.
