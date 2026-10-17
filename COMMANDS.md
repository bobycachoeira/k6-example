# COMMANDS.md — referência rápida de comandos

Todos os comandos assumem que você está na raiz do projeto.
Começando agora? Rode o **Quickstart** e depois pule para a seção que precisar.

## Quickstart

```bash
./scripts/check.sh        # valida tudo sem rodar carga (sempre antes de commit)
./scripts/run.sh smoke    # execução real curta contra o alvo (~10s)
```

---

## 0. Ajuda embutida

```bash
./scripts/run.sh --help   # perfis, flags, variáveis e exemplos direto no terminal
```

## 1. Validação (sem carga)

```bash
./scripts/check.sh                  # suíte completa: parse, thresholds, dynamic, contratos, sintaxe
k6 run tests/contracts.js           # só os contratos dos módulos (1 iteração, zero requisições)
k6 inspect scenarios/smoke.js       # inspeciona as opções geradas por um perfil
```

## 2. Execuções (perfis fixos)

```bash
./scripts/run.sh smoke     # 1 VU por 10s — valida que script e alvo funcionam
./scripts/run.sh load      # taxa de chegada com rampa — comportamento sob carga esperada
./scripts/run.sh stress    # VUs em rampa crescente — encontra o limite do sistema
./scripts/run.sh spike     # pico súbito (2 → 60 req/s) — reação a picos
```

## 3. Alvos, ambientes e identificação

```bash
# Outro alvo (staging, local, etc.)
BASE_URL=https://staging.sua-api.com ./scripts/run.sh smoke
BASE_URL=http://localhost:8090 ./scripts/run.sh dynamic

# Nome do ambiente (vira a tag env=<nome> em todas as métricas)
ENV_NAME=staging ./scripts/run.sh load

# RUN_ID próprio (aparece no metadata.txt e nas tags testid/testName)
RUN_ID=black-friday-sim-01 ./scripts/run.sh load

# Flags extras repassadas direto ao k6 (tags, --summary-trend-stats, etc.)
K6_EXTRA_FLAGS="--tag squad=checkout --tag regiao=br" ./scripts/run.sh smoke

# Carregue tudo de uma vez pelo .env (o run.sh lê automaticamente)
cp .env.example .env    # edite BASE_URL, ENV_NAME etc. e rode normalmente
```

## 4. Perfil dynamic — modos de execução

O perfil `dynamic` roda cada jornada como um cenário independente (taxa de chegada + pool de VUs
próprio). Ele tem **3 modos** — escolha um por execução:

### 4.1 Taxas por jornada (RPS explícito)

```bash
./scripts/run.sh dynamic                            # padrão: get 20/s + create 5/s por 1m
GET_RPS=30 CREATE_RPS=0 DURATION=2m ./scripts/run.sh dynamic
GET_RPS=20 CREATE_RPS=5 DURATION=5m ./scripts/run.sh dynamic
FULL_RPS=5 DURATION=1m ./scripts/run.sh dynamic     # jornada completa (com pausa entre iterações)
```

### 4.2 Seleção explícita de jornadas

```bash
SCENARIOS=get,create ./scripts/run.sh dynamic       # só as escolhidas (taxas padrão)
SCENARIOS=full FULL_RPS=2 DURATION=1m ./scripts/run.sh dynamic
```

### 4.3 Mix percentual (mistura de produção) — `TOTAL_RPS` + `MIX`

```bash
# Só o total: usa o mix padrão (get:20,create:5 ⇒ ~80/20), por 2 minutos
TOTAL_RPS=300 DURATION=2m ./scripts/run.sh dynamic

# 100 iterações/s totais: 70% leitura + 30% escrita, por 2 minutos
TOTAL_RPS=100 MIX=get:70,create:30 DURATION=2m ./scripts/run.sh dynamic

# Três jornadas com pesos relativos (normalizados automaticamente)
TOTAL_RPS=50 MIX=get:5,create:3,full:2 DURATION=1m ./scripts/run.sh dynamic
```

> `MIX` é opcional — sem ele vale o padrão `get:20,create:5`. Pesos não precisam somar 100
> (são normalizados). Taxas são arredondadas (mínimo 1/s). No modo mix use **apenas**
> `TOTAL_RPS`, `MIX` e `DURATION` — combinar com `SCENARIOS`/`*_RPS` gera erro. Lembre: a taxa
> é de **iterações da jornada** (a `get` faz 4 requisições por iteração).

### 4.4 Pré-visualizar sem rodar (dry-run de opções)

```bash
k6 inspect scenarios/dynamic.js
k6 inspect -e TOTAL_RPS=100 -e MIX=get:70,create:30 scenarios/dynamic.js
k6 inspect -e GET_RPS=50 scenarios/dynamic.js
```

## 5. Flags do run.sh e variáveis

| Flag | Efeito |
|---|---|
| `--influx` | Envia métricas em tempo real ao InfluxDB/Grafana local |
| `--logs-json` | Logs do k6 em JSON (útil para pipelines) |
| `-h`, `--help` | Ajuda completa |

| Variável | Exemplo | Onde vale |
|---|---|---|
| `BASE_URL` | `BASE_URL=https://staging.api.com` | todos |
| `ENV_NAME` | `ENV_NAME=staging` | todos |
| `RUN_ID` | `RUN_ID=bf-sim-01` | todos |
| `K6_INFLUX_URL` | `K6_INFLUX_URL=http://host:8086/k6` | com `--influx` |
| `K6_EXTRA_FLAGS` | `K6_EXTRA_FLAGS="--tag squad=x"` | todos |
| `GET_RPS` / `CREATE_RPS` / `FULL_RPS` | `GET_RPS=30` | dynamic |
| `DURATION` | `DURATION=2m` | dynamic |
| `SCENARIOS` | `SCENARIOS=get,create` | dynamic |
| `TOTAL_RPS` (+ `MIX` opcional) | `TOTAL_RPS=300` ou `TOTAL_RPS=100 MIX=get:70,create:30` | dynamic (modo mix) |
| `K6_OUT` | — | só com `k6 run` direto (ignorado com `--out`) |

## 6. Observabilidade (Grafana + InfluxDB)

```bash
docker compose up -d influxdb grafana     # sobe a stack (Grafana: http://localhost:3000)

./scripts/run.sh load --influx            # execução enviando métricas em tempo real

docker compose --profile run up k6        # smoke rodando dentro do Compose

# Consultas rápidas no InfluxDB
docker compose exec influxdb influx -database k6 -execute 'SHOW MEASUREMENTS'
docker compose exec influxdb influx -database k6 -execute 'SELECT count(value) FROM successful_reads'
docker compose exec influxdb influx -database k6 -precision rfc3339 -execute 'SELECT last(value) FROM get_journey_duration'
docker compose exec influxdb influx -database k6 -execute 'SHOW TAG VALUES FROM http_reqs WITH KEY = "testid"'

docker compose down                       # para tudo (use -v para apagar os dados)
```

No Grafana, filtre por `testid` para comparar execuções. Dashboard: **k6 — Visão geral**.

## 7. Analisar resultados

```bash
ls -t results | head                                   # últimas execuções (mais recente primeiro)
cat results/<pasta>/metadata.txt                       # perfil, run_id/testid, commit, alvo, exit code
cat results/<pasta>/console.log                        # saída completa + resumo formatado
xdg-open results/<pasta>/summary.html                  # relatório visual no navegador
```

Análise programática do `summary.json` (snippet completo em `agents/avaliar-resultados.md`):

```bash
python3 - <<'EOF'
import json, glob
f = sorted(glob.glob('results/*/summary.json'))[-1]
m = json.load(open(f))['metrics']
print('arquivo:', f)
print('checks rate:', m['checks']['values']['rate'])
print('p95:', m['http_req_duration']['values'].get('p(95)'))
for name, metric in sorted(m.items()):
    for expr, r in (metric.get('thresholds') or {}).items():
        print('threshold', name, expr, '=> ok' if r['ok'] else '=> VIOLADO')
EOF
```

## 8. k6 direto / Docker (flexível)

```bash
# k6 direto — cada arquivo define o próprio perfil
k6 run scenarios/load.js
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scenarios/load.js

# Docker com perfil e envs customizados (comando é sobrescrito)
docker compose --profile run run --rm k6 run scenarios/dynamic.js
docker compose --profile run run --rm -e DURATION=30s -e TOTAL_RPS=20 -e MIX=get:70,create:30 \
  k6 run scenarios/dynamic.js
docker compose --profile run run --rm -e BASE_URL=https://outro-alvo.com k6 run scenarios/smoke.js
```

## 9. Desenvolvimento (novos cenários e jornadas)

```bash
cat agents/criar-cenario.md    # playbook: adicionar um novo perfil
cat agents/criar-jornada.md    # playbook: adicionar um novo fluxo de negócio
cat agents/evolucao.md         # checklist antes de commit/PR
cat AGENTS.md                  # contexto para agentes de IA (arquitetura e invariantes)

# Depois de qualquer mudança:
./scripts/check.sh && ./scripts/run.sh smoke
```

## 10. CI (GitHub Actions)

```bash
gh run list        # histórico das execuções (check + smoke a cada push/PR)
gh run watch       # acompanha a execução mais recente
gh run view        # detalhes da última execução
```

Baixar os artefatos direto pelo CLI (sem navegador):

```bash
gh run download -n k6-resultados -D /tmp/k6-resultados   # última execução
gh run download <run-id> -n k6-resultados                # execução específica
```

> O Chrome às vezes bloqueia o `.zip` de artefatos do GitHub como "arquivo perigoso"
> (falso positivo do Safe Browsing). Com `gh run download` você contorna isso por completo.

---

## Receitas prontas

```bash
# 1. Simular pico de e-commerce: mix de produção em volume alto, 5 min, indo pro Grafana
TOTAL_RPS=300 MIX=get:70,create:30 DURATION=5m ENV_NAME=prod-sim RUN_ID=bf-sim-01 \
  ./scripts/run.sh dynamic --influx

# 2. Comparar execuções no Grafana (filtre pelo testid no dashboard)
RUN_ID=antes-deploy  ./scripts/run.sh load --influx
RUN_ID=depois-deploy ./scripts/run.sh load --influx

# 3. Pipeline local: logs em JSON + exit code para o CI
./scripts/run.sh smoke --logs-json || echo "thresholds violados — analise results/*/summary.html"

# 4. Validar mudanças no próprio projeto sem tocar o alvo
./scripts/check.sh
```
