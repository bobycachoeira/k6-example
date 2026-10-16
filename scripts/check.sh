#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

ok() { echo "  ok       $1"; PASS=$((PASS + 1)); }
bad() { echo "  FALHOU   $1"; FAIL=$((FAIL + 1)); }

scenarios_of() {
  k6 inspect "$@" 2>/dev/null | python3 -c "import json,sys; print(','.join(sorted(json.load(sys.stdin)['scenarios'])))" 2>/dev/null
}

detail_of() {
  k6 inspect "$@" 2>/dev/null | python3 -c "
import json, sys
d = json.load(sys.stdin)
for name, sc in sorted(d['scenarios'].items()):
    print(f\"{name}={sc['executor']}|{sc.get('exec', 'default')}|{sc.get('rate', '-')}\")
" 2>/dev/null
}

rate_of() {
  local journey="$1"
  shift
  k6 inspect "$@" 2>/dev/null | python3 -c "
import json, sys
sc = json.load(sys.stdin)['scenarios'].get('$journey') or {}
print(f\"{sc.get('rate', '-')}|{sc.get('exec', '-')}\")
" 2>/dev/null
}

thresholds_ok() {
  k6 inspect "$@" 2>/dev/null | python3 -c "
import json, sys
t = json.load(sys.stdin).get('thresholds') or {}
required = ['checks', 'http_req_failed', 'http_req_duration', 'api_latency', 'dropped_iterations']
sys.exit(0 if all(k in t and t[k] for k in required) else 1)
"
}

expect() {
  local desc="$1" expected="$2" got="$3"
  if [ "$got" = "$expected" ]; then
    ok "$desc"
  else
    bad "$desc (esperado: '$expected' | obtido: '$got')"
  fi
}

expect_names() {
  local desc="$1" expected="$2"
  shift 2
  local got
  got="$(scenarios_of "$@")"
  if [ "$got" = "$expected" ]; then
    ok "$desc"
  else
    bad "$desc (esperado: '$expected' | obtido: '$got')"
  fi
}

expect_fail() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    bad "$desc (deveria falhar)"
  else
    ok "$desc"
  fi
}

echo "== 1. Parse e opções de cada perfil (k6 inspect) =="
for f in smoke load stress spike dynamic; do
  if k6 inspect "scenarios/$f.js" >/dev/null 2>&1; then
    ok "scenarios/$f.js compila e gera opções"
  else
    bad "scenarios/$f.js compila e gera opções"
  fi
done

echo "== 2. Thresholds obrigatórios em todos os perfis =="
for f in smoke load stress spike dynamic; do
  if thresholds_ok "scenarios/$f.js"; then
    ok "scenarios/$f.js define thresholds obrigatórios"
  else
    bad "scenarios/$f.js define thresholds obrigatórios"
  fi
done

echo "== 3. Perfil dynamic: seleção de jornadas por RPS =="
expect "default => get e create" \
  "create,get" \
  "$(scenarios_of scenarios/dynamic.js)"

expect "GET_RPS=0 => só create" \
  "create" \
  "$(scenarios_of -e GET_RPS=0 scenarios/dynamic.js)"

expect "CREATE_RPS=0 => só get" \
  "get" \
  "$(scenarios_of -e CREATE_RPS=0 scenarios/dynamic.js)"

expect "FULL_RPS=10 => get, create e full" \
  "create,full,get" \
  "$(scenarios_of -e FULL_RPS=10 scenarios/dynamic.js)"

expect "taxa e exec do GET_RPS respeitados" \
  "get=constant-arrival-rate|getJourney|7" \
  "$(detail_of -e GET_RPS=7 -e CREATE_RPS=0 scenarios/dynamic.js)"

expect "taxa e exec do CREATE_RPS respeitados" \
  "create=constant-arrival-rate|createJourney|2" \
  "$(detail_of -e GET_RPS=0 -e CREATE_RPS=2 scenarios/dynamic.js)"

expect_fail "todas as jornadas em 0 deve falhar" \
  k6 inspect -e GET_RPS=0 -e CREATE_RPS=0 -e FULL_RPS=0 scenarios/dynamic.js

expect_fail "RPS inválido deve falhar" \
  k6 inspect -e GET_RPS=abc scenarios/dynamic.js

echo "== 3b. Perfil dynamic: seleção explícita via SCENARIOS =="
expect "SCENARIOS=get => só get" \
  "get" \
  "$(scenarios_of -e SCENARIOS=get scenarios/dynamic.js)"

expect "SCENARIOS=create,full => create e full" \
  "create,full" \
  "$(scenarios_of -e SCENARIOS=create,full -e FULL_RPS=1 scenarios/dynamic.js)"

expect_fail "SCENARIOS com nome inválido deve falhar" \
  k6 inspect -e SCENARIOS=xyz scenarios/dynamic.js

expect_fail "jornada selecionada com RPS 0 deve falhar" \
  k6 inspect -e SCENARIOS=create -e CREATE_RPS=0 scenarios/dynamic.js

echo "== 3c. Perfil dynamic: modo mix (TOTAL_RPS + percentuais) =="
expect "mix: get recebe 70% de 100" \
  "70|getJourney" \
  "$(rate_of get -e TOTAL_RPS=100 -e MIX=get:70,create:30 scenarios/dynamic.js)"

expect "mix: create recebe 30% de 100" \
  "30|createJourney" \
  "$(rate_of create -e TOTAL_RPS=100 -e MIX=get:70,create:30 scenarios/dynamic.js)"

expect "mix: pesos relativos normalizados (1:1 de 10 = 5)" \
  "5|getJourney" \
  "$(rate_of get -e TOTAL_RPS=10 -e MIX=get:1,create:1 scenarios/dynamic.js)"

expect "mix: taxa mínima de 1 por jornada" \
  "1|createJourney" \
  "$(rate_of create -e TOTAL_RPS=1 -e MIX=get:1,create:1 scenarios/dynamic.js)"

expect_names "mix: apenas as jornadas do MIX" \
  "create,get" \
  -e TOTAL_RPS=10 -e MIX=get:5,create:5 scenarios/dynamic.js

expect_fail "MIX sem TOTAL_RPS deve falhar" \
  k6 inspect -e MIX=get:70 scenarios/dynamic.js

expect_fail "MIX com jornada desconhecida deve falhar" \
  k6 inspect -e TOTAL_RPS=10 -e MIX=pizza:1 scenarios/dynamic.js

expect_fail "MIX com peso inválido deve falhar" \
  k6 inspect -e TOTAL_RPS=10 -e MIX=get:abc scenarios/dynamic.js

expect_fail "MIX combinado com SCENARIOS deve falhar" \
  k6 inspect -e TOTAL_RPS=10 -e MIX=get:1 -e SCENARIOS=get scenarios/dynamic.js

expect_fail "TOTAL_RPS sem MIX deve falhar" \
  k6 inspect -e TOTAL_RPS=10 scenarios/dynamic.js

echo "== 4. Contratos dos módulos (k6 run, 1 iteração, sem carga) =="
if CONTRACT_OUT="$(k6 run tests/contracts.js 2>&1)"; then
  ok "contratos passaram (execs, executores, thresholds)"
else
  bad "contratos dos módulos"
  echo "$CONTRACT_OUT" | grep "✗" | head -10 | sed 's/^/           /'
fi

echo "== 5. Scripts de orquestração =="
if bash -n scripts/run.sh >/dev/null 2>&1; then
  ok "scripts/run.sh com sintaxe válida"
else
  bad "scripts/run.sh com sintaxe válida"
fi

echo ""
echo "Resultado: ${PASS} ok, ${FAIL} falha(s)"
[ "$FAIL" -eq 0 ] || exit 1
