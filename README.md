# k6 Example

Projeto de exemplo de **testes de carga com k6** — fins de estudo e portfólio.
Cada execução gera artefatos completos (JSON, CSV, HTML e log) para análise posterior,
com opção de dashboards em tempo real via Grafana + InfluxDB.

> Projeto independente, com código 100% original. O alvo padrão é a API pública de
> demonstração [jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com) —
> nenhuma dependência de serviços internos.

## Estrutura

```text
config/       Perfis de execução (smoke/load/stress/spike/dynamic), thresholds e variáveis de ambiente
lib/          Cliente HTTP, checks, jornadas e relatório HTML; lib/metrics/ — métricas por jornada
scenarios/    Arquivos executáveis pelo k6 (um por perfil)
scripts/      run.sh — orquestra a execução e guarda todos os resultados; check.sh — valida sem carga
tests/        contracts.js — testes de contrato dos módulos (1 iteração, sem carga)
grafana/      Provisioning do Grafana (datasource + dashboard)
agents/       Playbooks para agentes de IA (criar cenário/jornada, avaliar resultados, evoluir)
results/      Artefatos gerados (ignorados pelo Git)
```

> Referência rápida de todos os comandos: [`COMMANDS.md`](COMMANDS.md).

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

# Com métricas em tempo real no Grafana local (requer docker compose up)
./scripts/run.sh load --influx
```

Flags disponíveis:

| Flag | Efeito |
|---|---|
| `--influx` | Envia métricas em tempo real ao InfluxDB/Grafana local |
| `--logs-json` | Logs do k6 em JSON (útil para pipelines) |

O `run.sh` carrega um `.env` da raiz automaticamente (copie o `.env.example`), gera um `RUN_ID`
por execução e adiciona as tags `testid`/`testName` às métricas — o cabeçalho impresso mostra
k6, commit, perfil, run_id e alvo.

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

> Atenção: o k6 ignora `K6_OUT` quando existem flags `--out` (caso do `run.sh`). Para enviar
> métricas ao Grafana via orquestrador, use `./scripts/run.sh <perfil> --influx`.

## Resultados gerados

Cada execução cria `results/<data>-<perfil>/` com:

| Arquivo | Conteúdo |
|---|---|
| `console.log` | Saída completa do k6, incluindo o resumo formatado no final (THRESHOLDS, CUSTOM, HTTP, EXECUTION, NETWORK) |
| `summary.json` | Sumário estruturado de todas as métricas |
| `summary.html` | Relatório visual (thresholds e métricas) |
| `raw.json.gz` | Stream completo de métricas, ponto a ponto |
| `metrics.csv` | Métricas em CSV para planilhas/análises |
| `metadata.txt` | Perfil, run_id/testid, commit, versão do k6, alvo, horários e exit code |

## Validando scripts sem rodar carga

```bash
./scripts/check.sh
```

Valida tudo **sem disparar requisições** contra o alvo:

- sintaxe e geração de opções de todos os perfis (`k6 inspect`);
- presença dos thresholds obrigatórios em cada perfil;
- seleção de jornadas do perfil `dynamic` por RPS — incluindo casos de erro (todas as jornadas
  em 0, valor inválido);
- contratos dos módulos com 1 iteração e sem carga (`k6 run tests/contracts.js`): funções `exec`
  exportadas, executor e duração/estágios de cada cenário, thresholds mínimos;
- sintaxe do `scripts/run.sh`.

O check roda no CI antes do smoke e requer `python3` (apenas para ler o JSON do `k6 inspect`).

## Observabilidade com Grafana

```bash
docker compose up -d influxdb grafana
# Grafana em http://localhost:3000 (acesso anônimo habilitado)
```

Envie métricas em tempo real durante a execução:

```bash
./scripts/run.sh load --influx          # recomendado: via run.sh
# ou, executando o k6 direto:
K6_OUT=influxdb=http://localhost:8086/k6 k6 run scenarios/load.js
```

> URL customizada do InfluxDB: `K6_INFLUX_URL=http://outro-host:8086/k6 ./scripts/run.sh smoke --influx`

O dashboard **k6 — Visão geral** já vem provisionado (latência p95, RPS, VUs, falhas, leituras,
escritas e tempos por jornada).
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
| `SCENARIOS` | Seleção explícita de jornadas (ex.: `get,create`) | vazio (usa as taxas) |

```bash
# 30 req/s só de leitura, por 2 minutos
GET_RPS=30 CREATE_RPS=0 DURATION=2m ./scripts/run.sh dynamic

# Leitura e escrita juntas, mix 20/5 req/s por 5 minutos
GET_RPS=20 CREATE_RPS=5 DURATION=5m ./scripts/run.sh dynamic

# Seleção explícita (taxas padrão aplicadas às jornadas escolhidas)
SCENARIOS=get,create ./scripts/run.sh dynamic
```

> Jornada selecionada em `SCENARIOS` com taxa resolvida em 0 falha com mensagem clara — para
> rodar a `full` via `SCENARIOS`, defina `FULL_RPS` maior que 0.

> A taxa configurada é de **iterações da jornada por segundo**, não de requisições HTTP.
> Cada iteração de `getJourney()` dispara 4 requisições (listar posts, ler post, ler comentários,
> listar usuários) e cada iteração de `createJourney()` dispara 1. Exemplo: `GET_RPS=20` gera
> ~80 requisições/s no alvo, em paralelo com os ~5 req/s do `CREATE_RPS=5`.
>
> Dica de VUs no k6: o número de VUs é por cenário — cenários não compartilham VUs.
> Uma taxa de chegada (`arrival rate`) também é diferente de VUs fixos: o k6 aloca os VUs
> necessários para sustentar a taxa configurada.

Thresholds globais (em `config/options.js`): `checks > 99%`, `http_req_failed < 1%`,
`http_req_duration p95 < 800ms` e `p99 < 1500ms`, `api_latency p95 < 800ms` e
`dropped_iterations == 0`.

O threshold de `dropped_iterations` invalida a medição: se o k6 não conseguir sustentar a taxa
de chegada (faltaram VUs), as iterações são descartadas e a execução termina com falha — o
resultado **não serve para análise**. Vale para os perfis de taxa de chegada (`load`, `spike` e
`dynamic`); nos demais a métrica nem existe e o threshold é ignorado.

Ao violar qualquer threshold, o `run.sh` termina com exit code diferente de zero, registra
`result=invalido_threshold_violado` no `metadata.txt` e falha no CI — pronto para pipelines.

## Métricas customizadas

Métricas comuns em `lib/metrics/common.js`:

| Métrica | Tipo | Descrição |
|---|---|---|
| `api_latency` | Trend | Tempo por requisição HTTP (tag `name` = rota) |
| `api_errors` | Counter | Respostas com status ≥ 400 ou falha de rede |
| `business_flows` | Counter | Fluxos completos executados com sucesso |

Métricas por jornada (um arquivo dedicado em `lib/metrics/` por fluxo):

| Métrica | Tipo | Jornada | Descrição |
|---|---|---|---|
| `successful_reads` / `failed_reads` | Counter | get | Leituras com sucesso / com falha |
| `read_response_time` | Trend | get | Tempo por operação de leitura (ms) |
| `get_journey_duration` | Trend | get | Duração total da jornada de leitura (ms) |
| `successful_creates` / `failed_creates` | Counter | create | Escritas com sucesso / com falha |
| `create_response_time` | Trend | create | Tempo por operação de escrita (ms) |
| `create_journey_duration` | Trend | create | Duração total da jornada de escrita (ms) |

> Contadores sem amostras (ex.: `failed_reads` em uma execução sem falhas) não aparecem no
> `summary.json` — isso é esperado no k6.

Padrão para uma nova jornada: crie `lib/metrics/<jornada>.js` exportando as métricas **e um
recorder** (ex.: `recordRead(ok, startedAt)`), re-exporte em `lib/metrics/index.js` e chame o
recorder nos passos da jornada. Passo a passo em `agents/criar-jornada.md`.

## CI

O workflow `.github/workflows/k6-smoke.yml` roda `./scripts/check.sh` (validações sem carga) e o
perfil `smoke` a cada push/PR, publicando a pasta `results/` como artefato.

## Uso com IA (agentes)

O projeto é **AI-ready**: o [`AGENTS.md`](AGENTS.md) descreve arquitetura, invariantes e comandos,
e a pasta [`agents/`](agents/) traz playbooks por tarefa:

- [`agents/criar-cenario.md`](agents/criar-cenario.md) — adicionar um novo perfil de execução
- [`agents/criar-jornada.md`](agents/criar-jornada.md) — adicionar um novo fluxo de negócio
- [`agents/avaliar-resultados.md`](agents/avaliar-resultados.md) — interpretar os artefatos de uma execução
- [`agents/evolucao.md`](agents/evolucao.md) — evoluir o projeto com segurança

Agentes como opencode, Claude Code, Cursor e Copilot leem o `AGENTS.md` automaticamente — a
qualquer mudança, o contrato é sempre o mesmo: `./scripts/check.sh` com 0 falhas.

## Licença

[MIT](LICENSE)
