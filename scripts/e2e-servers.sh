#!/usr/bin/env bash
# T#4: run one command against freshly started e2e servers, then stop only the servers this run started.
#
#   scripts/e2e-servers.sh -- <command> [args...]
#
# 1. Fails without starting anything if port 18080 (backend) or 14173 (frontend preview) is in use; the process
#    using it is left alone.
# 2. Builds the frontend (npm --prefix frontend run build); a failed build starts nothing.
# 3. Starts the backend (through scripts/nexi-isolated.sh, DB file backend/data/e2e.db) and `vite preview` of the new
#    build, each in its own process group, and writes both group IDs to .nexi-tmp/e2e-servers.pids.
# 4. Waits up to 120s for http://localhost:14173/api/health, then runs the command from the caller's folder.
# 5. On exit, failure, or interrupt it sends TERM to those two groups only (KILL after 10s), never by port or name.
# Works with bash on Linux and macOS. Exit status: the command's, or 1 when the servers could not be prepared.
set -u

backend_port=18080
frontend_port=14173
root=$(cd "$(dirname "$0")/.." && pwd -P)
caller_dir=$PWD
pid_file="$root/.nexi-tmp/e2e-servers.pids"
log_dir="$root/.nexi-tmp"
groups=()

[ "${1:-}" = "--" ] && [ $# -ge 2 ] || { echo "usage: $0 -- <command> [args...]" >&2; exit 2; }
shift

port_in_use() {
  node -e '
    const socket = require("net").connect({ port: Number(process.argv[1]), host: "localhost" })
    socket.on("connect", () => process.exit(0))
    socket.on("error", () => process.exit(1))
    setTimeout(() => process.exit(1), 2000)
  ' "$1"
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

for port in "$backend_port" "$frontend_port"; do
  if port_in_use "$port"; then
    echo "e2e-servers: 포트 $port 사용 중 — 그 포트를 쓰는 프로세스를 끝낸 뒤 다시 실행하세요 (이 실행은 아무 서버도 띄우지 않았습니다)" >&2
    exit 1
  fi
done

trap stop_servers EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm --prefix "$root/frontend" run build || { echo "e2e-servers: 프런트엔드 빌드 실패 — 서버를 띄우지 않았습니다" >&2; exit 1; }

mkdir -p "$log_dir"
: > "$pid_file"
set -m
(
  cd "$root" &&
    exec scripts/nexi-isolated.sh --root "$root" --file DB_PATH=backend/data/e2e.db --set SERVER_PORT="$backend_port" \
      -- ./backend/mvnw -q -f backend/pom.xml spring-boot:run
) > "$log_dir/e2e-backend.log" 2>&1 &
groups+=("$!")
echo "$!" >> "$pid_file"
(
  cd "$root/frontend" &&
    API_TARGET="http://localhost:$backend_port" exec ./node_modules/.bin/vite preview --port "$frontend_port" --strictPort
) > "$log_dir/e2e-preview.log" 2>&1 &
groups+=("$!")
echo "$!" >> "$pid_file"
set +m

ready=0
for _ in $(seq 1 120); do
  if node -e '
    fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))
  ' "http://localhost:$frontend_port/api/health"; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "e2e-servers: 120초 안에 http://localhost:$frontend_port/api/health 응답 없음" >&2
  tail -n 20 "$log_dir/e2e-backend.log" "$log_dir/e2e-preview.log" >&2
  exit 1
fi

(cd "$caller_dir" && "$@")
