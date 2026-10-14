#!/usr/bin/env bash
# T#4: run one command against freshly started e2e servers, then stop only the servers this run started.
#
#   scripts/e2e-servers.sh [--fresh-db] -- <command> [args...]
#
# Without --fresh-db the backend uses the shared e2e DB backend/data/e2e.db (made once, kept between runs) and the
# command runs without E2E_DB. With --fresh-db (T#39) it uses .nexi-tmp/e2e-write.db, made empty for this run (the
# backend seeds it, D38) and removed afterwards, and the command runs with E2E_DB=fresh.
#
# 1. Refuses, writing, removing and starting nothing, if .nexi-tmp or an output file in it (e2e-servers.pids,
#    e2e-backend.log, e2e-preview.log, and with --fresh-db e2e-write.db and its -journal, -wal and -shm files) is a
#    symlink, is not a regular file or folder, or resolves outside the repository.
# 2. Fails without starting or removing anything if port 18080 (backend) or 14173 (frontend preview) is in use; the
#    process using it is left alone. Two runs cannot overlap, so a DB file in use is never removed.
# 3. With --fresh-db, removes those four DB files. Builds the frontend (npm --prefix frontend run build); a failed
#    build starts nothing.
# 4. Starts the backend (through scripts/nexi-isolated.sh with its DB file) and `vite preview` of the new build, each
#    in its own process group, and writes both group IDs to .nexi-tmp/e2e-servers.pids.
# 5. Waits for http://localhost:14173/api/health at most 120s in total (each request is cancelled at that deadline),
#    then runs the command from the caller's folder.
# 6. On exit, failure, or interrupt it sends TERM to those two groups only (KILL after 10s), never by port or name;
#    with --fresh-db it then removes the four DB files again.
# Works with bash on Linux and macOS. Exit status: the command's, 2 for a refused output path or bad arguments, or 1
# when the servers could not be prepared.
set -u

backend_port=18080
frontend_port=14173
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
log_dir="$root/.nexi-tmp"
pid_file="$log_dir/e2e-servers.pids"
output_files=("$pid_file" "$log_dir/e2e-backend.log" "$log_dir/e2e-preview.log")
fresh_db=.nexi-tmp/e2e-write.db
fresh_files=("$root/$fresh_db" "$root/$fresh_db-journal" "$root/$fresh_db-wal" "$root/$fresh_db-shm")
fresh=0
groups=()

port_in_use() {
  node -e '
    const socket = require("net").connect({ port: Number(process.argv[1]), host: "localhost" })
    socket.on("connect", () => process.exit(0))
    socket.on("error", () => process.exit(1))
    setTimeout(() => process.exit(1), 2000)
  ' "$1"
}

refuse_output() {
  echo "e2e-servers: 출력 경로 거부 — $1 (저장소 밖에 쓸 수 있어 아무것도 쓰거나 띄우지 않았습니다)" >&2
  return 1
}

# Checks the output folder and files before anything is written there.
check_output_paths() {
  local path
  [ ! -L "$log_dir" ] || refuse_output "$log_dir 가 심볼릭 링크입니다" || return 1
  [ ! -e "$log_dir" ] || [ -d "$log_dir" ] || refuse_output "$log_dir 가 폴더가 아닙니다" || return 1
  mkdir -p "$log_dir" || return 1
  [ "$(cd "$log_dir" && pwd -P)" = "$root/.nexi-tmp" ] || refuse_output "$log_dir 가 저장소 밖을 가리킵니다" || return 1
  for path in "${output_files[@]}"; do
    [ ! -L "$path" ] || refuse_output "$path 가 심볼릭 링크입니다" || return 1
    [ ! -e "$path" ] || [ -f "$path" ] || refuse_output "$path 가 일반 파일이 아닙니다" || return 1
  done
}

# Waits until <url> answers 2xx, at most <seconds> in total: every request is cancelled at the deadline, so a server
# that accepts connections but never answers cannot stretch the wait.
wait_for_health() {
  node -e '
    const url = process.argv[1]
    const deadline = Date.now() + Number(process.argv[2]) * 1000
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    ;(async () => {
      while (Date.now() < deadline) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) })
          if (response.ok) process.exit(0)
        } catch {
          // not ready yet, refused, or cancelled at the deadline
        }
        await sleep(Math.min(1000, Math.max(0, deadline - Date.now())))
      }
      process.exit(1)
    })()
  ' "$1" "$2"
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

# Removes the per-run DB of --fresh-db; only those four paths, checked by check_output_paths before.
remove_fresh_db() {
  [ "$fresh" = 1 ] || return 0
  rm -f -- "${fresh_files[@]}"
}

cleanup() {
  stop_servers
  remove_fresh_db
}

main() {
  local caller_dir=$PWD port db_file=backend/data/e2e.db
  if [ "${1:-}" = "--fresh-db" ]; then
    fresh=1
    db_file=$fresh_db
    output_files+=("${fresh_files[@]}")
    shift
  fi
  [ "${1:-}" = "--" ] && [ $# -ge 2 ] || { echo "usage: $0 [--fresh-db] -- <command> [args...]" >&2; exit 2; }
  shift

  check_output_paths || exit 2

  for port in "$backend_port" "$frontend_port"; do
    if port_in_use "$port"; then
      echo "e2e-servers: 포트 $port 사용 중 — 그 포트를 쓰는 프로세스를 끝낸 뒤 다시 실행하세요 (이 실행은 아무 서버도 띄우지 않았습니다)" >&2
      exit 1
    fi
  done

  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  remove_fresh_db || { echo "e2e-servers: $fresh_db 를 지우지 못했습니다 — 서버를 띄우지 않았습니다" >&2; exit 1; }
  npm --prefix "$root/frontend" run build || { echo "e2e-servers: 프런트엔드 빌드 실패 — 서버를 띄우지 않았습니다" >&2; exit 1; }

  : > "$pid_file"
  set -m
  (
    cd "$root" &&
      exec scripts/nexi-isolated.sh --root "$root" --file DB_PATH="$db_file" --set SERVER_PORT="$backend_port" \
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

  if ! wait_for_health "http://localhost:$frontend_port/api/health" 120; then
    echo "e2e-servers: 120초 안에 http://localhost:$frontend_port/api/health 응답 없음" >&2
    tail -n 20 "$log_dir/e2e-backend.log" "$log_dir/e2e-preview.log" >&2
    exit 1
  fi

  if [ "$fresh" = 1 ]; then
    (cd "$caller_dir" && env E2E_DB=fresh "$@")
  else
    (cd "$caller_dir" && env -u E2E_DB "$@")
  fi
}

# Run only when executed, so a check can `source` this file and call wait_for_health.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
