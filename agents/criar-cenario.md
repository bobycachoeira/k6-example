# Playbook: criar um novo cenário (perfil)

Exemplo: adicionar o perfil `breakpoint` (rampa agressiva para encontrar o limite do sistema).

## Pontos que precisam ser tocados

### 1. `config/options.js` — adicione a entrada em `profiles`

```js
breakpoint: {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 30,
  maxVUs: 150,
  stages: [
    { target: 50, duration: '1m' },
    { target: 150, duration: '2m' },
  ],
  tags: { profile: 'breakpoint' },
},
```

### 2. `scenarios/breakpoint.js` — crie o arquivo (padrão dos demais)

```js
import { buildOptions } from '../config/options.js';
import { fullJourney } from '../lib/journey.js';
import { makeHandleSummary } from '../lib/report.js';

export const options = buildOptions('breakpoint');

export default function () {
  fullJourney();
}

export const handleSummary = makeHandleSummary('breakpoint');
```

### 3. `tests/contracts.js` — importe o módulo e registre em `modules`

```js
import breakpointDefault, * as breakpoint from '../scenarios/breakpoint.js';
// ...
const modules = [
  // ...
  { label: 'breakpoint', ns: breakpoint, def: breakpointDefault },
];
```

### 4. `scripts/check.sh` — inclua `breakpoint` nas duas listas de loop (parse e thresholds)

### 5. `scripts/run.sh` — atualize a mensagem `Disponíveis:`

### 6. `README.md` — adicione a linha na tabela de perfis

## Validação

```bash
./scripts/check.sh              # deve terminar em "0 falha(s)"
./scripts/run.sh breakpoint     # execução real (atenção: gera carga alta)
```

## Regras

- O perfil DEVE ter tags `{ profile: '<nome>' }` no cenário.
- Os thresholds globais vêm de `commonThresholds` — não os remova. Se o perfil precisar de
  thresholds próprios, estenda: `buildOptions('breakpoint', { thresholds: {...} })`.
- Nunca dependa de variável de ambiente para escolher o perfil (invariante 3 do AGENTS.md).
