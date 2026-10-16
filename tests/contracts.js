import { check } from 'k6';
import dynamicDefault, * as dynamic from '../scenarios/dynamic.js';
import loadDefault, * as load from '../scenarios/load.js';
import smokeDefault, * as smoke from '../scenarios/smoke.js';
import spikeDefault, * as spike from '../scenarios/spike.js';
import stressDefault, * as stress from '../scenarios/stress.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate>0.99'] },
};

const modules = [
  { label: 'dynamic', ns: dynamic, def: dynamicDefault },
  { label: 'load', ns: load, def: loadDefault },
  { label: 'smoke', ns: smoke, def: smokeDefault },
  { label: 'spike', ns: spike, def: spikeDefault },
  { label: 'stress', ns: stress, def: stressDefault },
];

const REQUIRED_THRESHOLDS = ['checks', 'http_req_failed', 'http_req_duration', 'api_latency'];

function validateScenarioShape(label, name, scenario) {
  check(scenario, {
    [`${label} | cenário "${name}" tem executor`]: (s) =>
      typeof s.executor === 'string' && s.executor.length > 0,
    [`${label} | cenário "${name}" tem duration ou stages`]: (s) =>
      s.duration !== undefined || s.stages !== undefined,
  });
}

function validateExec(label, name, scenario, ns, def) {
  if (scenario.exec) {
    const execName = scenario.exec;
    check(ns, {
      [`${label} | exec "${execName}" está exportado`]: (m) => typeof m[execName] === 'function',
    });
  } else {
    check(def, {
      [`${label} | cenário "${name}" tem default exportado`]: (d) => typeof d === 'function',
    });
  }
}

function validateThresholds(label, ns) {
  const thresholds = ns.options.thresholds || {};
  check(thresholds, {
    [`${label} | thresholds obrigatórios definidos`]: (t) =>
      REQUIRED_THRESHOLDS.every((key) => Array.isArray(t[key]) && t[key].length > 0),
  });
}

export default function () {
  for (const { label, ns, def } of modules) {
    const scenarios = ns.options.scenarios || {};

    check(scenarios, {
      [`${label} | define pelo menos um cenário`]: (s) =>
        Object.keys(s).length > 0 && Boolean(s),
    });

    for (const [name, scenario] of Object.entries(scenarios)) {
      validateScenarioShape(label, name, scenario);
      validateExec(label, name, scenario, ns, def);
    }

    validateThresholds(label, ns);
  }

  check(dynamic, {
    'lib/journey.js | getJourney exportado': (m) => typeof m.getJourney === 'function',
    'lib/journey.js | createJourney exportado': (m) => typeof m.createJourney === 'function',
    'lib/journey.js | fullJourney exportado': (m) => typeof m.fullJourney === 'function',
  });
}
