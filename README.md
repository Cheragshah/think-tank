# Think Tank

<p align="center"><img src="app/public/brand/think-tank-mark.svg" alt="Think Tank" width="96"></p>
<p align="center"><strong>Pressure-test the decision before you make it.</strong></p>

Bring a hard business decision and a council of AI advisors argues it out, then hands you a scored verdict and a one-click PDF. Twelve core advisors ship with it, plus seven new seats that are being upgraded to full source-backed brains. For each question, the Chair recommends who should sit on the council and you confirm. The council runs in Claude Code or OpenCode, and a small local web app shows them around a table talking it through. Want someone else at the table? Use the `new-thinker` skill with a name, and the agent builds that advisor the same way.

| Seat | Pillar | The question they own |
|---|---|---|
| Jeff Bezos | Strategy and decisions | Is this the right bet, and how reversible is it? |
| Paul Graham | Product and startups | Do people actually want this, and is it growing? |
| Alex Hormozi | Offers, pricing, and sales | Will people pay, how much, and how do we close? |
| Gary Vaynerchuk | Marketing and attention | Where does the attention come from? |
| Dan Martell | People, hiring, and founder time | Who does this, and what does it cost your calendar? |
| Gino Wickman | Operations and scaling | Can the business run this without you holding it together? |
| Warren Buffett | Money and capital | What does it do to cash, risk, and long-term value? |

Those seven are the **default board**. Five more advisors are on call, and the Chair brings them in when your question is in their lane:

| Seat | Pillar | The question they own |
|---|---|---|
| Naval Ravikant | Leverage and wealth | Does this build leverage and equity you own, or does it just rent out your time? |
| Codie Sanchez | Buying and owning small businesses | Should you build this, or buy something that already works? |
| Leila Hormozi | Leadership and scaling teams | Can your team and your leadership carry this, and who has to change? |
| Sara Blakely | Consumer product and brand from zero | Will customers love it enough to sell it for you, without outside money? |
| Elon Musk | First principles and execution speed | What is the real constraint here, and can we cut steps and build it faster? |

Seven new seats are installed on call and appear in the picker. **Modi's full source-backed brain is built.** The other six are **provisional** while their builds finish:

| Seat | Pillar | The question they own |
|---|---|---|
| Narendra Modi | Political leadership and national-scale execution | Can this be executed at scale, and what does it do to your political and regulatory capital? |
| Mukesh Ambani | Scale, capital, and conglomerate strategy | Can this scale, and what does it do to capital and regulatory risk? |
| Nikhil Kamath | Investing and capital allocation | Is this a good business at this price, and what is the downside? |
| Steven Bartlett | Audience, content, and personal brand | Will the story travel, and can you build an audience around it? |
| Tony Robbins | Performance, influence, and sales psychology | What is the psychological blocker, and how do you move people to action? |
| Joe Dispenza | Mindset, identity, and behavior change | What identity and belief is driving this, and how do you change it? |
| John Demartini | Values, human behavior, and decision-making | What does your value hierarchy say, and what are you not seeing? |

The picker marks each unfinished seat **building**. A standard-depth build runs in the background and replaces the provisional brain, agent, and roster entry when it finishes. Reload the room after a build completes to see the finished seat.

New leaders get a **real photo avatar** automatically. The room looks for a public photo on Wikipedia/Wikimedia, crops it into a square avatar, and shows the actual person instead of a drawn placeholder. If Wikipedia has no photo, the deep build finds an official photo during the portrait step. Add `KIE_AI_API_KEY` if you want the original cartoon treatment. The photo sources are listed in `app/public/portraits/CREDITS.md`.

The **Leaders** button in the top bar lists every seat, marks provisional ones **building**, and lets you tick leaders for the next council. Type a name under **Add a leader by name** and the room creates a provisional seat immediately, then runs a **deep research** build in the background. A name is the only input required; the deep build infers the pillar, the question the seat owns, and the scorecard dimension from that person's public work.

## Deploy online

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Cheragshah/think-tank)

The full app runs on **Render** with a Docker service and a persistent disk. See [DEPLOY.md](DEPLOY.md) for the Blueprint, environment variables, password gate, and model keys.

Vercel can host a read-only viewer of the seats, avatars, and saved sessions, but it cannot run the chat, add a leader, or perform deep research. Those need a writable disk and the OpenCode CLI, which Vercel's serverless functions do not provide.

## What you need

- [Claude Code](https://claude.com/claude-code) or [OpenCode](https://opencode.ai). Your plan covers it; no API key needed.
- [Node.js](https://nodejs.org) 20 or newer, for the room. There's nothing to install beyond that.

## Setup

This is your local Think Tank install. Run every command from this folder. It needs Node 20+ and OpenCode (or Claude Code); no API key is required.

```bash
npm run opencode:sync
npm start
```

## Run in OpenCode

The Think Tank runs in OpenCode from this folder. OpenCode reads the skills from `.claude/skills/` directly and loads the seats from `.opencode/agents/`.

1. Generate the OpenCode agents: `npm run opencode:sync` (one time, and again after adding an advisor).
2. Start the room: `npm start`, then open http://localhost:4730. Leave it open.
3. Click **Chat with the Chair** in the room, or **Chat** in the top bar.
4. Type your decision and press **Send**. Pick **Quick council** for a smaller call, and optionally choose a model.
5. To pick the leaders yourself, click **Who should we select?** above the message box. Leave it empty to let the Chair recommend a board, tick specific seats, or choose **Everyone**. The picker locks once the conversation starts; click **New question** to change it.

The room runs the council through your local OpenCode setup. The Chair writes the council into `sessions/` as it goes, so the room plays it live, and the chat keeps the conversation for follow-ups. Follow-ups continue the same OpenCode session, so you can say "ask Buffett about the churn risk" after the verdict.

The chat runs OpenCode non-interactively (`opencode run --auto`). It asks the Chair to pick the recommended board and state assumptions instead of stopping for questions. Use the OpenCode terminal if you want to answer the Chair's questions yourself: run `opencode` in this folder and type `@think-tank` plus your decision.

The skills keep the same IDs in both runtimes: `think-tank` and `new-thinker`. The only maintenance step is the agent sync. `.claude/agents/` stays the source of truth (the room app and `@new-thinker` read it), and `npm run opencode:sync` rewrites the frontmatter into the OpenCode subagent format. After adding a seat, run the sync and start a new session or run `/reload`; `@new-thinker` runs the sync for you. `npm run opencode:check` fails if `.opencode/agents/` is stale.

The optional API runner in `.env` (`COUNCIL_RUNNER=api`) still calls Anthropic directly and is independent of OpenCode. Set `COUNCIL_RUNNER=viewer` to keep the room as a pure viewer.

## Run a council

1. Start the room: `npm start`, then open http://localhost:4730. Leave it open.
2. Open Claude Code in the same folder: `claude`
3. Type `/think-tank` and your decision.
4. Answer the Chair's questions, then watch the council argue it out in the room.
5. When the verdict lands, click **Download PDF**.

You also get a short verdict in Claude Code, and the full report lands in `sessions/<date>-<decision>/verdict.md`.

## What to put in your question

The council is only as good as what you give it. Include:

- **The decision** in one line.
- **Your options.** Two or three. "Keep doing what I do now" counts.
- **Your numbers.** Revenue, cash, and team size.
- **Your limits.** Deadline, hours, and budget.
- **What success looks like**, and by when.
- **Which way you're leaning**, and why. The council tests your lean instead of agreeing with it.

Left something out? The Chair asks before the council starts. Example:

```
/think-tank I run a coaching business at $30k a month with 15 clients at $2,000 each.
Should I raise to $3,500 for everyone, raise for new clients only, or keep $2,000?
Close rate is about 50% and I have $40k in the bank. Success is $45k a month by March.
I'm leaning toward raising for everyone because I'm underpaid.
```

More ways to run it:

- `/think-tank --quick ...` seats four advisors for two rounds. Use it for smaller, reversible calls. It uses far less of your plan.
- `/think-tank --seats hormozi,buffett ...` seats only the advisors you name.
- `/think-tank ask hormozi ...` gets one answer from one seat.
- `/think-tank --all ...` seats every advisor you have (up to nine).
- `/think-tank board` shows who sits at the table by default and lets you change it.

The room is optional. The council runs the same in Claude Code or OpenCode without it.

## Choose who sits at the table

When you run `/think-tank`, the Chair reads your question and recommends a council from every advisor you have, with one line on why each one fits. You pick:

- **Recommended board**: the five to seven advisors the Chair picked for this question.
- **Default board**: your usual seven.
- **Everyone**: all of them, when you have nine or fewer.
- **Other**: type changes, like "recommended, but add Naval and drop Wickman".

A pricing question might get Hormozi, Buffett, Codie Sanchez, Sara Blakely, and Graham. A hiring question might get Leila Hormozi, Martell, Wickman, Naval, and Buffett. Every council keeps a seat that guards your downside and one that's likely to disagree, so the room argues instead of nodding.

How the board gets picked is a setting in `.claude/skills/think-tank/roster.json`:

```json
{
  "board": "ask",
  "default": ["bezos", "graham", "hormozi", "garyvee", "martell", "wickman", "buffett"],
  "seats": [ ...every advisor you have... ]
}
```

| Setting | What happens on every `/think-tank` |
|---|---|
| `"ask"` (out of the box) | The Chair recommends a council and asks you to confirm it. |
| `"auto"` | The Chair picks the council and tells you who and why, without asking. |
| `"default"` | Your default board sits every time. No question. |

You don't need to edit the file by hand. Type `/think-tank board` and say what you want: "put Naval on my default board", "take Gary V off", or "stop asking me, just use my default board".

Skip the question on any run: `--seats hormozi,naval,buffett` seats exactly those advisors, and `--all` seats everyone (up to nine). `--quick` recommends four.

In the room's chat, click **Who should we select?** for the same choice. Tick the seats you want, choose **Everyone**, or leave it empty for the Chair's recommendation. The default board itself still lives in `roster.json` and changes with `@think-tank board`.

## Add your own advisor

```
@new-thinker Morgan Housel
```

In the room's chat, click **+ Build a new advisor** and fill in the name, pillar, and question. The rest of the build runs the same way.

The skill builds a new seat the way the original seven were built:

1. **Asks two or three questions**: the business pillar and question the advisor owns (it suggests one), whether they join your default board, and how deep to go.
2. **Finds their public work**: essays, letters, talks, long interviews, and podcasts where they are the main speaker.
3. **Fetches it** into `build/<name>/`, a local folder git ignores. Web pages become text and YouTube videos become transcripts.
4. **Extracts how they think**: parallel sub-agents read every source and pull out their frameworks, rules, positions, stories, and voice, with verbatim quotes.
5. **Writes the brain** (`.claude/skills/think-tank/brains/<name>/`) and checks that every quote is word for word in the source it cites.
6. **Writes the advisor's agent** (`.claude/agents/council-<name>.md`, then syncs it to `.opencode/agents/`) and adds them to `roster.json`.
7. **Makes their portrait** for the room from a real photo, in the same cartoon style as the other advisors.
8. **Tests the new seat** on a sample question, then tells you how to use it.

| Depth | Sources | Good for |
|---|---|---|
| `--quick` | 12 to 20 | Trying someone out |
| default | 30 to 50 | An advisor you'll use |
| `--deep` | 80+ | Matching the original seven |

A standard build is about 8 to 10 sub-agent runs, so it uses a real share of your plan. When it finishes, open a new Claude Code or OpenCode session so the advisor loads as its own agent (the council works before that too). Then use them like anyone else: `/think-tank ask housel ...`, `/think-tank --seats housel,buffett,hormozi ...`, or put them on your default board. The Chair also starts recommending them when a question fits their pillar.

You can build an advisor from public figures, living or historical, with a real body of public work, or from your own material (your posts, transcripts, notes) if you want yourself or a consenting mentor on the board. The raw sources stay on your machine; only the brain, which holds short quotes and paraphrase, is meant to be committed.

**Their face in the room:** `/new-thinker` also makes the new advisor's cartoon portrait, the same way the original seven were made. It finds a real photo of the person, turns it into the same 3D cartoon style (using one of the existing cartoons as the style reference), picks the closest likeness, and makes the talking frames (mouth open, mouth "oh", and a blink). This step needs a [kie.ai](https://kie.ai/api-key) key in `.env` (`KIE_AI_API_KEY=`, about 5 image jobs per advisor) and Python with `opencv-python` (Claude installs it if it's missing). Without a key the advisor still works and shows a placeholder face; add a key later and run `/new-thinker portrait <name>`.

YouTube transcripts and photos work best with [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed, and PDFs need `pdftotext` ([Poppler](https://poppler.freedesktop.org)). Both are optional: without them, Claude falls back to YouTube's own captions and reads PDFs itself.

## Watch an example first

Run `npm start`, open http://localhost:4730, and click **Past sessions**. Three finished councils ship with the repo, so you can see how it works (and download their PDFs) before you run your own.

## How it works

- **The council runs in Claude Code or OpenCode.** Each seat is a sub-agent (`.claude/agents/council-*.md`, synced to `.opencode/agents/` and listed in `roster.json`) that reads its own brain (`.claude/skills/think-tank/brains/<name>/`): frameworks, principles, positions, stories, and voice notes compiled from public sources, with every quote tied to a source. Claude Code acts as the Chair. It runs the rounds, keeps score, and writes the verdict (`.claude/skills/think-tank/SKILL.md`).
- **Each seat scores every option**, weighted by how much that seat's pillar matters to your decision. The Chair caps the verdict when a seat flags ruin risk, and it forces a real argument when everyone agrees too fast.
- **The room watches, and can start the council.** As the Chair works, it writes each step to `sessions/`, and the app plays those files back. Between rounds it shows which round is running, how long it has been, and what each advisor is weighing. The chat panel runs `opencode run` in this folder and then plays the files as they land. In viewer mode the room makes no AI calls of its own.
- **Every council is saved** in `sessions/`. Past sessions replays any of them and downloads its PDF.
- **Usage:** a full council is three sub-agent runs per seat (21 for seven), so it takes a real bite out of your plan's usage. Use `--quick` for small calls.

## Optional: let the room run councils itself

If you'd rather type a decision straight into the room, copy `.env.example` to `.env`, add an `ANTHROPIC_API_KEY`, set `COUNCIL_RUNNER=api`, and restart `npm start`. That mode bills your Anthropic API account (about 25 calls per full council).

## What's inside

| Path | What |
|---|---|
| `.claude/skills/think-tank/` | The council skill: protocol, prompts, scoring, report template, and one brain per advisor |
| `.claude/skills/think-tank/roster.json` | Every advisor, your default board, and how the board is picked |
| `.claude/skills/new-thinker/` | The `/new-thinker` skill and its scripts: fetch sources, check quotes, register a seat |
| `.claude/agents/` | One agent per advisor (`council-<name>.md`), the source both runtimes read |
| `.opencode/agents/` | The same seats converted to the OpenCode subagent format by `npm run opencode:sync` |
| `scripts/sync-opencode-agents.mjs` | Generates `.opencode/agents/`; `--check` verifies it is current |
| `app/` | The room: a zero-dependency Node server, the web page, and the PDF builder |
| `sessions/` | Your councils (kept out of git) and the three examples |
| `build/` | Raw sources `/new-thinker` fetched (kept out of git) |

## About the advisors

These are simulations built from each person's public work, and so is any advisor you add. They are not the people, they don't speak for them, and none of them is affiliated with or endorses this project. A seat only quotes a person verbatim when the line is in its brain with a source, and `python .claude/skills/think-tank/scripts/check_quotes.py sessions/<session>` checks every quote in a council against the brains. Each brain's `sources.md` lists what it was built from.

Built on an MIT-licensed open-source council protocol by AI Automation Society. The code is MIT licensed; see `LICENSE`. The PDF builder bundles [jsPDF](https://github.com/parallax/jsPDF) (MIT) and [Montserrat](https://github.com/JulietaUla/Montserrat) (SIL Open Font License); their licenses sit next to them in `app/public/`.
