# COMMANDS.md — referência rápida de comandos

Todos os comandos assumem que você está na raiz do projeto.
Começando agora? Rode o **Quickstart** e depois pule para a seção que precisar.

## Quickstart

```bash
./scripts/check.sh        # valida tudo sem rodar carga (sempre antes de commit)
./scripts/run.sh smoke    # execução real curta contra o alvo (~10s)
```

---

## 1. Validação (sem carga)

```bash
./scripts/check.sh                  # suíte completa: parse, thresholds, dynamic, contratos, sintaxe
k6 run tests/contracts.js           # só os contratos dos módulos (1 iteração, zero requisições)
k6 inspect scenarios/smoke.js       # inspeciona as opções geradas por um perfil
```

## 2. Execuções (perfis)

```bash
./scripts/run.sh smoke     # 1 VU por 10s — valida que script e alvo funcionam
./scripts/run.sh load      # taxa de chegada com rampa — comportamento sob carga esperada
./scripts/run.sh stress    # VUs em rampa crescente — encontra o limite do sistema
./scripts/run.sh spike     # pico súbito (2 → 60 req/s) — reação a picos
```

## 3. Perfil dynamic (por RPS)

```bash
# Padrão: get 20/s + create 5/s durante 1m
./scripts/run.sh dynamic

# Só leitura, 30/s por 2 minutos
GET_RPS=30 CREATE_RPS=0 DURATION=2m ./scripts/run.sh dynamic

# Mix leitura + escrita (atenção: taxa = iterações da jornada/s, não requisições)
GET_RPS=20 CREATE_RPS=5 DURATION=5m ./scripts/run.sh dynamic

# Jornada completa (inclui pausa entre iterações)
FULL_RPS=5 DURATION=1m ./scripts/run.sh dynamic

# Seleção explícita de jornadas (taxas padrão aplicadas às escolhidas)
SCENARIOS=get,create ./scripts/run.sh dynamic

# Selecionar a full exige taxa > 0
SCENARIOS=full FULL_RPS=2 DURATION=1m ./scripts/run.sh dynamic
```

## 4. Flags e variáveis de ambiente

| Flag / variável | Exemplo |
|---|---|
| `--influx` | `./scripts/run.sh load --influx` |
| `--logs-json` | `./scripts/run.sh smoke --logs-json` |
| `BASE_URL` | `BASE_URL=https://sua-api.com ./scripts/run.sh smoke` |
| `RUN_ID` | `RUN_ID=minha-run-01 ./scripts/run.sh smoke` |
| `K6_INFLUX_URL` | `K6_INFLUX_URL=http://outro-host:8086/k6 ./scripts/run.sh smoke --influx` |
| `ENV_NAME` | `ENV_NAME=staging ./scripts/run.sh smoke` |
| `GET_RPS` / `CREATE_RPS` / `FULL_RPS` | seção 3 |
| `DURATION` | `DURATION=30s` (apenas no dynamic) |
| `SCENARIOS` | `SCENARIOS=get,create` (apenas no dynamic) |

Arquivo `.env` (carregado automaticamente pelo `run.sh`):

```bash
cp .env.example .env    # edite BASE_URL, ENV_NAME etc.
```

## 5. Observabilidade (Grafana + InfluxDB)

```bash
docker compose up -d influxdb grafana     # sobe a stack (Grafana: http://localhost:3000)

./scripts/run.sh load --influx            # execução enviando métricas em tempo real

docker compose --profile run up k6        # smoke rodando dentro do Compose

# Consultas rápidas no InfluxDB
docker compose exec influxdb influx -database k6 -execute 'SHOW MEASUREMENTS'
docker compose exec influxdb influx -database k6 -execute 'SELECT count(value) FROM successful_reads'
docker compose exec influxdb influx -database k6 -precision rfc3339 -execute 'SELECT last(value) FROM get_journey_duration'

docker compose down                       # para tudo (use -v para apagar os dados)
```

Dashboard provisionado: **k6 — Visão geral** (latência p95, RPS, VUs, falhas, leituras,
escritas e tempos por jornada). Filtre por `testid` para comparar execuções.

## 6. Analisar resultados

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

## 7. k6 direto / Docker

```bash
k6 run scenarios/load.js                                          # cada arquivo define o próprio perfil
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scenarios/load.js # sem flag --out, K6_OUT funciona
```

> Atenção: o k6 ignora `K6_OUT` quando existem flags `--out`. Via `run.sh`, use `--influx`.

## 8. Desenvolvimento (novos cenários e jornadas)

```bash
cat agents/criar-cenario.md    # playbook: adicionar um novo perfil
cat agents/criar-jornada.md    # playbook: adicionar um novo fluxo de negócio
cat agents/evolucao.md         # checklist antes de commit/PR
cat AGENTS.md                  # contexto para agentes de IA (arquitetura e invariantes)

# Depois de qualquer mudança:
./scripts/check.sh && ./scripts/run.sh smoke
```

## 9. CI (GitHub Actions)

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
