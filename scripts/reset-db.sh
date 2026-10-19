#!/usr/bin/env bash
# T#57: delete the demo DB (and its -wal/-shm/-journal files) so the next backend start reseeds from today (B#5).
#
#   scripts/reset-db.sh [--db <path>] [--port <port>]
#
# --db defaults to backend/data/app.db; the path is taken only from this flag, never from the DB_PATH environment
# variable the app itself reads (a DB_PATH left in the caller's shell for an unrelated reason must not change what
# this destructive command deletes). The resolved real path (symlinks followed, for the file itself when it
# exists) must stay inside this repository; an absolute path, a ".." that reaches outside it, or a symlink whose
# target is outside it is refused and nothing is deleted.
# --port defaults to 8080 (the backend's default demo port, BACKEND_PORT in scripts/run.sh). If that port is
# confirmed in use, the backend looks like it is running: refused, nothing deleted (deleting a WAL file a live
# connection still holds can break its next checkpoint). If the check itself cannot tell (for example `node` is
# missing), this also refuses — never treated as "free".
# Only the exact four paths (the resolved DB file and its -wal, -shm, -journal siblings) are ever removed, and
# only the ones that exist; backend/data/e2e.db and .nexi-tmp/* (scripts/e2e-servers.sh's own DBs) are never
# touched unless explicitly passed as --db. A failed delete (for example a permission error) is reported as a
# failure, not as success.
# Exit status: 0 on a successful delete (or nothing to delete), 1 if the port is in use or its state could not be
# checked, or a file could not be deleted, 2 for a refused path or bad arguments.
set -u

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
db_path=backend/data/app.db
port=8080

# Exit status: 0 confirmed in use, 1 confirmed free, 2 could not tell (never treat this as "free").
port_in_use() {
  node -e '
    const socket = require("net").connect({ port: Number(process.argv[1]), host: "localhost" })
    socket.on("connect", () => process.exit(44))
    socket.on("error", () => process.exit(55))
    setTimeout(() => process.exit(55), 2000)
  ' "$1"
  case $? in
    44) return 0 ;;
    55) return 1 ;;
    *) return 2 ;;
  esac
}

# Resolves --db to a real, absolute path and checks it stays inside the repository root. If the file (or a
# symlink at that path) already exists, its target is resolved too, so a symlink pointing outside the repo is
# caught instead of silently unlinking just the local symlink. If it does not exist yet, only the parent
# directory is resolved (there is nothing further to follow).
resolve_inside_root() {
  local target=$1 dir base resolved_dir resolved_file
  if [ -e "$target" ] || [ -L "$target" ]; then
    resolved_file=$(node -e 'console.log(require("fs").realpathSync(process.argv[1]))' "$target" 2>/dev/null) || return 1
  else
    dir=$(dirname -- "$target")
    base=$(basename -- "$target")
    [ -d "$dir" ] || return 1
    resolved_dir=$(cd "$dir" && pwd -P) || return 1
    resolved_file="$resolved_dir/$base"
  fi
  case "$resolved_file" in
    "$root"/*) printf '%s\n' "$resolved_file"; return 0 ;;
    *) return 1 ;;
  esac
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

  port_in_use "$port"
  case $? in
    0)
      echo "reset-db: 백엔드가 실행 중인 것으로 보입니다(포트 $port 사용 중) — 먼저 멈추세요 (아무것도 지우지 않았습니다)" >&2
      exit 1
      ;;
    1) ;; # confirmed free — proceed
    *)
      echo "reset-db: 포트 $port 상태를 확인할 수 없습니다 — 아무것도 지우지 않았습니다" >&2
      exit 1
      ;;
  esac

  if ! rm -f -- "$resolved" "$resolved-wal" "$resolved-shm" "$resolved-journal"; then
    echo "reset-db: 삭제 실패 — $db_path" >&2
    exit 1
  fi
  echo "reset-db: $db_path(와 -wal/-shm/-journal가 있었다면)를 지웠습니다 — 다음 백엔드 실행이 오늘 기준으로 다시 시드합니다"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
