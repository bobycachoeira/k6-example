# k6 Example

Projeto de exemplo de **testes de carga com k6** — fins de estudo e portfólio.
Cada execução gera artefatos completos (JSON, CSV, HTML e log) para análise posterior,
com opção de dashboards em tempo real via Grafana + InfluxDB.

> Projeto independente, com código 100% original. O alvo padrão é a API pública de
> demonstração [jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com) —
> nenhuma dependência de serviços internos.

## Estrutura

```text
config/       Perfis de execução (smoke/load/stress/spike), thresholds e variáveis de ambiente
lib/          Cliente HTTP, checks, métricas customizadas, jornada do usuário e relatório HTML
scenarios/    Arquivos executáveis pelo k6 (um por perfil)
scripts/      run.sh — orquestra a execução e guarda todos os resultados
grafana/      Provisioning do Grafana (datasource + dashboard)
results/      Artefatos gerados (ignorados pelo Git)
```

## Pré-requisitos

- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) v1+ instalado
- Docker + Docker Compose (opcional, para observabilidade)

## Executando

```bash
# Perfil smoke (rápido, validação)
./scripts/run.sh smoke

# Perfis disponíveis
./scripts/run.sh load     # carga constante com rampa
./scripts/run.sh stress   # pressão crescente até o limite
./scripts/run.sh spike    # pico súbito de tráfego
```

Para apontar para outro alvo:

```bash
BASE_URL=https://sua-api.exemplo.com ./scripts/run.sh smoke
```

## Resultados gerados

Cada execução cria `results/<data>-<perfil>/` com:

| Arquivo | Conteúdo |
|---|---|
| `console.log` | Saída completa do k6 (resumo textual incluído) |
| `summary.json` | Sumário estruturado de todas as métricas |
| `summary.html` | Relatório visual (thresholds e métricas) |
| `raw.json.gz` | Stream completo de métricas, ponto a ponto |
| `metrics.csv` | Métricas em CSV para planilhas/análises |
| `metadata.txt` | Perfil, commit, versão do k6, alvo e horários |

## Observabilidade com Grafana

```bash
docker compose up -d influxdb grafana
# Grafana em http://localhost:3000 (acesso anônimo habilitado)
```

Envie métricas em tempo real para o InfluxDB durante a execução:

```bash
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scenarios/load.js
```

O dashboard **k6 — Visão geral** já vem provisionado (latência p95, RPS, VUs e falhas).
Ou rode o k6 dentro do Compose:

```bash
docker compose --profile run up k6
```

## Perfis e thresholds

| Perfil | Executor | Objetivo |
|---|---|---|
| `smoke` | 1 VU por 10s | Validar que o script e o alvo funcionam |
| `load` | Arrival rate com rampa | Comportamento sob carga esperada |
| `stress` | VUs com rampa crescente | Encontrar o limite do sistema |
| `spike` | Pico de 2 → 60 req/s | Reação a picos súbitos |

Thresholds globais (em `config/options.js`): `checks > 99%`, `http_req_failed < 1%`,
`http_req_duration p95 < 800ms` e `p99 < 1500ms`, `api_latency p95 < 800ms`.
Ao violar um threshold, o `run.sh` termina com exit code diferente de zero —
pronto para uso em pipelines de CI.

## CI

O workflow `.github/workflows/k6-smoke.yml` executa o perfil `smoke` a cada push/PR e
publica a pasta `results/` como artefato.

## Licença

[MIT](LICENSE)
