#!/usr/bin/env bash
# Render boot: put mutable Think Tank data on the persistent disk, keep the
# skill code in the image, and start the room.
set -euo pipefail

DATA="${DATA_DIR:-/data}"
mkdir -p "$DATA"
for d in sessions build brains agents opencode-agents portraits; do
  mkdir -p "$DATA/$d"
done

# Seed the disk once. Existing data is never overwritten.
[ -f "$DATA/roster.json" ] || cp .claude/skills/think-tank/roster.json "$DATA/roster.json"
[ -f "$DATA/seats.md" ] || cp .claude/skills/think-tank/references/seats.md "$DATA/seats.md"
[ -n "$(ls -A "$DATA/brains" 2>/dev/null || true)" ] || cp -a .claude/skills/think-tank/brains/. "$DATA/brains/"
[ -n "$(ls -A "$DATA/agents" 2>/dev/null || true)" ] || cp -a .claude/agents/. "$DATA/agents/"
[ -n "$(ls -A "$DATA/opencode-agents" 2>/dev/null || true)" ] || cp -a .opencode/agents/. "$DATA/opencode-agents/"
[ -n "$(ls -A "$DATA/portraits" 2>/dev/null || true)" ] || cp -a app/public/portraits/. "$DATA/portraits/"
[ -n "$(ls -A "$DATA/sessions" 2>/dev/null || true)" ] || cp -a sessions/. "$DATA/sessions/"

link() {
  mkdir -p "$(dirname "$2")"
  rm -rf "$2"
  ln -s "$1" "$2"
}

link "$DATA/sessions" sessions
link "$DATA/build" build
link "$DATA/agents" .claude/agents
link "$DATA/opencode-agents" .opencode/agents
link "$DATA/brains" .claude/skills/think-tank/brains
link "$DATA/roster.json" .claude/skills/think-tank/roster.json
link "$DATA/seats.md" .claude/skills/think-tank/references/seats.md
link "$DATA/portraits" app/public/portraits

exec node app/server.mjs
