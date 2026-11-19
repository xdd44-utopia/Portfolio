# The Human Option — build plan

A free, public chat page for an art experiment.

- **Page:** `https://xdd44.xyz/thehumanoption`
- **API:** `https://xdd44.xyz/api/chat`

Both are served by the existing Google VM and nginx. The API key, the real prompt and the agent setup stay on the server.

Status: **historical draft.** The implementation has since changed, including provider order and conversation storage. See [the backend README](server/thehumanoption/README.md) for current behavior, setup, and deployment instructions. The proposals and open decisions below are retained for reference.

---

## 1. What a visitor experiences

1. They open `/thehumanoption`. Turnstile checks them invisibly; most people never see a challenge.
2. They type a message. The reply streams in word by word. While the agent works, the page can show a short status such as "thinking…" or "looking things up…".
3. Replies can include images found online. Each image shows its credit and license.
4. When a limit is hit, the page shows a message written for the piece, never a raw error. Cases:
   - the visitor sent too many messages
   - the conversation got too long
   - the day's budget is used up
   - the piece is switched off
   - both AI providers are down
5. Closing the tab ends the conversation. Nothing is kept long-term in this version (see §8).

---

## 2. Architecture

```
Browser (/thehumanoption, static page built by Astro)
   │  POST /api/chat/...   (same domain, so no CORS)
   ▼
nginx (existing)  ── burst limit, connection limit, body size cap
   │  proxy to 127.0.0.1:8787 (not reachable from outside)
   ▼
Python backend (FastAPI + Pydantic AI, systemd service)
   ├─ Turnstile check  → signed session cookie
   ├─ limits & budget  → SQLite file on the VM
   ├─ conversation     → kept server-side, per session
   └─ Agent
        ├─ Claude (primary) ──fallback──► OpenAI
        ├─ provider-run tools: web search, web fetch (Claude only)
        └─ local tools: find_images (Openverse / Wikimedia), calculate
```

### Why each piece

- **Python + Pydantic AI.** Fallback from Claude to OpenAI is built in. Provider-run tools are declared once and mapped per provider. Conversations serialize to plain data, so saving them later is a small change.
- **FastAPI + uvicorn.** This is Pydantic AI's natural host, and it streams replies with Server-Sent Events.
- **The conversation lives on the server, not in the browser.** The browser only ever sees final text, images and status. Thinking, tool calls and search results never leave the server. Visitors also can't forge earlier turns or send a huge fake history.
- **SQLite.** One file holds sessions, conversations, rate counters and the spend log. It survives restarts and needs no database server.

### The repo is public

The repo on GitHub is **public**. The real system prompt and the agent configuration must never be committed.

- The repo holds the backend code and a **placeholder** prompt only.
- The real prompt lives on the VM at `/etc/thehumanoption/prompt.md` and is read at startup.

---

## 3. Repo layout

```
server/thehumanoption/          # new, not touched by Astro
  pyproject.toml                # deps pinned (pydantic-ai, fastapi, uvicorn, httpx, simpleeval)
  app/
    main.py                     # FastAPI app, routes
    agent.py                    # Pydantic AI agent, models, fallback, tools wiring
    tools/images.py             # find_images: Openverse + Wikimedia Commons
    tools/calculate.py          # safe expression evaluator
    turnstile.py                # siteverify call
    session.py                  # signed cookie, session lookup
    limits.py                   # per-session / per-IP / global budget / concurrency
    store.py                    # SQLite access
    config.py                   # env + prompt file loading
  prompt.example.md             # placeholder; real prompt only on the VM
  deploy/
    thehumanoption.service      # systemd unit
    nginx-snippet.conf          # reference copy of the nginx block
src/pages/thehumanoption.astro  # the chat page
public/css/thehumanoption.css   # (+ _mobile.css, matching site convention)
public/js/thehumanoption.js     # chat client (or inline <script> in the .astro page)
```

`thehumanoption.astro` builds to `dist/thehumanoption.html`. nginx's existing `try_files $uri $uri.html` already serves that at `/thehumanoption`.

---

## 4. API

All routes sit under `/api/chat`. They only accept JSON or event-stream content.

| Route | Purpose |
|---|---|
| `GET  /api/chat/status` | Is the piece open? Returns `open`, `closed_for_today` or `off`. The page calls this on load to decide what to show. |
| `POST /api/chat/session` | Body: Turnstile token. The server verifies it with Cloudflare and sets an HttpOnly, Secure, SameSite=Strict signed cookie. A session lasts up to N hours. |
| `POST /api/chat` | Body: `{ message }`. Requires the session cookie. Streams the reply as SSE (event types below). |
| `POST /api/chat/reset` | Starts a new conversation within the same session. |

SSE events sent to the browser:

| Event | Meaning |
|---|---|
| `status` | A deliberately vague label (`thinking`, `searching`, `finding_images`, `calculating`). See decision D4. |
| `text` | Next chunk of reply text. |
| `images` | `[{ url, thumbnail, title, creator, license, license_url, source_url }]` |
| `done` | End of the reply. Carries `remaining_messages`. |
| `error` | `{ code }`, one of `rate_limited`, `conversation_full`, `budget_exhausted`, `off`, `unavailable`, `turnstile_required`. The page maps each code to its own message. |

Turnstile tokens are single-use and expire after 5 minutes. That's why the token is exchanged once for a session cookie instead of being sent with every message. When the session expires, the page re-runs Turnstile silently and retries the message.

---

## 5. Agent

- **Models.** Claude first, OpenAI as automatic fallback when Claude errors, times out or is overloaded. Exact models are decision D1.
- **Prompt.** Read from `/etc/thehumanoption/prompt.md`. Kept stable between messages so prompt caching makes repeat context cheap.
- **Tools:**

| Tool | Runs on | Limits |
|---|---|---|
| Web search | Provider (Claude / OpenAI) | Max searches per reply (default 3). Optional blocked-domain list. |
| Web fetch (read a page) | Provider (Claude only; absent after fallback) | Max fetches per reply (default 2). |
| `find_images` | Our backend → Openverse API (CC-licensed), Wikimedia Commons as backup | Max 6 images per call. Returns license and credit. Free Openverse API key for higher limits. |
| `calculate` | Our backend, using `simpleeval` (no code execution, arithmetic and math functions only) | Expression length cap, timeout. |

- **Thinking.** Uses the models' built-in thinking. Only the status label reaches the browser, never the reasoning text.
- **Not in this version: a provider-run code sandbox.** It can be added later as a provider tool; nothing runs visitor-driven code on the VM.
- **Note on fallback.** After a fallback, the persona's voice may shift a little and the agent can't read specific web pages. The page doesn't announce this unless decision D5 says otherwise.

Exact Pydantic AI class and argument names get checked against the current docs at build time.

---

## 6. Limits and spend control

Layered from outermost to innermost. Numbers are starting defaults, to tune later (decision D2).

| Layer | Where | Default |
|---|---|---|
| Provider spend cap | Anthropic and OpenAI consoles | Set a monthly hard cap on both before launch |
| Burst limit per IP | nginx `limit_req` | 10 requests/min, burst 5 |
| Open connections per IP | nginx `limit_conn` | 3 |
| Request body size | nginx | 32 KB |
| Bot check | Turnstile → session cookie | Required for every session |
| Messages per session | backend | 30 |
| Messages per IP | backend | 60/hour, 150/day |
| Message length | backend | 2,000 characters |
| Conversation length | backend | 30 turns, or a token ceiling, whichever comes first |
| Reply length | backend | Max output tokens per reply (set per model) |
| Simultaneous replies | backend | 8 at once; extras get `unavailable` ("busy, try again") |
| Daily budget | backend | `$X/day`. Each reply's actual token and search usage × price table is added to a daily total; past the cap, status becomes `closed_for_today` until midnight (VM timezone, configurable). |
| Off switch | backend | `touch /etc/thehumanoption/OFF` closes the piece at once; delete the file to reopen. No restart needed. |

Conversations and sessions are deleted after they've been idle for 24 hours.

**Visitor IPs.** The backend reads the visitor IP from nginx's `X-Real-IP` header. That header is set by our nginx and can't be faked from outside. If Cloudflare is put in front later, nginx needs `real_ip` configuration for Cloudflare's address ranges. Otherwise every visitor looks like the same few IPs and the per-IP limits break. (DDoS / Cloudflare proxy is out of scope for this plan.)

---

## 7. Frontend page

- **`src/pages/thehumanoption.astro`.** Whether it uses `SiteLayout` (site nav and footer) or is standalone with its own look is decision D6.
- **Plain JavaScript, no framework.** It handles:
  - loading Turnstile (`challenges.cloudflare.com/turnstile/v0/api.js`, invisible or managed mode)
  - the session exchange
  - reading the SSE stream with `fetch` + a stream reader (EventSource can't POST)
- **Rendering replies.** Text is rendered either as plain text with line breaks, or as limited markdown (bold, italics, links, lists) with HTML stripped. See decision D7. Links open in a new tab with `rel="noopener noreferrer"`.
- **Images.** Lazy-loaded thumbnails. Each has a credit line and license link, and clicking it goes to the source page.
- **States to design:**
  - first load / closed / off
  - waiting for the first reply text
  - streaming
  - each error code from §4
  - the conversation ending
  - mobile at 450px and below (site convention: `*_mobile.css` via `media="screen and (max-width: 450px)"`)
- **Turnstile site key** is public and goes in the page. The secret stays on the server.

---

## 8. Saving conversations later (not built now)

The design already keeps whole conversations server-side in SQLite. Turning on saving means:

1. Stop deleting idle conversations; export them to a separate table or file instead.
2. Add a visible notice on the page, and possibly a consent checkbox.
3. Decide on retention and on whether IPs are stored alongside transcripts. Recommended: don't store them.

No framework change is needed.

---

## 9. Server setup (Google VM)

1. **Python.** Install Python 3.12+ and `uv` (or `python3-venv`).
2. **Service user and folders.**
   - System user `thehumanoption`, with no login shell.
   - App folder `/opt/thehumanoption`, owned by the deploy user and readable by the service.
   - Data folder `/var/lib/thehumanoption` for the SQLite file, owned by `thehumanoption`.
3. **Config folder `/etc/thehumanoption/`**, owned by root, group `thehumanoption`, mode 750. It holds:
   - **`env`** (mode 640). Contents:
     - `ANTHROPIC_API_KEY`
     - `OPENAI_API_KEY`
     - `TURNSTILE_SECRET`
     - `SESSION_SIGNING_KEY` (random 32 bytes)
     - `OPENVERSE_CLIENT_ID` / `OPENVERSE_CLIENT_SECRET`
     - `DAILY_BUDGET_USD`
     - model IDs
     - the limit values from §6
   - **`prompt.md`** (mode 640), the real prompt.
4. **systemd unit `thehumanoption.service`.**
   - Runs `uvicorn app.main:app --host 127.0.0.1 --port 8787 --workers 1`.
   - `EnvironmentFile=/etc/thehumanoption/env`.
   - `User=thehumanoption`, `Restart=on-failure`.
   - Hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`, `ReadWritePaths=/var/lib/thehumanoption`, `PrivateTmp`.
   - Runs one worker, so the concurrency cap and in-memory counters stay correct.
5. **Firewall.** Nothing new to open. Port 8787 stays bound to localhost, and the GCP firewall still allows only 80/443.
6. **Cloudflare dashboard.** Create a Turnstile widget for hostname `xdd44.xyz` (add `localhost` for development) and get the site key and secret.
7. **Spend caps.** Set monthly spend limits in the Anthropic Console and the OpenAI dashboard.

---

## 10. nginx changes (`nginx_default.conf`)

At the top of the file (http context, next to `ssl_session_cache`):

```nginx
limit_req_zone  $binary_remote_addr zone=chat_req:10m  rate=10r/m;
limit_conn_zone $binary_remote_addr zone=chat_conn:10m;
```

Inside the `server { listen 443 ... }` block, before `location /`:

```nginx
location ^~ /api/chat {
    limit_req  zone=chat_req burst=5 nodelay;
    limit_conn chat_conn 3;
    limit_req_status  429;
    limit_conn_status 429;
    client_max_body_size 32k;

    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection        "";

    # streaming replies
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    add_header X-Accel-Buffering no;
}
```

- `^~` makes this block win over the existing `\.(css|js|...)$` regex block.
- `/api/chat` doesn't match any of the existing `.html`/`index` redirect rules.
- The browser treats nginx's 429 responses the same as the backend's `rate_limited` error.

---

## 11. Deployment

- **Site (unchanged).** The existing workflow builds Astro and rsyncs `dist/`. The new page ships with it automatically.
- **Backend (new job in `.github/workflows/deploy.yml`).** It runs only when `server/thehumanoption/**` changes:
  1. rsync `server/thehumanoption/` to `/opt/thehumanoption/`, excluding `.venv`, caches and any local `prompt.md`.
  2. Over SSH, `uv sync --frozen` in `/opt/thehumanoption`.
  3. `sudo systemctl restart thehumanoption`, allowed through a sudoers rule limited to exactly that command.
  4. Check `https://xdd44.xyz/api/chat/status` returns 200.
- **Deploy login.** Today's deploy login uploads straight into the site folder, and `--delete` would wipe anything else placed there. The backend upload needs either a second deploy key restricted to `/opt/thehumanoption`, or the existing login widened. Your setup call.
- **Prompt and secrets are never deployed from CI.** They're edited on the VM directly, then the service is restarted.

---

## 12. Local development

- **Backend:** `cd server/thehumanoption && uv run uvicorn app.main:app --reload --port 8787`.
  - Uses a local `.env` (gitignored) and a local `prompt.md` (gitignored).
  - Uses Cloudflare's Turnstile **test keys**, which always pass, so no real widget is needed.
- **Site:** `npm run dev`. Add a Vite dev proxy in `astro.config.mjs` (`vite.server.proxy['/api'] → http://127.0.0.1:8787`) so the page talks to the local backend at the same path it uses in production.
- **`.gitignore`:** add `server/thehumanoption/.env`, `server/thehumanoption/prompt.md`, `server/thehumanoption/.venv/`, `*.sqlite`.

---

## 13. Build order

1. **Backend core.** Session and Turnstile (test keys), conversation store, streaming chat with Claude → OpenAI fallback, no tools. All limits, the daily budget and the off switch.
2. **Page.** `/thehumanoption` with streaming, every state from §7, and the dev proxy.
3. **Tools.** Web search and fetch, `find_images`, `calculate`, and the status events.
4. **Server.** VM setup (§9), nginx (§10), first manual deploy, real Turnstile keys, spend caps.
5. **CI.** Automate the backend deploy (§11).
6. **Later.** Transcript saving (§8), Cloudflare proxy + `real_ip`, a provider-run code sandbox.

---

## 14. Open decisions

| # | Decision | Notes |
|---|---|---|
| D1 | Which Claude and OpenAI models | Per 1M tokens in/out: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50. Sets the cost per reply. |
| D2 | Limit values and daily budget in §6 | The defaults are placeholders. |
| D3 | Session length and conversation length | Defaults: 30 turns, 24h idle expiry. |
| D4 | How much the page reveals about what the agent is doing | Generic status labels, or none at all. Each label hints at the setup. |
| D5 | Whether to signal when a reply came from the fallback model | Default: no. |
| D6 | Page shell | Site nav and footer (`SiteLayout`), or a standalone full-screen piece. |
| D7 | Reply formatting | Plain text, or limited markdown. |
| D8 | Backend deploy access | Second restricted key vs widening the existing deploy login (§11). |
| D9 | Backend tests | The repo has no test setup today. Should a small pytest suite for limits, sessions and the budget be added with the backend? |
