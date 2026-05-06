import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up: 0 → 10 usuários
    { duration: '1m',  target: 50 },  // Ramp-up: 10 → 50 usuários
    { duration: '2m',  target: 50 },  // Sustentado: 50 usuários
    { duration: '30s', target: 0  },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% das requisições < 500ms
    error_rate: ['rate<0.01'],          // Taxa de erro < 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    email: `user${Math.floor(Math.random() * 1000)}@test.com`,
    password: 'SenhaSegura@123',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

  const success = check(res, {
    'status 200':           (r) => r.status === 200,
    'tem access_token':     (r) => r.json('access_token') !== undefined,
    'tempo < 500ms':        (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  loginDuration.add(res.timings.duration);

  sleep(1);
}
