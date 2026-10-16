import { PROFILE } from './env.js';
import { buildDynamicScenarios } from './dynamic.js';

const commonThresholds = {
  checks: ['rate>0.99'],
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800', 'p(99)<1500'],
  api_latency: ['p(95)<800'],
};

export const profiles = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '10s',
    tags: { profile: 'smoke' },
  },
  load: {
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 20,
    maxVUs: 80,
    stages: [
      { target: 10, duration: '30s' },
      { target: 10, duration: '1m' },
      { target: 0, duration: '15s' },
    ],
    tags: { profile: 'load' },
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { target: 10, duration: '30s' },
      { target: 30, duration: '1m' },
      { target: 60, duration: '1m' },
      { target: 0, duration: '30s' },
    ],
    gracefulRampDown: '10s',
    tags: { profile: 'stress' },
  },
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: 2,
    timeUnit: '1s',
    preAllocatedVUs: 30,
    maxVUs: 120,
    stages: [
      { target: 2, duration: '20s' },
      { target: 60, duration: '10s' },
      { target: 60, duration: '30s' },
      { target: 2, duration: '15s' },
    ],
    tags: { profile: 'spike' },
  },
};

export function buildOptions(profile = PROFILE, extra = {}) {
  const base = {
    thresholds: commonThresholds,
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    ...extra,
  };

  if (profile === 'dynamic') {
    return { ...base, scenarios: buildDynamicScenarios() };
  }

  const scenario = profiles[profile];
  if (!scenario) {
    throw new Error(
      `Perfil desconhecido: "${profile}". Use um de: ${Object.keys(profiles).join(', ')}, dynamic`,
    );
  }

  return { ...base, scenarios: { [profile]: scenario } };
}
