#!/usr/bin/env node
// Register a finished seat in the Think Tank roster (.claude/skills/think-tank/roster.json).
//
//   node .claude/skills/new-thinker/scripts/add_seat.mjs --key naval --name "Naval Ravikant" --short Naval \
//     --slug naval-ravikant --pillar "Leverage and wealth" --question "Does this build leverage you own?" \
//     --dimension "Leverage and long-term wealth" [--color "#22b8a0"] [--default] [--swap <key>]
//
// Checks the agent file and the brain exist first, so a half-built seat never reaches the table.
// --default puts the seat on the default board; --swap <key> takes that seat off the board in
// the same move (the board holds at most nine). Running it again for the same key updates it.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SKILL = path.join(ROOT, ".claude", "skills", "think-tank");
const ROSTER = path.join(SKILL, "roster.json");
const MAX_BOARD = 9;
const BRAIN_FILES = ["_hot.md", "frameworks.md", "principles.md", "positions.md", "voice.md", "stories.md", "sources.md"];
const PALETTE = ["#22b8a0", "#e05d9b", "#c9a227", "#5b7cfa", "#ef7d32", "#2fa4d6", "#a3be3c", "#b06ad9", "#d6543f", "#3fb37f"];
const LOCK = ROSTER + ".lock";

// Several builds can run at once, from the room and from the queue. Serialize the
// roster read-modify-write so two seats added together never clobber each other.
function withRosterLock(fn) {
  for (let i = 0; i < 300; i++) {
    try {
      const fd = fs.openSync(LOCK, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 60_000) fs.unlinkSync(LOCK); } catch { /* stale lock */ }
      if (i === 299) throw new Error("roster lock timeout");
      spawnSync("sleep", ["0.1"]);
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(LOCK); } catch { /* already released */ } }
}

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const fail = (m) => { console.error("add_seat: " + m); process.exit(1); };

const seat = {
  key: (opt("key") || "").toLowerCase(),
  name: opt("name"), short: opt("short"), initials: opt("initials"), slug: opt("slug"),
  pillar: opt("pillar"), question: opt("question"), dimension: opt("dimension"), color: opt("color"),
};
for (const f of ["key", "name", "short", "slug", "pillar", "question", "dimension"]) if (!seat[f]) fail(`--${f} is required`);
if (!/^[a-z][a-z0-9]{1,15}$/.test(seat.key)) fail("--key must be 2 to 16 lowercase letters or digits, starting with a letter");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(seat.slug)) fail("--slug must look like first-last");
seat.initials ||= seat.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

const agent = path.join(ROOT, ".claude", "agents", `council-${seat.key}.md`);
if (!fs.existsSync(agent)) fail(`missing agent file ${path.relative(ROOT, agent)}`);
const brain = path.join(SKILL, "brains", seat.slug);
const missing = BRAIN_FILES.filter((f) => !fs.existsSync(path.join(brain, f)));
if (missing.length) fail(`brain ${path.relative(ROOT, brain)} is missing ${missing.join(", ")}`);

let r, at;
try {
  ({ r, at } = withRosterLock(() => {
    const r = JSON.parse(fs.readFileSync(ROSTER, "utf8"));
    const others = r.seats.filter((s) => s.key !== seat.key);
    if (others.some((s) => s.slug === seat.slug)) throw new Error(`slug ${seat.slug} already belongs to another seat`);
    if (others.some((s) => s.short.toLowerCase() === seat.short.toLowerCase())) throw new Error(`short name ${seat.short} is taken; pick another`);
    if (!/^#[0-9a-f]{6}$/i.test(seat.color || "")) {
      const used = new Set(r.seats.map((s) => s.color.toLowerCase()));
      seat.color = PALETTE.find((c) => !used.has(c)) || PALETTE[r.seats.length % PALETTE.length];
    }
    const at = r.seats.findIndex((s) => s.key === seat.key);
    if (at >= 0) r.seats[at] = seat; else r.seats.push(seat);

    const swap = opt("swap");
    if (swap) r.default = r.default.filter((k) => k !== swap);
    if (args.includes("--default") && !r.default.includes(seat.key)) {
      if (r.default.length >= MAX_BOARD) throw new Error(`the default board already has ${MAX_BOARD} seats; add --swap <key> to take one off`);
      r.default.push(seat.key);
    }

    // one seat per line keeps the file easy to read and edit by hand
    const line = (o) => "{ " + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + " }";
    const out = [
      "{",
      `  "board": ${JSON.stringify(r.board || "default")},`,
      `  "default": [${r.default.map((k) => JSON.stringify(k)).join(", ")}],`,
      `  "seats": [`,
      r.seats.map((s) => "    " + line(s)).join(",\n"),
      "  ]",
      "}",
    ].join("\n") + "\n";
    JSON.parse(out); // never write a file the room cannot read
    fs.writeFileSync(ROSTER, out);
    return { r, at };
  }));
} catch (e) {
  fail(e.message);
}

// Keep the OpenCode agent catalog in step with the Claude-format source.
const sync = path.join(ROOT, "scripts", "sync-opencode-agents.mjs");
if (fs.existsSync(sync)) {
  const result = spawnSync(process.execPath, [sync], { stdio: "inherit" });
  if (result.status !== 0) console.error("add_seat: OpenCode agent sync failed; run npm run opencode:sync");
}

console.log(`${at >= 0 ? "Updated" : "Added"} ${seat.name} (${seat.key}) to the roster.`);
console.log(`Default board (${r.default.length}): ${r.default.map((k) => r.seats.find((s) => s.key === k)?.short || k).join(", ")}`);
console.log(`Board setting: ${r.board || "default"}`);
