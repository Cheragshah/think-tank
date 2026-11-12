// Real-photo avatar fallback for seats that do not have a cartoon portrait yet.
//
// The room's preferred portraits are the four talking frames made by the
// new-thinker portrait pipeline. When that pipeline has no kie.ai key, or a
// leader is added from the room, this module finds a public photo, crops it, and
// writes <key>-base.jpg so the seat shows the actual person instead of a drawn
// placeholder.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./env.mjs";

const PORTRAITS = path.join(REPO_ROOT, "app", "public", "portraits");
const TEMP = path.join(REPO_ROOT, "build", "avatars");
const SCRIPT = path.join(REPO_ROOT, ".claude", "skills", "new-thinker", "scripts", "make-avatar.py");
const CREDITS = path.join(PORTRAITS, "CREDITS.md");
const UA = "ThinkTank/1.0 (local avatar fallback)";

function existingAvatar(key) {
  return ["webp", "png", "jpg", "jpeg"].some((ext) => fs.existsSync(path.join(PORTRAITS, `${key}-base.${ext}`)));
}

async function wikiJson(params) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ ...params, format: "json", origin: "*" }).toString();
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  return res.json();
}

function tokens(value) {
  return String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
}

function confident(title, name) {
  const titleTokens = new Set(tokens(title));
  const wanted = tokens(name).filter((t) => t.length > 2 && !["dr", "mr", "mrs", "ms", "prof", "sir", "the"].includes(t));
  return wanted.length > 0 && wanted.every((t) => titleTokens.has(t));
}

async function wikiImage(name) {
  let page = null;
  const exact = await wikiJson({
    action: "query", titles: name, redirects: "1", prop: "pageimages",
    piprop: "thumbnail|original", pithumbsize: "900",
  });
  page = Object.values(exact?.query?.pages || {})[0];

  if (!page || (!page.thumbnail && !page.original)) {
    const search = await wikiJson({
      action: "query", generator: "search", gsrsearch: name, gsrlimit: "1",
      prop: "pageimages", piprop: "thumbnail|original", pithumbsize: "900",
    });
    page = Object.values(search?.query?.pages || {})[0];
  }

  if (!page) return null;
  // Never use a photo for a different person. A search for "John Demartini"
  // must not return Warren DeMartini, and "Joe Dispenza" must not return a film.
  if (!confident(page.title, name)) return null;
  const source = page.thumbnail?.source || page.original?.source;
  if (!source) return null;
  const clean = source.split("?")[0];
  if (!/\.(jpe?g|png|webp)$/i.test(clean)) return null;
  return {
    url: clean,
    title: page.title,
    page: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, "_"))}`,
  };
}

export async function ensureAvatar(name, key) {
  if (existingAvatar(key)) return true;
  try {
    const found = await wikiImage(name);
    if (!found) return false;
    fs.mkdirSync(TEMP, { recursive: true });
    fs.mkdirSync(PORTRAITS, { recursive: true });
    const ext = found.url.match(/\.(jpe?g|png|webp)$/i)[0].toLowerCase().replace("jpeg", "jpg");
    const source = path.join(TEMP, `${key}.${ext}`);
    const res = await fetch(found.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return false;
    fs.writeFileSync(source, Buffer.from(await res.arrayBuffer()));
    const output = path.join(PORTRAITS, `${key}-base.jpg`);
    const run = spawnSync("python3", [SCRIPT, source, output], { cwd: REPO_ROOT, encoding: "utf8" });
    if (run.status !== 0 || !fs.existsSync(output)) return false;
    const line = `- ${name}: [${found.title}](${found.page}) via Wikipedia/Wikimedia\n`;
    const credits = fs.existsSync(CREDITS) ? fs.readFileSync(CREDITS, "utf8") : "# Portrait credits\n\n";
    if (!credits.includes(line)) fs.appendFileSync(CREDITS, line);
    return true;
  } catch {
    return false;
  }
}
