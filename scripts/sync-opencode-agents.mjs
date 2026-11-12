#!/usr/bin/env node
// Generate OpenCode subagent definitions from the Claude-format seat sources.
//
// OpenCode V2 reads agents from `.opencode/agents/` and does not load
// `.claude/agents/`. The seat bodies are runtime-neutral, so this script keeps
// `.claude/agents/council-*.md` as the single source of truth (the room app and
// /new-thinker also read it) and rewrites only the frontmatter for OpenCode.
//
//   node scripts/sync-opencode-agents.mjs          # write .opencode/agents
//   node scripts/sync-opencode-agents.mjs --check  # fail if out of date
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, ".claude", "agents");
const TARGET = path.join(ROOT, ".opencode", "agents");
const CHECK = process.argv.includes("--check");

const OPENCODE_FRONTMATTER = (description, steps) => `---
description: ${description}
mode: subagent
steps: ${steps}
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: read
    resource: "*"
    effect: allow
  - action: glob
    resource: "*"
    effect: allow
  - action: grep
    resource: "*"
    effect: allow
---`;

function parse(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  if (!fields.description) throw new Error(`${file}: missing description`);
  return { fields, body: match[2] };
}

function render(file) {
  const { fields, body } = parse(file);
  const steps = Number(fields.maxTurns) || 12;
  return `${OPENCODE_FRONTMATTER(fields.description, steps)}\n\n${body.replace(/^\s+/, "")}`;
}

if (!fs.existsSync(SOURCE)) {
  console.error(`sync-opencode-agents: no ${path.relative(ROOT, SOURCE)} folder`);
  process.exit(1);
}

const sources = fs.readdirSync(SOURCE).filter((f) => /^council-.*\.md$/.test(f)).sort();
if (!sources.length) {
  console.error("sync-opencode-agents: no council-*.md agents found");
  process.exit(1);
}

let stale = 0;
let changed = 0;
const expected = new Set();

for (const name of sources) {
  expected.add(name);
  const output = render(path.join(SOURCE, name));
  const target = path.join(TARGET, name);
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (current === output) continue;
  changed++;
  if (CHECK) {
    console.error(`out of date: ${path.relative(ROOT, target)}`);
  } else {
    fs.mkdirSync(TARGET, { recursive: true });
    fs.writeFileSync(target, output);
    console.log(`wrote ${path.relative(ROOT, target)}`);
  }
}

if (fs.existsSync(TARGET)) {
  for (const name of fs.readdirSync(TARGET)) {
    if (!/^council-.*\.md$/.test(name) || expected.has(name)) continue;
    stale++;
    if (CHECK) {
      console.error(`stale: ${path.relative(ROOT, path.join(TARGET, name))}`);
    } else {
      fs.rmSync(path.join(TARGET, name));
      console.log(`removed ${path.relative(ROOT, path.join(TARGET, name))}`);
    }
  }
}

if (CHECK && (changed || stale)) process.exit(1);
console.log(
  CHECK
    ? `${sources.length} OpenCode agents are in sync.`
    : `${sources.length} OpenCode agents synced to .opencode/agents/.`,
);
