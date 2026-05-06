/**
 * Teste de Sobrecarga Completo — Tarefa 5.0
 * Cobre: login, projetos, listagem geral
 * Thresholds: p95 < 500ms, error_rate < 1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─── Métricas customizadas ────────────────────────────────────────────────────
const errorRate     = new Rate('error_rate');
const loginTrend    = new Trend('duration_login');
const projectsTrend = new Trend('duration_projects');
const totalRequests = new Counter('total_requests');

// ─── Configuração dos cenários ────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Cenário 1: Ramp-up suave
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 50 },
        { duration: '2m',  target: 50 },
        { duration: '30s', target: 0  },
      ],
      gracefulRampDown: '10s',
    },

    // Cenário 2: Pico de carga (spike)
    spike: {
      executor: 'ramping-vus',
      startTime: '4m30s',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 200 }, // pico repentino
        { duration: '30s', target: 200 },
        { duration: '15s', target: 0   },
      ],
      gracefulRampDown: '10s',
    },

    // Cenário 3: Taxa constante de requisições
    constant_rate: {
      executor: 'constant-arrival-rate',
      startTime: '5m30s',
      rate: 30,          // 30 req/s
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },

  thresholds: {
    // Performance geral
    http_req_duration:          ['p(95)<500', 'p(99)<1000'],
    // Por endpoint
    'duration_login':           ['p(95)<400'],
    'duration_projects':        ['p(95)<500'],
    // Confiabilidade
    error_rate:                 ['rate<0.01'],
    http_req_failed:            ['rate<0.01'],
    // Throughput
    http_reqs:                  ['rate>10'],
  },
};

// ─── Variáveis de ambiente ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ─── Setup: obtém token antes dos testes ─────────────────────────────────────
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: 'admin@test.com', password: 'SenhaSegura@123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 200) {
    console.error(`Setup falhou — status: ${res.status}`);
    return { token: null };
  }

  return { token: res.json('access_token') };
}

// ─── Função principal ─────────────────────────────────────────────────────────
export default function (data) {
  const token = data?.token;

  const authHeaders = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  // ── Grupo 1: Autenticação ──────────────────────────────────────────────────
  group('auth', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: `user${randomIntBetween(1, 500)}@test.com`,
        password: 'SenhaSegura@123',
      }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
    );

    const ok = check(res, {
      '[login] status 200':     (r) => r.status === 200,
      '[login] tem token':      (r) => !!r.json('access_token'),
      '[login] tempo < 400ms':  (r) => r.timings.duration < 400,
    });

    errorRate.add(!ok);
    loginTrend.add(res.timings.duration);
    totalRequests.add(1);
  });

  sleep(randomIntBetween(1, 2));

  // ── Grupo 2: Projetos ──────────────────────────────────────────────────────
  group('projects', () => {
    // Listar
    const listRes = http.get(`${BASE_URL}/api/projects`, {
      ...authHeaders,
      tags: { endpoint: 'projects_list' },
    });

    check(listRes, {
      '[projects] list 200':      (r) => r.status === 200,
      '[projects] list < 500ms':  (r) => r.timings.duration < 500,
    });

    projectsTrend.add(listRes.timings.duration);
    errorRate.add(listRes.status !== 200);
    totalRequests.add(1);

    sleep(0.3);

    // Criar
    const createRes = http.post(
      `${BASE_URL}/api/projects`,
      JSON.stringify({ name: `Load Test ${Date.now()}`, status: 'active' }),
      { ...authHeaders, tags: { endpoint: 'projects_create' } }
    );

    const created = check(createRes, {
      '[projects] create 201':     (r) => r.status === 201,
      '[projects] create < 500ms': (r) => r.timings.duration < 500,
    });

    errorRate.add(!created);
    totalRequests.add(1);

    // Buscar por ID se criado com sucesso
    if (created && createRes.json('id')) {
      const id = createRes.json('id');
      const getRes = http.get(`${BASE_URL}/api/projects/${id}`, {
        ...authHeaders,
        tags: { endpoint: 'projects_get' },
      });

      check(getRes, {
        '[projects] get 200':     (r) => r.status === 200,
        '[projects] get < 500ms': (r) => r.timings.duration < 500,
      });

      totalRequests.add(1);
    }
  });

  sleep(randomIntBetween(1, 3));
}

// ─── Teardown: resumo ─────────────────────────────────────────────────────────
export function teardown(data) {
  console.log('✅ Testes de sobrecarga finalizados.');
  console.log(`   Token usado: ${data?.token ? 'Sim' : 'Não (anônimo)'}`);
}
