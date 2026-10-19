#!/usr/bin/env bash
# T#57: start backend and frontend together for a local demo, stop both on Ctrl-C.
#
#   scripts/run.sh
#
# 1. Reads the expected Node version from .nvmrc (never writes it) and compares it to `node -v`. If they differ,
#    prints the expected and installed versions with a "nvm use" hint and exits without starting anything.
# 2. Checks that the backend port (BACKEND_PORT, default 8080) and frontend port (FRONTEND_PORT, default 5173) are
#    both free. If either is in use, prints which one and exits without starting anything; the process using it is
#    left alone.
# 3. Starts the backend (through scripts/nexi-isolated.sh, backend/data/app.db, server.address defaults to
#    127.0.0.1 per application.yml) and the frontend dev server (`npm run dev`, proxying /api to the backend port),
#    each in its own process group.
# 4. On exit, failure, Ctrl-C (SIGINT) or SIGTERM, sends TERM to both groups (KILL after 10s), never by port or
#    name. The persistent demo DB (backend/data/app.db) is never touched by this script.
# Works with bash on Linux and macOS. Exit status: 0 on a clean Ctrl-C, 1 if Node version or a port check failed
# (nothing started), 2 for bad arguments.
set -u

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
backend_port=${BACKEND_PORT:-8080}
frontend_port=${FRONTEND_PORT:-5173}
groups=()

port_in_use() {
  node -e '
    const socket = require("net").connect({ port: Number(process.argv[1]), host: "localhost" })
    socket.on("connect", () => process.exit(0))
    socket.on("error", () => process.exit(1))
    setTimeout(() => process.exit(1), 2000)
  ' "$1"
}

check_node_version() {
  local expected installed
  expected=$(tr -d '[:space:]' < "$root/.nvmrc")
  installed=$(node -v | sed 's/^v//')
  if [ "$expected" != "$installed" ]; then
    echo "run: Node $installed가 설치돼 있지만 .nvmrc는 $expected를 기대합니다 — \`nvm use\`로 맞춘 뒤 다시 실행하세요 (아무 서버도 띄우지 않았습니다)" >&2
    return 1
  fi
}

stop_servers() {
  local group waited
  for group in ${groups[@]+"${groups[@]}"}; do
    kill -TERM -- "-$group" 2>/dev/null
  done
  for group in ${groups[@]+"${groups[@]}"}; do
    waited=0
    while kill -0 -- "-$group" 2>/dev/null && [ "$waited" -lt 100 ]; do
      sleep 0.1
      waited=$((waited + 1))
    done
    kill -KILL -- "-$group" 2>/dev/null
  done
  groups=()
}

main() {
  check_node_version || exit 1

  local port
  for port in "$backend_port" "$frontend_port"; do
    if port_in_use "$port"; then
      echo "run: 포트 $port 사용 중 — 그 포트를 쓰는 프로세스를 끝낸 뒤 다시 실행하세요 (아무 서버도 띄우지 않았습니다)" >&2
      exit 1
    fi
  done

  trap stop_servers EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  set -m
  (
    cd "$root" &&
      exec scripts/nexi-isolated.sh --root "$root" --file DB_PATH=backend/data/app.db \
        --set SERVER_PORT="$backend_port" -- ./backend/mvnw -f backend/pom.xml spring-boot:run
  ) &
  groups+=("$!")
  (
    cd "$root/frontend" &&
      API_TARGET="http://localhost:$backend_port" exec npm run dev -- --port "$frontend_port"
  ) &
  groups+=("$!")
  set +m

  wait
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
