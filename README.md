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

## Jornadas

As jornadas ficam em `lib/journey.js` e podem ser compostas de três formas:

| Jornada | O que executa |
|---|---|
| `getJourney()` | Somente leitura: listar posts, ler post, ler comentários e listar usuários |
| `createJourney()` | Somente escrita: criar post |
| `fullJourney()` | Leituras + escrita, contabiliza um fluxo de negócio e pausa entre iterações |

O perfil `smoke` executa `getJourney()` e `createJourney()` separadamente — exemplo de uso
individual de cada jornada. Os perfis `load`, `stress` e `spike` executam a `fullJourney()`.

## Adicionando uma nova jornada

As jornadas são a camada que compõe os fluxos de negócio (`lib/journey.js` é quem controla tudo).
Para criar uma nova — por exemplo, um fluxo que combina leitura e escrita de outra forma:

1. Escreva a função em `lib/journey.js`, compondo os passos existentes (`listPosts`, `createPost`, ...);
2. Use-a nos cenários que precisarem (ex.: no `default` de um perfil);
3. Para rodá-la por RPS no perfil `dynamic`: exporte-a em `scenarios/dynamic.js` e adicione a
   entrada correspondente em `config/dynamic.js` (nome, `exec` e taxa padrão).

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

Também dá para executar direto pelo k6 — cada arquivo de cenário já define o próprio perfil,
sem precisar de variáveis de ambiente:

```bash
k6 run scenarios/load.js
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scenarios/load.js
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
| `smoke` | 1 VU por 10s | Validar que o script e o alvo funcionam (executa `getJourney` + `createJourney` em sequência no mesmo VU) |
| `load` | Arrival rate com rampa | Comportamento sob carga esperada |
| `stress` | VUs com rampa crescente | Encontrar o limite do sistema |
| `spike` | Pico de 2 → 60 req/s | Reação a picos súbitos |
| `dynamic` | Arrival rate por jornada | Taxa (RPS) definida por variável de ambiente, por jornada |

### Perfil dinâmico (por RPS)

No perfil `dynamic`, **cada jornada é um cenário independente do k6**, com seu próprio pool de
VUs, e a taxa de requisições de cada uma é definida por variáveis de ambiente — omita ou use `0`
para não executar uma jornada:

| Variável | Jornada | Padrão |
|---|---|---|
| `GET_RPS` | `getJourney` (leitura) | 20 |
| `CREATE_RPS` | `createJourney` (escrita) | 5 |
| `FULL_RPS` | `fullJourney` (completa) | 0 (desligada) |
| `DURATION` | Duração de cada cenário | 1m |

```bash
# 30 req/s só de leitura, por 2 minutos
GET_RPS=30 CREATE_RPS=0 DURATION=2m ./scripts/run.sh dynamic

# Leitura e escrita juntas, mix 20/5 req/s por 5 minutos
GET_RPS=20 CREATE_RPS=5 DURATION=5m ./scripts/run.sh dynamic
```

> A taxa configurada é de **iterações da jornada por segundo**, não de requisições HTTP.
> Cada iteração de `getJourney()` dispara 4 requisições (listar posts, ler post, ler comentários,
> listar usuários) e cada iteração de `createJourney()` dispara 1. Exemplo: `GET_RPS=20` gera
> ~80 requisições/s no alvo, em paralelo com os ~5 req/s do `CREATE_RPS=5`.
>
> Dica de VUs no k6: o número de VUs é por cenário — cenários não compartilham VUs.
> Uma taxa de chegada (`arrival rate`) também é diferente de VUs fixos: o k6 aloca os VUs
> necessários para sustentar a taxa configurada.

Thresholds globais (em `config/options.js`): `checks > 99%`, `http_req_failed < 1%`,
`http_req_duration p95 < 800ms` e `p99 < 1500ms`, `api_latency p95 < 800ms`.
Ao violar um threshold, o `run.sh` termina com exit code diferente de zero —
pronto para uso em pipelines de CI.

## CI

O workflow `.github/workflows/k6-smoke.yml` executa o perfil `smoke` a cada push/PR e
publica a pasta `results/` como artefato.

## Licença

[MIT](LICENSE)
