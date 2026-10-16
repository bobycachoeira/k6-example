import { group, sleep } from 'k6';
import { get, post } from './http-client.js';
import { hasFields, isJson, respondsFast, statusIs } from './checks.js';
import { newPostPayloads, pick } from './data.js';
import {
  businessFlows,
  createJourneyDuration,
  getJourneyDuration,
  recordCreate,
  recordRead,
} from './metrics/index.js';

export function listPosts() {
  return group('listar posts', () => {
    const startedAt = Date.now();
    const res = get('/posts');
    const ok = [
      statusIs(res, 200, 'GET /posts'),
      respondsFast(res, 800, 'GET /posts'),
      isJson(res, 'GET /posts'),
    ].every(Boolean);
    return recordRead(ok, startedAt);
  });
}

export function readPost() {
  return group('ler post', () => {
    const startedAt = Date.now();
    const res = get('/posts/1');
    const ok = [
      statusIs(res, 200, 'GET /posts/1'),
      isJson(res, 'GET /posts/1'),
      hasFields(res.json(), ['id', 'title', 'body'], 'GET /posts/1'),
    ].every(Boolean);
    return recordRead(ok, startedAt);
  });
}

export function readComments() {
  return group('ler comentários', () => {
    const startedAt = Date.now();
    const res = get('/posts/1/comments');
    const ok = [
      statusIs(res, 200, 'GET /posts/1/comments'),
      respondsFast(res, 800, 'GET /posts/1/comments'),
    ].every(Boolean);
    return recordRead(ok, startedAt);
  });
}

export function createPost() {
  return group('criar post', () => {
    const startedAt = Date.now();
    const res = post('/posts', pick(newPostPayloads));
    const ok = [statusIs(res, 201, 'POST /posts'), isJson(res, 'POST /posts')].every(Boolean);
    return recordCreate(ok, startedAt);
  });
}

export function listUsers() {
  return group('listar usuários', () => {
    const startedAt = Date.now();
    const res = get('/users');
    const ok = statusIs(res, 200, 'GET /users');
    return recordRead(ok, startedAt);
  });
}

export function getJourney() {
  const startedAt = Date.now();
  const results = [listPosts(), readPost(), readComments(), listUsers()];
  const ok = results.every(Boolean);
  getJourneyDuration.add(Date.now() - startedAt);
  return ok;
}

export function createJourney() {
  const startedAt = Date.now();
  const ok = createPost();
  createJourneyDuration.add(Date.now() - startedAt);
  return ok;
}

export function fullJourney() {
  const getOk = getJourney();
  const createOk = createJourney();

  if (getOk && createOk) {
    businessFlows.add(1);
  }

  sleep(1 + Math.random() * 2);
  return getOk && createOk;
}
