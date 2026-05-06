#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# run-tests.sh — Executor de Testes de Sobrecarga (Tarefa 5.0)
# Uso: ./run-tests.sh [login|projects|full] [BASE_URL]
# ─────────────────────────────────────────────────────────────────────────────

set -e

TEST_TYPE=${1:-full}
BASE_URL=${2:-http://localhost:3000}
REPORT_DIR="./reports/$(date +%Y-%m-%d_%H-%M-%S)"
AUTH_TOKEN=${AUTH_TOKEN:-""}

mkdir -p "$REPORT_DIR"

echo "╔══════════════════════════════════════════════════════╗"
echo "║       TESTES DE SOBRECARGA — Tarefa 5.0              ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Tipo:    $TEST_TYPE"
echo "║  URL:     $BASE_URL"
echo "║  Relatório: $REPORT_DIR"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

run_test() {
  local test_file=$1
  local test_name=$2
  local output_json="$REPORT_DIR/${test_name}-results.json"
  local output_html="$REPORT_DIR/${test_name}-report.html"

  echo "▶ Rodando: $test_name"
  echo "  Arquivo: $test_file"
  echo "  Iniciando em $(date '+%H:%M:%S')..."
  echo ""

  k6 run \
    --env BASE_URL="$BASE_URL" \
    --env AUTH_TOKEN="$AUTH_TOKEN" \
    --out json="$output_json" \
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
    "$test_file" 2>&1 | tee "$REPORT_DIR/${test_name}-console.log"

  local exit_code=${PIPESTATUS[0]}

  echo ""
  if [ $exit_code -eq 0 ]; then
    echo "✅ $test_name — PASSOU (todos os thresholds OK)"
  else
    echo "❌ $test_name — FALHOU (verifique os thresholds)"
  fi

  echo "   Log:  $REPORT_DIR/${test_name}-console.log"
  echo "   JSON: $output_json"
  echo ""

  return $exit_code
}

OVERALL_EXIT=0

case "$TEST_TYPE" in
  login)
    run_test "./tests/login.test.js" "login" || OVERALL_EXIT=1
    ;;
  projects)
    run_test "./tests/projects.test.js" "projects" || OVERALL_EXIT=1
    ;;
  full)
    run_test "./tests/full-load.test.js" "full-load" || OVERALL_EXIT=1
    ;;
  all)
    run_test "./tests/login.test.js"    "login"    || OVERALL_EXIT=1
    run_test "./tests/projects.test.js" "projects" || OVERALL_EXIT=1
    run_test "./tests/full-load.test.js" "full-load" || OVERALL_EXIT=1
    ;;
  *)
    echo "Tipo inválido. Use: login | projects | full | all"
    exit 1
    ;;
esac

echo "════════════════════════════════════════════════════════"
echo "Relatórios salvos em: $REPORT_DIR"
echo "════════════════════════════════════════════════════════"

exit $OVERALL_EXIT
