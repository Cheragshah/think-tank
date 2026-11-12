// OpenCode runner for the room's chat panel.
//
// The room stays a viewer: OpenCode does the work. This module starts one
// `opencode run` child at a time in the repo, reads its JSON event stream, and
// relays text, tool status, and usage to the browser over SSE. The Chair writes
// the session folder as usual, so the room plays the council live.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { REPO_ROOT } from "./env.mjs";

const DIRECTIVE = "\n\nGUI run: just run it. Do not ask me questions. Choose the recommended board, state any assumptions, and proceed.";

function findBin() {
  if (process.env.OPENCODE_BIN) return fs.existsSync(process.env.OPENCODE_BIN) ? process.env.OPENCODE_BIN : null;
  const r = spawnSync("sh", ["-lc", "command -v opencode"], { encoding: "utf8" });
  const found = (r.stdout || "").trim().split(/\r?\n/)[0];
  if (found) return found;
  const home = process.env.HOME || "";
  for (const p of [
    path.join(home, ".opencode", "bin", "opencode"),
    path.join(home, ".bun", "bin", "opencode"),
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
  ]) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const BIN = findBin();
export function hasOpencode() {
  return Boolean(BIN);
}
export function binPath() {
  return BIN;
}

let modelsCache = { at: 0, list: [] };
export function models() {
  if (Date.now() - modelsCache.at < 60_000 && modelsCache.list.length) return modelsCache.list;
  if (!hasOpencode()) return [];
  const r = spawnSync(BIN, ["models"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 20_000 });
  const list = (r.stdout || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9._-]+\/[A-Za-z0-9._#-]+$/.test(s));
  modelsCache = { at: Date.now(), list };
  return list;
}

const listeners = new Set();
const chat = {
  sessionId: null,
  messages: [], // { role: "user" | "assistant", text, ts }
  running: false,
  model: "",
  error: null,
  child: null,
  startedAt: null,
  steps: 0,
  cost: 0,
  tokens: { input: 0, output: 0 },
};

function copy() {
  return {
    sessionId: chat.sessionId,
    messages: chat.messages.map((m) => ({ ...m })),
    running: chat.running,
    model: chat.model,
    error: chat.error,
    steps: chat.steps,
    cost: chat.cost,
    tokens: { ...chat.tokens },
    startedAt: chat.startedAt,
  };
}

function emit(ev) {
  for (const fn of listeners) {
    try { fn(ev); } catch { /* a closed stream */ }
  }
}

export function state() {
  return { ...copy(), models: models() };
}

export function subscribe(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");
  res.write(`data: ${JSON.stringify({ type: "state", state: copy() })}\n\n`);
  const fn = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  listeners.add(fn);
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    listeners.delete(fn);
    clearInterval(ping);
  });
}

function partText(text) {
  return String(text || "");
}

export function buildPrompt(message, { quick = false, seats = [], all = false, first = true } = {}) {
  const text = String(message || "").trim();
  const picked = (Array.isArray(seats) ? seats : String(seats || "").split(","))
    .map((s) => String(s).trim().toLowerCase())
    .filter((s, i, a) => /^[a-z0-9]{2,16}$/.test(s) && a.indexOf(s) === i)
    .slice(0, 9);

  let prompt = text;
  if (!first) return prompt + "\n\nAnswer as the Chair. Do not ask questions; make assumptions and proceed.";

  if (!/^@(think-tank|new-thinker)\b/i.test(prompt)) prompt = "@think-tank " + prompt;
  const buildingSeat = /^@new-thinker\b/i.test(prompt);
  const flags = [];
  if (quick && !/--quick\b/i.test(prompt)) flags.push("--quick");
  if (!buildingSeat) {
    if (all && !/--all\b/i.test(prompt)) flags.push("--all");
    else if (picked.length && !/--seats\b/i.test(prompt)) flags.push(`--seats ${picked.join(",")}`);
  }
  if (flags.length) prompt = prompt.replace(/^(@\S+\s+)/, `$1${flags.join(" ")} `);
  return prompt + DIRECTIVE;
}

export function send(message, { model = "", quick = false, seats = [], all = false } = {}) {
  if (!BIN) throw new Error("OpenCode CLI not found. Install it or set OPENCODE_BIN.");
  if (chat.running) throw new Error("The council is already running.");
  const text = String(message || "").trim();
  if (text.length < 3) throw new Error("Give the Chair a real question.");

  const first = !chat.sessionId;
  const prompt = buildPrompt(text, { quick, seats, all, first });

  if (model) chat.model = model;
  chat.running = true;
  chat.error = null;
  chat.startedAt = Date.now();
  chat.steps = 0;
  chat.cost = 0;
  chat.tokens = { input: 0, output: 0 };

  const userMessage = { role: "user", text, ts: Date.now() };
  chat.messages.push(userMessage);
  emit({ type: "user", message: userMessage });
  emit({ type: "start", startedAt: chat.startedAt, model: chat.model });

  const args = ["run", "--standalone", "--auto", "--format", "json"];
  if (chat.sessionId) args.push("--session", chat.sessionId);
  if (chat.model) args.push("-m", chat.model);
  args.push(prompt);

  let child;
  try {
    child = spawn(BIN, args, { cwd: REPO_ROOT, env: process.env });
  } catch (e) {
    chat.running = false;
    chat.error = e.message;
    emit({ type: "error", error: chat.error });
    emit({ type: "done", code: -1, sessionId: chat.sessionId });
    throw e;
  }
  chat.child = child;

  let assistant = null;
  const parts = new Map();
  let stderr = "";

  const flushAssistant = () => {
    if (!assistant) {
      assistant = { role: "assistant", text: "", ts: Date.now() };
      chat.messages.push(assistant);
    }
    assistant.text = [...parts.values()].join("\n\n");
    emit({ type: "text", text: assistant.text });
  };

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let ev;
    try { ev = JSON.parse(line); } catch { return; }
    if (ev.sessionID && chat.sessionId !== ev.sessionID) {
      chat.sessionId = ev.sessionID;
      emit({ type: "session", sessionId: ev.sessionID });
    }
    if (ev.type === "step_start") {
      chat.steps += 1;
      emit({ type: "step", steps: chat.steps });
      return;
    }
    if (ev.type === "text") {
      const id = ev.part?.id || "text";
      const next = partText(ev.part?.text);
      const before = parts.get(id) || "";
      // OpenCode usually sends a complete part. Keep deltas working too.
      parts.set(id, next.startsWith(before) ? next : before + next);
      flushAssistant();
      return;
    }
    if (ev.type === "tool_use") {
      const part = ev.part || {};
      const s = part.state || {};
      emit({
        type: "tool",
        tool: part.tool || "tool",
        status: s.status || "",
        agent: s.input?.agent || "",
        description: s.input?.description || "",
      });
      return;
    }
    if (ev.type === "step_finish") {
      const p = ev.part || {};
      chat.cost += Number(p.cost) || 0;
      chat.tokens.input += Number(p.tokens?.input) || 0;
      chat.tokens.output += Number(p.tokens?.output) || 0;
      emit({ type: "usage", cost: chat.cost, tokens: { ...chat.tokens } });
    }
  });

  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("error", (err) => {
    chat.running = false;
    chat.child = null;
    chat.error = err.message;
    emit({ type: "error", error: chat.error });
    emit({ type: "done", code: -1, sessionId: chat.sessionId });
  });
  child.on("close", (code) => {
    if (!chat.running) return;
    chat.running = false;
    chat.child = null;
    if (code !== 0 && code !== null) {
      chat.error = stderr.trim().split(/\r?\n/).slice(-3).join(" ") || `opencode exited with code ${code}`;
      emit({ type: "error", error: chat.error });
    }
    emit({ type: "done", code, sessionId: chat.sessionId });
  });
}

export function stop() {
  if (chat.child) chat.child.kill("SIGTERM");
}

export function reset() {
  if (chat.running) throw new Error("Stop the running council first.");
  chat.sessionId = null;
  chat.messages = [];
  chat.error = null;
  chat.startedAt = null;
  chat.steps = 0;
  chat.cost = 0;
  chat.tokens = { input: 0, output: 0 };
  emit({ type: "reset" });
}
