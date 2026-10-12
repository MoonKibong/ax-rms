#!/usr/bin/env bash
# NEXI: run one command with a clean environment, so a check cannot reach the caller's databases or services (T#269).
#
#   nexi-isolated.sh --root <dir> [--set VAR=VALUE]... [--file VAR=RELPATH]... [--file-url VAR=RELPATH]...
#                    [--keep VAR]... [--home keep|isolated] -- <command> [args...]
#
# The command starts from an empty environment. It gets only: PATH, LANG, LC_ALL, LC_CTYPE, TZ, TERM, USER, LOGNAME, HOME
# (<root>/.nexi-home, or the caller's with --home keep), TMPDIR=<root>/.nexi-tmp, and what the options give:
#   --set VAR=VALUE        a literal value
#   --file VAR=RELPATH     the absolute path of RELPATH inside <root>; refused if it is absolute, has '.' or '..', has %, ?, #
#                          or a space, or any part of it that exists is a symlink (nothing is created for a refused path)
#   --file-url VAR=RELPATH the same path as file:<absolute path> (for example a SQLite DATABASE_URL)
#   --keep VAR             the caller's value of VAR, only when the contract or README names it (for example a registry token)
#   --home keep            the caller's HOME, only when a step needs a tool's files there; then SDKs can read its config too
# Limits: it clears the environment and confines the paths it sets. It does not stop a command from reading project files
# (.env), absolute paths written in configuration, the network, or cloud metadata. The root is trusted: nobody else changes
# it while the command runs.
# Every other variable of the caller is dropped, also in the command's child processes. On stderr it prints one line naming
# the dropped variables that look like settings of databases, mail, ports, environments, or cloud credentials (names only,
# never values), and the variables it passed. Exit status: the command's, or 2 for invalid arguments or a refused path.
set -u
root=""; home=isolated; sets=(); keeps=(); names=();
usage() { echo "usage: $0 --root <dir> [--set V=X] [--file V=REL] [--file-url V=REL] [--keep V] [--home keep|isolated] -- <command>" >&2; exit 2; }
inside() {  # $1 relative path -> absolute path inside $root, or fail; creates the missing folders only after the checks
  local rel=$1 cur=$root part rest
  case "$rel" in ''|/*) return 1;; esac
  case "/$rel/" in */../*|*/./*|*//*) return 1;; esac
  case "$rel" in *%*|*\?*|*#*|*[[:space:]]*) return 1;; esac   # no URI escapes, queries, fragments, or spaces
  rest=$rel
  while :; do
    part=${rest%%/*}
    [ -L "$cur/$part" ] && return 1
    if [ "$part" = "$rest" ]; then break; fi
    [ ! -e "$cur/$part" ] || [ -d "$cur/$part" ] || return 1
    cur="$cur/$part"; rest=${rest#*/}
  done
  mkdir -p "$(dirname "$root/$rel")" || return 1
  printf '%s/%s' "$root" "$rel"
}
while [ $# -gt 0 ]; do
  case "$1" in
    --root) [ $# -ge 2 ] || usage; [ -d "$2" ] || { echo "--root is not a folder: $2" >&2; exit 2; }
      root=$(cd "$2" && pwd -P); shift 2;;
    --home) [ $# -ge 2 ] || usage; home=$2; shift 2; case "$home" in keep|isolated) ;; *) usage;; esac;;
    --set|--file|--file-url|--keep) [ $# -ge 2 ] && [ -n "$2" ] || usage; opt=$1; arg=$2; shift 2
      case "$opt" in
        --keep) case "$arg" in *[!A-Za-z0-9_]*) usage;; esac; keeps+=("$arg"); names+=("$arg");;
        *) name=${arg%%=*}; val=${arg#*=}
           [ "$name" != "$arg" ] || usage
           case "$name" in ''|*[!A-Za-z0-9_]*) usage;; esac
           names+=("$name")
           if [ "$opt" = --set ]; then sets+=("$name=$val")
           else
             [ -n "$root" ] || { echo "--root must come before $opt" >&2; exit 2; }
             p=$(inside "$val") || { echo "refused: $name=$val is not a path inside $root" >&2; exit 2; }
             if [ "$opt" = --file-url ]; then
               case "$p" in *%*|*\?*|*#*|*[[:space:]]*) echo "refused: $name: the path $p has %, ?, # or a space" >&2; exit 2;; esac
               sets+=("$name=file:$p")
             else sets+=("$name=$p"); fi
           fi;;
      esac;;
    --) shift; break;;
    *) usage;;
  esac
done
[ -n "$root" ] && [ $# -gt 0 ] || usage
for d in .nexi-tmp .nexi-home; do
  [ ! -L "$root/$d" ] || { echo "refused: $root/$d is a symlink" >&2; exit 2; }
done
mkdir -p "$root/.nexi-tmp" || exit 2
env_args=()
base=(PATH LANG LC_ALL LC_CTYPE TZ TERM USER LOGNAME)
for v in "${base[@]}"; do
  [ -n "${!v+x}" ] && env_args+=("$v=${!v}") && names+=("$v")
done
if [ "$home" = isolated ]; then
  mkdir -p "$root/.nexi-home" || exit 2
  env_args+=("HOME=$root/.nexi-home" "XDG_CONFIG_HOME=$root/.nexi-home/.config" "XDG_CACHE_HOME=$root/.nexi-home/.cache")
  names+=(HOME XDG_CONFIG_HOME XDG_CACHE_HOME)
else
  env_args+=("HOME=$HOME"); names+=(HOME)
fi
env_args+=("TMPDIR=$root/.nexi-tmp"); names+=(TMPDIR)
for k in ${keeps[@]+"${keeps[@]}"}; do [ -n "${!k+x}" ] && env_args+=("$k=${!k}"); done
env_args+=(${sets[@]+"${sets[@]}"})
dropped=$(compgen -e |
  grep -E '(DATABASE|^DB_|_DB$|POSTGRES|^PG|MYSQL|SQLITE|REDIS|MONGO|SMTP|MAIL|^PORT$|_PORT$|NODE_ENV|RAILS_ENV|SPRING_|JAVA_TOOL_OPTIONS|NODE_OPTIONS|AWS_|GOOGLE_|AZURE_|GCP_|_TOKEN$|_SECRET|_KEY$|PASSWORD)' |
  sort -u | grep -vxF -f <(printf '%s\n' "${names[@]}") | tr '\n' ' ')
passed=$(printf '%s\n' "${names[@]}" | sort -u | tr '\n' ' ')
echo "nexi-isolated: root $root; dropped: ${dropped:-none}; passed: $passed" >&2
exec env -i "${env_args[@]}" "$@"
