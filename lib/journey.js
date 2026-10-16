import { group, sleep } from 'k6';
import { get, post } from './http-client.js';
import { hasFields, isJson, respondsFast, statusIs } from './checks.js';
import { newPostPayloads, pick } from './data.js';
import { businessFlows } from './metrics.js';

export function listPosts() {
  group('listar posts', () => {
    const res = get('/posts');
    statusIs(res, 200, 'GET /posts');
    respondsFast(res, 800, 'GET /posts');
    isJson(res, 'GET /posts');
  });
}

export function readPost() {
  group('ler post', () => {
    const res = get('/posts/1');
    statusIs(res, 200, 'GET /posts/1');
    isJson(res, 'GET /posts/1');
    hasFields(res.json(), ['id', 'title', 'body'], 'GET /posts/1');
  });
}

export function readComments() {
  group('ler comentários', () => {
    const res = get('/posts/1/comments');
    statusIs(res, 200, 'GET /posts/1/comments');
    respondsFast(res, 800, 'GET /posts/1/comments');
  });
}

export function createPost() {
  group('criar post', () => {
    const res = post('/posts', pick(newPostPayloads));
    statusIs(res, 201, 'POST /posts');
    isJson(res, 'POST /posts');
  });
}

export function listUsers() {
  group('listar usuários', () => {
    const res = get('/users');
    statusIs(res, 200, 'GET /users');
  });
}

export function fullJourney() {
  listPosts();
  readPost();
  readComments();
  createPost();
  listUsers();

  businessFlows.add(1);
  sleep(1 + Math.random() * 2);
}
