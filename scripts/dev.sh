#!/bin/bash
set -Eeuo pipefail


PORT="${PORT:-3000}"
WORKSPACE_PATH="${WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"


cd "${WORKSPACE_PATH}"

find_listening_pids() {
    if command -v lsof >/dev/null 2>&1; then
      lsof -nP -iTCP:"${DEPLOY_RUN_PORT}" -sTCP:LISTEN -t 2>/dev/null | paste -sd' ' - || true
      return
    fi

    if command -v ss >/dev/null 2>&1; then
      ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true
    fi
}

kill_port_if_listening() {
    local pids
    pids="$(find_listening_pids)"
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids="$(find_listening_pids)"
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting HTTP service on port ${PORT} for dev..."

NODE_ENV=development PORT="${PORT}" pnpm tsx watch src/server.ts
