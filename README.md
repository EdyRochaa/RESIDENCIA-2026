# 5.0 Testes de Sobrecarga (Load Testing)

## Ferramenta escolhida: **k6**

k6 foi escolhido por: sintaxe JavaScript familiar, suporte nativo a thresholds, relatórios JSON/HTML integrados, e execução leve via CLI sem dependências pesadas.

---

## Estrutura

```
load-testing/
├── tests/
│   ├── login.test.js        # Teste isolado do endpoint de autenticação
│   ├── projects.test.js     # Teste isolado dos endpoints de projetos
│   └── full-load.test.js    # Teste completo com múltiplos cenários
├── reports/                 # Gerado automaticamente ao rodar os testes
├── run-tests.sh             # Script executor
└── README.md
```

---

## Instalação

```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (Chocolatey)
choco install k6
```

---

## Como executar

```bash
chmod +x run-tests.sh

# Teste de login apenas
./run-tests.sh login http://localhost:3000

# Teste de projetos apenas
./run-tests.sh projects http://localhost:3000

# Teste completo (recomendado)
./run-tests.sh full http://localhost:3000

# Todos os testes em sequência
./run-tests.sh all http://localhost:3000

# Com token de autenticação
AUTH_TOKEN="seu_jwt_aqui" ./run-tests.sh full http://localhost:3000
```

---

## Thresholds de Performance

| Métrica                  | Threshold       | Justificativa                   |
|--------------------------|-----------------|----------------------------------|
| `http_req_duration p(95)`| < 500ms         | UX aceitável para 95% dos users |
| `http_req_duration p(99)`| < 1000ms        | Tolerância para picos           |
| `error_rate`             | < 1%            | Confiabilidade mínima           |
| `http_req_failed`        | < 1%            | Erros de rede/timeout           |
| `duration_login p(95)`   | < 400ms         | Login é crítico — mais restrito |

---

## Cenários cobertos

### 1. Ramp-up (`ramp_up`)
Simula crescimento orgânico de usuários:
- 0 → 10 usuários em 30s
- 10 → 50 usuários em 1min
- Sustentado em 50 por 2min
- Ramp-down para 0

### 2. Spike (`spike`)
Simula pico repentino de carga:
- 0 → 200 usuários em 15s
- Sustentado em 200 por 30s
- Queda para 0

### 3. Taxa constante (`constant_rate`)
30 requisições/segundo por 2 minutos — verifica throughput estável.

---

## Endpoints testados

| Endpoint                | Método | Descrição          |
|-------------------------|--------|--------------------|
| `/api/auth/login`       | POST   | Autenticação       |
| `/api/projects`         | GET    | Listar projetos    |
| `/api/projects`         | POST   | Criar projeto      |
| `/api/projects/:id`     | GET    | Buscar projeto     |

---

## Resultados — Template de Documentação

Preencha após cada execução em ambiente de desenvolvimento:

```
Data: ___________
Ambiente: desenvolvimento
Base URL: ___________
Duração total: ___________

RESULTADOS:
┌─────────────────────────┬────────┬────────┬────────┬────────┬────────┐
│ Endpoint                │  avg   │  p(90) │  p(95) │  p(99) │  max   │
├─────────────────────────┼────────┼────────┼────────┼────────┼────────┤
│ login                   │        │        │        │        │        │
│ projects (list)         │        │        │        │        │        │
│ projects (create)       │        │        │        │        │        │
│ projects (get by id)    │        │        │        │        │        │
└─────────────────────────┴────────┴────────┴────────┴────────┴────────┘

Taxa de erro global: _____%
VUs máximos atingidos: _____
Requisições totais: _____
Throughput médio: _____ req/s

STATUS DOS THRESHOLDS:
[ ] p(95) < 500ms        → ✅ / ❌
[ ] error_rate < 1%      → ✅ / ❌
[ ] http_req_failed < 1% → ✅ / ❌

GARGALOS IDENTIFICADOS:
-

RECOMENDAÇÕES:
-
```

---

## Variáveis de ambiente

| Variável     | Padrão                 | Descrição                  |
|--------------|------------------------|----------------------------|
| `BASE_URL`   | `http://localhost:3000`| URL base da API            |
| `AUTH_TOKEN` | `""`                   | JWT para endpoints privados|
