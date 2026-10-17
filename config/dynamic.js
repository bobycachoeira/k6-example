const JOURNEYS = {
  get: { exec: 'getJourney', envVar: 'GET_RPS', defaultRate: 20 },
  create: { exec: 'createJourney', envVar: 'CREATE_RPS', defaultRate: 5 },
  full: { exec: 'fullJourney', envVar: 'FULL_RPS', defaultRate: 0 },
};

const JOURNEY_NAMES = Object.keys(JOURNEYS).join(', ');
const MIX_CONFLICTS = ['SCENARIOS', 'GET_RPS', 'CREATE_RPS', 'FULL_RPS'];
const DEFAULT_MIX = Object.entries(JOURNEYS)
  .filter(([, journey]) => journey.defaultRate > 0)
  .map(([name, journey]) => `${name}:${journey.defaultRate}`)
  .join(',');

function hasEnv(name) {
  return __ENV[name] !== undefined && __ENV[name] !== '';
}

function selectedJourneys() {
  return (__ENV.SCENARIOS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function scenarioFor(journey, rate, duration, mode) {
  return {
    executor: 'constant-arrival-rate',
    exec: JOURNEYS[journey].exec,
    rate,
    timeUnit: '1s',
    duration,
    preAllocatedVUs: Math.max(5, Math.ceil(rate / 2)),
    maxVUs: Math.max(10, rate * 4),
    tags: { profile: 'dynamic', journey, mode },
  };
}

function parseMix(mixRaw) {
  const seen = new Set();

  return mixRaw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, weightRaw] = part.split(':').map((value) => (value || '').trim());

      if (!JOURNEYS[name]) {
        throw new Error(`MIX inválido: jornada desconhecida "${name}". Use: ${JOURNEY_NAMES}`);
      }
      if (seen.has(name)) {
        throw new Error(`MIX inválido: jornada "${name}" repetida`);
      }
      seen.add(name);

      const weight = Number(weightRaw);
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error(`MIX inválido para "${name}": peso "${weightRaw}" (use um número > 0)`);
      }

      return { journey: name, weight };
    });
}

function buildMixScenarios(duration, mixRaw) {
  const conflicts = MIX_CONFLICTS.filter(hasEnv);
  if (conflicts.length > 0) {
    throw new Error(
      `MIX não combina com ${conflicts.join(', ')} — no modo mix use apenas TOTAL_RPS + MIX (+ DURATION)`,
    );
  }

  if (!hasEnv('TOTAL_RPS')) {
    throw new Error('MIX exige TOTAL_RPS (ex.: TOTAL_RPS=100 MIX=get:70,create:30)');
  }

  const total = Number(__ENV.TOTAL_RPS);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`TOTAL_RPS inválido: "${__ENV.TOTAL_RPS}" (use um número > 0)`);
  }

  const parts = parseMix(mixRaw);
  if (parts.length === 0) {
    throw new Error('MIX vazio — formato: MIX=get:70,create:30');
  }

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const scenarios = {};

  for (const { journey, weight } of parts) {
    const rate = Math.max(1, Math.round((total * weight) / totalWeight));
    scenarios[journey] = scenarioFor(journey, rate, duration, 'mix');
  }

  return scenarios;
}

export function buildDynamicScenarios() {
  const duration = __ENV.DURATION || '1m';

  const mixRaw = hasEnv('MIX') ? __ENV.MIX : hasEnv('TOTAL_RPS') ? DEFAULT_MIX : null;
  if (mixRaw !== null) {
    return buildMixScenarios(duration, mixRaw);
  }

  const selection = selectedJourneys();

  if (selection.length > 0) {
    const unknown = selection.filter((name) => !JOURNEYS[name]);
    if (unknown.length > 0) {
      throw new Error(
        `SCENARIOS inválido: "${unknown.join(', ')}". Use: ${JOURNEY_NAMES}`,
      );
    }
  }

  const scenarios = {};

  for (const [journey, { envVar, defaultRate }] of Object.entries(JOURNEYS)) {
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

    scenarios[journey] = scenarioFor(journey, rate, duration, 'rates');
  }

  if (Object.keys(scenarios).length === 0) {
    throw new Error(
      'Perfil dynamic sem cenários: defina GET_RPS, CREATE_RPS ou FULL_RPS com valor maior que 0.',
    );
  }

  return scenarios;
}
