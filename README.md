# Portfolio

Chenyue "xdd44" Dai's portfolio, built with Astro and exported as a static website.

## Local development

The portfolio requires Node.js 22.23.4 or newer. **The Human Option chat also requires [uv](https://docs.astral.sh/uv/getting-started/installation/)** to install Python dependencies and run its backend. `npm run dev` starts only the website; chat needs both servers below.

### First-time setup

From the repository root (`Portfolio`), install the website dependencies:

```sh
npm ci
```

For chat, follow the backend README's [private environment and prompt setup](server/thehumanoption/README.md#try-it-locally). Keep existing `.env` and prompt files; do not overwrite them with examples. Then install Python and the backend dependencies:

```sh
cd server/thehumanoption
uv python install 3.12
uv sync --python 3.12 --frozen
```

`uv` manages a separate Python environment here, so you do not need to replace your system Python. Run `uv sync --frozen` again after backend dependency updates, including the new photo-preview dependency, Pillow.

### Start local development

Terminal 1 — from the repository root, start the chat backend:

```sh
cd server/thehumanoption
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
```

Terminal 2 — from the repository root, start the website:

```sh
npm run dev
```

Keep both terminals running. The website is at **http://localhost:4321** and chat is at **http://localhost:4321/thehumanoption**. Astro forwards `/api` requests to the backend on port 8787. For portfolio-only work, terminal 2 is enough.

Stop either server with Ctrl+C. Code changes reload automatically. Restart the backend after editing its `.env`, `prompt.md`, or `prompts/theme.md`; restart the website after changing the root `.env`. If Astro chooses another port, update the backend's `ALLOWED_ORIGINS` accordingly. Local chat still uses real provider credits and needs network access for verification and image search.

Private run logging is enabled for the experiment. From the repository root, use `tail -F server/thehumanoption/evaluation/runs.jsonl` to follow the three agents' activity, generated prompts, conversation, photo decisions, timing, and costs. See [private run evaluation](server/thehumanoption/README.md#private-run-evaluation) for production paths, rotation, and logging controls.

### Production build preview

These commands preview the static website; use the development commands above for chat and its API proxy:

```sh
npm run build
npm run preview
```

## Editing content

- `src/pages/`: pages and routes.
- `src/layouts/` and `src/components/`: shared UI.
- `src/data/projects.ts`: homepage project cards.
- `public/`: assets and standalone APD, Bahrain, and Feral pages.

For a new project, copy a neighboring `.astro` page and add its card to `src/data/projects.ts`.

## Deployment

Pushes to `master` build and deploy `dist/` through GitHub Actions. The workflow also supports manual runs and verifies the live homepage after uploading.

Connection details use repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`.

The Human Option backend deploys separately through the same workflow when `server/thehumanoption/` changes. Before deploying the new photo flow to an existing server, follow [the backend upgrade steps](server/thehumanoption/README.md#upgrading-an-existing-deployment): privately provision `/etc/thehumanoption/theme.md` and set `THEME_PROMPT_PATH` in `/etc/thehumanoption/env`. The deployment intentionally excludes private prompts and cannot install them. CI runs `uv sync --frozen --no-dev` for dependencies and restarts the service. See the [backend README](server/thehumanoption/README.md#vm-setup) for first-time VM setup and backend deployment secrets.

## Notice

All photos and projects contained on this site are works of Chenyue "xdd44" DAI. All rights reserved.
