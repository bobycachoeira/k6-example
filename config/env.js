export const BASE_URL = (__ENV.BASE_URL || 'https://jsonplaceholder.typicode.com').replace(/\/+$/, '');

export const PROFILE = __ENV.PROFILE || 'smoke';

export const RESULTS_DIR = __ENV.RESULTS_DIR || 'results';

export const TAGS = {
  project: 'k6-example',
  env: __ENV.ENV_NAME || 'public-demo',
  run_id: __ENV.RUN_ID || 'local',
};
