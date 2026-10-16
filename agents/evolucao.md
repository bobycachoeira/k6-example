# Playbook: evolução segura do projeto

## Antes de qualquer commit/PR

1. `./scripts/check.sh` — exigir `0 falha(s)`
2. `./scripts/run.sh smoke` — execução real curta deve atender os thresholds
3. CI verde no GitHub (roda `check.sh` + smoke a cada push/PR)

## Checklist de consistência

- [ ] Invariantes do `AGENTS.md` respeitados (thresholds, perfil explícito, sem deps npm)
- [ ] Novo comportamento tem teste: contrato em `tests/contracts.js` ou caso no `check.sh`
- [ ] README/AGENTS.md atualizados se algo público mudou (perfis, jornadas, envs, artefatos)
- [ ] Sem referências a empresas, APIs internas ou código proprietário
- [ ] Commits pequenos e descritivos

## Backlog de evolução (sugestões)

- **Perfis**: `breakpoint` (rampa agressiva) e `soak` (longa duração, detecta vazamentos)
- **Jornadas**: escrita encadeada (criar → ler o recurso criado)
- **Qualidade**: comparar thresholds com baseline versionado e falhar se afrouxarem
- **CI**: rodar `k6 inspect` do dynamic em matriz de envs; smoke em PR e load agendado (cron)
- **Observabilidade**: painel por jornada no dashboard Grafana (tag `journey`)

## Regras

- Nunca afrouxe um threshold apenas para o CI passar — investigue a causa primeiro.
- Prefira estender (`buildOptions(profile, { thresholds })`) em vez de editar os globais.
- Resultado de execução nunca é commitado (`results/` é ignorado; exceto `.gitkeep`).
