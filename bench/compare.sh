#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <before-commit> <after-commit>"
  echo "Example: $0 9b3878e fb81036"
  exit 1
fi

BEFORE=$1
AFTER=$2
ROOT=$(git rev-parse --show-toplevel)
BEFORE_DIR=$(mktemp -d)
AFTER_DIR=$(mktemp -d)
BEFORE_JSON=$(mktemp /tmp/bench-before-XXXX.json)
AFTER_JSON=$(mktemp /tmp/bench-after-XXXX.json)

cleanup() {
  git -C "$ROOT" worktree remove --force "$BEFORE_DIR" 2>/dev/null || true
  git -C "$ROOT" worktree remove --force "$AFTER_DIR" 2>/dev/null || true
  rm -f "$BEFORE_JSON" "$AFTER_JSON"
}
trap cleanup EXIT

echo "Checking out $BEFORE → $BEFORE_DIR"
git -C "$ROOT" worktree add --quiet "$BEFORE_DIR" "$BEFORE"
# Symlink node_modules so we don't reinstall
ln -s "$ROOT/node_modules" "$BEFORE_DIR/node_modules"

echo "Checking out $AFTER → $AFTER_DIR"
git -C "$ROOT" worktree add --quiet "$AFTER_DIR" "$AFTER"
ln -s "$ROOT/node_modules" "$AFTER_DIR/node_modules"

echo
echo "Running benchmark on $BEFORE..."
(cd "$BEFORE_DIR" && node bench/run.mjs --output "$BEFORE_JSON")

echo "Running benchmark on $AFTER..."
(cd "$AFTER_DIR" && node bench/run.mjs --output "$AFTER_JSON")

node "$ROOT/bench/compare-results.mjs" "$BEFORE_JSON" "$AFTER_JSON" "$BEFORE" "$AFTER"
