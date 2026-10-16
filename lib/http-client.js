import http from 'k6/http';
import { BASE_URL, TAGS } from '../config/env.js';
import { apiErrors, apiLatency } from './metrics/index.js';

function track(res, name) {
  apiLatency.add(res.timings.duration, { name });
  if (res.status === 0 || res.status >= 400) {
    apiErrors.add(1, { name });
  }
  return res;
}

export function get(path, { tags = {}, ...params } = {}) {
  const res = http.get(`${BASE_URL}${path}`, {
    ...params,
    tags: { ...TAGS, name: path, ...tags },
  });
  return track(res, path);
}

export function post(path, body, { tags = {}, headers = {}, ...params } = {}) {
  const res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    ...params,
    headers: { 'Content-Type': 'application/json', ...headers },
    tags: { ...TAGS, name: path, ...tags },
  });
  return track(res, path);
}
