#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-smoke}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f "scenarios/${PROFILE}.js" ]; then
  echo "Perfil inválido: \"${PROFILE}\""
  echo "Disponíveis: smoke, load, stress, spike"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="results/${STAMP}-${PROFILE}"
mkdir -p "$OUT"

{
  echo "profile=${PROFILE}"
  echo "started_at=$(date -Is)"
  echo "k6=$(k6 version 2>/dev/null | head -1 || echo 'n/d')"
  echo "git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'n/d')"
  echo "base_url=${BASE_URL:-https://jsonplaceholder.typicode.com (padrao)}"
} > "${OUT}/metadata.txt"

echo ""
echo "Executando perfil '${PROFILE}' — resultados em ${OUT}/"
echo ""

set +e
RESULTS_DIR="$OUT" k6 run \
  --out "json=${OUT}/raw.json.gz" \
  --out "csv=${OUT}/metrics.csv" \
  "scenarios/${PROFILE}.js" 2>&1 | tee "${OUT}/console.log"
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
exit "$STATUS"
