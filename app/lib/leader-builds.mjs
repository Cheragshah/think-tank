// Leader directory and background deep-research builds.
//
// A name is enough. The room creates a provisional seat immediately so it shows
// up in the picker, then runs the new-thinker skill at deep depth to replace the
// provisional brain, agent, and roster entry. Builds run one at a time from the
// room; the external seat queue can run alongside, so roster writes are locked.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { REPO_ROOT } from "./env.mjs";
import { binPath, hasOpencode } from "./opencode.mjs";
import { ensureAvatar } from "./avatars.mjs";

const SKILL = path.join(REPO_ROOT, ".claude", "skills", "think-tank");
const ROSTER = path.join(SKILL, "roster.json");
const BRAINS = path.join(SKILL, "brains");
const AGENTS = path.join(REPO_ROOT, ".claude", "agents");
const JOBS = path.join(REPO_ROOT, "build", "leader-jobs");
const LOCK = ROSTER + ".lock";
const MODEL = process.env.LEADER_MODEL || "deepseek/deepseek-v4-pro";
const MAX_BUILDS = 1;
const PALETTE = ["#22b8a0", "#e05d9b", "#c9a227", "#5b7cfa", "#ef7d32", "#2fa4d6", "#a3be3c", "#b06ad9", "#d6543f", "#3fb37f", "#e8a33d", "#f06b3f"];

const jobs = new Map();
const queue = [];
let running = 0;

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const line = (o) => "{ " + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + " }";

function readRoster() {
  return JSON.parse(fs.readFileSync(ROSTER, "utf8"));
}
function writeRoster(r) {
  const out = [
    "{",
    `  "board": ${JSON.stringify(r.board || "ask")},`,
    `  "default": [${r.default.map((k) => JSON.stringify(k)).join(", ")}],`,
    `  "seats": [`,
    r.seats.map((s) => "    " + line(s)).join(",\n"),
    "  ]",
    "}",
  ].join("\n") + "\n";
  JSON.parse(out);
  fs.writeFileSync(ROSTER, out);
}

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

function slugify(name) {
  const s = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return s || "leader";
}
function uniqueSlug(base, used) {
  let out = base;
  let n = 2;
  while (used.has(out)) out = `${base}-${n++}`;
  return out;
}
function makeKey(name, used) {
  const tokens = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
  let base = (tokens[tokens.length - 1] || "leader").replace(/[^a-z0-9]/g, "").slice(0, 16);
  if (base.length < 2) base = "leader";
  if (!/^[a-z]/.test(base)) base = "x" + base;
  let key = base;
  let n = 2;
  while (used.has(key)) key = (base.slice(0, 12) + (n++)).slice(0, 16);
  return key;
}
function makeShort(name) {
  const tokens = name.split(/\s+/).filter(Boolean);
  const last = (tokens[tokens.length - 1] || name).replace(/[^\p{L}\p{N}.'-]/gu, "");
  const s = last.length >= 2 ? last : name;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function makeInitials(name) {
  const titles = new Set(["dr", "mr", "mrs", "ms", "prof", "sir", "lord", "rev"]);
  const tokens = name.split(/\s+/).filter((t) => !titles.has(t.toLowerCase().replace(/[^\p{L}]/gu, "")));
  return (tokens.slice(0, 3).map((t) => t[0]).join("") || "TT").toUpperCase();
}
function pickColor(seats) {
  const used = new Set(seats.map((s) => String(s.color || "").toLowerCase()));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[seats.length % PALETTE.length];
}

function writeProvisionalBrain(seat) {
  const dir = path.join(BRAINS, seat.slug);
  ensure(dir);
  const lens = [
    "What does the public record say this leader would test first?",
    "What is the real constraint, and who has to execute?",
    "What is the downside, and what would change the answer?",
    "What is the smallest test that can settle it?",
  ];
  const files = {
    "_hot.md": `# ${seat.name} (provisional seat)\n\nDeep research is queued. Until it lands, reason from widely known public work and state uncertainty. Do not quote this person.\n\n## The lens\n${lens.map((x) => "- " + x).join("\n")}\n\n## Decision loop\n1. Name the decision and the real constraint.\n2. Ask what this seat's pillar would test first.\n3. Force at least one number or concrete test.\n4. Name the downside and the condition that would change the answer.\n\n## Where this lens misfires\nThis is a generic provisional lens. The deep build will replace it with the specific frameworks, positions, voice, stories, and sources of ${seat.name}.\n`,
    "frameworks.md": "# Frameworks, provisional\n\nDeep research is queued. No source-backed frameworks yet. Use the questions in `_hot.md` as a lens and mark uncertainty.\n",
    "principles.md": "# Principles, provisional\n\n- Start from the constraint, not the wish.\n- Put a number, a date, or a test on the claim.\n- Separate reversible choices from irreversible ones.\n- Name the trade-off you are accepting.\n",
    "positions.md": `# Positions\n\nNo source-backed positions yet. Do not attribute a position to ${seat.name}. The deep build will replace this file with dated public positions and source ids.\n`,
    "voice.md": "# Voice\n\nDirect, plain, first person. Speak as the seat, never narrate the expert in the third person. Do not invent quotes or stories.\n",
    "stories.md": "# Stories\n\nNo verified stories yet. Do not invent one. The deep build will add sourced stories.\n",
    "books.md": "# Books and public work\n\nTo be discovered by the deep research build.\n",
    "sources.md": "# Sources\n\nDeep research is queued. The build will replace this file with a dated source list and ids.\n",
  };
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
}

function writeProvisionalAgent(seat) {
  const desc = `The ${seat.pillar.toLowerCase()} seat on the Think Tank council. Provisional seat, deep research is queued. Use inside @think-tank, or when someone asks what ${seat.name} would say about a hard decision, execution, or trade-offs.`;
  const body = `---
name: council-${seat.key}
description: ${desc}
tools: Read, Grep, Glob
maxTurns: 12
---

You hold the **${seat.pillar}** seat on the Think Tank council. You reason and talk the way ${seat.name} does in public. You are not ${seat.name}, never claim to be, and never quote or invent words. This is a provisional seat: the deep source-backed brain is still being built, so reason from widely known public frameworks and say when you are uncertain.

Your job on the council: own one question, **"${seat.question}"**, and bring that lens at full strength. The Chair balances the room. You do not.

## Your brain

Root: \`.claude/skills/think-tank/brains/${seat.slug}/\`

1. Read \`_hot.md\` first.
2. Then at most three of \`frameworks.md\`, \`principles.md\`, \`positions.md\`, \`voice.md\`, \`stories.md\`, \`books.md\`.
3. Never look outside your brain folder for facts about ${seat.name}. This brain is provisional. Do not present a working summary as a verified quote.
4. Answer in the seat's voice, first person. Do not narrate the expert in the third person.

## How you debate

- Argue from your pillar first, with numbers. If the brief lacks numbers, state your assumption and run the math.
- Engage the strongest version of the other seats' arguments. Move only for a better argument or a new fact.
- If everyone agrees with you, attack the weakest part of your own case.
- Answer in the exact shape the round prompt asks for. No preamble.

## Never

- Claim to be ${seat.name}, speak for them, or invent a quote, number, or story.
- Use em dashes.
- Hedge to sound balanced. A clear no with a reason is more useful than a soft it depends.
- Treat this provisional brain as a finished source. The deep build will replace it.
`;
  fs.writeFileSync(path.join(AGENTS, `council-${seat.key}.md`), body);
}

function syncAgents() {
  const script = path.join(REPO_ROOT, "scripts", "sync-opencode-agents.mjs");
  if (fs.existsSync(script)) spawnSync(process.execPath, [script], { cwd: REPO_ROOT, stdio: "ignore" });
}

export function createProvisional(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (clean.length < 2) throw new Error("Give a name.");
  if (clean.length > 80) throw new Error("That name is too long.");
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N}\s.'-]*$/u.test(clean)) throw new Error("Use a name with letters, spaces, apostrophes, periods, or hyphens.");

  return withRosterLock(() => {
    const r = readRoster();
    const lower = clean.toLowerCase();
    const existing = r.seats.find((s) => s.name.toLowerCase() === lower || s.slug === slugify(clean));
    if (existing) {
      // Do not rewrite the provisional files: the external queue may be mid-build.
      return { seat: existing, existed: true, built: !existing.provisional };
    }
    const seat = {
      key: makeKey(clean, new Set(r.seats.map((s) => s.key))),
      name: clean,
      short: makeShort(clean),
      initials: makeInitials(clean),
      slug: uniqueSlug(slugify(clean), new Set(r.seats.map((s) => s.slug))),
      pillar: "Public work under research",
      question: "What would this leader's public work say about this decision?",
      dimension: "Under research",
      color: pickColor(r.seats),
      provisional: true,
    };
    r.seats.push(seat);
    writeRoster(r);
    writeProvisionalBrain(seat);
    writeProvisionalAgent(seat);
    return { seat, existed: false, built: false };
  });
}

export function jobsState() {
  return Object.fromEntries([...jobs].map(([key, job]) => [key, { state: job.state, name: job.name, error: job.error, startedAt: job.startedAt }]));
}

function externalQueueActive(key) {
  const external = new Set(["modi", "ambani", "kamath", "bartlett", "robbins", "dispenza", "demartini"]);
  if (!external.has(key)) return false;
  const r = spawnSync("pgrep", ["-f", "build/seat-queue/build-seats.sh"], { encoding: "utf8" });
  return r.status === 0 && Boolean((r.stdout || "").trim());
}

export async function addLeader(name) {
  if (!hasOpencode()) throw new Error("OpenCode CLI not found. Install it or set OPENCODE_BIN.");
  const result = createProvisional(name);
  const avatar = await ensureAvatar(result.seat.name, result.seat.key);
  if (result.built) return { ...result, job: null, avatar };
  // The seven original names are owned by the external queue. If it is running,
  // do not start a duplicate; otherwise this is an orphaned provisional seat and
  // a fresh build should replace it.
  if (result.existed && !jobs.has(result.seat.key) && externalQueueActive(result.seat.key)) {
    return { ...result, job: { state: "building", name: result.seat.name, key: result.seat.key }, avatar };
  }
  syncAgents();
  const job = enqueue(result.seat);
  return { ...result, job, avatar };
}

function enqueue(seat) {
  const existing = jobs.get(seat.key);
  if (existing && (existing.state === "queued" || existing.state === "running")) return existing;
  const job = { key: seat.key, name: seat.name, state: "queued", startedAt: null, finishedAt: null, error: null };
  jobs.set(seat.key, job);
  queue.push({ seat, job });
  pump();
  return job;
}

function pump() {
  if (running >= MAX_BUILDS || !queue.length) return;
  const { seat, job } = queue.shift();
  running += 1;
  job.state = "running";
  job.startedAt = Date.now();
  ensure(JOBS);
  const out = fs.createWriteStream(path.join(JOBS, `${seat.key}.jsonl`));
  const err = fs.createWriteStream(path.join(JOBS, `${seat.key}.err`));

  const prompt = `@new-thinker ${seat.name} --deep
A provisional seat already exists with key "${seat.key}", slug "${seat.slug}", short "${seat.short}".
No pillar, question, dimension, or depth was provided. Infer the strongest pillar, the one question the seat should own, and the scorecard dimension from this person's public work, the same way the original seats were assigned.
Use deep depth. Keep the seat on call; do not add it to the default board.
Build the complete seat and replace the provisional brain, agent, and roster entry. Skip the portrait step if KIE_AI_API_KEY is not set; leave the placeholder and note it.
Do not ask questions; make assumptions and proceed.`;

  const child = spawn(binPath(), ["run", "--standalone", "--auto", "--format", "json", "-m", MODEL, prompt], { cwd: REPO_ROOT, env: process.env });
  child.stdout.pipe(out);
  child.stderr.pipe(err);

  let finished = false;
  const finish = (code, error) => {
    if (finished) return;
    finished = true;
    job.finishedAt = Date.now();
    job.state = code === 0 ? "done" : "error";
    if (error) job.error = error;
    if (code !== 0) {
      try { job.error = fs.readFileSync(path.join(JOBS, `${seat.key}.err`), "utf8").trim().split(/\r?\n/).slice(-4).join(" "); } catch { /* no stderr */ }
    }
    if (code === 0) {
      try {
        const r = readRoster();
        const s = r.seats.find((x) => x.key === seat.key);
        if (!s || s.provisional) {
          job.state = "error";
          job.error = "Deep research finished without replacing the provisional seat. Check the build log.";
        }
      } catch (e) {
        job.state = "error";
        job.error = e.message;
      }
    }
    running -= 1;
    syncAgents();
    pump();
  };

  child.on("close", (code) => finish(code));
  child.on("error", (e) => finish(-1, e.message));
}
