import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const projectsDuration = new Trend('projects_duration');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m',  target: 100 },
    { duration: '2m',  target: 100 },
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN    = __ENV.AUTH_TOKEN || 'seu-token-aqui';

function authHeaders() {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  };
}

export default function () {
  // GET /api/projects - listar projetos
  const listRes = http.get(`${BASE_URL}/api/projects`, {
    ...authHeaders(),
    tags: { endpoint: 'projects_list' },
  });

  check(listRes, {
    'lista: status 200':  (r) => r.status === 200,
    'lista: é array':     (r) => Array.isArray(r.json()),
    'lista: tempo < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(listRes.status !== 200);
  projectsDuration.add(listRes.timings.duration);

  sleep(0.5);

  // POST /api/projects - criar projeto
  const createPayload = JSON.stringify({
    name: `Projeto Teste ${Date.now()}`,
    description: 'Criado pelo load test',
    status: 'active',
  });

  const createRes = http.post(`${BASE_URL}/api/projects`, createPayload, {
    ...authHeaders(),
    tags: { endpoint: 'projects_create' },
  });

  const created = check(createRes, {
    'criar: status 201':    (r) => r.status === 201,
    'criar: tem id':        (r) => r.json('id') !== undefined,
    'criar: tempo < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!created);

  // GET /api/projects/:id - buscar projeto criado
  if (created) {
    const projectId = createRes.json('id');
    const getRes = http.get(`${BASE_URL}/api/projects/${projectId}`, {
      ...authHeaders(),
      tags: { endpoint: 'projects_get' },
    });

    check(getRes, {
      'get: status 200':    (r) => r.status === 200,
      'get: id correto':    (r) => r.json('id') === projectId,
      'get: tempo < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(1);
}
