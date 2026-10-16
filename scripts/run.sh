#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-smoke}"
EXTRA_FLAG="${2:-}"
INFLUX_URL="${K6_INFLUX_URL:-http://localhost:8086/k6}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f "scenarios/${PROFILE}.js" ]; then
  echo "Perfil inválido: \"${PROFILE}\""
  echo "Disponíveis: smoke, load, stress, spike, dynamic"
  echo "Uso: ./scripts/run.sh <perfil> [--influx]"
  exit 1
fi

if [ -n "$EXTRA_FLAG" ] && [ "$EXTRA_FLAG" != "--influx" ]; then
  echo "Flag desconhecida: \"${EXTRA_FLAG}\" — use --influx para enviar métricas ao Grafana local"
  exit 1
fi

if [ -n "${K6_OUT:-}" ] && [ "$EXTRA_FLAG" != "--influx" ]; then
  echo "Aviso: K6_OUT é ignorado pelo k6 quando existem flags --out (caso do run.sh)."
  echo "       Para enviar ao InfluxDB local, use: ./scripts/run.sh ${PROFILE} --influx"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="results/${STAMP}-${PROFILE}"
mkdir -p "$OUT"

OUT_FLAGS=(--out "json=${OUT}/raw.json.gz" --out "csv=${OUT}/metrics.csv")
INFLUX_LINE="influx=desligado"

if [ "$EXTRA_FLAG" = "--influx" ]; then
  OUT_FLAGS+=(--out "influxdb=${INFLUX_URL}")
  INFLUX_LINE="influx=${INFLUX_URL}"
fi

{
  echo "profile=${PROFILE}"
  echo "started_at=$(date -Is)"
  echo "k6=$(k6 version 2>/dev/null | head -1 || echo 'n/d')"
  echo "git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'n/d')"
  echo "base_url=${BASE_URL:-https://jsonplaceholder.typicode.com (padrao)}"
  echo "${INFLUX_LINE}"
} > "${OUT}/metadata.txt"

echo ""
echo "Executando perfil '${PROFILE}' — resultados em ${OUT}/"
if [ "$EXTRA_FLAG" = "--influx" ]; then
  echo "Enviando métricas em tempo real para ${INFLUX_URL}"
fi
echo ""

set +e
PROFILE="$PROFILE" RESULTS_DIR="$OUT" k6 run "${OUT_FLAGS[@]}" "scenarios/${PROFILE}.js" 2>&1 | tee "${OUT}/console.log"
STATUS=${PIPESTATUS[0]}
set -e

echo "finished_at=$(date -Is)" >> "${OUT}/metadata.txt"
echo "exit_code=${STATUS}" >> "${OUT}/metadata.txt"

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "OK — threshold(s) atendido(s). Artefatos gerados:"
else
  echo "FALHA — threshold(s) violado(s) (exit ${STATUS}). Artefatos gerados:"
fi
ls -1 "$OUT"

if [ "$EXTRA_FLAG" != "--influx" ]; then
  echo ""
  echo "Dica: ./scripts/run.sh ${PROFILE} --influx envia as métricas ao Grafana local (http://localhost:3000)"
fi

exit "$STATUS"
