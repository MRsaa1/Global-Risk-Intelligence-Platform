#!/usr/bin/env bash
# ===========================================
# Сравнение результатов тестов «локально (без GPU)» и «с GPU».
# Запуск после gpu-test-local.sh и gpu-test-gpu.sh:
#   ./scripts/gpu-test-compare.sh
# Читает docs/gpu-test-artifacts/local/ и docs/gpu-test-artifacts/gpu/.
# ===========================================

set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOCAL="$ROOT/docs/gpu-test-artifacts/local"
GPU="$ROOT/docs/gpu-test-artifacts/gpu"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Сравнение: локально (без GPU) vs с GPU ===${NC}"
echo ""

_jq() {
  if command -v jq >/dev/null 2>&1; then
    jq "$@"
  else
    echo "n/a (установите jq для детального сравнения)"
    return 1
  fi
}

# Health NVIDIA: структура может быть { nvidia_services: { fourcastnet_nim: { ready } } } или { fourcastnet_nim: { ready } }
_ready_local() {
  if [ -f "$LOCAL/health_nvidia.json" ]; then
    _jq -r '.nvidia_services.fourcastnet_nim.ready // false' "$LOCAL/health_nvidia.json" 2>/dev/null || echo "false"
  else
    echo "no file"
  fi
}

_ready_gpu() {
  if [ -f "$GPU/health_nvidia.json" ]; then
    _jq -r '.nvidia_services.fourcastnet_nim.ready // false' "$GPU/health_nvidia.json" 2>/dev/null || echo "false"
  else
    echo "no file"
  fi
}

_nim_status_local() {
  if [ -f "$LOCAL/nim_health.json" ]; then
    _jq -r '.fourcastnet.status // "unavailable"' "$LOCAL/nim_health.json" 2>/dev/null || echo "unavailable"
  else
    echo "no file"
  fi
}

_nim_status_gpu() {
  if [ -f "$GPU/nim_health.json" ]; then
    _jq -r '.fourcastnet.status // "unavailable"' "$GPU/nim_health.json" 2>/dev/null || echo "unavailable"
  else
    echo "no file"
  fi
}

echo "| Критерий                    | Локально (без GPU) | С GPU       |"
echo "|----------------------------|--------------------|-------------|"

RL=$(_ready_local)
RG=$(_ready_gpu)
echo "| health/nvidia → NIM ready  | $RL                 | $RG         |"

NL=$(_nim_status_local)
NG=$(_nim_status_gpu)
echo "| nvidia/nim/health → status | $NL        | $NG |"

echo ""

# Execute response: gpu_services_used / data_sources
if [ -f "$LOCAL/execute_response.json" ] && [ -f "$GPU/execute_response.json" ]; then
  echo -e "${CYAN}--- Stress test execute ---${NC}"
  if command -v jq >/dev/null 2>&1; then
    GSU_L=$(jq -r '.report_v2.gpu_services_used // [] | join(", ") // "—"' "$LOCAL/execute_response.json" 2>/dev/null || echo "—")
    GSU_G=$(jq -r '.report_v2.gpu_services_used // [] | join(", ") // "—"' "$GPU/execute_response.json" 2>/dev/null || echo "—")
    DS_L=$(jq -r '.data_sources // [] | join(", ") // "—"' "$LOCAL/execute_response.json" 2>/dev/null | head -c 60)
    DS_G=$(jq -r '.data_sources // [] | join(", ") // "—"' "$GPU/execute_response.json" 2>/dev/null | head -c 60)
    echo "  Локально: gpu_services_used = [$GSU_L], data_sources = [$DS_L...]"
    echo "  С GPU:    gpu_services_used = [$GSU_G], data_sources = [$DS_G...]"
  fi
else
  echo "  Execute артефакты отсутствуют (запустите оба скрипта с TOKEN=...)."
fi

echo ""
echo -e "${GREEN}Ожидание: локально NIM ready=false/unavailable; с GPU ready=true/healthy.${NC}"
