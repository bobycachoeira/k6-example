# Playbook: avaliar resultados de uma execução

## Onde ficam os artefatos

Cada execução do `run.sh` cria `results/<data>-<perfil>/`:

| Arquivo | Uso |
|---|---|
| `summary.json` | Fonte primária para análise programática |
| `summary.html` | Leitura humana (thresholds + tabela de métricas) |
| `metrics.csv` | Série temporal simples (planilhas) |
| `raw.json.gz` | Stream completo, ponto a ponto (análise fina por tag) |
| `console.log` | Saída do k6 (avisos, resumo textual, exit) |
| `metadata.txt` | Perfil, commit, versão do k6, alvo, horários, exit code |

## Como ler o `summary.json`

Métricas-chave:

- `checks.values.rate` — taxa de checks que passaram (esperado 1.0; threshold > 0.99)
- `http_req_failed.values.rate` — fração de requisições com erro (esperado ~0)
- `http_req_duration.values['p(95)']` e `['p(99)']` — latência por requisição
- `api_latency` — métrica customizada (ms por requisição, tag `name` = rota)
- `api_errors` — contador de respostas com status >= 400 ou falha de rede, por rota
- `successful_reads` / `failed_reads` e `successful_creates` / `failed_creates` — contadores por
  operação das jornadas get/create (falhas podem estar ausentes quando não há amostras)
- `read_response_time` / `create_response_time` e `get_journey_duration` / `create_journey_duration`
  — tempos (ms) por operação e por jornada completa
- `dropped_iterations` — se existir e for > 0, o k6 **não conseguiu sustentar a taxa**
  configurada (faltaram VUs) — sinal de saturação do gerador ou do alvo
- `business_flows.values.count` — fluxos completos executados
- Por métrica, `thresholds`: `{"<expressão>": {"ok": true|false}}` — status de cada threshold

Snippet pronto para inspecionar a última execução:

```bash
python3 - <<'EOF'
import json, glob
f = sorted(glob.glob('results/*/summary.json'))[-1]
d = json.load(open(f))
m = d['metrics']
print('arquivo:', f)
print('checks rate:', m['checks']['values']['rate'])
print('http_req_failed:', m.get('http_req_failed', {}).get('values', {}).get('rate'))
print('p95:', m['http_req_duration']['values'].get('p(95)'))
print('iterações dropadas:', m.get('dropped_iterations', {}).get('values', {}).get('count', 0))
for name, metric in sorted(m.items()):
    for expr, r in (metric.get('thresholds') or {}).items():
        print('threshold', name, expr, '=> ok' if r['ok'] else '=> VIOLADO')
EOF
```

Para fatiar por jornada/rota, use o `raw.json.gz` ou o `metrics.csv` com as tags
(`journey`, `name`, `profile`).

## O que reportar

1. **Status dos thresholds** — todos ok? quais violaram?
2. **Latência** — p95/p99 vs. execuções anteriores (confira commit/perfil no `metadata.txt`)
3. **Erros** — `http_req_failed` e `api_errors` (rotas afetadas)
4. **Saturação** — `dropped_iterations` > 0 ou VUs próximos do `maxVUs`
5. **Recomendações** — investigar endpoint? ajustar VUs/taxa? escalar? corrigir alvo?

## Template de resposta (para a IA)

- Execução analisada: arquivo, perfil, commit, alvo
- Tabela: `métrica | valor | status (ok/violado)`
- Violações e prováveis causas
- Próximos passos sugeridos (com comandos, quando aplicável)
