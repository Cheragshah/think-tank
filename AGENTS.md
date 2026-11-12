# Think Tank

This project is the Think Tank: a council of simulated advisors that debates a founder's business decision. Twelve core seats ship with it: a default board of seven (Bezos, Paul Graham, Hormozi, Gary Vaynerchuk, Dan Martell, Gino Wickman, Buffett) and five on call (Naval Ravikant, Codie Sanchez, Leila Hormozi, Sara Blakely, Elon Musk). Six newer seats are on call and marked provisional while their full source-backed brains build (Ambani, Nikhil Kamath, Steven Bartlett, Tony Robbins, Joe Dispenza, John Demartini). Modi's full source-backed brain is built and the seat is complete. Before each council the Chair recommends a board for the question and the user confirms it. The user can add more advisors.

- When the user brings a decision ("should I...", pricing, hiring, raising money, a new product, a pivot), load `@think-tank`. For a quick question to one advisor, use `@think-tank ask <seat> ...`.
- Every advisor and the default board live in `.claude/skills/think-tank/roster.json`. When the user wants to add an advisor ("add Naval", "I want X on my board"), load `@new-thinker`. When they want to change who sits at the table by default, or be asked each time, use `@think-tank board`.
- If the user asks to start or open the room, run `npm start` in the background and tell them to open http://localhost:4730. It needs Node 20 or newer and nothing else.
- Councils are saved in `sessions/<date>-<decision>/`. The room plays them live as those files land. Follow `.claude/skills/think-tank/references/live-room.md` exactly so the room can read them.
- The seats are simulations built from public work. Never present a seat's words as something the real person said unless it is a verbatim quote with a source id from that seat's brain.
- Write the Chair's parts in plain English: short sentences, no hype, no filler. Keep the verdict in chat short enough to decide from at a glance; the full report goes in `verdict.md`, and the room's "Download PDF" button turns it into a branded PDF.

## OpenCode

- The skills are discovered from `.claude/skills/`; invoke them as `@think-tank` and `@new-thinker`.
- The seats are OpenCode subagents in `.opencode/agents/`, generated from the `.claude/agents/` sources by `npm run opencode:sync`. Run that after adding or editing a seat, then start a new session (or run `/reload`).
- Ask the user with the `question` tool, and spawn seats with the `subagent` tool (`agent: council-<seat>`).
- The room at `http://localhost:4730` has a chat panel that starts `opencode run` in this folder. It is a second way to run the same skill, not a separate council implementation.
- The top-bar Leaders menu lists every seat and its build state. Adding a leader by name creates a provisional seat and starts a deep research build in the background; no other details are required.
- New seats get a real-photo avatar fallback automatically. The room uses `app/lib/avatars.mjs` and `.claude/skills/new-thinker/scripts/make-avatar.py`; the deep build uses the same script when no `KIE_AI_API_KEY` is set. Photo credits live in `app/public/portraits/CREDITS.md`.
