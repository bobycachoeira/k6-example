const JOURNEYS = {
  get: { exec: 'getJourney', envVar: 'GET_RPS', defaultRate: 20 },
  create: { exec: 'createJourney', envVar: 'CREATE_RPS', defaultRate: 5 },
  full: { exec: 'fullJourney', envVar: 'FULL_RPS', defaultRate: 0 },
};

function selectedJourneys() {
  return (__ENV.SCENARIOS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function buildDynamicScenarios() {
  const duration = __ENV.DURATION || '1m';
  const selection = selectedJourneys();

  if (selection.length > 0) {
    const unknown = selection.filter((name) => !JOURNEYS[name]);
    if (unknown.length > 0) {
      throw new Error(
        `SCENARIOS inválido: "${unknown.join(', ')}". Use: ${Object.keys(JOURNEYS).join(', ')}`,
      );
    }
  }

  const scenarios = {};

  for (const [journey, { exec, envVar, defaultRate }] of Object.entries(JOURNEYS)) {
    const selected = selection.includes(journey);
    if (selection.length > 0 && !selected) {
      continue;
    }

    const raw = __ENV[envVar];
    const rate = raw === undefined || raw === '' ? defaultRate : Number(raw);

    if (Number.isNaN(rate) || rate < 0) {
      throw new Error(`${envVar} inválido: "${raw}" (use um número >= 0)`);
    }

    if (rate === 0) {
      if (selected) {
        throw new Error(
          `Jornada "${journey}" selecionada em SCENARIOS, mas ${envVar}=0 — defina uma taxa maior que 0.`,
        );
      }
      continue;
    }

    scenarios[journey] = {
      executor: 'constant-arrival-rate',
      exec,
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(5, Math.ceil(rate / 2)),
      maxVUs: Math.max(10, rate * 4),
      tags: { profile: 'dynamic', journey },
    };
  }

  if (Object.keys(scenarios).length === 0) {
    throw new Error(
      'Perfil dynamic sem cenários: defina GET_RPS, CREATE_RPS ou FULL_RPS com valor maior que 0.',
    );
  }

  return scenarios;
}
