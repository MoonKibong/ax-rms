#!/usr/bin/env bash
# T#57: delete the demo DB (and its -wal/-shm/-journal files) so the next backend start reseeds from today (B#5).
#
#   scripts/reset-db.sh [--db <path>] [--port <port>]
#
# --db defaults to backend/data/app.db; the path is taken only from this flag, never from the DB_PATH environment
# variable the app itself reads (a DB_PATH left in the caller's shell for an unrelated reason must not change what
# this destructive command deletes). The resolved real path must stay inside this repository; an absolute path or
# a ".." that reaches outside it is refused and nothing is deleted.
# --port defaults to 8080 (the backend's default demo port, BACKEND_PORT in scripts/run.sh). If that port is in
# use, the backend looks like it is running: refused, nothing deleted (deleting a WAL file a live connection still
# holds can break its next checkpoint).
# Only the exact four paths (the DB file and its -wal, -shm, -journal siblings) are ever removed, and only the ones
# that exist; backend/data/e2e.db and .nexi-tmp/* (scripts/e2e-servers.sh's own DBs) are never touched unless
# explicitly passed as --db.
# Exit status: 0 on a successful delete (or nothing to delete), 1 if the port is in use, 2 for a refused path or
# bad arguments.
set -u

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
db_path=backend/data/app.db
port=8080

port_in_use() {
  node -e '
    const socket = require("net").connect({ port: Number(process.argv[1]), host: "localhost" })
    socket.on("connect", () => process.exit(0))
    socket.on("error", () => process.exit(1))
    setTimeout(() => process.exit(1), 2000)
  ' "$1"
}

# Resolves --db to an absolute path (symlinks included where the file already exists) and checks it stays inside
# the repository root. Works even when the target file does not exist yet, by resolving its parent directory.
resolve_inside_root() {
  local target=$1 dir base resolved_dir
  dir=$(dirname -- "$target")
  base=$(basename -- "$target")
  if [ ! -d "$dir" ]; then
    # parent folder does not exist either — nothing there to delete, and we cannot resolve it; treat as outside.
    return 1
  fi
  resolved_dir=$(cd "$dir" && pwd -P) || return 1
  case "$resolved_dir/" in
    "$root"/*) ;;
    *) return 1 ;;
  esac
  printf '%s/%s\n' "$resolved_dir" "$base"
}

main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --db) db_path=$2; shift 2 ;;
      --port) port=$2; shift 2 ;;
      *) echo "usage: $0 [--db <path>] [--port <port>]" >&2; exit 2 ;;
    esac
  done

  local resolved
  if ! resolved=$(resolve_inside_root "$db_path"); then
    echo "reset-db: 경로가 저장소 밖을 가리켜 거부 — $db_path (아무것도 지우지 않았습니다)" >&2
    exit 2
  fi

  if port_in_use "$port"; then
    echo "reset-db: 백엔드가 실행 중인 것으로 보입니다(포트 $port 사용 중) — 먼저 멈추세요 (아무것도 지우지 않았습니다)" >&2
    exit 1
  fi

  rm -f -- "$resolved" "$resolved-wal" "$resolved-shm" "$resolved-journal"
  echo "reset-db: $db_path(와 -wal/-shm/-journal가 있었다면)를 지웠습니다 — 다음 백엔드 실행이 오늘 기준으로 다시 시드합니다"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
