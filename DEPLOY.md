# Deploy Think Tank

The full app runs on **Render** with a Docker web service and a persistent disk. Vercel cannot run the full app because it has no persistent filesystem, cannot run the local `opencode` process, and cannot keep long council or deep-research jobs alive.

## Why Render

The room needs to:

- write `sessions/`, `build/`, the roster, brains, agents, and avatars
- spawn `opencode run` for council chat and deep research
- keep an SSE stream open while a council is running
- survive a deploy without losing the seats and councils

Render's Docker service plus a disk provides all four. A small VPS works the same way. Vercel is suitable only for a read-only viewer that ships prebuilt session data.

## Deploy from this repo

The repo includes `render.yaml`, `Dockerfile`, and `scripts/render-boot.sh`.

1. Push the repo to GitHub (the public repo is `Cheragshah/think-tank`).
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render reads `render.yaml` and creates:
   - a Docker web service named `think-tank`
   - a 5 GB disk mounted at `/data`
   - a health check at `/healthz`
4. When prompted, set:
   - **APP_PASSWORD**: the shared password for the site
   - **DEEPSEEK_API_KEY**: the key for the default leader model
   - **KIE_AI_API_KEY**: optional, for the cartoon portrait pipeline
5. Deploy. Open the Render URL. The browser asks for:
   - username: `think-tank` (or your `APP_USER`)
   - password: your `APP_PASSWORD`

The app listens on Render's `PORT` and `0.0.0.0`. The boot script moves mutable data to `/data` and seeds it from the image on first boot. Later deploys keep the disk data.

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_PASSWORD` | Shared password. Leave blank locally; set it for any public deployment. |
| `APP_USER` | Basic Auth username, default `think-tank`. |
| `LEADER_MODEL` | Model for background deep research, default `deepseek/deepseek-v4-pro`. |
| `DEEPSEEK_API_KEY` | Provider key for DeepSeek models. |
| `KIE_AI_API_KEY` | Optional, for the cartoon portrait pipeline. |
| `DATA_DIR` | Disk mount, default `/data` in the Docker image. |
| `COUNCIL_RUNNER` | `opencode` (default when the CLI exists), `viewer`, or `api`. |

The chat model list comes from `opencode models`. Add another provider key (for example `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) in the Render dashboard if you want those models in the picker, and change `LEADER_MODEL` to match.

## Plans

`render.yaml` uses Render's **Starter** plan so the disk is available. The app, the OpenCode CLI, Python, and image processing can be tight in 512 MB. If a deep-research build is killed for memory, switch the service to **Standard**.

Deep research runs inside the web service. Keep the service awake; a sleeping instance cannot finish a build.

## Local development

```bash
npm run opencode:sync
npm start
```

Optional local password:

```bash
APP_PASSWORD=your-password npm start
```

## Data and resets

Everything mutable lives on `/data`:

- `sessions/`
- `build/`
- `brains/`
- `agents/` and `opencode-agents/`
- `roster.json`
- `seats.md`
- `portraits/`

The image seeds this data on first boot. If you add new core seats or portraits to a later image, an existing disk will not merge them automatically. Delete the disk (or copy the new files into it) to reseed.

## Vercel

If you want a public demo on Vercel, deploy a **viewer-only** build: precompute `seats` and `sessions` JSON, copy the portraits and example sessions, and disable chat, add-leader, and deep research. Do not deploy the current server to Vercel and expect the chat or builds to work.
