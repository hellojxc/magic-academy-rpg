#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_DIR="${PREVIEW_DIR:-/home/dennisj/apps/magic-academy-rpg-preview}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5173}"
LOG_FILE="$PREVIEW_DIR/vite-preview.log"

echo "[preview] source repo: $ROOT_DIR"
echo "[preview] preview dir: $PREVIEW_DIR"

if ! git -C "$PREVIEW_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[preview] missing preview worktree: $PREVIEW_DIR" >&2
  echo "[preview] create it with: git -C \"$ROOT_DIR\" worktree add --track -b preview \"$PREVIEW_DIR\" origin/main" >&2
  exit 1
fi

if ! git -C "$PREVIEW_DIR" diff --quiet || ! git -C "$PREVIEW_DIR" diff --cached --quiet; then
  echo "[preview] refusing to update: preview worktree has local changes" >&2
  git -C "$PREVIEW_DIR" status --short
  exit 1
fi

echo "[preview] fetching origin/main"
git -C "$ROOT_DIR" fetch origin main

current_branch="$(git -C "$PREVIEW_DIR" branch --show-current)"
if [[ "$current_branch" != "preview" ]]; then
  echo "[preview] switching preview worktree to local preview branch"
  git -C "$PREVIEW_DIR" switch preview
fi

echo "[preview] fast-forwarding preview to origin/main"
git -C "$PREVIEW_DIR" merge --ff-only origin/main

echo "[preview] installing dependencies"
npm --prefix "$PREVIEW_DIR" ci

echo "[preview] running production build check"
npm --prefix "$PREVIEW_DIR" run build

echo "[preview] stopping existing preview server on $HOST:$PORT"
pids="$(ss -ltnp 2>/dev/null | awk -v port=":$PORT" '$4 ~ port { print }' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"
for pid in $pids; do
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  if [[ "$cwd" != "$PREVIEW_DIR" ]]; then
    echo "[preview] refusing to stop pid $pid: cwd is $cwd, expected $PREVIEW_DIR" >&2
    exit 1
  fi
  kill "$pid" 2>/dev/null || true
done

sleep 1

echo "[preview] starting Vite preview dev server"
cd "$PREVIEW_DIR"
nohup ./node_modules/.bin/vite --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 < /dev/null &
echo "$!" > "$PREVIEW_DIR/vite-preview.pid"

echo "[preview] waiting for http://$HOST:$PORT/"
for _ in $(seq 1 30); do
  if curl -fsSI "http://$HOST:$PORT/" >/dev/null; then
    echo "[preview] ready: http://$HOST:$PORT/"
    exit 0
  fi
  sleep 0.5
done

echo "[preview] server did not become healthy" >&2
tail -80 "$LOG_FILE" >&2 || true
exit 1
