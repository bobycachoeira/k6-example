#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    [ -z "$key" ] && continue
    if [ -z "${!key:-}" ]; then
      value="$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
      export "$key=$value"
    fi
  done < "$file"
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  load_env_file .env
fi

PROFILE=""
INFLUX=0
LOGS_JSON=0
SHOW_HELP=0

for arg in "$@"; do
  case "$arg" in
    --influx) INFLUX=1 ;;
    --logs-json) LOGS_JSON=1 ;;
    -h|--help) SHOW_HELP=1 ;;
    --*)
      echo "Flag desconhecida: \"${arg}\" (suportadas: --influx, --logs-json, -h)"
      exit 1
      ;;
    *)
      if [ -z "$PROFILE" ]; then
        PROFILE="$arg"
      else
        echo "Argumento extra: \"${arg}\""
        exit 1
      fi
      ;;
  esac
done
PROFILE="${PROFILE:-smoke}"

if [ "$SHOW_HELP" -eq 1 ]; then
  cat <<'USAGE'
Uso: ./scripts/run.sh [perfil] [flags]

Perfis:
  smoke    1 VU por 10s — validação rápida
  load     taxa de chegada com rampa (~2min)
  stress   VUs em rampa crescente até o limite
  spike    pico súbito de tráfego
  dynamic  jornadas como cenários independentes por RPS (padrão: get 20/s + create 5/s)

Flags:
  --influx     envia métricas em tempo real ao InfluxDB local (Grafana em :3000)
  --logs-json  logs do k6 em JSON (útil para pipelines)
  -h, --help   mostra esta ajuda

Variáveis principais:
  BASE_URL, ENV_NAME, RUN_ID, K6_INFLUX_URL, K6_EXTRA_FLAGS
  GET_RPS, CREATE_RPS, FULL_RPS, DURATION, SCENARIOS     (perfil dynamic)
  TOTAL_RPS, MIX                                          (modo mix; MIX padrão: get:20,create:5)

Exemplos:
  ./scripts/run.sh smoke
  ./scripts/run.sh load --influx
  BASE_URL=https://staging.exemplo.com ./scripts/run.sh smoke
  GET_RPS=30 CREATE_RPS=0 DURATION=2m ./scripts/run.sh dynamic
  SCENARIOS=get,create ./scripts/run.sh dynamic
  TOTAL_RPS=100 MIX=get:70,create:30 DURATION=2m ./scripts/run.sh dynamic
  K6_EXTRA_FLAGS="--tag squad=checkout" ./scripts/run.sh smoke

Referência completa: COMMANDS.md
USAGE
  exit 0
fi

if [ ! -f "scenarios/${PROFILE}.js" ]; then
  echo "Perfil inválido: \"${PROFILE}\""
  echo "Disponíveis: smoke, load, stress, spike, dynamic"
  echo "Uso: ./scripts/run.sh <perfil> [--influx] [--logs-json] (-h para ajuda completa)"
  exit 1
fi

if [ -n "${K6_OUT:-}" ] && [ "$INFLUX" -eq 0 ]; then
  echo "Aviso: K6_OUT é ignorado pelo k6 quando existem flags --out (caso do run.sh)."
  echo "       Para enviar ao InfluxDB local, use: ./scripts/run.sh ${PROFILE} --influx"
fi

INFLUX_URL="${K6_INFLUX_URL:-http://localhost:8086/k6}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_ID="${RUN_ID:-$STAMP}"
TEST_ID="${PROFILE}-${RUN_ID}"
OUT="results/${STAMP}-${PROFILE}"
mkdir -p "$OUT"

OUT_FLAGS=(--out "json=${OUT}/raw.json.gz" --out "csv=${OUT}/metrics.csv")
INFLUX_LINE="influx=desligado"
if [ "$INFLUX" -eq 1 ]; then
  OUT_FLAGS+=(--out "influxdb=${INFLUX_URL}")
  INFLUX_LINE="influx=${INFLUX_URL}"
fi

LOG_FLAGS=()
if [ "$LOGS_JSON" -eq 1 ]; then
  LOG_FLAGS+=(--log-format=json)
fi

EXTRA_ARGS=()
if [ -n "${K6_EXTRA_FLAGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ARGS=(${K6_EXTRA_FLAGS})
fi

K6_VERSION="$(k6 version 2>/dev/null | head -1 || echo 'n/d')"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'n/d')"
BASE_URL_TXT="${BASE_URL:-https://jsonplaceholder.typicode.com (padrao)}"

{
  echo "profile=${PROFILE}"
  echo "run_id=${RUN_ID}"
  echo "testid=${TEST_ID}"
  echo "started_at=$(date -Is)"
  echo "k6=${K6_VERSION}"
  echo "git_commit=${GIT_COMMIT}"
  echo "base_url=${BASE_URL_TXT}"
  echo "${INFLUX_LINE}"
  echo "extra_flags=${K6_EXTRA_FLAGS:-}"
} > "${OUT}/metadata.txt"

echo ""
echo "${K6_VERSION} | commit=${GIT_COMMIT} | perfil=${PROFILE}"
echo "run_id=${RUN_ID} | testid=${TEST_ID}"
echo "alvo=${BASE_URL_TXT}"
if [ "$INFLUX" -eq 1 ]; then
  echo "influx=${INFLUX_URL}"
fi
echo "resultados em ${OUT}/"
echo ""

set +e
PROFILE="$PROFILE" RESULTS_DIR="$OUT" RUN_ID="$RUN_ID" k6 run \
  "${OUT_FLAGS[@]}" "${LOG_FLAGS[@]}" "${EXTRA_ARGS[@]}" \
  --tag "testid=${TEST_ID}" \
  --tag "testName=k6-example_${PROFILE}_${RUN_ID}" \
  "scenarios/${PROFILE}.js" 2>&1 | tee "${OUT}/console.log"
STATUS=${PIPESTATUS[0]}
set -e

echo "finished_at=$(date -Is)" >> "${OUT}/metadata.txt"
echo "exit_code=${STATUS}" >> "${OUT}/metadata.txt"
if [ "$STATUS" -eq 0 ]; then
  echo "result=valido" >> "${OUT}/metadata.txt"
else
  echo "result=invalido_threshold_violado" >> "${OUT}/metadata.txt"
fi

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "OK — threshold(s) atendido(s). Artefatos gerados:"
else
  echo "FALHA — threshold(s) violado(s) (exit ${STATUS}). Artefatos gerados:"
fi
ls -1 "$OUT"

if [ "$INFLUX" -eq 0 ]; then
  echo ""
  echo "Dica: ./scripts/run.sh ${PROFILE} --influx envia as métricas ao Grafana local (http://localhost:3000)"
fi

exit "$STATUS"
