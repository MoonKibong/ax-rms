#!/usr/bin/env bash
# NEXI fingerprint. nexi-init and nexi-implement copy this file from the nexi-init skill to scripts/nexi-fingerprint.sh.
# Reads only; writes nothing.
#
#   nexi-fingerprint.sh
#       Code fingerprint: one hash for the uncommitted changes (staged or not, deletions, new files, file modes,
#       symlink targets), leaving out docs/evidence and docs/reviews. The evidence records it.
#   nexi-fingerprint.sh --reviewed <N>
#       Reviewed-files fingerprint: one hash for every uncommitted change except docs/reviews/T<N>.md, so it covers
#       the code, contract, brief, evidence and screenshots. The review records it.
#   nexi-fingerprint.sh --reviewed <N> --commit <commit>
#       The same reviewed-files fingerprint for the changes that <commit> made to its only parent. After the
#       reviewed files are committed, it prints the hash that --reviewed <N> printed before the commit.
#
# A path or symlink target that contains a newline, and a legacy link line that contains " -> ", could make two
# different sets of files print the same lines. The script then prints no hash and exits 1.
#
# Exit status: 0 hash printed; 1 a git read failed or the change cannot be fingerprinted; 2 usage error.
set -euo pipefail

NL=$'\n'

refuse() {
  echo "nexi-fingerprint: $1; no hash printed" >&2
  exit 1
}

# Refuse a path that contains a newline.
check_path() {
  case "$1" in *"$NL"*) refuse "a changed path contains a newline" ;; esac
}

# Print a symlink's target, or refuse a target that contains a newline. readlink -n (GNU and BSD) prints the target's
# exact bytes; plain readlink and command substitution can drop a trailing newline, so count newlines first.
link_target() {
  local newlines
  newlines=$(readlink -n "./$1" | tr -cd '\n' | wc -c) || exit 1
  [ "$newlines" -eq 0 ] || refuse "the target of symlink $1 contains a newline"
  readlink -n "./$1"
}

usage() {
  echo "usage: nexi-fingerprint.sh [--reviewed <N> [--commit <commit>]]" >&2
  exit 2
}

# Code fingerprint. Under the C locale the output is unchanged from the first kit, so earlier evidence stays comparable. The
# untracked paths are sorted under the C locale so that two sessions with different locales get the same fingerprint (T#243).
code_changes() {
  git diff HEAD --binary -- . ':!docs/evidence' ':!docs/reviews' || return 1
  git ls-files -z -o --exclude-standard -- . ':!docs/evidence' ':!docs/reviews' | LC_ALL=C sort -z |
    while IFS= read -r -d '' f; do
      check_path "$f"
      if [ -L "$f" ]; then
        t=$(link_target "$f") || exit 1
        case "$f$NL$t" in *" -> "*) refuse "symlink $f or its target contains ' -> '" ;; esac
        printf 'link %s -> %s\n' "$f" "$t"
      else
        h=$(git hash-object -- "$f") || exit 1
        if [ -x "$f" ]; then kind=exec; else kind=file; fi
        printf '%s %s %s\n' "$kind" "$f" "$h"
      fi
    done
}

# Reviewed-files manifest of the working tree: one line per changed path, "<kind> <path> <blob>" or "delete <path>".
# A symlink's blob is the hash of its target, as git stores it, so a committed change gives the same line.
tree_manifest() {
  local record=$1 f h t
  {
    git diff HEAD --name-only -z --no-renames -- . ":!$record" || return 1
    git ls-files -z -o --exclude-standard -- . ":!$record" || return 1
  } | LC_ALL=C sort -z -u | while IFS= read -r -d '' f; do
    check_path "$f"
    if [ -L "$f" ]; then
      t=$(link_target "$f") || exit 1
      h=$(printf '%s' "$t" | git hash-object --stdin) || exit 1
      printf 'link %s %s\n' "$f" "$h"
    elif [ -d "$f" ]; then
      echo "nexi-fingerprint: $f is a directory (submodule); cannot fingerprint it" >&2
      exit 1
    elif [ -f "$f" ]; then
      h=$(git hash-object -- "$f") || exit 1
      if [ -x "$f" ]; then kind=exec; else kind=file; fi
      printf '%s %s %s\n' "$kind" "$f" "$h"
    else
      printf 'delete %s\n' "$f"
    fi
  done
}

# Reviewed-files manifest of the changes <commit> made to its only parent, in the same line format.
commit_manifest() {
  local record=$1 commit=$2 parents meta path newmode newsha status
  parents=$(git rev-list --parents -n 1 "$commit" --) || return 1
  set -- $parents
  if [ "$#" -ne 2 ]; then
    echo "nexi-fingerprint: $commit must have exactly one parent" >&2
    return 1
  fi
  git diff-tree -r -z --no-renames --no-commit-id "$2" "$1" -- . ":!$record" |
    while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
      # meta is ":<old mode> <new mode> <old blob> <new blob> <status>"
      set -- $meta
      newmode=$2 newsha=$4 status=$5
      check_path "$path"
      if [ "$status" != D ] && [ "$newmode" = 120000 ]; then
        [ "$(git cat-file blob "$newsha" | wc -l)" -eq 0 ] || refuse "the target of symlink $path contains a newline"
      fi
      case "$status:$newmode" in
        D:*) printf 'delete %s\n' "$path" ;;
        *:100644) printf 'file %s %s\n' "$path" "$newsha" ;;
        *:100755) printf 'exec %s %s\n' "$path" "$newsha" ;;
        *:120000) printf 'link %s %s\n' "$path" "$newsha" ;;
        *)
          echo "nexi-fingerprint: $path has mode $newmode; cannot fingerprint it" >&2
          exit 1
          ;;
      esac
    done
}

if [ "$#" -eq 0 ]; then
  out=$(code_changes) || exit 1 # a failed read stops here, before any hash is printed
  printf '%s\n' "$out" | git hash-object --stdin
  exit 0
fi

[ "${1:-}" = "--reviewed" ] || usage
n=${2:-}
case "$n" in '' | *[!0-9]*) usage ;; esac
record="docs/reviews/T$n.md"
if [ "$#" -eq 2 ]; then
  out=$(tree_manifest "$record") || exit 1
elif [ "$#" -eq 4 ] && [ "$3" = "--commit" ]; then
  commit=$(git rev-parse --verify --quiet "$4^{commit}") || {
    echo "nexi-fingerprint: $4 is not a commit" >&2
    exit 1
  }
  out=$(commit_manifest "$record" "$commit") || exit 1
else
  usage
fi
printf '%s\n' "$out" | LC_ALL=C sort | git hash-object --stdin
